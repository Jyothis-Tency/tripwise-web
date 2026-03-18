import { User } from 'lucide-react';
import type { Driver } from '../api';

function getStatusColor(driver: Driver): string {
  const statusVal = driver.status || (driver.isActive !== false ? 'Active' : 'Inactive');
  const s = String(statusVal).toLowerCase();
  if (s === 'active') return 'bg-emerald-500';
  if (s === 'on leave') return 'bg-amber-500';
  return 'bg-slate-400';
}

function getStatusLabel(driver: Driver): string {
  return driver.status || (driver.isActive !== false ? 'Active' : 'Inactive');
}

interface DriverCardProps {
  driver: Driver;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

export function DriverCard({ driver, isSelected, onSelect, onEdit }: DriverCardProps) {
  const name = driver.firstName && driver.lastName
    ? `${driver.firstName} ${driver.lastName}`.trim()
    : (driver as any).name ?? '—';
  const statusLabel = getStatusLabel(driver);
  const statusDot = getStatusColor(driver);
  const subtitle = driver.place
    ? driver.place
    : `${driver.totalTrips ?? 0} trips · ${driver.totalKm ?? 0} km`;

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all
        ${isSelected
          ? 'bg-indigo-50 border-indigo-400 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'}`}
    >
      {/* Avatar */}
      {driver.profileImg ? (
        <img
          src={driver.profileImg}
          alt={name}
          className="h-10 w-10 rounded-full object-cover shrink-0"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-indigo-500" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          <span className="text-[11px] text-slate-500">{statusLabel}</span>
        </div>
        <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>
      </div>

      {/* Edit */}
      <button
        onClick={e => { e.stopPropagation(); onEdit(); }}
        className="shrink-0 p-1.5 rounded-md bg-indigo-50 text-indigo-500 hover:bg-indigo-100 transition"
        title="Edit driver"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    </div>
  );
}
