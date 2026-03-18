import React from 'react';
import { Wallet, Briefcase, Truck } from 'lucide-react';
import type { PLRevenue } from '../api';

interface RevenueBreakdownProps {
  revenue: PLRevenue;
}

export const RevenueBreakdown: React.FC<RevenueBreakdownProps> = ({ revenue }) => {
  const commission = revenue.commission || revenue.commissionRevenue || revenue.ownerRevenue || 0;
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Revenue Card - Large */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-white p-5 sm:p-6 shadow-sm md:col-span-2 lg:col-span-1">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-50 opacity-50"></div>
          <div className="relative flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">Total Revenue</p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900">₹{revenue.total.toLocaleString()}</h3>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">Combined revenue from all sources</p>
        </div>

        {/* Commission Revenue Card */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 sm:p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">Commission Revenue</p>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">₹{commission.toLocaleString()}</h3>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">From bulk entries & agencies</p>
        </div>

        {/* Trip Revenue Card */}
        <div className="rounded-2xl border border-blue-100 bg-white p-5 sm:p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">Trip Revenue</p>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">₹{revenue.tripRevenue.toLocaleString()}</h3>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">From owner's own trips</p>
        </div>
      </div>
    </div>
  );
};
