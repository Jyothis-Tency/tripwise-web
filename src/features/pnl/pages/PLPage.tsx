import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  Filter, 
  X, 
  RefreshCw, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { fetchPLData } from '../api';
import type { PLDataResponse } from '../api';
import { RevenueBreakdown } from '../components/RevenueBreakdown';
import { TripStatistics } from '../components/TripStatistics';
import { TopRoutes } from '../components/TopRoutes';
import { AdditionalMetrics } from '../components/AdditionalMetrics';

export const PLPage: React.FC = () => {
  const [data, setData] = useState<PLDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [filterText, setFilterText] = useState('All Time');

  const loadData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      
      const period = (!startDate && !endDate) ? 'all' : undefined;
      const result = await fetchPLData(period, startDate, endDate);
      setData(result);
      
      // Update filter text
      if (startDate && endDate) {
        setFilterText(`${startDate} to ${endDate}`);
      } else if (startDate) {
        setFilterText(`From ${startDate}`);
      } else if (endDate) {
        setFilterText(`Until ${endDate}`);
      } else {
        setFilterText('All Time');
      }
      
      setIsFilterApplied(!!(startDate || endDate));
    } catch (err: any) {
      setError(err.message || 'Failed to load P&L data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyFilter = () => {
    loadData();
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    // We need to wait for state updates or pass values directly
    setTimeout(() => loadData(), 0);
  };

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-600">Loading P&L data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Failed to load P&L data</h2>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            onClick={() => loadData()}
            className="mt-6 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-6">
      {/* Header & Filters */}
      <div className="mb-6 sm:mb-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">Profit & Loss Statement</h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">Period: </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isFilterApplied ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {filterText}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap sm:items-end gap-3 sm:gap-4 border-t border-slate-100 pt-5 lg:border-none lg:pt-0">
            <div className="flex flex-col gap-1.5 w-full sm:w-auto">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-auto rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 w-full sm:w-auto">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-auto rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto mt-1 sm:mt-0">
              <button
                onClick={handleApplyFilter}
                className="flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Filter className="h-4 w-4" />
                Apply
              </button>
              {isFilterApplied && (
                <button
                  onClick={handleClearFilter}
                  className="flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {data && (
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          <RevenueBreakdown revenue={data.revenue} />
          <TripStatistics trips={data.trips} />
          <TopRoutes routes={data.topRoutes} />
          <AdditionalMetrics 
            revenue={data.revenue} 
            summary={data.summary} 
          />
        </div>
      )}
    </div>
  );
};
