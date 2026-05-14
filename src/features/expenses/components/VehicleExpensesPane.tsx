import { useCallback, useEffect, useState, useRef } from "react";
import {
  Calculator,
  Plus,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import {
  fetchVehicleExpenses,
  createVehicleExpense,
  updateVehicleExpense,
  deleteVehicleExpense,
  type Vehicle,
  type ExpenseItem,
} from "../../vehicles/api";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

function Field({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function formatDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div
        className={`flex max-h-[90vh] w-full ${maxWidth} flex-col rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const CATEGORIES = [
  "Fuel",
  "Maintenance",
  "Insurance",
  "Toll",
  "Parking",
  "Repair",
  "Food",
  "Cleaning",
  "Fine",
  "Tax & Permit",
  "Other",
];

function VehicleExpenseFormModal({
  vehicleId,
  expense,
  onClose,
  onSaved,
}: {
  vehicleId: string;
  expense?: ExpenseItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isUpdate = !!expense;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    category: expense?.category ?? "Fuel",
    amount: expense?.amount?.toString() ?? "",
    date: expense?.date
      ? expense.date.split("T")[0]
      : new Date().toISOString().split("T")[0],
    vendor: expense?.vendor ?? "",
    description: expense?.description ?? expense?.notes ?? "",
  });

  const set =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        category: form.category.toLowerCase(),
        amount: parseFloat(form.amount),
        date: form.date,
        vendor: form.vendor.trim() || undefined,
        description: form.description.trim() || "",
      };

      if (isUpdate && expense) {
        await updateVehicleExpense(vehicleId, expense._id, payload);
      } else {
        await createVehicleExpense(vehicleId, payload);
      }

      onSaved();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(msg ?? "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isUpdate ? "Edit Expense" : "Add Expense"}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <form onSubmit={submit} className="space-y-4 p-6">
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <Field label="Category" id="vec-cat" required>
          <select
            id="vec-cat"
            value={form.category}
            onChange={set("category")}
            className={inputCls}
            required
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Amount (₹)" id="vec-amt" required>
          <input
            id="vec-amt"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={set("amount")}
            required
            className={inputCls}
            placeholder="0.00"
          />
        </Field>

        <Field label="Date" id="vec-dte" required>
          <input
            id="vec-dte"
            type="date"
            value={form.date}
            onChange={set("date")}
            required
            className={inputCls}
          />
        </Field>

        <Field label="Vendor (Optional)" id="vec-vend">
          <input
            id="vec-vend"
            value={form.vendor}
            onChange={set("vendor")}
            className={inputCls}
            placeholder="Vendor name"
          />
        </Field>

        <Field label="Description" id="vec-desc" required>
          <textarea
            id="vec-desc"
            rows={2}
            value={form.description}
            onChange={set("description")}
            className={`${inputCls} resize-none`}
            placeholder="Details about this expense..."
            required
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : isUpdate ? "Update" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/** Per-vehicle expense list and CRUD (same data as former Trip Details → Vehicle Expenses tab). */
export function VehicleExpensesPane({ vehicle }: { vehicle: Vehicle }) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expenseModal, setExpenseModal] = useState<
    "add" | { edit: ExpenseItem } | null
  >(null);
  const [deleteModal, setDeleteModal] = useState<ExpenseItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchExpenses = useCallback(() => {
    setLoading(true);
    fetchVehicleExpenses(vehicle._id)
      .then(setExpenses)
      .catch(() => setError("Failed to load expenses"))
      .finally(() => setLoading(false));
  }, [vehicle._id]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const total = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await deleteVehicleExpense(vehicle._id, deleteModal._id);
      fetchExpenses();
    } catch {
      alert("Failed to delete expense");
    } finally {
      setDeleting(false);
      setDeleteModal(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:gap-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total expenses
            </p>
            <p className="text-lg font-bold text-slate-800">
              ₹{total.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpenseModal("add")}
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" /> Add expense
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {error && (
          <p className="border-b border-red-100 bg-red-50 py-2 text-center text-xs text-red-500">
            {error}
          </p>
        )}
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No expenses recorded</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr
                    key={e._id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(e.date)}
                    </td>
                    <td className="px-4 py-3 font-medium capitalize text-slate-700">
                      {e.category ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {e.vendor ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {e.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {e.amount != null
                        ? `₹${e.amount.toLocaleString("en-IN")}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpenseModal({ edit: e })}
                          className="p-1 text-blue-500 hover:text-blue-700"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModal(e)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {expenseModal && (
        <VehicleExpenseFormModal
          vehicleId={vehicle._id}
          expense={expenseModal === "add" ? null : expenseModal.edit}
          onClose={() => setExpenseModal(null)}
          onSaved={() => {
            setExpenseModal(null);
            fetchExpenses();
          }}
        />
      )}

      {deleteModal && (
        <ModalShell
          title="Delete Expense"
          onClose={() => setDeleteModal(null)}
          maxWidth="max-w-sm"
        >
          <div className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 h-6 w-6 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Delete this expense?
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
