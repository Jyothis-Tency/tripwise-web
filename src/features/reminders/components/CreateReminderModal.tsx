import React, { useState } from 'react';
import { X } from 'lucide-react';
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

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors";
  const labelCls = "text-xs font-semibold text-slate-500 mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-800">Create Trip Reminder</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mx-5 mt-4 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-medium border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Customer Name *</label><input className={inputCls} value={form.customerName} onChange={e => set('customerName', e.target.value)} /></div>
            <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)} /></div>
            <div><label className={labelCls}>From *</label><input className={inputCls} value={form.fromLocation} onChange={e => set('fromLocation', e.target.value)} /></div>
            <div><label className={labelCls}>To *</label><input className={inputCls} value={form.toLocation} onChange={e => set('toLocation', e.target.value)} /></div>
            <div><label className={labelCls}>Trip Date *</label><input className={inputCls} type="date" value={form.tripDate} onChange={e => set('tripDate', e.target.value)} /></div>
            <div><label className={labelCls}>Vehicle Type</label><input className={inputCls} value={form.vehicleDetails?.vehicleType ?? ''} onChange={e => setForm(p => ({ ...p, vehicleDetails: { vehicleType: e.target.value } }))} /></div>
            <div><label className={labelCls}>Advance (₹)</label><input className={inputCls} type="number" value={form.advanceCollected ?? ''} onChange={e => set('advanceCollected', e.target.value ? Number(e.target.value) : undefined)} /></div>
            <div><label className={labelCls}>Total (₹)</label><input className={inputCls} type="number" value={form.totalPayment ?? ''} onChange={e => set('totalPayment', e.target.value ? Number(e.target.value) : undefined)} /></div>
          </div>
          <div className="mt-3">
            <label className={labelCls}>Message</label>
            <textarea className={`${inputCls} min-h-[60px] resize-y`} value={form.message} onChange={e => set('message', e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateReminderModal;
