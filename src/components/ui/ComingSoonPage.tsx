interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: string;
}

export function ComingSoonPage({ title, description, icon }: ComingSoonPageProps) {
  return (
    <div className="flex h-full items-center justify-center p-6 animate-fade-in">
      <div className="flex flex-col items-center text-center max-w-sm">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 mb-6">
          <span className="text-4xl">{icon}</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-2">
          {title}
        </h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          {description}
        </p>
        <div className="flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-2">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-blue-300 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-blue-200 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs font-semibold text-blue-600">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
