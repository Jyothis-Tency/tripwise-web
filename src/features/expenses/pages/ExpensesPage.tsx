import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Expense, TripWithExpenses } from '../api';
import { fetchExpenses, fetchTripsWithExpenses } from '../api';
import ExpenseCard from '../components/ExpenseCard';
import AddExpenseModal from '../components/AddExpenseModal';
import TripExpenseCard from '../components/TripExpenseCard';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function monthRange(d: Date): { startDate: string; endDate: string } {
  const y = d.getFullYear(), m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
}

const ExpensesPage: React.FC = () => {
  const [isTripMode, setIsTripMode] = useState(false);
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth()); });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [trips, setTrips] = useState<TripWithExpenses[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const loadPersonal = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = monthRange(month);
      const res = await fetchExpenses({ limit: 100, startDate, endDate });
      setExpenses(res.expenses);
    } catch { setExpenses([]); }
    finally { setLoading(false); }
  }, [month]);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTripsWithExpenses({ limit: 100, search: search || undefined });
      setTrips(res.trips);
    } catch { setTrips([]); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { if (!isTripMode) loadPersonal(); }, [isTripMode, loadPersonal]);
  useEffect(() => { if (isTripMode) loadTrips(); }, [isTripMode, loadTrips]);

  /* Summary stats */
  const totalAmt = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]);
  const avgAmt = useMemo(() => expenses.length ? totalAmt / expenses.length : 0, [totalAmt, expenses.length]);


  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-6 lg:py-5 border-b border-slate-200/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💰</span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 m-0">Expenses</h2>
          </div>

          {/* Controls row */}
          <div className="flex flex-col xs:flex-row items-stretch sm:items-center gap-3">
            {/* Toggle */}
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 w-full sm:w-[220px]">
              <button
                type="button"
                className={`flex-1 py-1.5 sm:py-2 text-center rounded-lg font-semibold text-xs sm:text-sm transition-colors ${!isTripMode ? 'bg-indigo-500 text-white shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}
                onClick={() => setIsTripMode(false)}
              >
                Personal
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 sm:py-2 text-center rounded-lg font-semibold text-xs sm:text-sm transition-colors ${isTripMode ? 'bg-indigo-500 text-white shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}
                onClick={() => setIsTripMode(true)}
              >
                Trip Expense
              </button>
            </div>

            {!isTripMode && (
              <button onClick={() => setShowAdd(true)} className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border-0 rounded-xl px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold cursor-pointer transition-colors shadow-sm">
                + Add Expense
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24">
        {isTripMode ? (
          /* ── Trip Expenses ── */
          <>
            <div className="mb-4">
              <input
                placeholder="Search trips…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full sm:max-w-[340px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
            </div>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-200 animate-pulse mb-2.5" />)
            ) : trips.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-2">📦</div>
                <p className="text-sm">No trips with expenses found</p>
              </div>
            ) : (
              trips.map((t, i) => <TripExpenseCard key={t._id || (t as any).id || i} trip={t} onRefresh={loadTrips} />)
            )}
          </>
        ) : (
          /* ── Personal Expenses ── */
          <>
            {/* Month selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 w-full sm:w-auto">
                <span className="text-sm">📅</span>
                <select
                  value={`${month.getFullYear()}-${month.getMonth()}`}
                  onChange={e => { const [y, m] = e.target.value.split('-').map(Number); setMonth(new Date(y, m)); }}
                  className="border-0 outline-none text-sm cursor-pointer bg-transparent w-full sm:w-auto font-medium text-slate-700"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const y = new Date().getFullYear();
                    const m = new Date().getMonth() - i;
                    const d = new Date(y, m);
                    return <option key={i} value={`${d.getFullYear()}-${d.getMonth()}`}>{MONTHS[d.getMonth()]} {d.getFullYear()}</option>;
                  })}
                </select>
              </div>
              <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold w-full sm:w-auto text-center sm:text-left">
                Total: ₹{totalAmt.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Total Expenses', value: `₹${totalAmt.toLocaleString('en-IN')}`, color: 'text-red-500', bg: 'bg-red-50 border border-red-100' },
                { label: 'Count', value: String(expenses.length), color: 'text-indigo-500', bg: 'bg-indigo-50 border border-indigo-100' },
                { label: 'Average', value: `₹${Math.round(avgAmt).toLocaleString('en-IN')}`, color: 'text-amber-500', bg: 'bg-amber-50 border border-amber-100' },
              ].map(c => (
                <div key={c.label} className={`${c.bg} rounded-xl p-3.5 sm:p-4`}>
                  <div className="text-xs sm:text-xs text-slate-500 font-semibold uppercase tracking-wider">{c.label}</div>
                  <div className={`text-lg sm:text-xl font-bold ${c.color} mt-1`}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Expense list */}
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-200 animate-pulse mb-2" />)
            ) : expenses.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <div className="text-5xl mb-2">📋</div>
                <p className="text-sm">No expenses this month</p>
                <button onClick={() => setShowAdd(true)} className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white border-0 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors shadow-sm">Add one</button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {expenses.map(e => <ExpenseCard key={e._id} expense={e} onRefresh={loadPersonal} />)}
              </div>
            )}
          </>
        )}
      </div>

      <AddExpenseModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={loadPersonal} />
    </div>
  );
};

export default ExpensesPage;
