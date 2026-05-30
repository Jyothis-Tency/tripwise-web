import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  fetchDrivers,
  createDriver,
  type Driver,
} from "../features/drivers/api";
import {
  driverDisplayName,
  formatDriverLabel,
  splitDriverFullName,
} from "../lib/driverDisplay";

const DRIVER_INPUT_CLS =
  "w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 bg-white transition";

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div
        className={`w-full ${maxWidth} flex max-h-[90vh] flex-col rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function CreateDriverModal({
  onClose,
  onCreated,
  initialName = "",
}: {
  onClose: () => void;
  onCreated: (d: Driver) => void;
  initialName?: string;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      setErr("Driver name is required");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setErr("Phone number must be exactly 10 digits");
      return;
    }
    const { firstName, lastName } = splitDriverFullName(trimmed);
    if (!firstName) {
      setErr("Driver name is required");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const driver = await createDriver({
        firstName: firstName.toUpperCase(),
        lastName: (lastName || "").toUpperCase(),
        email: `bulk.${digits}@tripwise.com`,
        phone: digits,
        place: "N/A",
      });
      onCreated(driver);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setErr(msg ?? "Failed to create driver");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Create New Driver" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4 p-6">
        <p className="text-xs text-slate-500">
          New drivers appear in Drivers and Cash In / Out for salary and bulk
          advance.
        </p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">
            Driver name <span className="text-red-500">*</span>
          </label>
          <input
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setErr(null);
            }}
            placeholder="e.g. John Doe"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">
            Phone number <span className="text-red-500">*</span>
          </label>
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
              setErr(null);
            }}
            placeholder="9876543210"
            type="tel"
            inputMode="numeric"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export type DriverNameComboboxProps = {
  id?: string;
  value: string;
  onChange: (name: string) => void;
  onDriverSelect?: (driver: Driver) => void;
  selectedDriverId?: string;
  inputClassName?: string;
  className?: string;
  required?: boolean;
  placeholder?: string;
  extraSuggestionNames?: string[];
};

/**
 * Driver name field backed by owner drivers (`GET/POST /owners/drivers`),
 * with optional in-place create (phone required for new drivers).
 */
export function DriverNameCombobox({
  id,
  value,
  onChange,
  onDriverSelect,
  selectedDriverId,
  inputClassName,
  className = "",
  required,
  placeholder = "Driver name",
  extraSuggestionNames = [],
}: DriverNameComboboxProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState("");

  const reload = useCallback(async () => {
    try {
      const { drivers: list } = await fetchDrivers({ page: 1, limit: 500 });
      setDrivers(list);
    } catch {
      /* keep typed value usable */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const suggestionPool = useMemo(() => {
    const byId = new Map<string, Driver>();
    for (const d of drivers) {
      const key = d._id ?? d.id;
      if (key) byId.set(key, d);
    }
    for (const ex of extraSuggestionNames) {
      const n = ex?.trim();
      if (!n) continue;
      const match = drivers.some(
        (d) => driverDisplayName(d).toLowerCase() === n.toLowerCase(),
      );
      if (!match) {
        const { firstName, lastName } = splitDriverFullName(n);
        byId.set(`legacy:${n.toLowerCase()}`, {
          _id: `legacy:${n.toLowerCase()}`,
          firstName,
          lastName,
          email: "",
          phone: "",
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      formatDriverLabel(a).localeCompare(formatDriverLabel(b)),
    );
  }, [drivers, extraSuggestionNames]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestionPool.slice(0, 12);
    return suggestionPool
      .filter((d) => {
        const label = formatDriverLabel(d).toLowerCase();
        const name = driverDisplayName(d).toLowerCase();
        const phone = (d.phone ?? "").toLowerCase();
        return label.includes(q) || name.includes(q) || phone.includes(q);
      })
      .slice(0, 12);
  }, [suggestionPool, value]);

  const exactMatch = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return false;
    return suggestionPool.some(
      (d) =>
        driverDisplayName(d).trim().toLowerCase() === q &&
        (!selectedDriverId ||
          (d._id ?? d.id) === selectedDriverId ||
          String(d._id ?? d.id).startsWith("legacy:")),
    );
  }, [suggestionPool, value, selectedDriverId]);

  const openCreate = (preset: string) => {
    setCreatePreset(preset);
    setCreateOpen(true);
    setShowSuggestions(false);
  };

  const pickDriver = (driver: Driver) => {
    onChange(driverDisplayName(driver));
    onDriverSelect?.(driver);
    setShowSuggestions(false);
  };

  const panelVisible =
    showSuggestions && (filtered.length > 0 || (!!value.trim() && !exactMatch));

  const inputCls = inputClassName ?? DRIVER_INPUT_CLS;

  return (
    <>
      <div className={`relative ${className}`}>
        <input
          id={id}
          required={required}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          autoComplete="off"
          className={inputCls}
          placeholder={placeholder}
        />
        {panelVisible && (
          <div className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {filtered.map((driver) => {
              const key = driver._id ?? driver.id ?? driverDisplayName(driver);
              const label = formatDriverLabel(driver);
              const isSelected =
                selectedDriverId &&
                (driver._id ?? driver.id) === selectedDriverId;
              return (
                <button
                  key={key}
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${isSelected ? "bg-blue-50 font-medium text-blue-800" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickDriver(driver);
                  }}
                >
                  {label}
                </button>
              );
            })}
            {value.trim() && !exactMatch && (
              <button
                type="button"
                className="w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  openCreate(value.trim());
                }}
              >
                + Create driver &quot;{value.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>
      {createOpen && (
        <CreateDriverModal
          initialName={createPreset}
          onClose={() => setCreateOpen(false)}
          onCreated={async (d) => {
            pickDriver(d);
            setCreateOpen(false);
            await reload();
          }}
        />
      )}
    </>
  );
}
