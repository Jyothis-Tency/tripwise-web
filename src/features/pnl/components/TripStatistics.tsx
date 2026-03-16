import React from 'react';
import { 
  Milestone, 
  CheckCircle2, 
  XCircle, 
  BarChart3 
} from 'lucide-react';
import type { PLTrips } from '../api';

interface TripStatisticsProps {
  trips: PLTrips;
}

export const TripStatistics: React.FC<TripStatisticsProps> = ({ trips }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-indigo-500" />
        <h2 className="text-lg font-semibold text-slate-900">Trip Statistics</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Trips */}
        <div className="rounded-xl border border-indigo-50 bg-indigo-50/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <Milestone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Trips</p>
              <h4 className="text-lg font-bold text-indigo-700">{trips.total}</h4>
            </div>
          </div>
        </div>

        {/* Completed Trips */}
        <div className="rounded-xl border border-emerald-50 bg-emerald-50/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Completed</p>
              <h4 className="text-lg font-bold text-emerald-700">{trips.completed}</h4>
            </div>
          </div>
        </div>

        {/* Cancelled Trips */}
        <div className="rounded-xl border border-red-50 bg-red-50/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Cancelled</p>
              <h4 className="text-lg font-bold text-red-700">{trips.cancelled}</h4>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="rounded-xl border border-amber-50 bg-amber-50/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Completion Rate</p>
              <h4 className="text-lg font-bold text-amber-700">{trips.completionRate.toFixed(1)}%</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
