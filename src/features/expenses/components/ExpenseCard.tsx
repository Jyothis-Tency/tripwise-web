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

interface Props { expense: Expense; onRefresh: () => void; }

const ExpenseCard: React.FC<Props> = ({ expense, onRefresh }) => {
  const cat = (expense.category || 'other').toLowerCase();
  const icon = CAT_ICONS[cat] ?? '📦';

  const handleDelete = async () => {
    if (!confirm('Delete this expense?')) return;
    try { await deleteExpense(expense._id); onRefresh(); } catch (e) { console.error(e); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 10, padding: '10px 14px', marginBottom: 6, border: '1px solid #f1f5f9' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expense.title || expense.description || 'Expense'}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 8 }}>
          <span style={{ textTransform: 'capitalize' }}>{expense.category}</span>
          <span>{fmtDate(expense.date)}</span>
        </div>
      </div>
      <span style={{ fontWeight: 700, fontSize: 14, color: '#ef4444', whiteSpace: 'nowrap' }}>₹{Number(expense.amount).toLocaleString('en-IN')}</span>
      <button onClick={handleDelete} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 8, padding: '4px 8px', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>
    </div>
  );
};

export default ExpenseCard;
