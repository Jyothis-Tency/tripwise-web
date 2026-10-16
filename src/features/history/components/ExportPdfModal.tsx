import { useState } from 'react';
import { X, FileDown, Loader2 } from 'lucide-react';
import { DatePicker } from '../../../components/ui/DatePicker';
import { todayIsoInAppTz } from '../../../lib/datePickerUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  onExport: (start: string, end: string) => Promise<void>;
}

function istMonthBounds(): { first: string; last: string } {
  const ym = todayIsoInAppTz().slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  return { first, last };
}

export function ExportPdfModal({ open, onClose, onExport }: Props) {
  const bounds = istMonthBounds();

  const [startDate, setStartDate] = useState(bounds.first);
  const [endDate, setEndDate] = useState(bounds.last);
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport(startDate, endDate);
      onClose();
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-[var(--bg-card)] shadow-2xl dark:border-[#1e2638]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-[#1e2638]">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileDown className="h-5 w-5 text-indigo-500" />
            Export History PDF
          </h3>
          <button
            onClick={onClose}
            disabled={exporting}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select the date range for the trip history report you wish to export.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 dark:text-slate-300">Start Date</label>
              <DatePicker
                value={startDate}
                onChange={(v) => {
                  setStartDate(v);
                  if (endDate && v && endDate < v) setEndDate(v);
                }}
                disabled={exporting}
                className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 dark:text-slate-300">End Date</label>
              <DatePicker
                value={endDate}
                min={startDate || undefined}
                onChange={setEndDate}
                disabled={exporting}
                className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-white/[0.03] border-t border-slate-100 flex justify-end gap-3 dark:border-[#1e2638]">
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] hover:bg-slate-100 dark:border-[#1e2638] dark:hover:bg-white/5 text-slate-600 text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !startDate || !endDate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
