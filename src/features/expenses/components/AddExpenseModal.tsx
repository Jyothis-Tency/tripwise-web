import React, { useState } from 'react';
import type { CreateExpensePayload } from '../api';
import { createExpense } from '../api';

const CATEGORIES = ['Fuel', 'Maintenance', 'Insurance', 'Toll', 'Parking', 'Salary', 'Food', 'Office', 'Travel', 'Miscellaneous'];

interface Props { open: boolean; onClose: () => void; onCreated: () => void; }

const AddExpenseModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState<CreateExpensePayload>({ title: '', amount: 0, category: 'Fuel', date: new Date().toISOString().split('T')[0], notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const set = (k: keyof CreateExpensePayload, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.amount || !form.category || !form.date) { setError('Fill required fields'); return; }
    setSaving(true); setError('');
    try {
      await createExpense({ ...form, amount: Number(form.amount) });
      onCreated(); onClose();
      setForm({ title: '', amount: 0, category: 'Fuel', date: new Date().toISOString().split('T')[0], notes: '' });
    } catch (err: any) { setError(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 420, maxHeight: '80vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Add Personal Expense</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>
        {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '6px 10px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div><label style={labelStyle}>Title / Description *</label><input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Amount (₹) *</label><input style={inputStyle} type="number" min="0" value={form.amount || ''} onChange={e => set('amount', e.target.value ? Number(e.target.value) : 0)} /></div>
              <div>
                <label style={labelStyle}>Category *</label>
                <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div><label style={labelStyle}>Date *</label><input style={inputStyle} type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? .6 : 1 }}>
              {saving ? 'Adding…' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExpenseModal;
