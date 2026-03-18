import { useState } from 'react';
import type { HistoryTrip } from '../api';
import { updateTripFields } from '../api';
import { X, Save } from 'lucide-react';

export function EditTripModal({
  trip,
  onClose,
  onSuccess
}: {
  trip: HistoryTrip;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [fields, setFields] = useState({
    from: trip.from || trip.pickup || '',
    to: trip.to || trip.drop || '',
    agencyName: trip.agencyName || '',
    customer: trip.customer || '',
    startDate: trip.startDate ? trip.startDate.split('T')[0] : (trip.date ? trip.date.split('T')[0] : ''),
    endDate: trip.endDate ? trip.endDate.split('T')[0] : '',
    startTime: trip.startTime || '',
    endTime: trip.endTime || '',
    startKilometers: trip.startKilometers?.toString() || '',
    endKilometers: trip.endKilometers?.toString() || '',
    distance: trip.distance?.toString() || '',
    agencyCost: trip.agencyCost?.toString() || '',
    cabCost: trip.cabCost?.toString() || '',
    driver_salary: trip.driver_salary?.toString() || '',
    notes: trip.notes || trip.completionNote || ''
  });

  const handleChange = (field: keyof typeof fields, value: string) => {
    setFields(prev => ({ ...prev, [field]: value }));
  };

  const calculateDistance = () => {
    const start = parseFloat(fields.startKilometers);
    const end = parseFloat(fields.endKilometers);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      handleChange('distance', (end - start).toString());
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      // Clean payload
      const payload: Partial<HistoryTrip> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v !== '') {
          // Parse numbers
          if (['startKilometers', 'endKilometers', 'distance', 'agencyCost', 'cabCost', 'driver_salary'].includes(k)) {
            (payload as any)[k] = parseFloat(v);
          } else {
            (payload as any)[k] = v;
          }
        }
      }
      await updateTripFields(trip._id, payload);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update trip fields. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-slate-800">Edit Trip Details</h3>
            <p className="text-xs text-slate-500 mt-0.5">Trip {trip.tripNumber || trip._id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {/* Location Group */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Location & Client</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
                <input type="text" value={fields.from} onChange={e => handleChange('from', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
                <input type="text" value={fields.to} onChange={e => handleChange('to', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Customer / Care of</label>
                <input type="text" value={fields.customer} onChange={e => handleChange('customer', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Agency Name</label>
                <input type="text" value={fields.agencyName} onChange={e => handleChange('agencyName', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1" />
              </div>
            </div>
          </section>

          {/* Time & Distance Group */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Time & Distance</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                <input type="date" value={fields.startDate} onChange={e => handleChange('startDate', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
                  <input type="time" value={fields.startTime} onChange={e => handleChange('startTime', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End Time</label>
                  <input type="time" value={fields.endTime} onChange={e => handleChange('endTime', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start KM</label>
                <input type="number" value={fields.startKilometers} onChange={e => handleChange('startKilometers', e.target.value)} onBlur={calculateDistance}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End KM</label>
                <input type="number" value={fields.endKilometers} onChange={e => handleChange('endKilometers', e.target.value)} onBlur={calculateDistance}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Total Distance</label>
                <input type="number" value={fields.distance} onChange={e => handleChange('distance', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 bg-slate-50" />
              </div>
            </div>
          </section>

          {/* Financial Group */}
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Financial</h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Total Revenue (Agency Cost)</label>
                <div className="flex border border-slate-200 rounded-lg overflow-hidden focus-within:border-indigo-400 focus-within:ring-1">
                  <span className="px-3 bg-slate-50 border-r border-slate-200 py-2 text-sm text-slate-500">₹</span>
                  <input type="number" value={fields.agencyCost} onChange={e => handleChange('agencyCost', e.target.value)}
                    className="flex-1 w-full px-3 py-2 text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cab Cost</label>
                <div className="flex border border-slate-200 rounded-lg overflow-hidden focus-within:border-indigo-400 focus-within:ring-1">
                  <span className="px-3 bg-slate-50 border-r border-slate-200 py-2 text-sm text-slate-500">₹</span>
                  <input type="number" value={fields.cabCost} onChange={e => handleChange('cabCost', e.target.value)}
                    className="flex-1 w-full px-3 py-2 text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Driver Salary</label>
                <div className="flex border border-slate-200 rounded-lg overflow-hidden focus-within:border-indigo-400 focus-within:ring-1">
                  <span className="px-3 bg-slate-50 border-r border-slate-200 py-2 text-sm text-slate-500">₹</span>
                  <input type="number" value={fields.driver_salary} onChange={e => handleChange('driver_salary', e.target.value)}
                    className="flex-1 w-full px-3 py-2 text-sm outline-none" />
                </div>
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <label className="block text-xs font-medium text-slate-600 mb-1">Trip Notes</label>
            <textarea value={fields.notes} onChange={e => handleChange('notes', e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 resize-none" />
          </section>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50">
          <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-white transition bg-transparent disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex-[2] flex justify-center items-center gap-2 bg-indigo-600 text-white rounded-xl py-2 px-4 text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-70">
            {saving ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
