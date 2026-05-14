import type { ReactNode } from 'react';

export const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 hover:border-slate-300 placeholder:text-slate-400';

interface FieldProps {
  label: string;
  id: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}

export function Field({ label, id, required, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-slate-600 tracking-wide">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
