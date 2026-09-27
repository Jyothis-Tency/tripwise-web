import React from 'react';
import type { Reminder } from '../api';
import { completeReminder, deleteReminder } from '../api';

/* ── Helpers ───────────────────────────────────────── */
function fmtDate(iso?: string) {
  if (!iso) return 'N/A';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; }
}

function priorityStyle(r: Reminder) {
  if (r.isCompleted) return { color: '#10b981', bg: 'rgba(16,185,129,.08)', icon: '✓', label: 'Done' };
  const d = r.daysUntilTrip;
  if (d !== undefined && d !== null) {
    if (d < 0) return { color: '#ef4444', bg: 'rgba(239,68,68,.08)', icon: '⚠', label: 'Overdue' };
    if (d === 0) return { color: '#f59e0b', bg: 'rgba(245,158,11,.08)', icon: '⏰', label: 'Today' };
    if (d <= 2) return { color: '#ef4444', bg: 'rgba(239,68,68,.08)', icon: '⚠', label: `${d}d` };
    return { color: '#6366f1', bg: 'rgba(99,102,241,.08)', icon: '🗓', label: `${d}d` };
  }
  return { color: '#6366f1', bg: 'rgba(99,102,241,.08)', icon: '🗓', label: '' };
}

interface Props { reminder: Reminder; onRefresh: () => void; }

const ReminderCard: React.FC<Props> = ({ reminder, onRefresh }) => {
  const p = priorityStyle(reminder);
  const rid = reminder._id ?? reminder.id ?? '';

  const handleComplete = async () => { try { await completeReminder(rid); onRefresh(); } catch (e) { console.error(e); } };
  const handleDelete = async () => { if (!confirm('Delete this reminder?')) return; try { await deleteReminder(rid); onRefresh(); } catch (e) { console.error(e); } };

  return (
    <div className="mb-2 rounded-xl bg-[var(--bg-card)] p-3.5 shadow-sm transition-shadow hover:shadow-md sm:mb-2.5 sm:p-4 dark:hover:bg-white/[0.04]" style={{ border: `1px solid ${p.color}22`, borderLeft: `3px solid ${p.color}` }}>
      {/* Row 1: Trip ID + Priority badge */}
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-[13px] sm:text-sm text-slate-800 dark:text-white">{reminder.tripId ?? rid.slice(-6)}</span>
        {p.label && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg" style={{ background: p.bg, color: p.color }}>
            {p.icon} {p.label}
          </span>
        )}
      </div>

      {/* Row 2: Customer + Route */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-1.5 text-[13px]">
        <div>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{reminder.customerName || 'N/A'}</span>
          {reminder.customerPhone && <span className="text-slate-400 ml-1.5 text-xs dark:text-slate-500">{reminder.customerPhone}</span>}
        </div>
        <span className="text-slate-500 mt-1 sm:mt-0 dark:text-slate-400">{reminder.fromLocation || '?'} → {reminder.toLocation || '?'}</span>
      </div>

      {/* Row 3: Date + assignment chips */}
      <div className="flex flex-wrap justify-between items-center mt-2 gap-2 text-xs">
        <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md font-medium dark:text-slate-400 dark:bg-white/5">Trip: {fmtDate(reminder.tripDate)}</span>
        <div className="flex flex-wrap gap-1.5">
          {!reminder.isCompleted && !reminder.vehicleAssigned && <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border border-red-100 dark:bg-red-500/10 dark:border-red-500/30">No Vehicle</span>}
          {!reminder.isCompleted && !reminder.driverAssigned && <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border border-red-100 dark:bg-red-500/10 dark:border-red-500/30">No Driver</span>}
          {!reminder.isCompleted && reminder.vehicleAssigned && reminder.driverAssigned && <span className="bg-green-50 text-emerald-600 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border border-green-100 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400">Assigned</span>}
          {reminder.isCompleted && <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400">Completed</span>}
        </div>
      </div>

      {/* Row 4: Payment info */}
      {(reminder.advanceCollected != null || reminder.totalPayment != null) && (
        <div className="flex flex-wrap justify-between mt-2.5 text-xs text-slate-500 dark:text-slate-400">
          {reminder.advanceCollected != null && <span>Advance: ₹{Number(reminder.advanceCollected).toLocaleString('en-IN')}</span>}
          {reminder.totalPayment != null && <span>Total: ₹{Number(reminder.totalPayment).toLocaleString('en-IN')}</span>}
        </div>
      )}

      {/* Row 5: Vehicle type */}
      {reminder.vehicleDetails?.vehicleType && (
        <div className="mt-1.5 text-xs text-slate-500 font-medium dark:text-slate-400">🚗 {reminder.vehicleDetails.vehicleType}</div>
      )}

      {/* Row 6: Message + Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mt-3.5 gap-2 sm:gap-4 border-t border-slate-100/60 pt-3 dark:border-white/10">
        {reminder.message ? (
          <span className="text-xs text-slate-400 italic flex-1 overflow-hidden text-ellipsis whitespace-nowrap bg-slate-50 px-2 py-1 rounded-md border border-slate-100 dark:text-slate-500 dark:bg-white/5 dark:border-white/10">{reminder.message}</span>
        ) : <div className="flex-1" />}
        <div className="flex gap-2 ml-auto">
          {!reminder.isCompleted && (
            <button onClick={handleComplete} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 rounded-full px-3.5 py-1 text-[11px] font-bold tracking-wide cursor-pointer transition-colors shadow-sm">
              Mark Complete
            </button>
          )}
          <button onClick={handleDelete} className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors shadow-sm dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:border-red-500/30" title="Delete Reminder">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReminderCard;
