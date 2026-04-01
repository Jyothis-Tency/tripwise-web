import React from 'react';
import type { Expense } from '../api';
import { deleteExpense } from '../api';

const CAT_ICONS: Record<string, string> = {
  fuel: '⛽', maintenance: '🔧', insurance: '🛡️', toll: '🛣️', parking: '🅿️',
  salary: '💰', food: '🍔', office: '🏢', travel: '✈️', miscellaneous: '📦', other: '📦',
};

function fmtDate(iso?: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); } catch { return iso; }
}

interface Props { expense: Expense; onRefresh: () => void; onEdit: (expense: Expense) => void; }

const ExpenseCard: React.FC<Props> = ({ expense, onRefresh, onEdit }) => {
  const cat = (expense.category || 'other').toLowerCase();
  const icon = CAT_ICONS[cat] ?? '📦';

  const handleDelete = async () => {
    if (!confirm('Delete this expense?')) return;
    try { await deleteExpense(expense._id); onRefresh(); } catch (e) { console.error(e); }
  };

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 mb-2 border border-slate-100 shadow-sm transition-shadow hover:shadow-md group">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[13px] sm:text-sm text-slate-800 truncate">{expense.title || expense.description || 'Expense'}</div>
        <div className="text-[11px] sm:text-xs text-slate-400 flex gap-2 mt-0.5">
          <span className="capitalize">{expense.category}</span>
          <span>{fmtDate(expense.date)}</span>
          {expense.notes && <span className="truncate max-w-[120px] italic">{expense.notes}</span>}
        </div>
      </div>
      <span className="font-bold text-sm sm:text-[15px] text-red-500 whitespace-nowrap ml-1 sm:ml-2">₹{Number(expense.amount).toLocaleString('en-IN')}</span>
      {/* Edit button */}
      <button
        onClick={() => onEdit(expense)}
        className="bg-amber-50 hover:bg-amber-100 text-amber-500 border-0 rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] cursor-pointer shrink-0 ml-1 transition-colors"
        title="Edit Expense"
      >
        ✏️
      </button>
      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="bg-red-50 hover:bg-red-100 text-red-500 border-0 rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] cursor-pointer shrink-0 transition-colors"
        title="Delete Expense"
      >
        ✕
      </button>
    </div>
  );
};

export default ExpenseCard;
