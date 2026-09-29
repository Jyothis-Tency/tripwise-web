import { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { Driver } from '../api';
import { updateDriver } from '../api';

interface EditDriverModalProps {
  driver: Driver;
  onClose: () => void;
  onSuccess: () => void;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30';

export function EditDriverModal({ driver, onClose, onSuccess }: EditDriverModalProps) {
  const [firstName, setFirstName] = useState(driver.firstName ?? '');
  const [lastName, setLastName] = useState(driver.lastName ?? '');
  const [email, setEmail] = useState(driver.email ?? '');
  const [phone, setPhone] = useState(driver.phone ?? '');
  const [place, setPlace] = useState(driver.place ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !phone.trim()) {
      setError('Email and Phone are required.');
      return;
    }
    if (phone.replace(/\D/g, '').length !== 10) {
      setError('Phone number must be exactly 10 digits.');
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
      const raw = err?.response?.data?.message || '';
      setError(
        /phone/i.test(raw)
          ? 'A driver with this phone number already exists. Please use a different phone number.'
          : raw || 'Failed to update driver.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/60">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#1e2638] dark:bg-[#0e121d]">
        {/* Header */}
        <div className="flex items-center gap-2 rounded-t-2xl bg-indigo-600 px-5 py-4 dark:bg-indigo-500">
          <Save className="h-5 w-5 text-white" />
          <h3 className="flex-1 font-semibold text-white">Edit Driver</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 transition hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                First Name
              </label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value.toUpperCase())}
                className={`${inputCls} uppercase`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Last Name
              </label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value.toUpperCase())}
                className={`${inputCls} uppercase`}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value.toLowerCase())}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Place
            </label>
            <input
              value={place}
              onChange={e => setPlace(e.target.value)}
              className={inputCls}
            />
          </div>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
