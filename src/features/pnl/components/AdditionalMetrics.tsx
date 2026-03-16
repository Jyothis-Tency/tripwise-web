import React from 'react';
import { TrendingUp, User, MinusCircle, Calculator } from 'lucide-react';
import type { PLRevenue, PLSummary } from '../api';

interface AdditionalMetricsProps {
  revenue: PLRevenue;
  summary: PLSummary;
}

export const AdditionalMetrics: React.FC<AdditionalMetricsProps> = ({ revenue, summary }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-2">
        <Calculator className="h-5 w-5 text-indigo-500" />
        <h2 className="text-lg font-semibold text-slate-900">Additional Metrics</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Owner Profit */}
        <div className="flex items-center gap-4 rounded-xl border border-emerald-50 bg-emerald-50/20 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Owner Profit</p>
            <h4 className="text-xl font-bold text-emerald-700">₹{Math.round(revenue.ownerProfit).toLocaleString()}</h4>
            <p className="text-[10px] text-slate-400">Trip Revenue - Driver Salary</p>
          </div>
        </div>

        {/* Driver Salary */}
        <div className="flex items-center gap-4 rounded-xl border border-red-50 bg-red-50/20 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <User className="h-6 w-6" />
            <MinusCircle className="absolute -bottom-1 -right-1 h-4 w-4 fill-white text-red-500" />
          </div>
          <div className="relative">
            <p className="text-xs font-medium text-slate-500">Driver Salary</p>
            <h4 className="text-xl font-bold text-red-700">₹{Math.round(revenue.driverSalary).toLocaleString()}</h4>
            <p className="text-[10px] text-slate-400">Total salary paid to drivers</p>
          </div>
        </div>

        {/* Avg Revenue/Trip */}
        <div className="flex items-center gap-4 rounded-xl border border-indigo-50 bg-indigo-50/20 p-5 md:col-span-2 lg:col-span-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Avg Revenue/Trip</p>
            <h4 className="text-xl font-bold text-indigo-700">₹{Math.round(summary.avgRevenuePerTrip).toLocaleString()}</h4>
            <p className="text-[10px] text-slate-400">Average revenue per trip</p>
          </div>
        </div>
      </div>
    </div>
  );
};
