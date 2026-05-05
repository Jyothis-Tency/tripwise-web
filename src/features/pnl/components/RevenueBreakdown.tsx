import React from 'react';
import { Wallet, Briefcase, Truck, BadgeIndianRupee } from 'lucide-react';
import type { PLRevenue, PLSummary } from '../api';

interface RevenueBreakdownProps {
  revenue: PLRevenue;
  summary?: PLSummary;
}

export const RevenueBreakdown: React.FC<RevenueBreakdownProps> = ({ revenue, summary }) => {
  const commission = revenue.commission || revenue.commissionRevenue || revenue.ownerRevenue || 0;
  const tripsProfit = revenue.ownerProfit ?? revenue.ownerRevenue ?? 0;
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue Card - Large */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-600 p-5 sm:p-6 shadow-md md:col-span-2 lg:col-span-1 flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute -left-6 -bottom-6 h-32 w-32 rounded-full bg-indigo-500/50 blur-2xl"></div>
          
          <div className="relative flex items-start gap-4 z-10">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner border border-white/20 text-white">
              <Wallet className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-indigo-100">Total Revenue</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">₹{revenue.total.toLocaleString()}</h3>
              <p className="mt-1 text-[11px] sm:text-xs text-indigo-200">Combined revenue from all sources</p>
            </div>
          </div>

          <div className="relative z-10 mt-6 border-t border-white/20 pt-4">
            <h4 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-white/60 mb-3">Additional Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-indigo-200">Driver Salary</p>
                <p className="text-sm sm:text-base font-bold text-white mt-0.5">₹{Math.round(revenue.driverSalary || 0).toLocaleString()}</p>
              </div>
              {summary && (
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-indigo-200">Avg / Trip</p>
                  <p className="text-sm sm:text-base font-bold text-white mt-0.5">₹{Math.round(summary.avgRevenuePerTrip || 0).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Commission Revenue Card */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 sm:p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">Commission Profit</p>
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

        {/* Trips Profit Card */}
        <div className="rounded-2xl border border-violet-100 bg-white p-5 sm:p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <BadgeIndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">Trips Profit</p>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">₹{tripsProfit.toLocaleString()}</h3>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">Net profit earned from all trips</p>
        </div>
      </div>
    </div>
  );
};
