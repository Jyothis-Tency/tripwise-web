const STATUS_THEMES: Record<string, string> = {
  // Trip statuses — solid bg, white text (pill-style like Azulou)
  available: 'bg-emerald-500 text-white',
  'on trip': 'bg-blue-500 text-white',
  on_trip: 'bg-blue-500 text-white',
  ongoing: 'bg-blue-500 text-white',
  active: 'bg-blue-500 text-white',
  in_progress: 'bg-blue-500 text-white',
  'in progress': 'bg-blue-500 text-white',
  scheduled: 'bg-violet-500 text-white',
  upcoming: 'bg-purple-500 text-white',
  completed: 'bg-emerald-500 text-white',
  done: 'bg-emerald-500 text-white',
  cancelled: 'bg-red-500 text-white',
  maintenance: 'bg-orange-500 text-white',
  'under maintenance': 'bg-orange-500 text-white',
  inactive: 'bg-slate-400 text-white',

  // Payment statuses — lighter treatment
  paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border border-amber-200',
  unpaid: 'bg-slate-50 text-slate-600 border border-slate-200',
};

const DEFAULT_THEME = 'bg-slate-100 text-slate-600';

interface StatusBadgeProps {
  status: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, size = 'sm', className = '' }: StatusBadgeProps) {
  const key = (status ?? '').toLowerCase().trim();
  const theme = STATUS_THEMES[key] ?? DEFAULT_THEME;

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[9px]',
    sm: 'px-2.5 py-1 text-[10px]',
    md: 'px-3 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wide leading-none ${sizeClasses[size]} ${theme} ${className}`}
    >
      {status || 'Unknown'}
    </span>
  );
}
