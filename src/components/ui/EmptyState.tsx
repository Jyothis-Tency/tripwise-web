import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 sm:py-20 text-center animate-fade-in ${className}`}>
      {icon && (
        <div className="mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200/80 p-4 shadow-inner sm:p-5 dark:from-white/10 dark:to-white/5">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold text-slate-700 sm:text-lg dark:text-white">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm px-4 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action}
    </div>
  );
}
