import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, RefreshCw, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import { fetchTripHistory, type HistoryTrip, type HistoryPagination, type HistoryPaymentSummary } from '../api';
import { TripCard } from '../components/TripCard';
import { ExportPdfModal } from '../components/ExportPdfModal';

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

function fmtCurrency(v: number): string {
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getCurrentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [{ value: 'all_time', label: '📅 All Time' }];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    opts.push({ value, label });
  }
  return opts;
}

// ─── Payment Summary Banner ───────────────────────────────────────────────────

function PaymentBanner({ summary }: { summary: HistoryPaymentSummary }) {
  const cards = [
    { label: 'Total Amount', value: summary.totalAmount, gradient: 'from-slate-50 to-slate-100/80', border: 'border-slate-200', color: 'text-slate-800', icon: '💰' },
    { label: 'Total Paid',   value: summary.totalPaid,   gradient: 'from-emerald-50 to-emerald-100/80', border: 'border-emerald-200', color: 'text-emerald-700', icon: '✅' },
    { label: 'Outstanding',  value: summary.totalOutstanding, gradient: 'from-red-50 to-red-100/80', border: 'border-red-200', color: 'text-red-700', icon: '⏳' },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {cards.map(item => (
        <div key={item.label} className={`rounded-xl bg-gradient-to-br ${item.gradient} border ${item.border} px-5 py-4 sm:py-5 shadow-sm`}>
          <div className="flex items-center justify-between sm:block">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:hidden">{item.icon}</span>
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{item.label}</span>
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${item.color} sm:mt-1.5 tabular-nums`}>{fmtCurrency(item.value)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
      <div className="rounded-full bg-gradient-to-br from-slate-100 to-slate-200 p-4 sm:p-5 mb-4 shadow-inner">
        <Search className="h-7 w-7 sm:h-8 sm:w-8 text-slate-400" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-slate-700 mb-1">No trips found</h3>
      <p className="text-sm sm:text-sm text-slate-500 mb-4 px-4">Try adjusting your filters or search query.</p>
      <button onClick={onReset} className="text-sm sm:text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition">Clear all filters</button>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ p, onChange }: { p: HistoryPagination; onChange: (page: number) => void }) {
  if (p.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 pb-2">
      <span className="text-xs sm:text-sm text-slate-500">Page {p.page}/{p.pages} · {p.total} trips</span>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button disabled={!p.hasPrev} onClick={() => onChange(p.page - 1)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Prev
        </button>
        <button disabled={!p.hasNext} onClick={() => onChange(p.page + 1)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
          Next <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
  const [status, setStatus]       = useState('completed');
  const [month, setMonth]         = useState(currentMonth);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [page, setPage]           = useState(1);
  const [filterMode, setFilterMode] = useState<'month' | 'daterange'>('month');
  const LIMIT = 10;
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Data state
  const [trips, setTrips]               = useState<HistoryTrip[]>([]);
  const [pagination, setPagination]     = useState<HistoryPagination>({
    page: 1, limit: LIMIT, total: 0, pages: 1, hasNext: false, hasPrev: false,
  });
  const [paymentSummary, setPaymentSummary] = useState<HistoryPaymentSummary>({
    totalAmount: 0, totalPaid: 0, totalOutstanding: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

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
        sortBy: 'updatedAt',
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
      const result = await fetchTripHistory({ page: 1, limit: 1 });
      setPaymentSummary(result.paymentSummary);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadAllTimeStats(); }, [loadAllTimeStats]);

  const handleMonthChange = (val: string) => {
    setMonth(val);
    setFilterMode('month');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
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

  const hasActiveFilters = status !== 'all' || month !== currentMonth || startDate || endDate || debouncedSearch;

  const handleExportPdf = async (start: string, end: string) => {
    // Backend stores Trip.startDate as a string (often `D/M/YYYY`),
    // so server-side date range filtering can miss matches depending on format.
    // For PDF export we fetch and apply the selected range client-side.
    const result = await fetchTripHistory({
      limit: 10000, 
      sortBy: 'startDate',
      sortOrder: 'asc'
    });
    
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

    const startD = parseLooseDate(start);
    const endD = parseLooseDate(end);
    if (!startD || !endD) {
      alert('Invalid date range.');
      return;
    }
    startD.setHours(0, 0, 0, 0);
    endD.setHours(23, 59, 59, 999);

    const inRange = (d: Date | null): boolean => {
      if (!d) return false;
      const ts = d.getTime();
      return ts >= startD.getTime() && ts <= endD.getTime();
    };

    const exportTrips = (result.trips || []).filter((t) => {
      // Some records store logical trip date in `startDate` (string),
      // while server-side filters historically used `createdAt`.
      // To avoid "No trips" false negatives, accept if ANY of these dates match.
      const logicalTripDate = parseLooseDate((t as any).startDate ?? (t as any).date);
      const createdAtDate = parseLooseDate((t as any).createdAt);
      const updatedAtDate = parseLooseDate((t as any).updatedAt);

      return inRange(logicalTripDate) || inRange(createdAtDate) || inRange(updatedAtDate);
    });
    if (!exportTrips || exportTrips.length === 0) {
      alert("No trips found in this date range.");
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const leftX = 14;
    const rightX = 196;
    const pageBottomY = 280;
    let y = 16;

    const fmtDate = (raw: any): string => {
      const dt = raw ? new Date(raw) : null;
      if (!dt || Number.isNaN(dt.getTime())) return 'N/A';
      return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
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
      const agency = (trip as any).agencyName ?? (trip as any).agency ?? 'N/A';
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
    <div className="flex flex-col gap-5 sm:gap-6 px-4 sm:px-6 py-5 sm:py-6">

      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 bg-gradient-to-r from-slate-800 to-indigo-700 bg-clip-text text-transparent">Trip History</h1>
          <p className="text-sm text-slate-500 mt-1">View, filter and manage your trips</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-2.5 text-sm font-medium hover:bg-indigo-100 transition shrink-0">
            <FileDown className="h-4 w-4" />
            Export PDF
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 shrink-0">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Payment Summary */}
      <PaymentBanner summary={paymentSummary} />

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 space-y-3 sm:space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search by Trip ID, driver, vehicle or location…"
            className="w-full pl-11 pr-10 py-3 rounded-lg border border-slate-200 text-base outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition bg-slate-50 focus:bg-white"
          />
          {search && (
            <button onClick={() => handleSearchChange('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
          {/* Status */}
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Month */}
          <select value={filterMode === 'month' ? month : ''}
            onChange={e => handleMonthChange(e.target.value)}
            className={`rounded-lg border px-4 py-3 text-sm font-medium outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white ${
              filterMode === 'month' ? 'border-indigo-300 text-indigo-700 ring-1 ring-indigo-100' : 'border-slate-200 text-slate-700'
            }`}>
            {monthOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Date range — OR separator */}
          <span className="hidden sm:flex items-center text-xs font-semibold text-slate-400 uppercase">or</span>

          {/* Date range */}
          <div className={`col-span-2 flex items-center gap-2 rounded-lg border p-1 ${
            filterMode === 'daterange' ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-transparent'
          }`}>
            <input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
            <span className="text-slate-400 text-sm shrink-0">to</span>
            <input type="date" value={endDate} onChange={e => handleEndDateChange(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
          </div>

          {/* Clear */}
          {hasActiveFilters && (
            <button onClick={resetFilters}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-100 transition">
              <X className="h-4 w-4" /> Reset to This Month
            </button>
          )}
        </div>
      </div>

      {/* Trip List */}
      <div className="space-y-3">
        {loading && (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between">
            {error}
            <button onClick={load} className="text-red-600 underline text-xs hover:no-underline">Retry</button>
          </div>
        )}

        {!loading && !error && trips.length === 0 && (
          <EmptyState onReset={resetFilters} />
        )}

        {!loading && !error && trips.map(trip => (
          <TripCard
            key={trip._id}
            trip={trip}
            onDeleted={load}
            onPaymentRecorded={load}
          />
        ))}
      </div>

      {/* Pagination */}
      {!loading && <Pagination p={pagination} onChange={setPage} />}
      
      <ExportPdfModal 
        open={exportModalOpen} 
        onClose={() => setExportModalOpen(false)} 
        onExport={handleExportPdf}
      />
    </div>
  );
}
