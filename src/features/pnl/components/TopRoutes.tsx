import React from 'react';
import { Route as RouteIcon, Trophy } from 'lucide-react';
import type { PLRoute } from '../api';

interface TopRoutesProps {
  routes: PLRoute[];
}

export const TopRoutes: React.FC<TopRoutesProps> = ({ routes }) => {
  if (routes.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="mb-4 sm:mb-6 flex items-center gap-2">
        <RouteIcon className="h-5 w-5 text-indigo-500" />
        <h2 className="text-base sm:text-lg font-semibold text-slate-900">Top Revenue Routes</h2>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {routes.map((route, index) => (
          <div 
            key={route.route} 
            className="flex items-center gap-3 sm:gap-4 rounded-xl border border-slate-50 bg-slate-50/50 p-3 sm:p-4 transition-colors hover:bg-slate-50"
          >
            <div className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full font-bold shadow-sm text-sm sm:text-base ${
              index === 0 ? 'bg-amber-100 text-amber-600' :
              index === 1 ? 'bg-slate-200 text-slate-600' :
              index === 2 ? 'bg-orange-100 text-orange-600' :
              'bg-white text-slate-400 border border-slate-200'
            }`}>
              {index === 0 ? <Trophy className="h-4 w-4 sm:h-5 sm:w-5" /> : index + 1}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="truncate text-xs sm:text-sm font-semibold text-slate-900">{route.route}</h4>
              <p className="text-[10px] sm:text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                {route.trips} {route.trips === 1 ? 'trip' : 'trips'} <span className="hidden sm:inline">• Avg: ₹{Math.round(route.avgRevenue).toLocaleString()}</span>
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm sm:text-base font-bold text-emerald-600">₹{Math.round(route.revenue).toLocaleString()}</p>
              <p className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-slate-400">Total Rev<span className="hidden sm:inline">enue</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
