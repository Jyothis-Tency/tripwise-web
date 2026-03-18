import React, { useState } from 'react';
import type { TripWithExpenses } from '../api';
import { deleteTripExpense, addTripExpense } from '../api';

function fmtDate(iso?: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; }
}

interface Props { trip: TripWithExpenses; onRefresh: () => void; }

const TripExpenseCard: React.FC<Props> = ({ trip, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newExp, setNewExp] = useState({ description: '', amount: '', category: 'Fuel' });
  const [saving, setSaving] = useState(false);

  const tripId = trip._id || (trip as any).id || '';
  const expenses = trip.expenses ?? [];
  const total = trip.totalExpenses ?? expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const handleDeleteExp = async (expId: string) => {
    if (!confirm('Delete this expense?')) return;
    try { await deleteTripExpense(tripId, expId); onRefresh(); } catch (e) { console.error(e); }
  };

  const handleAddExp = async () => {
    if (!newExp.description || !newExp.amount) return;
    setSaving(true);
    try {
      await addTripExpense(tripId, { description: newExp.description, amount: Number(newExp.amount), category: newExp.category });
      setNewExp({ description: '', amount: '', category: 'Fuel' }); setAdding(false); onRefresh();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9', marginBottom: 10, overflow: 'hidden' }}>
      {/* Trip header */}
      <div onClick={() => setExpanded(!expanded)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{trip.tripNumber || (tripId ? tripId.slice(-6) : 'Trip')}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {trip.customer && <span>{trip.customer} · </span>}
            {trip.fromLocation || '?'} → {trip.toLocation || '?'}
            {trip.startDate && <span> · {fmtDate(trip.startDate)}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>₹{total.toLocaleString('en-IN')}</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{expenses.length} items</span>
          <span style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '.2s', fontSize: 14 }}>▾</span>
        </div>
      </div>

      {/* Expense list (expandable) */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 16px 12px' }}>
          {expenses.length > 0 ? expenses.map((exp, idx) => (
            <div key={exp._id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ fontSize: 13, color: '#334155' }}>
                {exp.description || exp.category || 'Expense'}
                {exp.date && <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11 }}>{fmtDate(exp.date)}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#ef4444' }}>₹{Number(exp.amount).toLocaleString('en-IN')}</span>
                <button onClick={() => handleDeleteExp(exp._id)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          )) : <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 8 }}>No expenses</div>}

          {/* Add inline */}
          {adding ? (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <input placeholder="Description" value={newExp.description} onChange={e => setNewExp(p => ({ ...p, description: e.target.value }))} style={{ flex: 2, padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <input placeholder="₹" type="number" value={newExp.amount} onChange={e => setNewExp(p => ({ ...p, amount: e.target.value }))} style={{ width: 70, padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <button onClick={handleAddExp} disabled={saving} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{saving ? '…' : 'Add'}</button>
              <button onClick={() => setAdding(false)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ marginTop: 8, width: '100%', padding: '6px', borderRadius: 6, border: '1px dashed #cbd5e1', background: '#f8fafc', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
              + Add expense to this trip
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TripExpenseCard;
