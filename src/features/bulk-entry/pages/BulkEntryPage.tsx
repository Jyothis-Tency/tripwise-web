import { memo, useCallback, useEffect, useRef, useState, useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  Plus, Trash2, ChevronDown, FileSpreadsheet,
  Building2, X, RefreshCw, Loader2, Cloud, CloudOff, Copy,
} from 'lucide-react';
import {
  fetchAgencies, createAgency, fetchBulkEntryTrips,
  fetchNormalEntryTrips,
  deleteBulkEntryTrip, deleteNormalEntryTrip,
  syncBulkEntry, syncNormalEntry,
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
  return { clientRowId: nextRowId(), date: '', driverName: '', mobileNumber: '', vehicleNumber: '', vehicleType: '', notes: '' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOSAVE ENGINE — Excel-like dual-layer persistence
// ═══════════════════════════════════════════════════════════════════════════════

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

const LS_BULK_PREFIX = 'tripwise_bulk_';
const LS_NORMAL_PREFIX = 'tripwise_normal_';
const LS_SELECTED_AGENCY = 'tripwise_bulk_selected_agency';
const LS_ENTRY_MODE = 'tripwise_bulk_entry_mode'; // 'bulk' | 'normal'
const AUTOSAVE_DELAY = 800; // ms after last keystroke

// Mirror of backend AgencyTrip.calculateBalance (non-negative balance)
function calculateBalanceAmount(grandTotal: number, advancePaid: number): number {
  const gt = typeof grandTotal === 'number' ? grandTotal : parseFloat(String(grandTotal)) || 0;
  const adv = typeof advancePaid === 'number' ? advancePaid : parseFloat(String(advancePaid)) || 0;

  if (gt > 0 && adv > 0) {
    return Math.max(gt - adv, 0);
  }
  if (gt > 0 && adv === 0) {
    return gt;
  }
  if (gt === 0 && adv > 0) {
    return adv;
  }
  return 0;
}

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

function BulkEntryTable({ groups, onChange, onDeleteTrip }: {
  groups: DriverGroup[];
  onChange: Dispatch<SetStateAction<DriverGroup[]>>;
  onDeleteTrip: (id: string) => Promise<void> | void;
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

  const deleteServerRow = useCallback(async (gi: number, ri: number, id: string) => {
    if (!id) return;
    try {
      await onDeleteTrip(id);
      // remove locally after successful delete
      removeRow(gi, ri);
    } catch {
      // silent
    }
  }, [onDeleteTrip, removeRow]);

  const addGroup = useCallback(() => {
    onChange(prev => [...prev, emptyDriverGroup()]);
  }, [onChange]);

  const removeGroup = useCallback((gi: number) => {
    onChange(prev => prev.filter((_: DriverGroup, i: number) => i !== gi));
  }, [onChange]);

  const deleteServerGroup = useCallback(async (gi: number) => {
    const ids = (groups[gi]?.rows ?? []).map(r => r._id).filter(Boolean) as string[];
    if (ids.length === 0) {
      removeGroup(gi);
      return;
    }
    // Best-effort: delete saved rows, then remove group locally
    await Promise.allSettled(ids.map(id => Promise.resolve(onDeleteTrip(String(id)))));
    removeGroup(gi);
  }, [groups, onDeleteTrip, removeGroup]);

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
            <button type="button" onClick={() => deleteServerGroup(gi)}
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
                      {r._id ? (
                        <button type="button" onClick={() => deleteServerRow(gi, ri, String(r._id))}
                          title="Delete saved trip"
                          className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      ) : g.rows.length > 1 ? (
                        <button type="button" onClick={() => removeRow(gi, ri)}
                          title="Remove row"
                          className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      ) : null}
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
            {(() => {
              const totalGrand = g.rows.reduce((s, r) => s + (r.grandTotal || 0), 0);
              const advance = g.advancePaid || 0;
              const balance = calculateBalanceAmount(totalGrand, advance);
              return (
                <>
                  <span className="text-slate-500">
                    Total: <strong className="text-slate-800">₹{totalGrand.toLocaleString('en-IN')}</strong>
                  </span>
                  <span className="text-slate-500">
                    Advance: <strong className="text-slate-800">₹{advance.toLocaleString('en-IN')}</strong>
                  </span>
                  <span className="text-slate-500">
                    Balance: <strong className="text-emerald-600">₹{balance.toLocaleString('en-IN')}</strong>
                  </span>
                </>
              );
            })()}
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
// COPY HELPERS
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

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

async function copySingleEntry(e: NormalEntryRow | AgencyTrip) {
  const msg = [
    'Vehicle Details',
    '─────────────────',
    formatSingleNormalEntry(e),
    '─────────────────',
  ].join('\n');
  await copyToClipboard(msg);
}

async function copyAllEntries(entries: (NormalEntryRow | AgencyTrip)[], agencyName?: string) {
  const filled = entries.filter(e => (e as any).driverName?.trim());
  if (filled.length === 0) return;
  const header = agencyName ? `${agencyName} — Vehicle Summary` : 'Vehicle Summary';
  const msg = [
    header,
    `Total Vehicles: ${filled.length}`,
    '─────────────────',
    ...filled.map((e) => formatSingleNormalEntry(e) + '\n─────────────────'),
  ].join('\n');
  await copyToClipboard(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMAL ENTRY TABLE
// ═══════════════════════════════════════════════════════════════════════════════

function NormalEntryTable({ entries, onChange, onDeleteTrip, agencyName }: {
  entries: NormalEntryRow[];
  onChange: Dispatch<SetStateAction<NormalEntryRow[]>>;
  onDeleteTrip: (id: string) => Promise<void> | void;
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
      if (prev.length <= 1) return [emptyNormalRow()];
      return prev.filter((_: NormalEntryRow, i: number) => i !== idx);
    });
  }, [onChange]);

  const deleteServerEntry = useCallback(async (idx: number, id: string) => {
    if (!id) return;
    try {
      await onDeleteTrip(id);
      removeEntry(idx);
    } catch {
      // silent
    }
  }, [onDeleteTrip, removeEntry]);

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
                        <button
                          type="button"
                          onClick={() => copySingleEntry(e)}
                          title="Copy this entry"
                          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-[10px] font-semibold transition"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      )}
                      {(e as any)._id ? (
                        <button type="button" onClick={() => deleteServerEntry(i, String((e as any)._id))}
                          title="Delete saved entry"
                          className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      ) : (
                        <button type="button" onClick={() => removeEntry(i)}
                          title={entries.length > 1 ? 'Remove row' : 'Clear row'}
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
        <button
          type="button"
          onClick={() => copyAllEntries(entries, agencyName)}
          title="Copy all entries"
          className="flex items-center gap-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 rounded-xl px-4 py-3 transition"
        >
          <Copy className="h-4 w-4" /> Copy All
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
  const [isBulkMode, setIsBulkMode] = useState(() => {
    try {
      const v = localStorage.getItem(LS_ENTRY_MODE);
      return v !== 'normal';
    } catch {
      return true;
    }
  });

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

  // No manual submit — MS Office style autosync only

  const selectedAgency = agencies.find(a => (a._id ?? a.id) === selectedId) ?? null;

  // ── Serializers (stable refs) ──
  const serializeBulk = useCallback((groups: DriverGroup[]) => JSON.stringify(groups), []);
  const serializeNormal = useCallback((entries: NormalEntryRow[]) => JSON.stringify(entries), []);

  // ── Backend sync callbacks (stable refs) ──
  const syncBulkToBackend = useCallback(async (groups: DriverGroup[]) => {
    if (!selectedAgency) return;
    const validGroups = groups.filter(g => g.driverName.trim() && g.vehicleNumber.trim());
    if (validGroups.length === 0) return;
    const res = await syncBulkEntry({ agencyName: selectedAgency.name, driverGroups: validGroups });

    // Patch returned _id mappings back into state so refresh doesn't duplicate server rows.
    const mappings = (res.rows ?? []).filter(r => r.clientRowId && r._id) as Array<{ clientRowId: string; _id: string }>;
    if (mappings.length === 0) return;
    const map = new Map(mappings.map(m => [m.clientRowId, m._id]));

    setBulkGroupsRaw(prev => prev.map(g => ({
      ...g,
      rows: g.rows.map(r => {
        if (r._id) return r;
        const id = map.get(r.clientRowId);
        return id ? { ...r, _id: id } : r;
      }),
    })));
  }, [selectedAgency]);

  const syncNormalToBackend = useCallback(async (entries: NormalEntryRow[]) => {
    if (!selectedAgency) return;
    const validEntries = entries.filter(e => e.driverName.trim() && e.vehicleNumber.trim());
    if (validEntries.length === 0) return;
    const res = await syncNormalEntry({ agencyName: selectedAgency.name, entries: validEntries });

    const mappings = (res.rows ?? []).filter(r => r.clientRowId && r._id) as Array<{ clientRowId: string; _id: string }>;
    if (mappings.length === 0) return;
    const map = new Map(mappings.map(m => [m.clientRowId, m._id]));
    setNormalEntriesRaw(prev => prev.map(e => {
      if (e._id) return e;
      const id = map.get(e.clientRowId || '');
      return id ? { ...e, _id: id } : e;
    }));
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

    let totalBalance = 0;

    for (const group of bulkGroups) {
      if (
        !group.driverName.trim() &&
        !group.vehicleNumber.trim() &&
        group.rows.every(r => !r.startDate && !r.startKm && !r.grandTotal)
      ) {
        continue;
      }

      let remainingGroupAdvance = group.advancePaid || 0;

      group.rows.forEach((row) => {
        const gt = row.grandTotal || 0;
        let rowAdvance = 0;

        // Backend logic: if row-level advance is ever added, it overrides group advance.
        // For now we only support group-level advance applied once per driver/vehicle group.
        if (remainingGroupAdvance > 0) {
          rowAdvance = remainingGroupAdvance;
          remainingGroupAdvance = 0;
        }

        totalBalance += calculateBalanceAmount(gt, rowAdvance);
      });
    }

    return totalBalance;
  }, [bulkGroups, isBulkMode]);

  // ── Load agencies ──
  const loadAgencies = useCallback(async () => {
    setAgencyLoading(true);
    try {
      const data = await fetchAgencies();
      setAgencies(data.agencies);
      if (data.agencies.length > 0) {
        // Restore last selected agency if it still exists, else fallback to first.
        let preferredId: string | null = null;
        try { preferredId = localStorage.getItem(LS_SELECTED_AGENCY); } catch { /* ignore */ }
        const resolvedPreferred = preferredId
          ? data.agencies.find(a => (a._id ?? a.id) === preferredId)?._id ?? data.agencies.find(a => (a._id ?? a.id) === preferredId)?.id
          : null;

        const initialId = (resolvedPreferred ?? selectedId ?? data.agencies[0]._id ?? data.agencies[0].id ?? null) as string | null;
        if (initialId && initialId !== selectedId) {
          setSelectedId(initialId);
        }

        // Restore draft state for the chosen agency (bulk + normal), if present.
        if (initialId) {
          const savedBulk = loadFromLocalStorage<DriverGroup[]>(`${LS_BULK_PREFIX}${initialId}`, []);
          if (savedBulk.length > 0) setBulkGroupsRaw(savedBulk);
          const savedNormal = loadFromLocalStorage<NormalEntryRow[]>(`${LS_NORMAL_PREFIX}${initialId}`, []);
          if (savedNormal.length > 0) setNormalEntriesRaw(savedNormal);
        }
      }
    } catch { /* silent */ } finally { setAgencyLoading(false); }
  }, [selectedId]);

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
                // Preserve server clientRowId so refresh can dedupe against local drafts
                clientRowId: (t as any).clientRowId ?? nextRowId(),
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
            // Canonical merge: one group per (driverName, vehicleNumber).
            // Start from server state, then merge in any local unsaved rows (no _id) that aren't already on server.
            const keyOf = (g: Pick<DriverGroup, 'driverName' | 'vehicleNumber'>) =>
              `${(g.driverName || '').trim().toLowerCase()}|||${(g.vehicleNumber || '').trim().toUpperCase()}`;

            const rowKey = (r: any) => (r?._id ? `id:${String(r._id)}` : `cr:${String(r.clientRowId || '')}`);

            const outByKey = new Map<string, DriverGroup>();
            for (const sg of serverGroups) {
              const k = keyOf(sg);
              outByKey.set(k, {
                ...sg,
                rows: [...sg.rows],
              });
            }

            // Track row keys already present per group
            const existingRowKeysByGroup = new Map<string, Set<string>>();
            for (const [k, g] of outByKey.entries()) {
              existingRowKeysByGroup.set(k, new Set(g.rows.map(rowKey).filter(Boolean)));
            }

            // Merge local rows/groups
            for (const lg of prev) {
              const k = keyOf(lg);
              const target = outByKey.get(k) ?? {
                driverName: lg.driverName,
                vehicleNumber: lg.vehicleNumber,
                advancePaid: lg.advancePaid || 0,
                rows: [],
              };

              const seen = existingRowKeysByGroup.get(k) ?? new Set<string>();
              for (const r of lg.rows) {
                const rk = rowKey(r);
                if (!rk) continue;
                if (!seen.has(rk)) {
                  target.rows.push(r);
                  seen.add(rk);
                }
              }

              outByKey.set(k, target);
              existingRowKeysByGroup.set(k, seen);
            }

            const merged = Array.from(outByKey.values());
            const hasAnyData = merged.some(g =>
              g.driverName.trim() || g.vehicleNumber.trim() || g.rows.some(r => r.startDate || r.startKm || r.grandTotal)
            );

            return hasAnyData ? merged : [emptyDriverGroup()];
          });
        }
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
            // Canonical merge: prefer server entries, then keep local-only entries that aren't on server.
            const key = (e: any) => (e?._id ? `id:${String(e._id)}` : `local:${String(e.driverName || '')}|${String(e.vehicleNumber || '')}|${String(e.date || '')}`);
            const seen = new Set<string>();
            const out: NormalEntryRow[] = [];

            for (const se of serverEntries) {
              const k = key(se);
              if (!seen.has(k)) { out.push(se); seen.add(k); }
            }
            for (const le of prev) {
              const k = key(le);
              if (!seen.has(k)) { out.push(le); seen.add(k); }
            }

            const hasAny = out.some(e => e.driverName.trim() || e.vehicleNumber.trim());
            return hasAny ? out : [emptyNormalRow()];
          });
        }
      }
    } catch { /* silent */ }
  }, [selectedId, isBulkMode, selectedAgency]);
  const handleDeleteTrip = useCallback(async (id: string) => {
    if (!id) return;
    if (isBulkMode) await deleteBulkEntryTrip(id);
    else await deleteNormalEntryTrip(id);
    await loadTrips();
  }, [isBulkMode, loadTrips]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  // ── Agency selection ──
  const selectAgency = useCallback((id: string) => {
    setSelectedId(id);
    setShowDropdown(false);
    try { localStorage.setItem(LS_SELECTED_AGENCY, id); } catch {}
    // Restore from localStorage
    const savedBulk = loadFromLocalStorage<DriverGroup[]>(`${LS_BULK_PREFIX}${id}`, []);
    setBulkGroupsRaw(savedBulk.length > 0 ? savedBulk : [emptyDriverGroup()]);
    const savedNormal = loadFromLocalStorage<NormalEntryRow[]>(`${LS_NORMAL_PREFIX}${id}`, []);
    setNormalEntriesRaw(savedNormal.length > 0 ? savedNormal : [emptyNormalRow()]);
  }, []);

  // ── Mode toggle ──
  const toggleMode = useCallback((bulk: boolean) => {
    setIsBulkMode(bulk);
    try { localStorage.setItem(LS_ENTRY_MODE, bulk ? 'bulk' : 'normal'); } catch {}
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const close = () => setShowDropdown(false);
    document.addEventListener('click', close, { once: true });
    return () => document.removeEventListener('click', close);
  }, [showDropdown]);

  // No manual submit handlers — autosync only

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
          {/* No manual submit (autosync only) */}
        </div>
      </div>

      {/* ─── FEEDBACK BAR ─── */}
      {/* No submit feedback bar (autosync only) */}

      {/* ─── CONTENT ─── */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {!selectedAgency ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
            <Building2 className="h-16 w-16 text-slate-200" />
            <p className="text-sm font-medium text-slate-500">Select an agency to get started</p>
            <p className="text-xs text-slate-400">Choose from the dropdown above, or create a new agency.</p>
          </div>
        ) : isBulkMode ? (
          <BulkEntryTable groups={bulkGroups} onChange={setBulkGroups} onDeleteTrip={handleDeleteTrip} />
        ) : (
          <NormalEntryTable entries={normalEntries} onChange={setNormalEntries} onDeleteTrip={handleDeleteTrip} />
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
