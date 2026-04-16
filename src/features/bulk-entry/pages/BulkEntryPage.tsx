import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Plus,
  Trash2,
  ArrowLeft,
  ChevronDown,
  FileSpreadsheet,
  Building2,
  X,
  RefreshCw,
  Loader2,
  Cloud,
  CloudOff,
  Copy,
  CheckCircle,
  Wallet,
  FileDown,
} from "lucide-react";
import jsPDF from "jspdf";
import { useAuth } from "../../../hooks/useAuth";
import {
  fetchAgencies,
  createAgency,
  fetchBulkEntryTrips,
  fetchNormalEntryTrips,
  deleteBulkEntryTrip,
  deleteNormalEntryTrip,
  syncBulkEntry,
  syncNormalEntry,
  fetchAgencyPayoutSummary,
  addAgencyPayoutPayment,
  deletePayoutPayment,
  fetchDriverPayoutSummary,
  addDriverPayoutPayment,
  type Agency,
  type DriverGroup,
  type BulkTripRow,
  type NormalEntryRow,
  type AgencyTrip,
  type AgencyPayoutSummary,
  type DriverPayoutSummary,
  type PayoutPayment,
} from "../api";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

let _rowCounter = 0;
function nextRowId() {
  return `r_${Date.now()}_${++_rowCounter}`;
}

function emptyBulkRow(): BulkTripRow {
  return {
    clientRowId: nextRowId(),
    startDate: "",
    endDate: "",
    startKm: "",
    endKm: "",
    startTime: "",
    endTime: "",
    distance: 0,
    hours: 0,
    toll: 0,
    advancePaid: 0,
    grandTotal: 0,
    notes: "",
  };
}

function emptyDriverGroup(): DriverGroup {
  return {
    driverName: "",
    vehicleNumber: "",
    rows: [emptyBulkRow()],
  };
}

function normalizeBulkGroups(groups: any[]): DriverGroup[] {
  return (groups || []).map((group) => {
    const fallbackAdvance = Number(group?.advancePaid) || 0;
    const rows = Array.isArray(group?.rows) ? group.rows : [];
    return {
      driverName: group?.driverName || "",
      vehicleNumber: group?.vehicleNumber || "",
      rows: rows.length
        ? rows.map((row: any, idx: number) => ({
            ...emptyBulkRow(),
            ...row,
            advancePaid:
              row?.advancePaid !== undefined
                ? Number(row.advancePaid) || 0
                : idx === 0
                  ? fallbackAdvance
                  : 0,
          }))
        : [emptyBulkRow()],
    };
  });
}

function emptyNormalRow(): NormalEntryRow {
  return {
    clientRowId: nextRowId(),
    date: "",
    driverName: "",
    mobileNumber: "",
    vehicleNumber: "",
    vehicleType: "",
    notes: "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOSAVE ENGINE — Excel-like dual-layer persistence
// ═══════════════════════════════════════════════════════════════════════════════

type SyncStatus = "idle" | "saving" | "saved" | "error";

const LS_BULK_PREFIX = "tripwise_bulk_";
const LS_NORMAL_PREFIX = "tripwise_normal_";
const LS_SELECTED_AGENCY = "tripwise_bulk_selected_agency";
const LS_ENTRY_MODE = "tripwise_bulk_entry_mode"; // 'bulk' | 'normal'
const AUTOSAVE_DELAY = 800; // ms after last keystroke

// Mirror of backend AgencyTrip.calculateBalance (non-negative balance)
function calculateBalanceAmount(
  grandTotal: number,
  advancePaid: number,
): number {
  const gt =
    typeof grandTotal === "number"
      ? grandTotal
      : parseFloat(String(grandTotal)) || 0;
  const adv =
    typeof advancePaid === "number"
      ? advancePaid
      : parseFloat(String(advancePaid)) || 0;
  return Math.max(gt - adv, 0);
}

/** Simple hash for fast equality check */
function quickHash(s: string): string {
  if (!s) return "empty";
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return `${s.length}_${h}`;
}

function useAutosave<T>(
  key: string | null,
  data: T,
  serialize: (d: T) => string,
  onBackendSync: (d: T) => Promise<void>,
) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const lastLocalHash = useRef<string>("");
  const lastBackendHash = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset hashes when key changes
  useEffect(() => {
    lastLocalHash.current = "";
    lastBackendHash.current = "";
    setStatus("idle");
  }, [key]);

  // Main autosave effect
  useEffect(() => {
    if (!key) return;

    const json = serialize(data);
    const hash = quickHash(json);

    // 1. Instant localStorage persistence
    if (hash !== lastLocalHash.current) {
      try {
        localStorage.setItem(key, json);
      } catch {
        /* quota exceeded */
      }
      lastLocalHash.current = hash;
    }

    // 2. Debounced backend sync
    if (timerRef.current) clearTimeout(timerRef.current);

    if (hash !== lastBackendHash.current) {
      timerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        setStatus("saving");
        try {
          await onBackendSync(dataRef.current);
          if (mountedRef.current) {
            lastBackendHash.current = quickHash(serialize(dataRef.current));
            setStatus("saved");
            // Fade back to idle after 2s
            setTimeout(() => {
              if (mountedRef.current) setStatus("idle");
            }, 2000);
          }
        } catch {
          if (mountedRef.current) {
            setStatus("error");
            // Retry on next edit by not updating backend hash
          }
        }
      }, AUTOSAVE_DELAY);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, data, serialize, onBackendSync]);

  return status;
}

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* corrupted */
  }
  return fallback;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;
  const cfg = {
    saving: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: "Saving…",
      cls: "text-amber-600 bg-amber-50 border-amber-200",
    },
    saved: {
      icon: <Cloud className="h-4 w-4" />,
      text: "Saved",
      cls: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    error: {
      icon: <CloudOff className="h-4 w-4" />,
      text: "Offline",
      cls: "text-red-600 bg-red-50 border-red-200",
    },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${cfg.cls} transition-all`}
    >
      {cfg.icon} {cfg.text}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL SHELL
// ═══════════════════════════════════════════════════════════════════════════════

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF REPORT GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

const INR = (v: number) => `Rs. ${v.toLocaleString("en-IN")}`;
const fmtDate = (d: string | Date | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

function drawPDFHeader(
  doc: jsPDF,
  title: string,
  ownerName: string,
  y: number,
): number {
  const pw = doc.internal.pageSize.getWidth();

  // Generation Date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated: ${fmtDate(new Date())}`, pw - 20, 20, {
    align: "right",
  });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(title, 20, y + 35);

  // Owner Name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Owner: ${ownerName}`, 20, y + 43);

  return y + 53;
}

function drawSummaryRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  bold = false,
) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text(label, 20, y);
  doc.setFont("helvetica", "bold");
  doc.text(value, pw - 20, y, { align: "right" });
  return y + 8;
}

function drawPaymentTable(
  doc: jsPDF,
  payments: PayoutPayment[],
  y: number,
): number {
  const pw = doc.internal.pageSize.getWidth();
  if (payments.length === 0) return y;

  // Table header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(20, y - 5, pw - 40, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("#", 25, y + 2);
  doc.text("DATE", 38, y + 2);
  doc.text("METHOD", 95, y + 2);
  doc.text("NOTES", 135, y + 2);
  doc.text("AMOUNT", pw - 25, y + 2, { align: "right" });
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  payments.forEach((p, i) => {
    // Page break if near bottom
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 20;
    }
    // Alternate row bg
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(20, y - 5, pw - 40, 9, "F");
    }
    doc.setTextColor(51, 65, 85);
    doc.text(String(i + 1), 25, y + 1);
    doc.text(fmtDate(p.paymentDate), 38, y + 1);
    doc.text((p.paymentMethod || "cash").replace("_", " "), 95, y + 1);
    doc.text((p.notes || "—").substring(0, 25), 135, y + 1);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(INR(p.amount), pw - 25, y + 1, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 9;
  });

  return y;
}

function drawFooter(doc: jsPDF) {
  const ph = doc.internal.pageSize.getHeight();
  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(226, 232, 240);
  doc.line(20, ph - 18, pw - 20, ph - 18);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "This is a computer-generated document. No signature required.",
    pw / 2,
    ph - 10,
    { align: "center" },
  );
}

function generateAgencyPayoutPDF(
  ownerName: string,
  agencyName: string,
  data: AgencyPayoutSummary,
) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = drawPDFHeader(doc, `Agency Payout Report`, ownerName, 0);

  // Agency name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129);
  doc.text(`Agency: ${agencyName}`, 20, y);
  y += 14;

  // Separator
  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(226, 232, 240);
  doc.line(20, y - 4, pw - 20, y - 4);

  // Summary
  y = drawSummaryRow(doc, "Grand Total", INR(data.grandTotal), y, true);
  y = drawSummaryRow(doc, "Total Received", INR(data.totalReceived), y);
  y = drawSummaryRow(doc, "Remaining Balance", INR(data.remaining), y, true);
  y += 6;

  // Status
  const status =
    data.remaining <= 0
      ? "FULLY PAID"
      : data.totalReceived > 0
        ? "PARTIALLY PAID"
        : "UNPAID";
  const statusColor: [number, number, number] =
    data.remaining <= 0
      ? [16, 185, 129]
      : data.totalReceived > 0
        ? [245, 158, 11]
        : [239, 68, 68];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...statusColor);
  doc.text(`Status: ${status}`, 20, y);
  y += 14;

  // Payments table
  if (data.payments.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("Payment History", 20, y);
    y += 8;
    y = drawPaymentTable(doc, data.payments, y);
  }

  drawFooter(doc);
  doc.save(
    `Payout_${agencyName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
  );
}

function generateDriverPayoutPDF(
  ownerName: string,
  agencyName: string,
  driverName: string,
  data: DriverPayoutSummary,
) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = drawPDFHeader(doc, `Driver Payout Report`, ownerName, 0);

  // Agency + Driver
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129);
  doc.text(`Agency: ${agencyName}`, 20, y);
  y += 8;
  doc.setTextColor(30, 41, 59);
  doc.text(`Driver: ${driverName}`, 20, y);
  y += 14;

  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(226, 232, 240);
  doc.line(20, y - 4, pw - 20, y - 4);

  // Summary
  y = drawSummaryRow(
    doc,
    "Total Driver Salary (Advance)",
    INR(data.totalAdvance),
    y,
    true,
  );
  y = drawSummaryRow(doc, "Total Paid", INR(data.totalPaid), y);
  y = drawSummaryRow(doc, "Remaining to Pay", INR(data.remaining), y, true);
  y += 6;

  const status =
    data.remaining <= 0
      ? "FULLY PAID"
      : data.totalPaid > 0
        ? "PARTIALLY PAID"
        : "UNPAID";
  const statusColor: [number, number, number] =
    data.remaining <= 0
      ? [16, 185, 129]
      : data.totalPaid > 0
        ? [245, 158, 11]
        : [239, 68, 68];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...statusColor);
  doc.text(`Status: ${status}`, 20, y);
  y += 14;

  if (data.payments.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("Payment History", 20, y);
    y += 8;
    y = drawPaymentTable(doc, data.payments, y);
  }

  drawFooter(doc);
  doc.save(
    `DriverPayout_${driverName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
  );
}

function generateBulkTripsPDF(
  ownerName: string,
  agencyName: string,
  fileName: string,
  groups: DriverGroup[],
) {
  const doc = new jsPDF("l", "mm", "a4"); // 'l' for landscape
  let y = drawPDFHeader(doc, `Bulk Trips Report`, ownerName, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129);
  doc.text(`Agency: ${agencyName}`, 20, y);
  y += 14;

  const pw = doc.internal.pageSize.getWidth();

  const validGroups = groups.filter((g) => g.rows.length > 0);

  if (validGroups.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("No trips recorded.", 20, y);
    drawFooter(doc);
    doc.save(fileName);
    return;
  }

  validGroups.forEach((g) => {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(241, 245, 249);
    doc.rect(20, y - 5, pw - 40, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(
      `Driver: ${g.driverName || "Unknown"}  |  Vehicle: ${g.vehicleNumber || "Unknown"}`,
      25,
      y + 2,
    );

    y += 12;

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text("START DATE", 22, y);
    doc.text("START TIME", 45, y);
    doc.text("END DATE", 68, y);
    doc.text("END TIME", 90, y);
    doc.text("START KM", 110, y);
    doc.text("END KM", 130, y);
    doc.text("DIST", 150, y);
    doc.text("HOURS", 165, y);
    doc.text("TOLL", 180, y);
    doc.text("NOTES", 195, y);
    doc.text("TOTAL", pw - 20, y, { align: "right" });
    y += 6;

    let groupGrandTotal = 0;

    g.rows.forEach((r) => {
      groupGrandTotal += r.grandTotal || 0;
      if (y > doc.internal.pageSize.getHeight() - 25) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      doc.text(fmtDate(r.startDate), 22, y);
      doc.text(r.startTime || "—", 45, y);
      doc.text(fmtDate(r.endDate), 68, y);
      doc.text(r.endTime || "—", 90, y);

      doc.text(String(r.startKm || "—"), 110, y);
      doc.text(String(r.endKm || "—"), 130, y);
      doc.text(`${r.distance || 0} km`, 150, y);
      doc.text(`${r.hours || 0} hr`, 165, y);
      doc.text(INR(r.toll || 0), 180, y);
      doc.text((r.notes || "").substring(0, 35), 195, y);

      // Total column
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text(INR(r.grandTotal || 0), pw - 20, y, { align: "right" });

      y += 8;
    });

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total: ${INR(groupGrandTotal)}`, pw - 20, y, { align: "right" });

    y += 18;
  });

  drawFooter(doc);
  doc.save(fileName);
}

function generateNormalTripsPDF(
  ownerName: string,
  agencyName: string,
  fileName: string,
  entries: NormalEntryRow[],
) {
  const doc = new jsPDF("l", "mm", "a4"); // landscape
  let y = drawPDFHeader(doc, `Normal Trips Report`, ownerName, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129);
  doc.text(`Agency: ${agencyName}`, 20, y);
  y += 14;

  const pw = doc.internal.pageSize.getWidth();

  if (entries.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("No entries recorded.", 20, y);
    drawFooter(doc);
    doc.save(fileName);
    return;
  }

  doc.setFillColor(241, 245, 249);
  doc.rect(20, y - 5, pw - 40, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);

  doc.text("DATE", 25, y + 2);
  doc.text("DRIVER", 50, y + 2);
  doc.text("MOBILE", 90, y + 2);
  doc.text("VEHICLE", 125, y + 2);
  doc.text("TYPE", 155, y + 2);
  doc.text("NOTES", 185, y + 2);

  y += 12;

  entries.forEach((r, i) => {
    if (y > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      y = 20;
    }

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, y - 5, pw - 40, 9, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    doc.text(fmtDate(r.date), 25, y);
    doc.text((r.driverName || "—").substring(0, 20), 50, y);
    doc.text(r.mobileNumber || "—", 90, y);
    doc.text((r.vehicleNumber || "—").substring(0, 15), 125, y);
    doc.text((r.vehicleType || "—").substring(0, 15), 155, y);
    doc.text((r.notes || "").substring(0, 45), 185, y);

    y += 9;
  });

  drawFooter(doc);
  doc.save(fileName);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENCY PAYOUT TAB
// ═══════════════════════════════════════════════════════════════════════════════

function AgencyPayoutTab({
  agencyId,
  agencyName,
}: {
  agencyId: string;
  agencyName: string;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<AgencyPayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAgencyPayoutSummary(agencyId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setErr("Enter a valid amount");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await addAgencyPayoutPayment(agencyId, {
        amount: amt,
        paymentDate,
        paymentMethod,
        notes,
      });
      setAmount("");
      setNotes("");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed to add payment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Delete this payment record?")) return;
    try {
      await deletePayoutPayment(paymentId);
      await load();
    } catch {
      alert("Failed to delete");
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );

  const gt = data?.grandTotal ?? 0;
  const received = data?.totalReceived ?? 0;
  const remaining = data?.remaining ?? 0;
  const pct = gt > 0 ? Math.min((received / gt) * 100, 100) : 0;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Grand Total",
            value: gt,
            color: "text-slate-800",
            bg: "bg-slate-50 border-slate-200",
          },
          {
            label: "Received",
            value: received,
            color: "text-emerald-700",
            bg: "bg-emerald-50 border-emerald-200",
          },
          {
            label: "Remaining",
            value: remaining,
            color: remaining > 0 ? "text-amber-700" : "text-slate-400",
            bg:
              remaining > 0
                ? "bg-amber-50 border-amber-200"
                : "bg-slate-50 border-slate-200",
          },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.bg}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {c.label}
            </div>
            <div className={`text-lg font-bold ${c.color}`}>
              ₹{c.value.toLocaleString("en-IN")}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {gt > 0 && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Payment Progress</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Add payment form */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-slate-700">
          Record Payment Received
        </h4>
        {err && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
            {err}
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
              Amount (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
              Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
              Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
              Notes
            </label>
            <input
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {saving ? "Adding…" : "Add Payment"}
        </button>
      </div>

      {/* Payment history */}
      <div>
        <h4 className="text-sm font-semibold text-slate-600 mb-2">
          Payment History ({data?.payments?.length ?? 0})
        </h4>
        {!data?.payments?.length ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No payments recorded yet
          </p>
        ) : (
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div
                key={p._id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-600 text-sm">
                      ₹{p.amount.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded capitalize">
                      {p.paymentMethod?.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {p.paymentDate
                      ? new Date(p.paymentDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                    {p.notes && <span className="ml-2 italic">{p.notes}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(p._id)}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Download PDF */}
      {data && (
        <button
          onClick={() =>
            generateAgencyPayoutPDF(user?.name || "Owner", agencyName, data)
          }
          className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition w-full justify-center"
        >
          <FileDown className="h-4 w-4" /> Download Agency Report (PDF)
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER PAYOUT PANEL (inside each DriverGroup card)
// ═══════════════════════════════════════════════════════════════════════════════

function DriverPayoutPanel({
  agencyId,
  driverName,
  agencyName,
}: {
  agencyId: string;
  driverName: string;
  agencyName: string;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<DriverPayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driverName.trim()) return;
    setLoading(true);
    try {
      setData(await fetchDriverPayoutSummary(agencyId, driverName));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agencyId, driverName]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setErr("Enter a valid amount");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await addDriverPayoutPayment(agencyId, {
        driverName,
        amount: amt,
        paymentDate,
        paymentMethod,
        notes,
      });
      setAmount("");
      setNotes("");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Delete this payment?")) return;
    try {
      await deletePayoutPayment(paymentId);
      await load();
    } catch {
      alert("Failed to delete");
    }
  };

  if (!driverName.trim())
    return (
      <p className="text-xs text-slate-400 px-4 py-3">
        Enter driver name first
      </p>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
      </div>
    );

  const total = data?.totalAdvance ?? 0;
  const paid = data?.totalPaid ?? 0;
  const remaining = data?.remaining ?? 0;

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Advance Owed", val: total, cls: "text-slate-700" },
          { label: "Paid", val: paid, cls: "text-emerald-700" },
          {
            label: "Remaining",
            val: remaining,
            cls: remaining > 0 ? "text-amber-700" : "text-slate-400",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"
          >
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {c.label}
            </div>
            <div className={`text-sm font-bold ${c.cls}`}>
              ₹{c.val.toLocaleString("en-IN")}
            </div>
          </div>
        ))}
      </div>

      {/* Add payment */}
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 min-w-[80px] rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
        />
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
        />
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="online">Online</option>
          <option value="other">Other</option>
        </select>
        <input
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 min-w-[80px] rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
        />
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {saving ? "…" : "Pay"}
        </button>
      </div>

      {/* History */}
      {(data?.payments?.length ?? 0) > 0 && (
        <div className="space-y-1.5">
          {data!.payments.map((p) => (
            <div
              key={p._id}
              className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2"
            >
              <span className="font-semibold text-emerald-600 text-xs">
                ₹{p.amount.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 flex-1">
                {p.paymentDate
                  ? new Date(p.paymentDate).toLocaleDateString("en-IN")
                  : ""}
                {p.notes && ` · ${p.notes}`}
              </span>
              <button
                onClick={() => handleDelete(p._id)}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Download PDF */}
      {data && total > 0 && (
        <button
          onClick={() =>
            generateDriverPayoutPDF(
              user?.name || "Owner",
              agencyName,
              driverName,
              data,
            )
          }
          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition w-full justify-center"
        >
          <FileDown className="h-3.5 w-3.5" /> Download Report
        </button>
      )}
    </div>
  );
}

function CreateAgencyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (a: Agency) => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setErr("Agency name is required");
      return;
    }
    setSubmitting(true);
    try {
      const agency = await createAgency(name.trim());
      onCreated(agency);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed to create agency");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Create New Agency" onClose={onClose} maxWidth="max-w-sm">
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">
            Agency Name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErr(null);
            }}
            placeholder="Enter agency name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
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
            className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CELL INPUT — Memoised to prevent re-rendering sibling cells
// ═══════════════════════════════════════════════════════════════════════════════

const CellInput = memo(function CellInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  const [localVal, setLocalVal] = useState(value);
  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  return (
    <input
      value={localVal}
      onChange={(e) => {
        setLocalVal(e.target.value);
        onChange(e.target.value);
      }}
      type={type}
      placeholder={placeholder}
      className={`w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none
        focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white transition ${
          type === "number"
            ? "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            : ""
        } ${className}`}
    />
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// BULK ENTRY TABLE
// ═══════════════════════════════════════════════════════════════════════════════

function BulkEntryTable({
  groups,
  onChange,
  onDeleteTrip,
  onDeleteTrips,
  agencyId,
  agencyName,
  filterStatus = "all",
}: {
  groups: DriverGroup[];
  onChange: Dispatch<SetStateAction<DriverGroup[]>>;
  onDeleteTrip: (id: string) => Promise<void> | void;
  onDeleteTrips?: (ids: string[]) => Promise<void> | void;
  agencyId?: string;
  agencyName?: string;
  filterStatus?: "all" | "pending" | "completed";
}) {
  const isRowHidden = (isCompleted?: boolean) => {
    if (filterStatus === "pending") return !!isCompleted;
    if (filterStatus === "completed") return !isCompleted;
    return false;
  };
  const { user } = useAuth();
  const [expandedPayoutGi, setExpandedPayoutGi] = useState<number | null>(null);
  const updateGroupField = useCallback(
    (gi: number, field: keyof DriverGroup, val: any) => {
      onChange((prev) => {
        const next = [...prev];
        next[gi] = { ...next[gi], [field]: val };
        return next;
      });
    },
    [onChange],
  );

  const toggleComplete = useCallback(
    (gi: number, ri: number) => {
      onChange((prev) => {
        const next = [...prev];
        next[gi] = { ...next[gi], rows: [...next[gi].rows] };
        next[gi].rows[ri] = {
          ...next[gi].rows[ri],
          isCompleted: !next[gi].rows[ri].isCompleted,
        };
        return next;
      });
    },
    [onChange],
  );

  const updateRow = useCallback(
    (gi: number, ri: number, field: keyof BulkTripRow, val: any) => {
      onChange((prev) => {
        const next = [...prev];
        next[gi] = { ...next[gi], rows: [...next[gi].rows] };
        const row = { ...next[gi].rows[ri], [field]: val };

        // Auto-calculate distance
        if (field === "startKm" || field === "endKm") {
          const skm = Number(row.startKm) || 0;
          const ekm = Number(row.endKm) || 0;
          row.distance = ekm > skm ? ekm - skm : 0;
        }

        // Auto-calculate hours
        if (field === "startTime" || field === "endTime") {
          const [sh, sm] = (row.startTime || "00:00").split(":").map(Number);
          const [eh, em] = (row.endTime || "00:00").split(":").map(Number);
          if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
            let mins = eh * 60 + em - (sh * 60 + sm);
            if (mins < 0) mins += 24 * 60; // handle overnight trips
            row.hours = Number((mins / 60).toFixed(2));
          } else {
            row.hours = 0;
          }
        }

        next[gi].rows[ri] = row;
        return next;
      });
    },
    [onChange],
  );

  const addRow = useCallback(
    (gi: number) => {
      onChange((prev) => {
        const next = [...prev];
        next[gi] = { ...next[gi], rows: [...next[gi].rows, emptyBulkRow()] };
        return next;
      });
    },
    [onChange],
  );

  const removeRow = useCallback(
    (gi: number, rowId: string) => {
      onChange((prev) => {
        const next = [...prev];
        if (next[gi].rows.length <= 1) {
          next[gi] = { ...next[gi], rows: [emptyBulkRow()] };
          return next;
        }
        next[gi] = {
          ...next[gi],
          rows: next[gi].rows.filter((r) => r.clientRowId !== rowId),
        };
        return next;
      });
    },
    [onChange],
  );

  const deleteServerRow = useCallback(
    async (gi: number, rowId: string, serverId: string) => {
      if (!serverId) return;
      try {
        await onDeleteTrip(serverId);
        // remove locally after successful delete
        removeRow(gi, rowId);
      } catch {
        // silent
      }
    },
    [onDeleteTrip, removeRow],
  );

  const addGroup = useCallback(() => {
    onChange((prev) => [...prev, emptyDriverGroup()]);
  }, [onChange]);

  const removeGroup = useCallback(
    (gi: number) => {
      onChange((prev) => prev.filter((_: DriverGroup, i: number) => i !== gi));
    },
    [onChange],
  );

  const deleteServerGroup = useCallback(
    async (gi: number) => {
      const ids = (groups[gi]?.rows ?? [])
        .map((r) => r._id)
        .filter(Boolean) as string[];
      if (ids.length === 0) {
        removeGroup(gi);
        return;
      }
      try {
        // Prefer batch delete confirmation (single modal) for saved groups.
        if (onDeleteTrips) {
          await onDeleteTrips(ids.map(String));
        } else {
          // Fallback: sequential delete to reduce chance of missed deletes.
          for (const id of ids) await Promise.resolve(onDeleteTrip(String(id)));
        }
        removeGroup(gi);
      } catch {
        // Silent: cancellation or failure means we keep local group.
      }
    },
    [groups, onDeleteTrip, removeGroup, onDeleteTrips],
  );

  return (
    <div className="space-y-4">
      {/* Top Actions */}
      {groups.length > 0 && groups.some((g) => g.rows.length > 0) && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => {
              const defaultName = `BulkTrips_${(agencyName || "Agency").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
              const fileName = window.prompt(
                "Enter file name for Report:",
                defaultName,
              );
              if (fileName) {
                generateBulkTripsPDF(
                  user?.name || "Owner",
                  agencyName || "Agency",
                  fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
                  groups,
                );
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-sm"
          >
            <FileDown className="h-4 w-4" /> Download Bulk Trips Report (PDF)
          </button>
        </div>
      )}

      {/* All groups are editable — server trips are merged into groups[] */}
      {groups.map((g, gi) => (
        <div
          key={gi}
          className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${groups.length > 1 && g.rows.every((r) => isRowHidden(r.isCompleted)) ? "hidden" : ""}`}
        >
          {/* Group header */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 border-b border-slate-100 bg-indigo-50/50 px-4 sm:px-5 py-3 sm:py-3.5">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-indigo-100 text-xs sm:text-sm font-bold text-indigo-600 shrink-0">
                {gi + 1}
              </span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-slate-600 shrink-0">
                  Driver:
                </span>
                <CellInput
                  value={g.driverName}
                  onChange={(v) => updateGroupField(gi, "driverName", v)}
                  placeholder="Enter Name"
                  className="min-w-0 flex-1 sm:w-[180px]"
                />
              </div>
              <button
                type="button"
                onClick={() => deleteServerGroup(gi)}
                className="text-red-400 hover:text-red-600 p-1 shrink-0 sm:hidden"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <span className="text-xs sm:text-sm font-semibold text-slate-600 shrink-0">
                  Vehicle:
                </span>
                <CellInput
                  value={g.vehicleNumber}
                  onChange={(v) =>
                    updateGroupField(gi, "vehicleNumber", v.toUpperCase())
                  }
                  placeholder="KL01..."
                  className="min-w-0 flex-1 sm:w-[140px]"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => deleteServerGroup(gi)}
              className="text-red-400 hover:text-red-600 p-1 shrink-0 hidden sm:block"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Trip rows — MOBILE CARD VIEW (below md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {g.rows.map((r, ri) => (
              <div
                key={r.clientRowId}
                className={`p-4 space-y-3 ${isRowHidden(r.isCompleted) ? "hidden" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-500 uppercase">
                    Trip {ri + 1}
                  </span>
                  <div className="flex items-center gap-2.5">
                    {r.distance > 0 && (
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600">
                        {r.distance} km
                      </span>
                    )}
                    {r.hours > 0 && (
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600">
                        {r.hours} hrs
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleComplete(gi, ri)}
                      title={
                        r.isCompleted ? "Mark as pending" : "Mark as completed"
                      }
                      className={`p-1 transition ${r.isCompleted ? "text-emerald-500 hover:text-emerald-600" : "text-slate-300 hover:text-slate-400"}`}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    {r._id ? (
                      <button
                        type="button"
                        onClick={() =>
                          deleteServerRow(gi, r.clientRowId, String(r._id))
                        }
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : g.rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeRow(gi, r.clientRowId)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Start Date
                    </label>
                    <CellInput
                      value={r.startDate}
                      onChange={(v) => updateRow(gi, ri, "startDate", v)}
                      type="date"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      End Date
                    </label>
                    <CellInput
                      value={r.endDate}
                      onChange={(v) => updateRow(gi, ri, "endDate", v)}
                      type="date"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Start KM
                    </label>
                    <CellInput
                      value={r.startKm}
                      onChange={(v) => updateRow(gi, ri, "startKm", v)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      End KM
                    </label>
                    <CellInput
                      value={r.endKm}
                      onChange={(v) => updateRow(gi, ri, "endKm", v)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Start Time
                    </label>
                    <CellInput
                      value={r.startTime}
                      onChange={(v) => updateRow(gi, ri, "startTime", v)}
                      type="time"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      End Time
                    </label>
                    <CellInput
                      value={r.endTime}
                      onChange={(v) => updateRow(gi, ri, "endTime", v)}
                      type="time"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Toll
                    </label>
                    <CellInput
                      value={r.toll === 0 ? "" : r.toll}
                      onChange={(v) =>
                        updateRow(gi, ri, "toll", Number(v) || 0)
                      }
                      type="number"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Advance
                    </label>
                    <CellInput
                      value={r.advancePaid === 0 ? "" : r.advancePaid}
                      onChange={(v) =>
                        updateRow(gi, ri, "advancePaid", Number(v) || 0)
                      }
                      type="number"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Grand Total
                    </label>
                    <CellInput
                      value={r.grandTotal === 0 ? "" : r.grandTotal}
                      onChange={(v) =>
                        updateRow(gi, ri, "grandTotal", Number(v) || 0)
                      }
                      type="number"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">
                    Notes
                  </label>
                  <textarea
                    value={r.notes}
                    onChange={(e) => updateRow(gi, ri, "notes", e.target.value)}
                    placeholder="Add note…"
                    rows={2}
                    className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white transition resize-y"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Trip rows — DESKTOP TABLE VIEW (md and above) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 font-semibold">
                  <th className="px-2 py-2 w-8">#</th>
                  <th className="px-2 py-2 w-8" title="Completed">
                    ✓
                  </th>
                  <th className="px-2 py-2 min-w-[120px]">Date (Start/End)</th>
                  <th className="px-2 py-2">Start KM</th>
                  <th className="px-2 py-2">End KM</th>
                  <th className="px-2 py-2">Dist.</th>
                  <th className="px-2 py-2 min-w-[110px]">Time (Start/End)</th>
                  <th className="px-2 py-2">Hrs.</th>
                  <th className="px-2 py-2">Toll</th>
                  <th className="px-2 py-2">Advance</th>
                  <th className="px-2 py-2">Grand Total</th>
                  <th className="px-2 py-2 min-w-[130px]">Notes</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, ri) => (
                  <tr
                    key={r.clientRowId}
                    className={`border-t border-slate-50 hover:bg-slate-50/30 ${isRowHidden(r.isCompleted) ? "hidden" : ""}`}
                  >
                    <td className="px-2 py-1.5 text-slate-400 font-medium">
                      {ri + 1}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => toggleComplete(gi, ri)}
                        title={
                          r.isCompleted
                            ? "Mark as pending"
                            : "Mark as completed"
                        }
                        className={`p-1.5 rounded-lg transition-all ${r.isCompleted ? "text-emerald-500 bg-emerald-50 hover:bg-emerald-100" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-1">
                        <CellInput
                          value={r.startDate}
                          onChange={(v) => updateRow(gi, ri, "startDate", v)}
                          type="date"
                        />
                        <CellInput
                          value={r.endDate}
                          onChange={(v) => updateRow(gi, ri, "endDate", v)}
                          type="date"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={r.startKm}
                        onChange={(v) => updateRow(gi, ri, "startKm", v)}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={r.endKm}
                        onChange={(v) => updateRow(gi, ri, "endKm", v)}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5 font-medium text-slate-700">
                      {r.distance}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-1">
                        <CellInput
                          value={r.startTime}
                          onChange={(v) => updateRow(gi, ri, "startTime", v)}
                          type="time"
                        />
                        <CellInput
                          value={r.endTime}
                          onChange={(v) => updateRow(gi, ri, "endTime", v)}
                          type="time"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 font-medium text-slate-700">
                      {r.hours}
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={r.toll === 0 ? "" : r.toll}
                        onChange={(v) =>
                          updateRow(gi, ri, "toll", Number(v) || 0)
                        }
                        type="number"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={r.advancePaid === 0 ? "" : r.advancePaid}
                        onChange={(v) =>
                          updateRow(gi, ri, "advancePaid", Number(v) || 0)
                        }
                        type="number"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={r.grandTotal === 0 ? "" : r.grandTotal}
                        onChange={(v) =>
                          updateRow(gi, ri, "grandTotal", Number(v) || 0)
                        }
                        type="number"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <textarea
                        value={r.notes}
                        onChange={(e) =>
                          updateRow(gi, ri, "notes", e.target.value)
                        }
                        placeholder="Add note…"
                        rows={3}
                        className="w-full min-w-[130px] rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white transition resize-y"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-1 items-center">
                        {r._id ? (
                          <button
                            type="button"
                            onClick={() =>
                              deleteServerRow(gi, r.clientRowId!, String(r._id))
                            }
                            title="Delete saved trip"
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : g.rows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeRow(gi, r.clientRowId!)}
                            title="Remove row"
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Group footer */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 sm:gap-3 border-t border-slate-100 px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-50/50">
            <button
              type="button"
              onClick={() => addRow(gi)}
              className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add Trip
            </button>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              {(() => {
                const totalGrand = g.rows.reduce(
                  (s, r) => s + (r.grandTotal || 0),
                  0,
                );
                const advance = g.rows.reduce(
                  (s, r) => s + (r.advancePaid || 0),
                  0,
                );
                const balance = g.rows.reduce(
                  (s, r) =>
                    s + calculateBalanceAmount(r.grandTotal || 0, r.advancePaid || 0),
                  0,
                );
                return (
                  <>
                    <span className="text-slate-500">
                      Total:{" "}
                      <strong className="text-slate-800">
                        ₹{totalGrand.toLocaleString("en-IN")}
                      </strong>
                    </span>
                    <span className="text-slate-500">
                      Advance:{" "}
                      <strong className="text-slate-800">
                        ₹{advance.toLocaleString("en-IN")}
                      </strong>
                    </span>
                    <span className="text-slate-500">
                      Balance:{" "}
                      <strong className="text-emerald-600">
                        ₹{balance.toLocaleString("en-IN")}
                      </strong>
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Driver Payout collapsible */}
          {agencyId && g.driverName.trim() && (
            <div className="border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  setExpandedPayoutGi(expandedPayoutGi === gi ? null : gi)
                }
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50/50 transition"
              >
                <Wallet className="h-3.5 w-3.5" />
                {expandedPayoutGi === gi ? "▾" : "▸"} Driver Payout
              </button>
              {expandedPayoutGi === gi && (
                <DriverPayoutPanel
                  agencyId={agencyId}
                  agencyName={agencyName || ""}
                  driverName={g.driverName}
                />
              )}
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addGroup}
        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-dashed border-indigo-300 rounded-xl px-4 py-3.5 w-full justify-center hover:bg-indigo-50/50 transition"
      >
        <Plus className="h-5 w-5" /> Add Driver / Vehicle
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COPY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatSingleNormalEntry(e: NormalEntryRow | AgencyTrip): string {
  const driver = (e as any).driverName ?? "—";
  const mobile = (e as any).mobileNumber ?? "—";
  const vehicle = (e as any).vehicleNumber ?? "—";
  const type = (e as any).vehicleType ?? "";
  return [
    `Driver: ${driver}`,
    `Mobile: ${mobile}`,
    `Vehicle: ${vehicle}`,
    type ? `Type: ${type}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

async function copySingleEntry(e: NormalEntryRow | AgencyTrip) {
  const msg = [
    "Vehicle Details",
    "─────────────────",
    formatSingleNormalEntry(e),
    "─────────────────",
  ].join("\n");
  await copyToClipboard(msg);
}

async function copyAllEntries(
  entries: (NormalEntryRow | AgencyTrip)[],
  agencyName?: string,
) {
  const filled = entries.filter((e) => (e as any).driverName?.trim());
  if (filled.length === 0) return;
  const header = agencyName
    ? `${agencyName} — Vehicle Summary`
    : "Vehicle Summary";
  const msg = [
    header,
    `Total Vehicles: ${filled.length}`,
    "─────────────────",
    ...filled.map((e) => formatSingleNormalEntry(e) + "\n─────────────────"),
  ].join("\n");
  await copyToClipboard(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMAL ENTRY TABLE
// ═══════════════════════════════════════════════════════════════════════════════

function NormalEntryTable({
  entries,
  onChange,
  onDeleteTrip,
  agencyName,
  filterStatus = "all",
}: {
  filterStatus?: "all" | "pending" | "completed";
  entries: NormalEntryRow[];
  onChange: Dispatch<SetStateAction<NormalEntryRow[]>>;
  onDeleteTrip: (id: string) => Promise<void> | void;
  agencyName?: string;
}) {
  const isRowHidden = (isCompleted?: boolean) => {
    if (filterStatus === "pending") return !!isCompleted;
    if (filterStatus === "completed") return !isCompleted;
    return false;
  };

  const toggleComplete = (i: number) => {
    onChange((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], isCompleted: !next[i].isCompleted };
      return next;
    });
  };
  const { user } = useAuth();
  const update = useCallback(
    (idx: number, field: keyof NormalEntryRow, val: string) => {
      onChange((prev) => {
        const next = [...prev];
        (next[idx] as any)[field] =
          field === "vehicleNumber" ? val.toUpperCase() : val;
        return next;
      });
    },
    [onChange],
  );

  const addEntry = useCallback(() => {
    onChange((prev) => [...prev, emptyNormalRow()]);
  }, [onChange]);

  const removeEntry = useCallback(
    (idx: number) => {
      onChange((prev) => {
        if (prev.length <= 1) return [emptyNormalRow()];
        return prev.filter((_: NormalEntryRow, i: number) => i !== idx);
      });
    },
    [onChange],
  );

  const deleteServerEntry = useCallback(
    async (idx: number, id: string) => {
      if (!id) return;
      try {
        await onDeleteTrip(id);
        removeEntry(idx);
      } catch {
        // silent
      }
    },
    [onDeleteTrip, removeEntry],
  );

  return (
    <div className="space-y-4">
      {/* All entries are editable — server trips are merged into entries[] */}

      {/* Editable entries — MOBILE CARD VIEW (below md) */}
      <div className="md:hidden space-y-3">
        {entries.map((e, i) => (
          <div
            key={i}
            className={`rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3 ${isRowHidden(e.isCompleted) ? "hidden" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-500 uppercase">
                Entry {i + 1}
              </span>
              <div className="flex items-center gap-2.5">
                {e.driverName?.trim() && (
                  <button
                    type="button"
                    onClick={() => copySingleEntry(e)}
                    title="Copy this entry"
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-semibold transition"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                )}
                {(e as any)._id ? (
                  <button
                    type="button"
                    onClick={() => deleteServerEntry(i, String((e as any)._id))}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeEntry(i)}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleComplete(i)}
                  title={
                    e.isCompleted ? "Mark as pending" : "Mark as completed"
                  }
                  className={`p-1 transition ${e.isCompleted ? "text-emerald-500 hover:text-emerald-600" : "text-slate-300 hover:text-slate-400"}`}
                >
                  <CheckCircle className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Date
                </label>
                <CellInput
                  value={e.date}
                  onChange={(v) => update(i, "date", v)}
                  type="date"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Driver Name
                </label>
                <CellInput
                  value={e.driverName}
                  onChange={(v) => update(i, "driverName", v)}
                  placeholder="Driver Name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Mobile
                </label>
                <CellInput
                  value={e.mobileNumber}
                  onChange={(v) => update(i, "mobileNumber", v)}
                  placeholder="9876543210"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Vehicle No.
                </label>
                <CellInput
                  value={e.vehicleNumber}
                  onChange={(v) => update(i, "vehicleNumber", v)}
                  placeholder="KL07XX1234"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Vehicle Type
                </label>
                <CellInput
                  value={e.vehicleType}
                  onChange={(v) => update(i, "vehicleType", v)}
                  placeholder="Sedan"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">
                Notes
              </label>
              <textarea
                value={e.notes}
                onChange={(ev) => update(i, "notes", ev.target.value)}
                placeholder="Add note…"
                rows={2}
                className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white transition resize-y"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Editable entries — DESKTOP TABLE VIEW (md and above) */}
      <div className="hidden md:block rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500 font-semibold">
                <th className="px-2 py-2 w-8">#</th>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Driver Name</th>
                <th className="px-2 py-2">Mobile Number</th>
                <th className="px-2 py-2">Vehicle Number</th>
                <th className="px-2 py-2">Vehicle Type</th>
                <th className="px-2 py-2 min-w-[130px]">Notes</th>
                <th className="px-2 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr
                  key={i}
                  className={`border-t border-slate-50 hover:bg-slate-50/30 ${isRowHidden(e.isCompleted) ? "hidden" : ""}`}
                >
                  <td className="px-2 py-1.5 text-slate-400 font-medium">
                    {i + 1}
                  </td>
                  <td className="px-2 py-1.5">
                    <CellInput
                      value={e.date}
                      onChange={(v) => update(i, "date", v)}
                      type="date"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <CellInput
                      value={e.driverName}
                      onChange={(v) => update(i, "driverName", v)}
                      placeholder="Driver Name"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <CellInput
                      value={e.mobileNumber}
                      onChange={(v) => update(i, "mobileNumber", v)}
                      placeholder="9876543210"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <CellInput
                      value={e.vehicleNumber}
                      onChange={(v) => update(i, "vehicleNumber", v)}
                      placeholder="KL07XX1234"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <CellInput
                      value={e.vehicleType}
                      onChange={(v) => update(i, "vehicleType", v)}
                      placeholder="Sedan"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <textarea
                      value={e.notes}
                      onChange={(ev) => update(i, "notes", ev.target.value)}
                      placeholder="Add note…"
                      rows={3}
                      className="w-full min-w-[130px] rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white transition resize-y"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-col gap-1 items-center">
                      {e.driverName?.trim() && (
                        <button
                          type="button"
                          onClick={() => copySingleEntry(e)}
                          title="Copy this entry"
                          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-[10px] font-semibold transition"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleComplete(i)}
                        title={
                          e.isCompleted
                            ? "Mark as pending"
                            : "Mark as completed"
                        }
                        className={`p-1 transition ${e.isCompleted ? "text-emerald-500 hover:text-emerald-600" : "text-slate-300 hover:text-slate-400"}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      {(e as any)._id ? (
                        <button
                          type="button"
                          onClick={() =>
                            deleteServerEntry(i, String((e as any)._id))
                          }
                          title="Delete saved entry"
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeEntry(i)}
                          title={
                            entries.length > 1 ? "Remove row" : "Clear row"
                          }
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-dashed border-indigo-300 rounded-xl px-4 py-3.5 flex-1 justify-center hover:bg-indigo-50/50 transition"
        >
          <Plus className="h-5 w-5" /> Add Entry
        </button>
        {entries.length > 0 &&
          entries.some(
            (e) => e.driverName || e.vehicleNumber || e.mobileNumber,
          ) && (
            <button
              type="button"
              onClick={() => {
                const defaultName = `NormalTrips_${(agencyName || "Agency").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
                const fileName = window.prompt(
                  "Enter file name for Report:",
                  defaultName,
                );
                if (fileName) {
                  generateNormalTripsPDF(
                    user?.name || "Owner",
                    agencyName || "Agency",
                    fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
                    entries.filter(
                      (e) => e.driverName || e.vehicleNumber || e.mobileNumber,
                    ),
                  );
                }
              }}
              title="Download Normal Trips Report"
              className="flex items-center gap-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 rounded-xl px-4 py-3.5 transition"
            >
              <FileDown className="h-5 w-5" /> Download Report
            </button>
          )}
        <button
          type="button"
          onClick={() => copyAllEntries(entries, agencyName)}
          title="Copy all entries"
          className="flex items-center gap-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 rounded-xl px-4 py-3.5 transition"
        >
          <Copy className="h-5 w-5" /> Copy All
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function BulkEntryPage() {
  // State — agencies
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agencyLoading, setAgencyLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Delete confirmations (prevents rapid double-deletes & gives server time)
  type PendingDelete = { ids: string[]; title: string; message: string };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const deletePromiseRef = useRef<{
    resolve: () => void;
    reject: (err?: any) => void;
  } | null>(null);

  // State — mode
  const [activeTab, setActiveTab] = useState<"bulk" | "normal" | "payout">(
    () => {
      try {
        const v = localStorage.getItem(LS_ENTRY_MODE) as any;
        if (v === "normal" || v === "payout") return v;
        return "bulk";
      } catch {
        return "bulk";
      }
    },
  );

  // State — bulk data (functional updater pattern for perf)
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "completed"
  >("pending");

  // State — bulk data (functional updater pattern for perf)
  const [bulkGroups, setBulkGroupsRaw] = useState<DriverGroup[]>([
    emptyDriverGroup(),
  ]);

  // State — normal data
  const [normalEntries, setNormalEntriesRaw] = useState<NormalEntryRow[]>([
    emptyNormalRow(),
  ]);

  // Functional updater wrappers — allow children to pass updater functions
  const setBulkGroups = useCallback(
    (updater: DriverGroup[] | ((prev: DriverGroup[]) => DriverGroup[])) => {
      setBulkGroupsRaw(typeof updater === "function" ? updater : () => updater);
    },
    [],
  );

  const setNormalEntries = useCallback(
    (
      updater:
        | NormalEntryRow[]
        | ((prev: NormalEntryRow[]) => NormalEntryRow[]),
    ) => {
      setNormalEntriesRaw(
        typeof updater === "function" ? updater : () => updater,
      );
    },
    [],
  );

  // No manual submit — MS Office style autosync only

  const selectedAgency =
    agencies.find((a) => (a._id ?? a.id) === selectedId) ?? null;

  // ── Serializers (stable refs) ──
  const serializeBulk = useCallback(
    (groups: DriverGroup[]) => JSON.stringify(groups),
    [],
  );
  const serializeNormal = useCallback(
    (entries: NormalEntryRow[]) => JSON.stringify(entries),
    [],
  );

  // derive isBulkMode from activeTab
  const isBulkMode = activeTab === "bulk";

  // ── Backend sync callbacks (stable refs) ──
  const syncBulkToBackend = useCallback(
    async (groups: DriverGroup[]) => {
      if (!selectedAgency) return;
      const validGroups = groups.filter(
        (g) => g.driverName.trim() && g.vehicleNumber.trim(),
      );
      if (validGroups.length === 0) return;
      const res = await syncBulkEntry({
        agencyName: selectedAgency.name,
        driverGroups: validGroups,
      });

      // Patch returned _id mappings back into state so refresh doesn't duplicate server rows.
      const mappings = (res.rows ?? []).filter(
        (r) => r.clientRowId && r._id,
      ) as Array<{ clientRowId: string; _id: string }>;
      if (mappings.length === 0) return;
      const map = new Map(mappings.map((m) => [m.clientRowId, m._id]));

      setBulkGroupsRaw((prev) =>
        prev.map((g) => ({
          ...g,
          rows: g.rows.map((r) => {
            if (r._id) return r;
            const id = map.get(r.clientRowId);
            return id ? { ...r, _id: id } : r;
          }),
        })),
      );
    },
    [selectedAgency],
  );

  const syncNormalToBackend = useCallback(
    async (entries: NormalEntryRow[]) => {
      if (!selectedAgency) return;
      const validEntries = entries.filter(
        (e) => e.driverName.trim() && e.vehicleNumber.trim(),
      );
      if (validEntries.length === 0) return;
      const res = await syncNormalEntry({
        agencyName: selectedAgency.name,
        entries: validEntries,
      });

      const mappings = (res.rows ?? []).filter(
        (r) => r.clientRowId && r._id,
      ) as Array<{ clientRowId: string; _id: string }>;
      if (mappings.length === 0) return;
      const map = new Map(mappings.map((m) => [m.clientRowId, m._id]));
      setNormalEntriesRaw((prev) =>
        prev.map((e) => {
          if (e._id) return e;
          const id = map.get(e.clientRowId || "");
          return id ? { ...e, _id: id } : e;
        }),
      );
    },
    [selectedAgency],
  );

  // ── Autosave hooks ──
  const bulkLsKey =
    selectedId && isBulkMode ? `${LS_BULK_PREFIX}${selectedId}` : null;
  const normalLsKey =
    selectedId && !isBulkMode ? `${LS_NORMAL_PREFIX}${selectedId}` : null;

  const bulkSyncStatus = useAutosave(
    bulkLsKey,
    bulkGroups,
    serializeBulk,
    syncBulkToBackend,
  );
  const normalSyncStatus = useAutosave(
    normalLsKey,
    normalEntries,
    serializeNormal,
    syncNormalToBackend,
  );

  const currentSyncStatus = isBulkMode ? bulkSyncStatus : normalSyncStatus;

  // ── Calculate selected agency total balance ──
  const agencyTotalBalance = useMemo(() => {
    if (!isBulkMode) return 0;

    let totalBalance = 0;

    for (const group of bulkGroups) {
      if (
        !group.driverName.trim() &&
        !group.vehicleNumber.trim() &&
        group.rows.every(
          (r) => !r.startDate && !r.startKm && !r.grandTotal && !r.advancePaid,
        )
      ) {
        continue;
      }

      group.rows.forEach((row) => {
        const gt = row.grandTotal || 0;
        const rowAdvance = row.advancePaid || 0;
        totalBalance += calculateBalanceAmount(gt, rowAdvance);
      });
    }

    return totalBalance;
  }, [bulkGroups, isBulkMode]);

  // ── Load agencies ──
  const loadAgencies = useCallback(async () => {
    setAgencyLoading(true);
    try {
      const data = await fetchAgencies();
      setAgencies(data.agencies);
      if (data.agencies.length > 0) {
        // Restore last selected agency if it still exists, else fallback to first.
        let preferredId: string | null = null;
        try {
          preferredId = localStorage.getItem(LS_SELECTED_AGENCY);
        } catch {
          /* ignore */
        }
        const resolvedPreferred = preferredId
          ? (data.agencies.find((a) => (a._id ?? a.id) === preferredId)?._id ??
            data.agencies.find((a) => (a._id ?? a.id) === preferredId)?.id)
          : null;

        const initialId = (resolvedPreferred ??
          selectedId ??
          data.agencies[0]._id ??
          data.agencies[0].id ??
          null) as string | null;
        if (initialId && initialId !== selectedId) {
          setSelectedId(initialId);
        }

        // Restore draft state for the chosen agency (bulk + normal), if present.
        if (initialId) {
          const savedBulk = loadFromLocalStorage<DriverGroup[]>(
            `${LS_BULK_PREFIX}${initialId}`,
            [],
          );
          if (savedBulk.length > 0) {
            setBulkGroupsRaw(normalizeBulkGroups(savedBulk));
          }
          const savedNormal = loadFromLocalStorage<NormalEntryRow[]>(
            `${LS_NORMAL_PREFIX}${initialId}`,
            [],
          );
          if (savedNormal.length > 0) setNormalEntriesRaw(savedNormal);
        }
      }
    } catch {
      /* silent */
    } finally {
      setAgencyLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadAgencies();
  }, [loadAgencies]);

  // ── Load trips when agency/mode changes ──
  const loadTrips = useCallback(async () => {
    if (!selectedId || !selectedAgency) return;
    try {
      if (isBulkMode) {
        const trips = await fetchBulkEntryTrips(selectedId);
        // Convert server trips into editable DriverGroup[] format
        if (trips.length > 0) {
          const grouped: Record<string, typeof trips> = {};
          for (const t of trips) {
            const key = `${(t.driverName || "").trim()}|||${(t.vehicleNumber || "").trim().toUpperCase()}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(t);
          }
          const serverGroups: DriverGroup[] = Object.values(grouped).map(
            (grp) => {
              const first = grp[0];
              return {
                driverName: first.driverName || "",
                vehicleNumber: first.vehicleNumber || "",
                rows: grp.map((t) => ({
                  // Preserve server clientRowId so refresh can dedupe against local drafts
                  clientRowId: (t as any).clientRowId ?? nextRowId(),
                  _id: t._id ?? t.id,
                  startDate: t.startDate ? t.startDate.split("T")[0] : "",
                  endDate: t.endDate ? t.endDate.split("T")[0] : "",
                  startKm: String(t.startKm ?? ""),
                  endKm: String(t.endKm ?? ""),
                  startTime: t.startTime || "",
                  endTime: t.endTime || "",
                  distance: Number(t.distance ?? 0),
                  hours: Number(t.hours ?? 0),
                  toll: Number(t.toll ?? 0),
                  advancePaid: Number(t.advancePaid ?? 0),
                  grandTotal: Number(t.grandTotal ?? 0),
                  notes: t.notes || "",
                  isCompleted: !!t.isCompleted,
                })),
              };
            },
          );
          setBulkGroupsRaw((prev) => {
            // Canonical merge: one group per (driverName, vehicleNumber).
            // Start from server state, then merge in any local unsaved rows (no _id) that aren't already on server.
            const keyOf = (
              g: Pick<DriverGroup, "driverName" | "vehicleNumber">,
            ) =>
              `${(g.driverName || "").trim().toLowerCase()}|||${(g.vehicleNumber || "").trim().toUpperCase()}`;

            const rowKey = (r: any) =>
              r?._id
                ? `id:${String(r._id)}`
                : `cr:${String(r.clientRowId || "")}`;

            const outByKey = new Map<string, DriverGroup>();
            for (const sg of serverGroups) {
              const k = keyOf(sg);
              outByKey.set(k, {
                ...sg,
                rows: [...sg.rows],
              });
            }

            // Track row keys already present per group
            const existingRowKeysByGroup = new Map<string, Set<string>>();
            for (const [k, g] of outByKey.entries()) {
              existingRowKeysByGroup.set(
                k,
                new Set(g.rows.map(rowKey).filter(Boolean)),
              );
            }

            // Merge local rows/groups
            for (const lg of prev) {
              const k = keyOf(lg);
              const target = outByKey.get(k) ?? {
                driverName: lg.driverName,
                vehicleNumber: lg.vehicleNumber,
                rows: [],
              };

              const seen = existingRowKeysByGroup.get(k) ?? new Set<string>();
              for (const r of lg.rows) {
                const rk = rowKey(r);
                if (!rk) continue;
                if (!seen.has(rk)) {
                  target.rows.push({
                    ...emptyBulkRow(),
                    ...r,
                    advancePaid: Number((r as any).advancePaid ?? 0) || 0,
                  });
                  seen.add(rk);
                }
              }

              outByKey.set(k, target);
              existingRowKeysByGroup.set(k, seen);
            }

            const merged = Array.from(outByKey.values());
            const hasAnyData = merged.some(
              (g) =>
                g.driverName.trim() ||
                g.vehicleNumber.trim() ||
                g.rows.some(
                  (r) => r.startDate || r.startKm || r.grandTotal || r.advancePaid,
                ),
            );

            return hasAnyData ? merged : [emptyDriverGroup()];
          });
        }
      } else {
        const trips = await fetchNormalEntryTrips(selectedId);
        // Convert server trips into editable NormalEntryRow[] format
        if (trips.length > 0) {
          const serverEntries: NormalEntryRow[] = trips.map((t) => ({
            _id: t._id ?? t.id,
            date: t.date ? t.date.split("T")[0] : "",
            driverName: t.driverName || "",
            mobileNumber: t.mobileNumber || "",
            vehicleNumber: t.vehicleNumber || "",
            vehicleType: t.vehicleType || "",
            notes: t.notes || "",
            isCompleted: !!t.isCompleted,
          }));
          setNormalEntriesRaw((prev) => {
            // Canonical merge: prefer server entries, then keep local-only entries that aren't on server.
            const key = (e: any) =>
              e?._id
                ? `id:${String(e._id)}`
                : `local:${String(e.driverName || "")}|${String(e.vehicleNumber || "")}|${String(e.date || "")}`;
            const seen = new Set<string>();
            const out: NormalEntryRow[] = [];

            for (const se of serverEntries) {
              const k = key(se);
              if (!seen.has(k)) {
                out.push(se);
                seen.add(k);
              }
            }
            for (const le of prev) {
              const k = key(le);
              if (!seen.has(k)) {
                out.push(le);
                seen.add(k);
              }
            }

            const hasAny = out.some(
              (e) => e.driverName.trim() || e.vehicleNumber.trim(),
            );
            return hasAny ? out : [emptyNormalRow()];
          });
        }
      }
    } catch {
      /* silent */
    }
  }, [selectedId, isBulkMode, selectedAgency]);

  const performDeleteTrips = useCallback(
    async (ids: string[]) => {
      const uniq = Array.from(new Set((ids ?? []).map(String).filter(Boolean)));
      for (const id of uniq) {
        if (isBulkMode) await deleteBulkEntryTrip(id);
        else await deleteNormalEntryTrip(id);
      }
      await loadTrips();
    },
    [isBulkMode, loadTrips],
  );

  const requestDeleteTrips = useCallback(
    (ids: string[], title: string, message: string) => {
      const cleanIds = Array.from(
        new Set((ids ?? []).map(String).filter(Boolean)),
      );
      if (cleanIds.length === 0)
        return Promise.reject(new Error("No items to delete"));
      if (deleteInFlight || deletePromiseRef.current) {
        return Promise.reject(new Error("Deletion already in progress"));
      }
      return new Promise<void>((resolve, reject) => {
        deletePromiseRef.current = { resolve, reject };
        setPendingDelete({ ids: cleanIds, title, message });
      });
    },
    [deleteInFlight],
  );

  const confirmDelete = useCallback(async () => {
    const req = pendingDelete;
    const pending = deletePromiseRef.current;
    if (!req || !pending) return;
    setDeleteInFlight(true);
    try {
      await performDeleteTrips(req.ids);
      pending.resolve();
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // If it's already deleted in the backend (ghost row), treat it as a success
        pending.resolve();
      } else {
        pending.reject(e);
        const msg =
          e?.response?.data?.message ?? e?.message ?? "Failed to delete";
        alert(msg);
      }
    } finally {
      deletePromiseRef.current = null;
      setDeleteInFlight(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, performDeleteTrips]);

  const cancelDelete = useCallback(() => {
    const pending = deletePromiseRef.current;
    deletePromiseRef.current = null;
    setDeleteInFlight(false);
    setPendingDelete(null);
    pending?.reject(new Error("cancelled"));
  }, []);

  const handleDeleteTrip = useCallback(
    (id: string) =>
      requestDeleteTrips(
        [id],
        "Delete saved trip",
        "Delete this trip? This cannot be undone.",
      ),
    [requestDeleteTrips],
  );

  const handleDeleteTrips = useCallback(
    (ids: string[]) =>
      requestDeleteTrips(
        ids,
        "Delete saved trips",
        `Delete ${ids.length} trip(s)? This cannot be undone.`,
      ),
    [requestDeleteTrips],
  );

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  // ── Agency selection ──
  const selectAgency = useCallback((id: string) => {
    setSelectedId(id);
    setShowDropdown(false);
    try {
      localStorage.setItem(LS_SELECTED_AGENCY, id);
    } catch {}
    // Restore from localStorage
    const savedBulk = loadFromLocalStorage<DriverGroup[]>(
      `${LS_BULK_PREFIX}${id}`,
      [],
    );
    setBulkGroupsRaw(savedBulk.length > 0 ? savedBulk : [emptyDriverGroup()]);
    const savedNormal = loadFromLocalStorage<NormalEntryRow[]>(
      `${LS_NORMAL_PREFIX}${id}`,
      [],
    );
    setNormalEntriesRaw(
      savedNormal.length > 0 ? savedNormal : [emptyNormalRow()],
    );
  }, []);

  // ── Mode toggle ──
  const toggleMode = useCallback((tab: "bulk" | "normal" | "payout") => {
    setActiveTab(tab);
    try {
      localStorage.setItem(LS_ENTRY_MODE, tab);
    } catch {}
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const close = () => setShowDropdown(false);
    document.addEventListener("click", close, { once: true });
    return () => document.removeEventListener("click", close);
  }, [showDropdown]);

  // No manual submit handlers — autosync only

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
      {/* ─── HEADER BAR ─── */}
      <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-3.5 shadow-sm shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <FileSpreadsheet className="h-6 w-6 text-indigo-500 shrink-0 hidden sm:block" />
          <h1 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wider hidden md:block">
            {isBulkMode ? "Bulk Entry" : "Normal Entry"}
          </h1>

          {/* Agency picker */}
          <div className="relative flex-1 sm:flex-none min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm hover:border-indigo-300 transition w-full sm:min-w-[180px]"
            >
              <Building2 className="h-4.5 w-4.5 text-slate-400 shrink-0" />
              <span className="truncate text-slate-700 font-medium">
                {selectedAgency?.name ?? "Select Agency"}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 ml-auto shrink-0" />
            </button>

            {showDropdown && (
              <div
                className="absolute left-0 top-full mt-1 w-full sm:w-72 rounded-xl border border-slate-200 bg-white shadow-lg z-30 py-1 max-h-60 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {agencyLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">
                    Loading…
                  </div>
                ) : agencies.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">
                    No agencies created yet
                  </div>
                ) : (
                  agencies.map((a) => (
                    <button
                      key={a._id ?? a.id}
                      type="button"
                      onClick={() => selectAgency(a._id ?? a.id ?? "")}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition ${
                        (a._id ?? a.id) === selectedId
                          ? "bg-indigo-50 text-indigo-700 font-semibold"
                          : "text-slate-700"
                      }`}
                    >
                      {a.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-indigo-600 transition shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" />{" "}
            <span className="hidden sm:inline">Agency</span>
            <span className="sm:hidden">New</span>
          </button>

          {/* Payout Button */}
          {selectedAgency && (
            <button
              type="button"
              onClick={() => toggleMode("payout")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-semibold transition shadow-sm shrink-0 border ${
                activeTab === "payout"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50"
              }`}
            >
              <Wallet className="h-4 w-4" />{" "}
              <span className="hidden sm:inline">Payout</span>
            </button>
          )}

          {/* Agency Total Balance Display */}
          {selectedAgency && isBulkMode && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 border border-emerald-100 shadow-sm transition-all hover:shadow hover:bg-emerald-100/60 sm:ml-auto">
              <span className="text-xs sm:text-sm font-bold text-emerald-600 uppercase tracking-wider">
                Balance:
              </span>
              <span
                className={`text-sm sm:text-base font-bold ${agencyTotalBalance < 0 ? "text-red-600" : "text-emerald-700"}`}
              >
                ₹{agencyTotalBalance.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Mobile total balance */}
          {selectedAgency && isBulkMode && (
            <div className="sm:hidden flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 border border-emerald-100">
              <span className="text-xs font-bold text-emerald-600 uppercase">
                Bal:
              </span>
              <span
                className={`text-sm font-bold ${agencyTotalBalance < 0 ? "text-red-600" : "text-emerald-700"}`}
              >
                ₹{agencyTotalBalance.toLocaleString("en-IN")}
              </span>
            </div>
          )}

          {/* Sync status */}
          <SyncBadge status={currentSyncStatus} />

          {/* Filter Status toggle */}
          {activeTab !== "payout" && (
            <div className="hidden sm:flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={`rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold transition ${
                  filterStatus === "all"
                    ? "bg-white text-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("pending")}
                className={`rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold transition ${
                  filterStatus === "pending"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("completed")}
                className={`rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold transition ${
                  filterStatus === "completed"
                    ? "bg-white text-emerald-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Done
              </button>
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => toggleMode("bulk")}
              className={`rounded-md px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "bulk"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Bulk
            </button>
            <button
              type="button"
              onClick={() => toggleMode("normal")}
              className={`rounded-md px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "normal"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Normal
            </button>
          </div>

          <button
            type="button"
            onClick={loadTrips}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition active:rotate-180 shrink-0"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          {/* No manual submit (autosync only) */}
        </div>
      </div>

      {/* ─── FEEDBACK BAR ─── */}
      {/* No submit feedback bar (autosync only) */}

      {/* ─── CONTENT ─── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
        {!selectedAgency ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
            <Building2 className="h-16 w-16 text-slate-200" />
            <p className="text-base font-medium text-slate-500">
              Select an agency to get started
            </p>
            <p className="text-sm text-slate-400">
              Choose from the dropdown above, or create a new agency.
            </p>
          </div>
        ) : activeTab === "payout" ? (
          <div className="max-w-2xl mx-auto">
            <div className="mb-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => toggleMode("bulk")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-500" />
              <h2 className="text-base font-bold text-slate-800">
                {selectedAgency.name} — Payout
              </h2>
              </div>
            </div>
            <AgencyPayoutTab
              agencyId={selectedAgency._id ?? selectedAgency.id ?? ""}
              agencyName={selectedAgency.name}
            />
          </div>
        ) : activeTab === "bulk" ? (
          <BulkEntryTable
            groups={bulkGroups}
            onChange={setBulkGroups}
            filterStatus={filterStatus}
            onDeleteTrip={handleDeleteTrip}
            onDeleteTrips={handleDeleteTrips}
            agencyId={selectedAgency._id ?? selectedAgency.id ?? ""}
            agencyName={selectedAgency.name}
          />
        ) : (
          <NormalEntryTable
            entries={normalEntries}
            onChange={setNormalEntries}
            filterStatus={filterStatus}
            onDeleteTrip={handleDeleteTrip}
            agencyName={selectedAgency.name}
          />
        )}
      </div>

      {/* ─── MODALS ─── */}
      {showCreateModal && (
        <CreateAgencyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(a) => {
            setShowCreateModal(false);
            setAgencies((prev) => [...prev, a]);
            selectAgency(a._id ?? a.id ?? "");
          }}
        />
      )}
      {pendingDelete && (
        <ModalShell
          title={pendingDelete.title}
          onClose={cancelDelete}
          maxWidth="max-w-sm"
        >
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-700">{pendingDelete.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={deleteInFlight}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteInFlight}
                className="rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteInFlight ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
