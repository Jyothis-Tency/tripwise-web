import { TripwiseLogo } from "../brand/TripwiseLogo";

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon?: string;
}

export function ComingSoonPage({
  title,
  description,
  icon,
}: ComingSoonPageProps) {
  return (
    <div className="flex h-full items-center justify-center p-6 animate-fade-in">
      <div className="flex max-w-sm flex-col items-center text-center">
        {icon ? (
          <div className="mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-[#1e2638]">
            <span className="text-4xl">{icon}</span>
          </div>
        ) : (
          <TripwiseLogo className="mb-6 h-24 w-24 drop-shadow-md" />
        )}
        <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {title}
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </p>
        <div className="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span
              className="h-1.5 w-1.5 rounded-full bg-indigo-300 animate-pulse"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full bg-indigo-200 animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
            Coming Soon
          </span>
        </div>
      </div>
    </div>
  );
}
