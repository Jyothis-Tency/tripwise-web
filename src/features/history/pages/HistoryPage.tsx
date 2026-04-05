import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, RefreshCw, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import { fetchTripHistory, type HistoryTrip, type HistoryPagination, type HistoryPaymentSummary } from '../api';
import { TripCard } from '../components/TripCard';
import { ExportPdfModal } from '../components/ExportPdfModal';
import { useAuth } from '../../../hooks/useAuth';

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
  const { user } = useAuth();
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
    const result = await fetchTripHistory({
      startDate: start,
      endDate: end,
      limit: 10000, 
      sortBy: 'startDate',
      sortOrder: 'asc'
    });
    
    const exportTrips = result.trips;
    if (!exportTrips || exportTrips.length === 0) {
      alert("No trips found in this date range.");
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    let y = 20;

    // Report Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const ownerName = user?.company || user?.name || 'Tripwise';
    doc.text(`${ownerName} History Report`, 14, y);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Timeline: ${start} to ${end}`, 14, y + 6);
    y += 16;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y - 5, 182, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('DATE', 16, y);
    doc.text('TRIP', 40, y);
    doc.text('VEHICLE', 85, y);
    doc.text('STATUS', 135, y);
    doc.text('PROFIT', 170, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42); // slate-900

    exportTrips.forEach(trip => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const rawDate = trip.startDate || trip.createdAt || '';
      const d = rawDate ? new Date(rawDate).toLocaleDateString('en-IN', {day:'2-digit', month:'2-digit', year:'numeric'}) : '--';
      const no = trip.tripNumber ? String(trip.tripNumber).substring(0, 15) : '--';
      
      let vh = '--';
      if (typeof trip.vehicle === 'object' && trip.vehicle !== null) {
        vh = trip.vehicle.vehicleNumber || '--';
      }

      const st = (trip.status || '--').toUpperCase();
      const rv = Number(trip.ownerProfit || 0).toLocaleString('en-IN');
      
      doc.text(d, 16, y);
      doc.text(no, 40, y);
      doc.text(vh.substring(0,25), 85, y);
      doc.text(st, 135, y);
      doc.text(`Rs. ${rv}`, 170, y);
      y += 8;
    });

    // Summary footer
    y += 5;
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const grandTotal = exportTrips.reduce((acc, t) => acc + Number(t.ownerProfit || 0), 0).toLocaleString('en-IN');
    doc.text(`Total Owner Profit Generated: Rs. ${grandTotal}`, 14, y);

    doc.save(`trips_report_${start}_to_${end}.pdf`);
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
