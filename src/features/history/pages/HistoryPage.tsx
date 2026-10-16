import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, RefreshCw, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import {
  fetchTripHistory,
  type HistoryTrip,
  type HistoryPagination,
  type HistoryPaymentSummary,
  type RecordPaymentTripSummary,
} from '../api';
import { TripCard } from '../components/TripCard';
import { fetchAgencies, type Agency } from '../../bulk-entry/api';
import { resolveAgencyLabelFromName } from '../../../lib/agencyDisplay';
import { DatePicker } from "../../../components/ui/DatePicker";
import { todayIsoInAppTz } from "../../../lib/datePickerUtils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'all',         label: 'All Status' },
  { value: 'completed',   label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'scheduled',   label: 'Scheduled' },
  { value: 'cancelled',   label: 'Cancelled' },
  { value: 'paid',        label: 'Paid' },
  { value: 'partial',     label: 'Partial' },
  { value: 'unpaid',      label: 'Unpaid' },
];

/** Current YYYY-MM in app business timezone (IST). */
function getCurrentMonthValue(): string {
  return todayIsoInAppTz().slice(0, 7);
}

const CUSTOM_DATE_VALUE = 'custom_date';

function monthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [
    { value: 'all_time', label: 'All Time' },
    { value: CUSTOM_DATE_VALUE, label: 'Custom date' },
  ];
  const current = getCurrentMonthValue();
  const [y0, m0] = current.split('-').map(Number);
  let year = y0;
  let month = m0;
  for (let i = 0; i < 24; i++) {
    const value = `${year}-${String(month).padStart(2, '0')}`;
    const label = new Date(year, month - 1, 1).toLocaleString('en-IN', {
      month: 'short',
      year: 'numeric',
    });
    opts.push({ value, label });
    month -= 1;
    if (month <= 0) {
      month += 12;
      year -= 1;
    }
  }
  return opts;
}

const filterInputCls =
  'h-8 rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100';

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center sm:py-20">
      <div className="mb-4 rounded-full border border-slate-200 bg-[var(--bg-elevated)] p-4 shadow-inner dark:border-[#1e2638] sm:p-5">
        <Search className="h-7 w-7 text-slate-400 dark:text-slate-500 sm:h-8 sm:w-8" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-700 dark:text-slate-200 sm:text-lg">
        No trips found
      </h3>
      <p className="mb-4 px-4 text-sm text-slate-500 dark:text-slate-400">
        Try adjusting your filters or search query.
      </p>
      <button
        onClick={onReset}
        className="rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
      >
        Clear all filters
      </button>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  p,
  onChange,
}: {
  p: HistoryPagination;
  onChange: (page: number) => void;
}) {
  if (p.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3">
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        Page {p.page}/{p.pages} · {p.total} trips
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={!p.hasPrev}
          onClick={() => onChange(p.page - 1)}
          className="inline-flex h-7 items-center gap-0.5 rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#1e2638] dark:text-slate-300 dark:hover:bg-white/5"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <button
          disabled={!p.hasNext}
          onClick={() => onChange(p.page + 1)}
          className="inline-flex h-7 items-center gap-0.5 rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#1e2638] dark:text-slate-300 dark:hover:bg-white/5"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── History Page ─────────────────────────────────────────────────────────────

export function HistoryPage() {
  // Filter state
  const currentMonth = getCurrentMonthValue();
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus]       = useState('all');
  const [month, setMonth]         = useState(currentMonth);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [page, setPage]           = useState(1);
  const [filterMode, setFilterMode] = useState<'month' | 'daterange'>('month');
  const LIMIT = 12;

  // Data state
  const [trips, setTrips]               = useState<HistoryTrip[]>([]);
  const [pagination, setPagination]     = useState<HistoryPagination>({
    page: 1, limit: LIMIT, total: 0, pages: 1, hasNext: false, hasPrev: false,
  });
  const [, setPaymentSummary] = useState<HistoryPaymentSummary>({
    totalAmount: 0, totalPaid: 0, totalOutstanding: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [ownerAgencies, setOwnerAgencies] = useState<Agency[]>([]);

  useEffect(() => {
    fetchAgencies(1, 500)
      .then((res) => setOwnerAgencies(res.agencies))
      .catch(() => setOwnerAgencies([]));
  }, []);

  const resolveAgencyLabel = useCallback(
    (agencyName?: string) => resolveAgencyLabelFromName(agencyName, ownerAgencies),
    [ownerAgencies],
  );

  // Debounce search 500ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = {
        page,
        limit: LIMIT,
        status: status === 'all' ? undefined : status,
        search: debouncedSearch || undefined,
        sortBy: 'startDate',
        sortOrder: 'desc',
      };
      if (filterMode === 'month' && month && month !== 'all_time') {
        params.month = month;
      } else if (filterMode === 'daterange') {
        params.startDate = startDate || undefined;
        params.endDate = endDate || undefined;
      }
      // 'all_time' => no date filter at all
      const result = await fetchTripHistory(params);
      setTrips(result.trips);
      setPagination(result.pagination);
    } catch {
      setError('Failed to load trip history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, status, month, debouncedSearch, startDate, endDate, filterMode]);

  useEffect(() => { load(); }, [load]);

  // Always fetch all-time stats (unfiltered) for the banner
  const loadAllTimeStats = useCallback(async () => {
    try {
      const result = await fetchTripHistory({ page: 1, limit: 1, status: 'all' });
      const summary =
        result.allTimePaymentSummary ?? result.paymentSummary;
      setPaymentSummary(summary);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadAllTimeStats(); }, [loadAllTimeStats]);

  const handleMonthChange = (val: string) => {
    if (val === CUSTOM_DATE_VALUE) {
      setFilterMode('daterange');
      setMonth('');
      setPage(1);
      return;
    }
    setMonth(val);
    setFilterMode('month');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate && val && endDate < val) setEndDate(val);
    setFilterMode('daterange');
    setMonth('');
    setPage(1);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setFilterMode('daterange');
    setMonth('');
    setPage(1);
  };

  const resetFilters = () => {
    setSearch(''); setDebouncedSearch(''); setStatus('all');
    setMonth(currentMonth); setStartDate(''); setEndDate('');
    setFilterMode('month'); setPage(1);
  };

  const handleTripUpdated = useCallback((updated: HistoryTrip) => {
    setTrips((prev) =>
      prev.map((t) => (t._id === updated._id ? updated : t)),
    );
  }, []);

  const handlePaymentRecorded = useCallback((tripId: string, summary: RecordPaymentTripSummary) => {
    const paymentStatus =
      summary.paymentStatus === 'paid' ||
      summary.paymentStatus === 'partial' ||
      summary.paymentStatus === 'unpaid'
        ? summary.paymentStatus
        : 'unpaid';
    setTrips((prev) =>
      prev.map((t) =>
        t._id === tripId
          ? {
              ...t,
              paidAmount: summary.paidAmount,
              paymentSummary: {
                ...t.paymentSummary,
                totalAmount: summary.totalAmount,
                paidAmount: summary.paidAmount,
                remainingBalance: summary.remainingBalance,
                paymentStatus,
              },
            }
          : t
      )
    );
  }, []);

  const handleExportPdf = async () => {
    const params: Record<string, any> = {
      page: 1,
      limit: 10000,
      status: status === 'all' ? undefined : status,
      search: debouncedSearch || undefined,
      sortBy: 'startDate',
      sortOrder: 'asc',
    };

    if (filterMode === 'month' && month && month !== 'all_time') {
      params.month = month;
    } else if (filterMode === 'daterange') {
      params.startDate = startDate || undefined;
      params.endDate = endDate || undefined;
    }

    const result = await fetchTripHistory(params);
    
    const parseLooseDate = (raw: any): Date | null => {
      if (!raw) return null;
      if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
      const s = String(raw).trim();

      // ISO-ish: YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const d = new Date(`${s}T00:00:00`);
        return Number.isNaN(d.getTime()) ? null : d;
      }

      // D/M/YYYY or DD/MM/YYYY
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) {
        const day = Number(m[1]);
        const month = Number(m[2]);
        const year = Number(m[3]);
        const d = new Date(year, month - 1, day);
        return Number.isNaN(d.getTime()) ? null : d;
      }

      const fallback = new Date(s);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    };

    let exportTrips = result.trips || [];

    // Extra defensive date-range filter on client side for inconsistent date storage.
    if (filterMode === 'daterange' && startDate && endDate) {
      const startD = parseLooseDate(startDate);
      const endD = parseLooseDate(endDate);
      if (startD && endD) {
        startD.setHours(0, 0, 0, 0);
        endD.setHours(23, 59, 59, 999);
        const inRange = (d: Date | null): boolean => {
          if (!d) return false;
          const ts = d.getTime();
          return ts >= startD.getTime() && ts <= endD.getTime();
        };
        exportTrips = exportTrips.filter((t) => {
          const logicalTripDate = parseLooseDate((t as any).startDate ?? (t as any).date);
          const createdAtDate = parseLooseDate((t as any).createdAt);
          const updatedAtDate = parseLooseDate((t as any).updatedAt);
          return inRange(logicalTripDate) || inRange(createdAtDate) || inRange(updatedAtDate);
        });
      }
    }

    if (!exportTrips || exportTrips.length === 0) {
      alert("No trips found for current filters.");
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const leftX = 14;
    const rightX = 196;
    const pageBottomY = 280;
    let y = 16;

    const fmtDate = (raw: any): string => {
      const s = raw == null ? '' : String(raw).trim();
      if (!s) return 'N/A';
      const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymd) {
        return `${Number(ymd[3])}/${Number(ymd[2])}/${Number(ymd[1])}`;
      }
      const dt = raw instanceof Date ? raw : new Date(s);
      if (Number.isNaN(dt.getTime())) return 'N/A';
      const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(dt)
        .split('-');
      return `${Number(d)}/${Number(m)}/${Number(y)}`;
    };

    const fmtRs = (raw: any): string => {
      const n = raw == null ? 0 : Number(raw);
      const v = Number.isFinite(n) ? n : 0;
      return `Rs. ${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getDriverName = (trip: HistoryTrip): string => {
      const d: any = (trip as any).driver;
      if (d && typeof d === 'object') {
        const nm = `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim();
        return nm || d.name || 'N/A';
      }
      return (trip as any).driverName || 'N/A';
    };

    const getVehicleText = (trip: HistoryTrip): string => {
      const v: any = (trip as any).vehicle;
      if (v && typeof v === 'object') {
        const num = v.vehicleNumber || 'N/A';
        const model = v.vehicleModel || v.model || 'N/A';
        return `${num} - ${model}`;
      }
      const num = (trip as any).vehicleNumber || 'N/A';
      const model = (trip as any).vehicleModel || (trip as any).model || 'N/A';
      return `${num} - ${model}`;
    };

    const pageWidth = rightX - leftX;
    const lineH = 5;

    const textWidth = (txt: string): number => doc.getTextWidth(txt);

    const truncateToWidth = (txt: string, maxW: number): string => {
      const s = String(txt ?? '');
      if (textWidth(s) <= maxW) return s;
      const ell = '…';
      let lo = 0;
      let hi = s.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const candidate = s.slice(0, mid).trimEnd() + ell;
        if (textWidth(candidate) <= maxW) lo = mid + 1;
        else hi = mid;
      }
      const cut = Math.max(0, lo - 1);
      return s.slice(0, cut).trimEnd() + ell;
    };

    const ensureSpace = (needed: number) => {
      if (y + needed <= pageBottomY) return;
      doc.addPage();
      y = 16;
    };

    const writeText = (text: string, x: number, yPos: number, opts?: { size?: number; bold?: boolean; color?: [number, number, number] }) => {
      const size = opts?.size ?? 10;
      const bold = opts?.bold ?? false;
      const color = opts?.color ?? [15, 23, 42];
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(text, x, yPos);
    };

    const writeDetailRow = (label: string, value: string, x: number, yPos: number, maxValueW: number) => {
      // Use measured label width so longer labels (Customer/Distance) don't collide with values.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const labelW = Math.max(18, textWidth(label) + 2);
      writeText(label, x, yPos, { size: 9, bold: true });
      writeText(truncateToWidth(value, maxValueW), x + labelW, yPos, { size: 9, bold: false });
    };

    // Header (match shared PDF)
    writeText('Trip History Report', leftX, y, { size: 18, bold: true });
    const totalTripsText = `Total Trips: ${exportTrips.length}`;
    writeText(totalTripsText, rightX - textWidth(totalTripsText), y, { size: 11, bold: true });
    y += 7;
    writeText(`Generated on: ${fmtDate(new Date())}`, leftX, y, { size: 10, color: [51, 65, 85] });
    y += 9;

    // Divider line
    doc.setDrawColor(60, 60, 60);
    doc.line(leftX, y, rightX, y);
    y += 12;

    writeText('Trip Details', leftX, y, { size: 14, bold: true });
    y += 8;

    exportTrips.forEach((trip, idx) => {
      const tripNo = (trip.tripNumber ? String(trip.tripNumber) : 'N/A');
      const driverName = getDriverName(trip);
      const vehicleText = getVehicleText(trip);

      const from = (trip as any).from ?? 'N/A';
      const to = (trip as any).to ?? 'N/A';
      const customer = (trip as any).customer ?? 'N/A';
      const agencyRaw = (trip as any).agencyName ?? (trip as any).agency ?? '';
      const agency = agencyRaw
        ? resolveAgencyLabel(String(agencyRaw))
        : 'N/A';
      const date = fmtDate((trip as any).startDate ?? (trip as any).date ?? (trip as any).createdAt);
      const st = String((trip as any).status ?? 'N/A').toUpperCase();
      const distRaw = (trip as any).distance;
      const distNum = distRaw == null ? null : Number(distRaw);
      const distText = distNum != null && Number.isFinite(distNum) ? `${distNum} km` : (distRaw ?? 'N/A');
      const cabCost = fmtRs((trip as any).cabCost ?? 0);

      // Card height becomes dynamic if Vehicle wraps.
      // Most values fit in one line, but Vehicle can be long.
      const cardPadX = 3;
      const colTripX = leftX + cardPadX;
      const colDriverX = leftX + 86;
      const colVehicleX = leftX + 136;

      // Pre-calc wrapped vehicle lines (up to 2 lines for layout stability)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const vehicleValX = colVehicleX + textWidth('Vehicle:') + 3;
      const vehicleMaxW = rightX - cardPadX - vehicleValX;
      const vehicleLines = doc
        .splitTextToSize(String(vehicleText), Math.max(10, vehicleMaxW))
        .slice(0, 2) as string[];
      const extraHeaderH = Math.max(0, vehicleLines.length - 1) * 4.6;
      const cardH = 34 + extraHeaderH;

      ensureSpace(cardH + 6);

      // Card
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(leftX, y - 2, pageWidth, cardH, 2, 2, 'S');

      // Card header line: Trip | Driver | Vehicle
      const headerY = y + 4;
      // Trip
      writeText(`Trip ${idx + 1}: ${tripNo}`, colTripX, headerY, { size: 10, bold: true });

      // Driver (truncate to driver column width)
      writeText('Driver:', colDriverX, headerY, { size: 9, bold: true });
      doc.setFontSize(9);
      const driverValX = colDriverX + textWidth('Driver:') + 3;
      const driverMaxW = colVehicleX - driverValX - 2;
      writeText(truncateToWidth(driverName, driverMaxW), driverValX, headerY, { size: 9 });

      // Vehicle (wrap up to 2 lines so values are visible)
      writeText('Vehicle:', colVehicleX, headerY, { size: 9, bold: true });
      vehicleLines.forEach((ln, i) => {
        writeText(ln, vehicleValX, headerY + i * 4.6, { size: 9 });
      });

      // thin divider in card
      doc.setDrawColor(220, 220, 220);
      const dividerY = y + 7 + extraHeaderH;
      doc.line(leftX + 3, dividerY, rightX - 3, dividerY);

      // Left column (From/To/Customer/Agency)
      const rowY1 = dividerY + 5;
      const leftColX = leftX + 3;
      const midColX = leftX + 82;
      const rightColX = leftX + 132;

      const leftValMaxW = midColX - (leftColX + 26) - 4;
      const midValMaxW = rightColX - (midColX + 26) - 4;

      writeDetailRow('From:', String(from), leftColX, rowY1, leftValMaxW);
      writeDetailRow('To:', String(to), leftColX, rowY1 + lineH, leftValMaxW);
      writeDetailRow('Customer:', String(customer), leftColX, rowY1 + lineH * 2, leftValMaxW);
      writeDetailRow('Agency:', String(agency), leftColX, rowY1 + lineH * 3, leftValMaxW);

      // Middle column (Date/Status/Distance)
      writeDetailRow('Date:', String(date), midColX, rowY1, midValMaxW);
      writeDetailRow('Status:', String(st), midColX, rowY1 + lineH, midValMaxW);
      writeDetailRow('Distance:', String(distText), midColX, rowY1 + lineH * 2, midValMaxW);

      // Right column (Cab Cost)
      writeText('Cab Cost', rightColX, rowY1, { size: 9, bold: true });
      // Cab cost should always be fully visible (no truncation).
      writeText(String(cabCost), rightColX + textWidth('Cab Cost') + 4, rowY1, { size: 9 });

      y += cardH + 6;
    });

    const today = fmtDate(new Date()).replaceAll('/', '-');
    doc.save(`Trip History Report ${today}.pdf`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden bg-[var(--bg-main)] px-4 pb-3 pt-3 sm:gap-3.5 sm:px-5 sm:pt-3">

      {/* Page Header */}
      <div className="flex shrink-0 flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white sm:text-xl">
            Trip History
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Filter and open trips for full details
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#1e2638] dark:text-slate-300 dark:hover:bg-white/5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Compact filter toolbar */}
      <div className="shrink-0 rounded-xl border border-slate-200 bg-[var(--bg-card)] p-2.5 shadow-sm dark:border-[#1e2638] sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full max-w-xs sm:w-56 sm:max-w-none md:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search trips…"
              className="h-8 w-full rounded-md border border-slate-200 bg-[var(--bg-elevated)] py-0 pl-8 pr-8 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={`${filterInputCls} min-w-[7.5rem]`}
            aria-label="Status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={
              filterMode === 'daterange' ? CUSTOM_DATE_VALUE : month
            }
            onChange={(e) => handleMonthChange(e.target.value)}
            className={`${filterInputCls} min-w-[8.5rem] ${
              filterMode === 'month'
                ? 'border-indigo-300 text-indigo-700 dark:border-indigo-500/40 dark:text-indigo-300'
                : ''
            }`}
            aria-label="Period"
          >
            {monthOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {filterMode === 'daterange' && (
            <div className="flex items-center gap-1">
              <DatePicker
                value={startDate}
                onChange={handleStartDateChange}
                className={`${filterInputCls} w-[8.25rem] font-mono`}
              />
              <span className="text-[10px] font-medium text-slate-400">–</span>
              <DatePicker
                value={endDate}
                min={startDate || undefined}
                onChange={handleEndDateChange}
                className={`${filterInputCls} w-[8.25rem] font-mono`}
              />
            </div>
          )}

          {(search ||
            status !== 'all' ||
            filterMode === 'daterange' ||
            (filterMode === 'month' && month !== currentMonth)) && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-8 items-center rounded-md px-2 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Trip grid */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
            <button
              onClick={load}
              className="text-xs text-rose-600 underline hover:no-underline dark:text-rose-300"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && trips.length === 0 && (
          <EmptyState onReset={resetFilters} />
        )}

        {!loading && !error && trips.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
            {trips.map((trip) => (
              <TripCard
                key={trip._id}
                trip={trip}
                onDeleted={load}
                onPaymentRecorded={handlePaymentRecorded}
                onTripUpdated={handleTripUpdated}
                resolveAgencyLabel={resolveAgencyLabel}
              />
            ))}
          </div>
        )}

        {!loading && (
          <Pagination p={pagination} onChange={setPage} />
        )}
      </div>
    </div>
  );
}
