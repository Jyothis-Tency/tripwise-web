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
        <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200/80 p-4 sm:p-5 mb-4 shadow-inner">
          {icon}
        </div>
      )}
      <h3 className="text-base sm:text-lg font-semibold text-slate-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 mb-4 px-4 max-w-sm">{description}</p>
      )}
      {action}
    </div>
  );
}
