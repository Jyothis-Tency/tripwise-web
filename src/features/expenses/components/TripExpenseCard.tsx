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
    <div className="bg-white rounded-xl border border-slate-100 mb-2.5 overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      {/* Trip header */}
      <div onClick={() => setExpanded(!expanded)} className="p-3 sm:p-4 cursor-pointer flex justify-between items-center transition-colors hover:bg-slate-50">
        <div>
          <div className="font-bold text-sm text-slate-800">{trip.tripNumber || (tripId ? tripId.slice(-6) : 'Trip')}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {trip.customer && <span>{trip.customer} · </span>}
            {trip.fromLocation || '?'} → {trip.toLocation || '?'}
            {trip.startDate && <span> · {fmtDate(trip.startDate)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-bold text-sm sm:text-[15px] text-red-500">₹{total.toLocaleString('en-IN')}</span>
          <span className="text-[11px] sm:text-xs text-slate-400 hidden xs:inline">{expenses.length} items</span>
          <span className="text-sm text-slate-400 transition-transform duration-200" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
        </div>
      </div>

      {/* Expense list (expandable) */}
      {expanded && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
          {expenses.length > 0 ? expenses.map((exp, idx) => (
            <div key={exp._id || idx} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <div className="text-[13px] text-slate-700">
                {exp.description || exp.category || 'Expense'}
                {exp.date && <span className="text-slate-400 ml-1.5 text-[11px]">{fmtDate(exp.date)}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[13px] text-red-500">₹{Number(exp.amount).toLocaleString('en-IN')}</span>
                <button onClick={() => handleDeleteExp(exp._id)} className="bg-red-50 hover:bg-red-100 text-red-500 border-0 rounded-md px-1.5 py-0.5 text-[10px] cursor-pointer transition-colors" title="Delete">✕</button>
              </div>
            </div>
          )) : <div className="text-xs text-slate-400 text-center p-2">No expenses</div>}

          {/* Add inline */}
          {adding ? (
            <div className="mt-2 flex flex-wrap xs:flex-nowrap gap-1.5 sm:gap-2 items-center">
              <input placeholder="Description" value={newExp.description} onChange={e => setNewExp(p => ({ ...p, description: e.target.value }))} className="flex-1 min-w-[100px] px-2.5 py-1.5 rounded-md border border-slate-200 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
              <input placeholder="₹" type="number" value={newExp.amount} onChange={e => setNewExp(p => ({ ...p, amount: e.target.value }))} className="w-16 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
              <div className="flex gap-1.5 ml-auto xs:ml-0">
                <button onClick={handleAddExp} disabled={saving} className="px-3 py-1.5 rounded-md border-0 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-60">{saving ? '…' : 'Add'}</button>
                <button onClick={() => setAdding(false)} className="px-2 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer transition-colors">✕</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="mt-2 w-full p-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs cursor-pointer transition-colors">
              + Add expense to this trip
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TripExpenseCard;
