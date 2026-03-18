import { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { Driver } from '../api';
import { updateDriver } from '../api';

interface EditDriverModalProps {
  driver: Driver;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditDriverModal({ driver, onClose, onSuccess }: EditDriverModalProps) {
  const [firstName, setFirstName] = useState(driver.firstName ?? '');
  const [lastName, setLastName] = useState(driver.lastName ?? '');
  const [email, setEmail] = useState(driver.email ?? '');
  const [phone, setPhone] = useState(driver.phone ?? '');
  const [place, setPlace] = useState(driver.place ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      setError('First Name, Last Name, Email, and Phone are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateDriver(driver._id, {
        firstName: firstName.trim().toUpperCase(),
        lastName: lastName.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ''),
        place: place.trim() || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update driver.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-indigo-600 rounded-t-2xl">
          <Save className="h-5 w-5 text-white" />
          <h3 className="text-white font-semibold flex-1">Edit Driver</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value.toUpperCase())}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value.toUpperCase())}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value.toLowerCase())}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Place</label>
            <input
              value={place}
              onChange={e => setPlace(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
