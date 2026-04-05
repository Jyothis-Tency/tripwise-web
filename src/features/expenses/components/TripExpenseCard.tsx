import React, { useState } from 'react';
import type { TripWithExpenses } from '../api';
import { deleteTripExpense, addTripExpense, updateTripExpense } from '../api';

function fmtDate(iso?: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; }
}

const TRIP_EXPENSE_CATEGORIES = ['Fuel', 'Toll', 'Tax & Permit', 'Parking', 'Maintenance', 'Repair', 'Food', 'Cleaning', 'Fine', 'Other'];

interface Props { trip: TripWithExpenses; onRefresh: () => void; }

const TripExpenseCard: React.FC<Props> = ({ trip, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newExp, setNewExp] = useState({ description: '', amount: '', category: 'Fuel' });
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExp, setEditExp] = useState({ description: '', amount: '', category: 'Fuel' });
  const [saving, setSaving] = useState(false);

  const tripId = trip._id || (trip as any).id || '';
  const expenses = trip.expenses ?? [];
  const total = trip.totalExpenses ?? expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const handleDeleteExp = async (expId: string) => {
    if (!confirm('Delete this expense?')) return;
    try { await deleteTripExpense(tripId, expId); onRefresh(); } catch (e) { console.error(e); }
  };

  const handleAddExp = async () => {
    if (!newExp.amount) return;
    setSaving(true);
    try {
      await addTripExpense(tripId, { 
        description: newExp.description || newExp.category, 
        amount: Number(newExp.amount), 
        category: newExp.category.toLowerCase() 
      });
      setNewExp({ description: '', amount: '', category: 'Fuel' }); 
      setAdding(false); 
      onRefresh();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleEditExp = async () => {
    if (!editExp.amount || !editingId) return;
    setSaving(true);
    try {
      await updateTripExpense(tripId, editingId, { 
        description: editExp.description || editExp.category, 
        amount: Number(editExp.amount), 
        category: editExp.category.toLowerCase() 
      });
      setEditingId(null);
      onRefresh();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const startEdit = (exp: any) => {
    setEditingId(exp._id);
    const catFormatted = TRIP_EXPENSE_CATEGORIES.find(c => c.toLowerCase() === exp.category?.toLowerCase() || c.toLowerCase() === exp.type?.toLowerCase()) || 'Other';
    setEditExp({
      description: exp.description || '',
      amount: String(exp.amount || ''),
      category: catFormatted
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const inputCls = "px-2 py-1.5 rounded-md border border-slate-200 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white";

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
            <div key={exp._id || idx} className="py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              {editingId === exp._id ? (
                // EDIT MODE
                <div className="flex flex-wrap xs:flex-nowrap gap-1.5 sm:gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <select 
                    value={editExp.category} 
                    onChange={e => setEditExp(p => ({ ...p, category: e.target.value }))}
                    className={`${inputCls} min-w-[90px]`}
                  >
                    {TRIP_EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input placeholder="Desc" value={editExp.description} onChange={e => setEditExp(p => ({ ...p, description: e.target.value }))} className={`${inputCls} flex-1 min-w-[80px]`} />
                  <input placeholder="₹" type="number" value={editExp.amount} onChange={e => setEditExp(p => ({ ...p, amount: e.target.value }))} className={`${inputCls} w-20`} />
                  
                  <div className="flex gap-1">
                    <button onClick={handleEditExp} disabled={saving} className="px-2 py-1.5 rounded-md border-0 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-60">{saving ? '…' : 'Save'}</button>
                    <button onClick={cancelEdit} className="px-1.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 text-[11px] cursor-pointer">✕</button>
                  </div>
                </div>
              ) : (
                // VIEW MODE
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="text-[13px] font-medium text-slate-700 flex items-center gap-1.5">
                      <span className="capitalize">{(exp as any).type || exp.category || 'Expense'}</span>
                      {exp.description && exp.description.toLowerCase() !== ((exp as any).type?.toLowerCase() || exp.category?.toLowerCase()) && (
                        <span className="text-slate-500 font-normal truncate max-w-[120px] xs:max-w-[180px]">— {exp.description}</span>
                      )}
                    </div>
                    {exp.date && <span className="text-slate-400 text-[11px]">{fmtDate(exp.date)}</span>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-[13px] text-red-500">₹{Number(exp.amount).toLocaleString('en-IN')}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(exp)} className="text-indigo-500 hover:bg-indigo-50 rounded-md p-1 px-1.5 text-[11px] cursor-pointer" title="Edit">✎</button>
                      <button onClick={() => handleDeleteExp(exp._id)} className="text-red-500 hover:bg-red-50 rounded-md p-1 px-1.5 text-[11px] cursor-pointer" title="Delete">✕</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )) : <div className="text-xs text-slate-400 text-center p-2">No expenses</div>}

          {/* Add inline */}
          {adding && !editingId ? (
            <div className="mt-3 flex flex-wrap xs:flex-nowrap gap-1.5 sm:gap-2 items-center bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 border-dashed">
              <select 
                value={newExp.category} 
                onChange={e => setNewExp(p => ({ ...p, category: e.target.value }))}
                className={`${inputCls} min-w-[90px] border-indigo-200 focus:border-indigo-500`}
              >
                {TRIP_EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input placeholder="Desc (Optional)" value={newExp.description} onChange={e => setNewExp(p => ({ ...p, description: e.target.value }))} className={`${inputCls} flex-1 min-w-[80px] border-indigo-200 focus:border-indigo-500`} />
              <input placeholder="₹ Amount" type="number" value={newExp.amount} onChange={e => setNewExp(p => ({ ...p, amount: e.target.value }))} className={`${inputCls} w-20 border-indigo-200 focus:border-indigo-500`} />
              
              <div className="flex gap-1 ml-auto xs:ml-0">
                <button onClick={handleAddExp} disabled={saving} className="px-3 py-1.5 rounded-md border-0 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-60">{saving ? '…' : 'Add'}</button>
                <button onClick={() => setAdding(false)} className="px-2 py-1.5 rounded-md border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[11px] cursor-pointer">✕</button>
              </div>
            </div>
          ) : !editingId ? (
            <button onClick={() => { setAdding(true); setEditingId(null); }} className="mt-2 w-full p-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs cursor-pointer transition-colors">
              + Add expense to this trip
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TripExpenseCard;
