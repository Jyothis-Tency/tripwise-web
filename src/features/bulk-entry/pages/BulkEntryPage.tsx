import { memo, useCallback, useEffect, useRef, useState, useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  Plus, Trash2, ChevronDown, Send, FileSpreadsheet,
  Building2, X, AlertTriangle, RefreshCw, Loader2, Cloud, CloudOff, Share2,
} from 'lucide-react';
import {
  fetchAgencies, createAgency, fetchBulkEntryTrips, createBulkTrips,
  fetchNormalEntryTrips, createNormalEntries,
  syncBulkEntry,
  type Agency, type DriverGroup, type BulkTripRow, type NormalEntryRow, type AgencyTrip,
} from '../api';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

let _rowCounter = 0;
function nextRowId() { return `r_${Date.now()}_${++_rowCounter}`; }

function emptyBulkRow(): BulkTripRow {
  return {
    clientRowId: nextRowId(),
    startDate: '', endDate: '', startKm: '', endKm: '',
    startTime: '', endTime: '', distance: 0, hours: 0, toll: 0, grandTotal: 0, notes: '',
  };
}

function emptyDriverGroup(): DriverGroup {
  return { driverName: '', vehicleNumber: '', advancePaid: 0, rows: [emptyBulkRow()] };
}

function emptyNormalRow(): NormalEntryRow {
  return { date: '', driverName: '', mobileNumber: '', vehicleNumber: '', vehicleType: '', notes: '' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOSAVE ENGINE — Excel-like dual-layer persistence
// ═══════════════════════════════════════════════════════════════════════════════

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

const LS_BULK_PREFIX = 'tripwise_bulk_';
const LS_NORMAL_PREFIX = 'tripwise_normal_';
const AUTOSAVE_DELAY = 800; // ms after last keystroke

/** Simple hash for fast equality check */
function quickHash(s: string): string {
  if (!s) return 'empty';
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return `${s.length}_${h}`;
}

function useAutosave<T>(
  key: string | null,
  data: T,
  serialize: (d: T) => string,
  onBackendSync: (d: T) => Promise<void>,
) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const lastLocalHash = useRef<string>('');
  const lastBackendHash = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Reset hashes when key changes
  useEffect(() => {
    lastLocalHash.current = '';
    lastBackendHash.current = '';
    setStatus('idle');
  }, [key]);

  // Main autosave effect
  useEffect(() => {
    if (!key) return;

    const json = serialize(data);
    const hash = quickHash(json);

    // 1. Instant localStorage persistence
    if (hash !== lastLocalHash.current) {
      try { localStorage.setItem(key, json); } catch { /* quota exceeded */ }
      lastLocalHash.current = hash;
    }

    // 2. Debounced backend sync
    if (timerRef.current) clearTimeout(timerRef.current);

    if (hash !== lastBackendHash.current) {
      timerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        setStatus('saving');
        try {
          await onBackendSync(dataRef.current);
          if (mountedRef.current) {
            lastBackendHash.current = quickHash(serialize(dataRef.current));
            setStatus('saved');
            // Fade back to idle after 2s
            setTimeout(() => { if (mountedRef.current) setStatus('idle'); }, 2000);
          }
        } catch {
          if (mountedRef.current) {
            setStatus('error');
            // Retry on next edit by not updating backend hash
          }
        }
      }, AUTOSAVE_DELAY);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [key, data, serialize, onBackendSync]);

  return status;
}

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* corrupted */ }
  return fallback;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === 'idle') return null;
  const cfg = {
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: 'Saving…', cls: 'text-amber-600 bg-amber-50 border-amber-200' },
    saved:  { icon: <Cloud className="h-3.5 w-3.5" />, text: 'Saved', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    error:  { icon: <CloudOff className="h-3.5 w-3.5" />, text: 'Offline', cls: 'text-red-600 bg-red-50 border-red-200' },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${cfg.cls} transition-all`}>
      {cfg.icon} {cfg.text}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL SHELL
// ═══════════════════════════════════════════════════════════════════════════════

function ModalShell({ title, onClose, children, maxWidth = 'max-w-md' }: {
  title: string; onClose: () => void; children: React.ReactNode; maxWidth?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} onClick={e => e.target === ref.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`w-full ${maxWidth} rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE AGENCY MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function CreateAgencyModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (a: Agency) => void;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) { setErr('Agency name is required'); return; }
    setSubmitting(true);
    try {
      const agency = await createAgency(name.trim());
      onCreated(agency);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Failed to create agency');
    } finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Create New Agency" onClose={onClose} maxWidth="max-w-sm">
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Agency Name <span className="text-red-500">*</span></label>
          <input value={name} onChange={e => { setName(e.target.value); setErr(null); }}
            placeholder="Enter agency name" autoFocus
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={submit} disabled={submitting}
            className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CELL INPUT — Memoised to prevent re-rendering sibling cells
// ═══════════════════════════════════════════════════════════════════════════════

const CellInput = memo(function CellInput({ value, onChange, placeholder, type = 'text', className = '' }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string;
  type?: string; className?: string;
}) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      type={type} placeholder={placeholder}
      className={`w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none
        focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white transition ${
          type === 'number' ? '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' : ''
        } ${className}`} />
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// BULK ENTRY TABLE
// ═══════════════════════════════════════════════════════════════════════════════

function BulkEntryTable({ groups, onChange }: {
  groups: DriverGroup[];
  onChange: Dispatch<SetStateAction<DriverGroup[]>>;
}) {
  const updateGroupField = useCallback((gi: number, field: keyof DriverGroup, val: any) => {
    onChange(prev => {
      const next = [...prev];
      (next[gi] as any)[field] = val;
      return next;
    });
  }, [onChange]);

  const updateRow = useCallback((gi: number, ri: number, field: keyof BulkTripRow, val: any) => {
    onChange(prev => {
      const next = [...prev];
      const row = next[gi].rows[ri];
      (row as any)[field] = val;

      // Auto-calculate distance
      if (field === 'startKm' || field === 'endKm') {
        const skm = Number(row.startKm) || 0;
        const ekm = Number(row.endKm) || 0;
        row.distance = ekm > skm ? ekm - skm : 0;
      }

      // Auto-calculate hours
      if (field === 'startTime' || field === 'endTime') {
        const [sh, sm] = (row.startTime || '00:00').split(':').map(Number);
        const [eh, em] = (row.endTime || '00:00').split(':').map(Number);
        if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
          let mins = (eh * 60 + em) - (sh * 60 + sm);
          if (mins < 0) mins += 24 * 60; // handle overnight trips
          row.hours = Number((mins / 60).toFixed(2));
        } else {
          row.hours = 0;
        }
      }

      return next;
    });
  }, [onChange]);

  const addRow = useCallback((gi: number) => {
    onChange(prev => {
      const next = [...prev];
      next[gi] = { ...next[gi], rows: [...next[gi].rows, emptyBulkRow()] };
      return next;
    });
  }, [onChange]);

  const removeRow = useCallback((gi: number, ri: number) => {
    onChange(prev => {
      const next = [...prev];
      if (next[gi].rows.length <= 1) return prev;
      next[gi] = { ...next[gi], rows: next[gi].rows.filter((_: BulkTripRow, i: number) => i !== ri) };
      return next;
    });
  }, [onChange]);

  const addGroup = useCallback(() => {
    onChange(prev => [...prev, emptyDriverGroup()]);
  }, [onChange]);

  const removeGroup = useCallback((gi: number) => {
    onChange(prev => prev.filter((_: DriverGroup, i: number) => i !== gi));
  }, [onChange]);

  return (
    <div className="space-y-4">
      {/* All groups are editable — server trips are merged into groups[] */}
      {groups.map((g, gi) => (
        <div key={gi} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Group header */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-indigo-50/50 px-4 py-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-600 shrink-0">{gi + 1}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 shrink-0">Driver:</span>
              <CellInput value={g.driverName} onChange={v => updateGroupField(gi, 'driverName', v)} placeholder="Enter Name" className="w-[180px]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 shrink-0">Vehicle:</span>
              <CellInput value={g.vehicleNumber} onChange={v => updateGroupField(gi, 'vehicleNumber', v.toUpperCase())} placeholder="KL01..." className="w-[140px]" />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs font-semibold text-slate-600 shrink-0">Advance: ₹</span>
              <CellInput value={g.advancePaid || ''} onChange={v => updateGroupField(gi, 'advancePaid', Number(v) || 0)} placeholder="0" type="number" className="w-[100px]" />
            </div>
            <button type="button" onClick={() => removeGroup(gi)}
              className="text-red-400 hover:text-red-600 p-1 shrink-0"><Trash2 className="h-4 w-4" /></button>
          </div>

          {/* Trip rows */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 font-semibold">
                  <th className="px-2 py-2 w-8">#</th>
                  <th className="px-2 py-2 min-w-[120px]">Date (Start/End)</th>
                  <th className="px-2 py-2">Start KM</th><th className="px-2 py-2">End KM</th><th className="px-2 py-2">Dist.</th>
                  <th className="px-2 py-2 min-w-[110px]">Time (Start/End)</th><th className="px-2 py-2">Hrs.</th>
                  <th className="px-2 py-2">Toll</th><th className="px-2 py-2">Grand Total</th>
                  <th className="px-2 py-2 min-w-[130px]">Notes</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, ri) => (
                  <tr key={r.clientRowId} className="border-t border-slate-50 hover:bg-slate-50/30">
                    <td className="px-2 py-1.5 text-slate-400 font-medium">{ri + 1}</td>
                    <td className="px-2 py-1.5 flex flex-col gap-1">
                      <CellInput value={r.startDate} onChange={v => updateRow(gi, ri, 'startDate', v)} type="date" />
                      <CellInput value={r.endDate} onChange={v => updateRow(gi, ri, 'endDate', v)} type="date" />
                    </td>
                    <td className="px-2 py-1.5"><CellInput value={r.startKm} onChange={v => updateRow(gi, ri, 'startKm', v)} placeholder="0" /></td>
                    <td className="px-2 py-1.5"><CellInput value={r.endKm} onChange={v => updateRow(gi, ri, 'endKm', v)} placeholder="0" /></td>
                    <td className="px-2 py-1.5 font-medium text-slate-700">{r.distance}</td>
                    <td className="px-2 py-1.5 flex flex-col gap-1">
                      <CellInput value={r.startTime} onChange={v => updateRow(gi, ri, 'startTime', v)} type="time" />
                      <CellInput value={r.endTime} onChange={v => updateRow(gi, ri, 'endTime', v)} type="time" />
                    </td>
                    <td className="px-2 py-1.5 font-medium text-slate-700">{r.hours}</td>
                    <td className="px-2 py-1.5"><CellInput value={r.toll === 0 ? '' : r.toll} onChange={v => updateRow(gi, ri, 'toll', Number(v) || 0)} type="number" /></td>
                    <td className="px-2 py-1.5"><CellInput value={r.grandTotal === 0 ? '' : r.grandTotal} onChange={v => updateRow(gi, ri, 'grandTotal', Number(v) || 0)} type="number" /></td>
                    <td className="px-2 py-1.5">
                      <textarea
                        value={r.notes}
                        onChange={e => updateRow(gi, ri, 'notes', e.target.value)}
                        placeholder="Add note…"
                        rows={3}
                        className="w-full min-w-[130px] rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white transition resize-y"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {g.rows.length > 1 && (
                        <button type="button" onClick={() => removeRow(gi, ri)}
                          className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Group footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 bg-slate-50/50">
            <button type="button" onClick={() => addRow(gi)}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              <Plus className="h-3.5 w-3.5" /> Add Trip
            </button>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500">Total: <strong className="text-slate-800">₹{g.rows.reduce((s, r) => s + (r.grandTotal || 0), 0).toLocaleString('en-IN')}</strong></span>
              <span className="text-slate-500">Advance: <strong className="text-slate-800">₹{(g.advancePaid || 0).toLocaleString('en-IN')}</strong></span>
              <span className="text-slate-500">Balance: <strong className="text-emerald-600">₹{(g.rows.reduce((s, r) => s + (r.grandTotal || 0), 0) - (g.advancePaid || 0)).toLocaleString('en-IN')}</strong></span>
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={addGroup}
        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-dashed border-indigo-300 rounded-xl px-4 py-3 w-full justify-center hover:bg-indigo-50/50 transition">
        <Plus className="h-4 w-4" /> Add Driver / Vehicle
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatSingleNormalEntry(e: NormalEntryRow | AgencyTrip): string {
  const driver  = (e as any).driverName   ?? '—';
  const mobile  = (e as any).mobileNumber ?? '—';
  const vehicle = (e as any).vehicleNumber ?? '—';
  const type    = (e as any).vehicleType   ?? '';
  return [
    `Driver: ${driver}`,
    `Mobile: ${mobile}`,
    `Vehicle: ${vehicle}`,
    type    ? `Type: ${type}` : '',
  ].filter(Boolean).join('\n');
}

function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function shareSingleEntry(e: NormalEntryRow | AgencyTrip) {
  const msg = [
    '*Vehicle Details*',
    '─────────────────',
    formatSingleNormalEntry(e),
    '─────────────────',
  ].join('\n');
  window.open(buildWhatsAppUrl(msg), '_blank');
}

function shareAllEntries(entries: (NormalEntryRow | AgencyTrip)[], agencyName?: string) {
  const filled = entries.filter(e => (e as any).driverName?.trim());
  if (filled.length === 0) return;
  const header = agencyName ? `*${agencyName} — Vehicle Summary*` : '*Vehicle Summary*';
  const msg = [
    header,
    `Total Vehicles: ${filled.length}`,
    '─────────────────',
    ...filled.map((e) => formatSingleNormalEntry(e) + '\n─────────────────'),
  ].join('\n');
  window.open(buildWhatsAppUrl(msg), '_blank');
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMAL ENTRY TABLE
// ═══════════════════════════════════════════════════════════════════════════════

function NormalEntryTable({ entries, onChange, agencyName }: {
  entries: NormalEntryRow[];
  onChange: Dispatch<SetStateAction<NormalEntryRow[]>>;
  agencyName?: string;
}) {
  const update = useCallback((idx: number, field: keyof NormalEntryRow, val: string) => {
    onChange(prev => {
      const next = [...prev];
      (next[idx] as any)[field] = field === 'vehicleNumber' ? val.toUpperCase() : val;
      return next;
    });
  }, [onChange]);

  const addEntry = useCallback(() => {
    onChange(prev => [...prev, emptyNormalRow()]);
  }, [onChange]);

  const removeEntry = useCallback((idx: number) => {
    onChange(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_: NormalEntryRow, i: number) => i !== idx);
    });
  }, [onChange]);

  return (
    <div className="space-y-4">
      {/* All entries are editable — server trips are merged into entries[] */}

      {/* Editable entries */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500 font-semibold">
                <th className="px-2 py-2 w-8">#</th>
                <th className="px-2 py-2">Date</th><th className="px-2 py-2">Driver Name</th>
                <th className="px-2 py-2">Mobile Number</th><th className="px-2 py-2">Vehicle Number</th>
                <th className="px-2 py-2">Vehicle Type</th><th className="px-2 py-2 min-w-[130px]">Notes</th><th className="px-2 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/30">
                  <td className="px-2 py-1.5 text-slate-400 font-medium">{i + 1}</td>
                  <td className="px-2 py-1.5"><CellInput value={e.date} onChange={v => update(i, 'date', v)} type="date" /></td>
                  <td className="px-2 py-1.5"><CellInput value={e.driverName} onChange={v => update(i, 'driverName', v)} placeholder="Driver Name" /></td>
                  <td className="px-2 py-1.5"><CellInput value={e.mobileNumber} onChange={v => update(i, 'mobileNumber', v)} placeholder="9876543210" /></td>
                  <td className="px-2 py-1.5"><CellInput value={e.vehicleNumber} onChange={v => update(i, 'vehicleNumber', v)} placeholder="KL07XX1234" /></td>
                  <td className="px-2 py-1.5"><CellInput value={e.vehicleType} onChange={v => update(i, 'vehicleType', v)} placeholder="Sedan" /></td>
                  <td className="px-2 py-1.5">
                    <textarea
                      value={e.notes}
                      onChange={ev => update(i, 'notes', ev.target.value)}
                      placeholder="Add note…"
                      rows={3}
                      className="w-full min-w-[130px] rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white transition resize-y"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-col gap-1">
                      {e.driverName?.trim() && (
                        <button type="button" onClick={() => shareSingleEntry(e)}
                          title="Share this entry via WhatsApp"
                          className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800 text-[10px] font-semibold transition">
                          <Share2 className="h-3 w-3" /> Share
                        </button>
                      )}
                      {entries.length > 1 && (
                        <button type="button" onClick={() => removeEntry(i)}
                          className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={addEntry}
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-dashed border-indigo-300 rounded-xl px-4 py-3 flex-1 justify-center hover:bg-indigo-50/50 transition">
          <Plus className="h-4 w-4" /> Add Entry
        </button>
        <button type="button" onClick={() => shareAllEntries(entries, agencyName)}
          title="Share all entries via WhatsApp"
          className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-xl px-4 py-3 transition">
          <Share2 className="h-4 w-4" /> Share All via WhatsApp
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function BulkEntryPage() {
  // State — agencies
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agencyLoading, setAgencyLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // State — mode
  const [isBulkMode, setIsBulkMode] = useState(true);

  // State — bulk data (functional updater pattern for perf)
  const [bulkGroups, setBulkGroupsRaw] = useState<DriverGroup[]>([emptyDriverGroup()]);

  // State — normal data
  const [normalEntries, setNormalEntriesRaw] = useState<NormalEntryRow[]>([emptyNormalRow()]);

  // Functional updater wrappers — allow children to pass updater functions
  const setBulkGroups = useCallback((updater: DriverGroup[] | ((prev: DriverGroup[]) => DriverGroup[])) => {
    setBulkGroupsRaw(typeof updater === 'function' ? updater : () => updater);
  }, []);

  const setNormalEntries = useCallback((updater: NormalEntryRow[] | ((prev: NormalEntryRow[]) => NormalEntryRow[])) => {
    setNormalEntriesRaw(typeof updater === 'function' ? updater : () => updater);
  }, []);

  // State — submit
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedAgency = agencies.find(a => (a._id ?? a.id) === selectedId) ?? null;

  // ── Serializers (stable refs) ──
  const serializeBulk = useCallback((groups: DriverGroup[]) => JSON.stringify(groups), []);
  const serializeNormal = useCallback((entries: NormalEntryRow[]) => JSON.stringify(entries), []);

  // ── Backend sync callbacks (stable refs) ──
  const syncBulkToBackend = useCallback(async (groups: DriverGroup[]) => {
    if (!selectedAgency) return;
    const validGroups = groups.filter(g => g.driverName.trim() && g.vehicleNumber.trim());
    if (validGroups.length === 0) return;
    await syncBulkEntry({ agencyName: selectedAgency.name, driverGroups: validGroups });
  }, [selectedAgency]);

  const syncNormalToBackend = useCallback(async (entries: NormalEntryRow[]) => {
    if (!selectedAgency) return;
    const validEntries = entries.filter(e => e.driverName.trim() && e.vehicleNumber.trim());
    if (validEntries.length === 0) return;
    await createNormalEntries({ agencyName: selectedAgency.name, entries: validEntries });
  }, [selectedAgency]);

  // ── Autosave hooks ──
  const bulkLsKey = selectedId && isBulkMode ? `${LS_BULK_PREFIX}${selectedId}` : null;
  const normalLsKey = selectedId && !isBulkMode ? `${LS_NORMAL_PREFIX}${selectedId}` : null;

  const bulkSyncStatus = useAutosave(bulkLsKey, bulkGroups, serializeBulk, syncBulkToBackend);
  const normalSyncStatus = useAutosave(normalLsKey, normalEntries, serializeNormal, syncNormalToBackend);

  const currentSyncStatus = isBulkMode ? bulkSyncStatus : normalSyncStatus;

  // ── Calculate selected agency total balance ──
  const agencyTotalBalance = useMemo(() => {
    if (!isBulkMode) return 0;
    let totalGrandTotal = 0;
    let totalAdvance = 0;
    for (const group of bulkGroups) {
      if (!group.driverName.trim() && !group.vehicleNumber.trim() && group.rows.every(r => !r.startDate && !r.startKm && !r.grandTotal)) continue;
      totalAdvance += (group.advancePaid || 0);
      for (const row of group.rows) {
        totalGrandTotal += (row.grandTotal || 0);
      }
    }
    return totalGrandTotal - totalAdvance;
  }, [bulkGroups, isBulkMode]);

  // ── Load agencies ──
  const loadAgencies = useCallback(async () => {
    setAgencyLoading(true);
    try {
      const data = await fetchAgencies();
      setAgencies(data.agencies);
      if (data.agencies.length > 0 && !selectedId) {
        const firstId = data.agencies[0]._id ?? data.agencies[0].id ?? null;
        setSelectedId(firstId);
        // Restore from localStorage if available
        if (firstId) {
          const savedBulk = loadFromLocalStorage<DriverGroup[]>(`${LS_BULK_PREFIX}${firstId}`, []);
          if (savedBulk.length > 0) setBulkGroupsRaw(savedBulk);
          const savedNormal = loadFromLocalStorage<NormalEntryRow[]>(`${LS_NORMAL_PREFIX}${firstId}`, []);
          if (savedNormal.length > 0) setNormalEntriesRaw(savedNormal);
        }
      }
    } catch { /* silent */ } finally { setAgencyLoading(false); }
  }, []);

  useEffect(() => { loadAgencies(); }, [loadAgencies]);

  // ── Load trips when agency/mode changes ──
  const loadTrips = useCallback(async () => {
    if (!selectedId || !selectedAgency) return;
    try {
      if (isBulkMode) {
        const trips = await fetchBulkEntryTrips(selectedId);
        // Convert server trips into editable DriverGroup[] format
        if (trips.length > 0) {
          const grouped: Record<string, typeof trips> = {};
          for (const t of trips) {
            const key = `${(t.driverName || '').trim()}|||${(t.vehicleNumber || '').trim().toUpperCase()}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(t);
          }
          const serverGroups: DriverGroup[] = Object.values(grouped).map(grp => {
            const first = grp[0];
            return {
              driverName: first.driverName || '',
              vehicleNumber: first.vehicleNumber || '',
              advancePaid: Number(first.advancePaid ?? 0),
              rows: grp.map(t => ({
                clientRowId: nextRowId(),
                _id: t._id ?? t.id,
                startDate: t.startDate ? t.startDate.split('T')[0] : '',
                endDate: t.endDate ? t.endDate.split('T')[0] : '',
                startKm: String(t.startKm ?? ''),
                endKm: String(t.endKm ?? ''),
                startTime: t.startTime || '',
                endTime: t.endTime || '',
                distance: Number(t.distance ?? 0),
                hours: Number(t.hours ?? 0),
                toll: Number(t.toll ?? 0),
                grandTotal: Number(t.grandTotal ?? 0),
                notes: t.notes || '',
              })),
            };
          });
          setBulkGroupsRaw(prev => {
            // Ensure we don't append duplicate server groups if they already exist in state
            const existingIds = new Set(prev.flatMap(g => g.rows.map(r => r._id)).filter(Boolean));
            const newServerGroups = serverGroups.filter(g => !g.rows.every(r => existingIds.has(r._id)));
            if (newServerGroups.length === 0) return prev;

            const hasUserData = prev.some(g =>
              g.driverName.trim() || g.vehicleNumber.trim() || g.rows.some(r => r.startDate || r.startKm || r.grandTotal)
            );
            return hasUserData ? [...newServerGroups, ...prev] : [...newServerGroups, emptyDriverGroup()];
          });        }
      } else {
        const trips = await fetchNormalEntryTrips(selectedId);
        // Convert server trips into editable NormalEntryRow[] format
        if (trips.length > 0) {
          const serverEntries: NormalEntryRow[] = trips.map(t => ({
            _id: t._id ?? t.id,
            date: t.date ? t.date.split('T')[0] : '',
            driverName: t.driverName || '',
            mobileNumber: t.mobileNumber || '',
            vehicleNumber: t.vehicleNumber || '',
            vehicleType: t.vehicleType || '',
            notes: t.notes || '',
          }));
          setNormalEntriesRaw(prev => {
            const existingIds = new Set(prev.map(e => e._id).filter(Boolean));
            const newServerEntries = serverEntries.filter(e => !existingIds.has(e._id));
            if (newServerEntries.length === 0) return prev;

            const hasUserData = prev.some(e => e.driverName.trim() || e.vehicleNumber.trim());
            return hasUserData ? [...newServerEntries, ...prev] : [...newServerEntries, emptyNormalRow()];
          });
        }
      }
    } catch { /* silent */ }
  }, [selectedId, isBulkMode, selectedAgency]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  // ── Agency selection ──
  const selectAgency = useCallback((id: string) => {
    setSelectedId(id);
    setShowDropdown(false);
    setSubmitMsg(null);
    // Restore from localStorage
    const savedBulk = loadFromLocalStorage<DriverGroup[]>(`${LS_BULK_PREFIX}${id}`, []);
    setBulkGroupsRaw(savedBulk.length > 0 ? savedBulk : [emptyDriverGroup()]);
    const savedNormal = loadFromLocalStorage<NormalEntryRow[]>(`${LS_NORMAL_PREFIX}${id}`, []);
    setNormalEntriesRaw(savedNormal.length > 0 ? savedNormal : [emptyNormalRow()]);
  }, []);

  // ── Mode toggle ──
  const toggleMode = useCallback((bulk: boolean) => {
    setIsBulkMode(bulk);
    setSubmitMsg(null);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const close = () => setShowDropdown(false);
    document.addEventListener('click', close, { once: true });
    return () => document.removeEventListener('click', close);
  }, [showDropdown]);

  // ── Submit bulk ──
  const submitBulk = useCallback(async () => {
    if (!selectedAgency) return;
    const validGroups = bulkGroups.filter(g => g.driverName.trim() && g.vehicleNumber.trim());
    if (validGroups.length === 0) { setSubmitMsg({ type: 'error', text: 'Add at least one driver with a vehicle number.' }); return; }
    setSubmitting(true); setSubmitMsg(null);
    try {
      const result = await createBulkTrips({ agencyName: selectedAgency.name, driverGroups: validGroups });
      setSubmitMsg({ type: 'success', text: `${result.created} created, ${result.updated} updated${result.failed ? `, ${result.failed} failed` : ''}` });
      setBulkGroupsRaw([emptyDriverGroup()]);
      // Clear localStorage after successful submit
      if (selectedId) { try { localStorage.removeItem(`${LS_BULK_PREFIX}${selectedId}`); } catch {} }
      loadTrips();
    } catch (e: any) {
      setSubmitMsg({ type: 'error', text: e?.response?.data?.message ?? 'Failed to submit bulk trips' });
    } finally { setSubmitting(false); }
  }, [selectedAgency, bulkGroups, selectedId, loadTrips]);

  // ── Submit normal ──
  const submitNormal = useCallback(async () => {
    if (!selectedAgency) return;
    const validEntries = normalEntries.filter(e => e.driverName.trim() && e.vehicleNumber.trim());
    if (validEntries.length === 0) { setSubmitMsg({ type: 'error', text: 'Add at least one entry with driver and vehicle.' }); return; }
    setSubmitting(true); setSubmitMsg(null);
    try {
      const result = await createNormalEntries({ agencyName: selectedAgency.name, entries: validEntries });
      setSubmitMsg({ type: 'success', text: `${result.created} created, ${result.updated} updated${result.failed ? `, ${result.failed} failed` : ''}` });
      setNormalEntriesRaw([emptyNormalRow()]);
      // Clear localStorage after successful submit
      if (selectedId) { try { localStorage.removeItem(`${LS_NORMAL_PREFIX}${selectedId}`); } catch {} }
      loadTrips();
    } catch (e: any) {
      setSubmitMsg({ type: 'error', text: e?.response?.data?.message ?? 'Failed to submit entries' });
    } finally { setSubmitting(false); }
  }, [selectedAgency, normalEntries, selectedId, loadTrips]);

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-full flex-col bg-slate-50 overflow-hidden">

      {/* ─── HEADER BAR ─── */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 backdrop-blur-md px-5 py-3 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-indigo-500" />
          <h1 className="text-sm font-bold text-slate-800 uppercase tracking-wider hidden sm:block">{isBulkMode ? 'Bulk Entry' : 'Normal Entry'}</h1>

          {/* Agency picker */}
          <div className="relative">
            <button type="button" onClick={e => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-indigo-300 transition min-w-[160px]">
              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="truncate text-slate-700 font-medium">{selectedAgency?.name ?? 'Select Agency'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-auto shrink-0" />
            </button>

            {showDropdown && (
              <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-lg z-30 py-1 max-h-60 overflow-y-auto"
                onClick={e => e.stopPropagation()}>
                {agencyLoading ? (
                  <div className="px-4 py-3 text-xs text-slate-400 text-center">Loading…</div>
                ) : agencies.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 text-center">No agencies created yet</div>
                ) : (
                  agencies.map(a => (
                    <button key={a._id ?? a.id} type="button"
                      onClick={() => selectAgency(a._id ?? a.id ?? '')}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition ${
                        (a._id ?? a.id) === selectedId ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700'
                      }`}>
                      {a.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button type="button" onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600 transition shadow-sm">
            <Plus className="h-3.5 w-3.5" /> Agency
          </button>

          {/* Agency Total Balance Display */}
          {selectedAgency && isBulkMode && (
            <div className="ml-auto hidden sm:flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-100 shadow-sm transition-all hover:shadow hover:bg-emerald-100/60">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Total Balance:</span>
              <span className={`text-sm font-bold ${agencyTotalBalance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                ₹{agencyTotalBalance.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sync status */}
          <SyncBadge status={currentSyncStatus} />

          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button type="button" onClick={() => toggleMode(true)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                isBulkMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>Bulk</button>
            <button type="button" onClick={() => toggleMode(false)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                !isBulkMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>Normal</button>
          </div>

          <button type="button" onClick={loadTrips}
            className="flex h-8 w-8 items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition active:rotate-180"
            title="Refresh"><RefreshCw className="h-4 w-4" /></button>

          <button type="button" onClick={isBulkMode ? submitBulk : submitNormal} disabled={submitting || !selectedAgency}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition shadow-sm">
            <Send className="h-3.5 w-3.5" />
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>

      {/* ─── FEEDBACK BAR ─── */}
      {submitMsg && (
        <div className={`px-5 py-2.5 text-xs font-medium flex items-center gap-2 shrink-0 ${
          submitMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-b border-emerald-100'
            : 'bg-red-50 text-red-700 border-b border-red-100'
        }`}>
          {submitMsg.type === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <FileSpreadsheet className="h-4 w-4 shrink-0" />}
          {submitMsg.text}
          <button type="button" onClick={() => setSubmitMsg(null)} className="ml-auto opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ─── CONTENT ─── */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {!selectedAgency ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
            <Building2 className="h-16 w-16 text-slate-200" />
            <p className="text-sm font-medium text-slate-500">Select an agency to get started</p>
            <p className="text-xs text-slate-400">Choose from the dropdown above, or create a new agency.</p>
          </div>
        ) : isBulkMode ? (
          <BulkEntryTable groups={bulkGroups} onChange={setBulkGroups} />
        ) : (
          <NormalEntryTable entries={normalEntries} onChange={setNormalEntries} />
        )}
      </div>

      {/* ─── MODALS ─── */}
      {showCreateModal && (
        <CreateAgencyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(a) => {
            setShowCreateModal(false);
            setAgencies(prev => [...prev, a]);
            selectAgency(a._id ?? a.id ?? '');
          }}
        />
      )}
    </div>
  );
}
