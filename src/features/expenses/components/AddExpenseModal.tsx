import React, { useEffect, useState } from 'react';
import type { CreateExpensePayload, Expense } from '../api';
import { createExpense, updateExpense } from '../api';

const CATEGORIES = ['Fuel', 'Maintenance', 'Insurance', 'Toll', 'Parking', 'Salary', 'Food', 'Office', 'Travel', 'Miscellaneous'];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Pass an existing expense to enter edit mode */
  expense?: Expense | null;
}

const BLANK: CreateExpensePayload = { title: '', amount: 0, category: 'Fuel', date: new Date().toISOString().split('T')[0], notes: '' };

const AddExpenseModal: React.FC<Props> = ({ open, onClose, onCreated, expense }) => {
  const isEdit = !!expense;
  const [form, setForm] = useState<CreateExpensePayload>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill when editing
  useEffect(() => {
    if (expense) {
      setForm({
        title: expense.title || expense.description || '',
        amount: expense.amount ?? 0,
        category: expense.category || 'Fuel',
        date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
        notes: expense.notes || '',
      });
    } else {
      setForm(BLANK);
    }
    setError('');
  }, [expense, open]);

  if (!open) return null;

  const set = (k: keyof CreateExpensePayload, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.amount || !form.category || !form.date) { setError('Fill required fields'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit && expense) {
        await updateExpense(expense._id, { ...form, amount: Number(form.amount) });
      } else {
        await createExpense({ ...form, amount: Number(form.amount) });
      }
      onCreated();
      onClose();
      setForm(BLANK);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all';
  const labelCls = 'block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide';

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-100 flex items-center justify-between ${isEdit ? 'bg-amber-50' : 'bg-indigo-50'}`}>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {isEdit ? '✏️ Edit Expense' : '+ Add Expense'}
            </h3>
            {isEdit && <p className="text-xs text-slate-400 mt-0.5">Update the details below</p>}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/70 hover:bg-white text-slate-400 hover:text-slate-600 transition-colors border border-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl text-xs">
              {error}
            </div>
          )}

          <div>
            <label className={labelCls}>Title / Description *</label>
            <input
              className={inputCls}
              placeholder="e.g. Fuel refill at pump"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount (₹) *</label>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.amount || ''}
                onChange={e => set('amount', e.target.value ? Number(e.target.value) : 0)}
              />
            </div>
            <div>
              <label className={labelCls}>Category *</label>
              <select className={inputCls} value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Date *</label>
            <input
              className={inputCls}
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Optional notes…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 ${isEdit ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {saving ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Expense')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExpenseModal;
