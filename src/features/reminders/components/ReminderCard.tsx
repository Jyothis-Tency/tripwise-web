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
    <div style={{ background: '#fff', border: `1px solid ${p.color}22`, borderLeft: `3px solid ${p.color}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
      {/* Row 1: Trip ID + Priority badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{reminder.tripId ?? rid.slice(-6)}</span>
        {p.label && (
          <span style={{ background: p.bg, color: p.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8 }}>
            {p.icon} {p.label}
          </span>
        )}
      </div>

      {/* Row 2: Customer + Route */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13 }}>
        <div>
          <span style={{ fontWeight: 600, color: '#334155' }}>{reminder.customerName || 'N/A'}</span>
          {reminder.customerPhone && <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 12 }}>{reminder.customerPhone}</span>}
        </div>
        <span style={{ color: '#64748b' }}>{reminder.fromLocation || '?'} → {reminder.toLocation || '?'}</span>
      </div>

      {/* Row 3: Date + assignment chips */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 12 }}>
        <span style={{ color: '#64748b' }}>Trip: {fmtDate(reminder.tripDate)}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {!reminder.isCompleted && !reminder.vehicleAssigned && <span style={{ background: '#fef2f2', color: '#ef4444', padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600 }}>No Vehicle</span>}
          {!reminder.isCompleted && !reminder.driverAssigned && <span style={{ background: '#fef2f2', color: '#ef4444', padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600 }}>No Driver</span>}
          {!reminder.isCompleted && reminder.vehicleAssigned && reminder.driverAssigned && <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600 }}>Assigned</span>}
          {reminder.isCompleted && <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600 }}>Completed</span>}
        </div>
      </div>

      {/* Row 4: Payment info */}
      {(reminder.advanceCollected != null || reminder.totalPayment != null) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: '#64748b' }}>
          {reminder.advanceCollected != null && <span>Advance: ₹{Number(reminder.advanceCollected).toLocaleString('en-IN')}</span>}
          {reminder.totalPayment != null && <span>Total: ₹{Number(reminder.totalPayment).toLocaleString('en-IN')}</span>}
        </div>
      )}

      {/* Row 5: Vehicle type */}
      {reminder.vehicleDetails?.vehicleType && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>🚗 {reminder.vehicleDetails.vehicleType}</div>
      )}

      {/* Row 6: Message + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        {reminder.message && <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{reminder.message}</span>}
        <div style={{ display: 'flex', gap: 6 }}>
          {!reminder.isCompleted && (
            <button onClick={handleComplete} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 14, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              Mark Complete
            </button>
          )}
          <button onClick={handleDelete} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 14, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReminderCard;
