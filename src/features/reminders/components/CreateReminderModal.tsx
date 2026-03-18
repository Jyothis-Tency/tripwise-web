import React, { useState } from 'react';
import type { CreateReminderPayload } from '../api';
import { createReminder } from '../api';

interface Props { open: boolean; onClose: () => void; onCreated: () => void; }

const CreateReminderModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState<CreateReminderPayload>({
    customerName: '', fromLocation: '', toLocation: '', tripDate: '',
    customerPhone: '', message: '', advanceCollected: undefined, totalPayment: undefined,
    vehicleDetails: { vehicleType: '' },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const set = (k: keyof CreateReminderPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.fromLocation || !form.toLocation || !form.tripDate) {
      setError('Please fill required fields'); return;
    }
    setSaving(true); setError('');
    try {
      const payload: any = { ...form };
      if (payload.advanceCollected !== undefined) payload.advanceCollected = Number(payload.advanceCollected);
      if (payload.totalPayment !== undefined) payload.totalPayment = Number(payload.totalPayment);
      if (!payload.vehicleDetails?.vehicleType) delete payload.vehicleDetails;
      await createReminder(payload);
      onCreated(); onClose();
    } catch (err: any) { setError(err?.message || 'Failed to create reminder'); }
    finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 460, maxHeight: '85vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Create Trip Reminder</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>
        {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '6px 10px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Customer Name *</label><input style={inputStyle} value={form.customerName} onChange={e => set('customerName', e.target.value)} /></div>
            <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)} /></div>
            <div><label style={labelStyle}>From *</label><input style={inputStyle} value={form.fromLocation} onChange={e => set('fromLocation', e.target.value)} /></div>
            <div><label style={labelStyle}>To *</label><input style={inputStyle} value={form.toLocation} onChange={e => set('toLocation', e.target.value)} /></div>
            <div><label style={labelStyle}>Trip Date *</label><input style={inputStyle} type="date" value={form.tripDate} onChange={e => set('tripDate', e.target.value)} /></div>
            <div><label style={labelStyle}>Vehicle Type</label><input style={inputStyle} value={form.vehicleDetails?.vehicleType ?? ''} onChange={e => setForm(p => ({ ...p, vehicleDetails: { vehicleType: e.target.value } }))} /></div>
            <div><label style={labelStyle}>Advance (₹)</label><input style={inputStyle} type="number" value={form.advanceCollected ?? ''} onChange={e => set('advanceCollected', e.target.value ? Number(e.target.value) : undefined)} /></div>
            <div><label style={labelStyle}>Total (₹)</label><input style={inputStyle} type="number" value={form.totalPayment ?? ''} onChange={e => set('totalPayment', e.target.value ? Number(e.target.value) : undefined)} /></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Message</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.message} onChange={e => set('message', e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? .6 : 1 }}>
              {saving ? 'Creating…' : 'Create Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateReminderModal;
