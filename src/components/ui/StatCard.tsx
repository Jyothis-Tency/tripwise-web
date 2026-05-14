interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  icon: string;
}

export function StatCard({ label, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 transition-colors hover:border-slate-300">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {subtitle && (
        <p className="mt-1.5 text-[11px] sm:text-xs text-slate-400">{subtitle}</p>
      )}
    </div>
  );
}
