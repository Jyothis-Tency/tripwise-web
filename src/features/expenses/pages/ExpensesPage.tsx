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

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '7px 0', textAlign: 'center', borderRadius: 8, fontWeight: 600, fontSize: 13,
    cursor: 'pointer', transition: '.2s',
    background: active ? '#6366f1' : 'transparent',
    color: active ? '#fff' : '#64748b',
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>💰</span>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Expenses</h2>
          </div>

          {/* Toggle */}
          <div style={{ display: 'flex', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 3, width: 220 }}>
            <div style={toggleStyle(!isTripMode)} onClick={() => setIsTripMode(false)}>Personal</div>
            <div style={toggleStyle(isTripMode)} onClick={() => setIsTripMode(true)}>Trip Expense</div>
          </div>

          {!isTripMode && (
            <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        {isTripMode ? (
          /* ── Trip Expenses ── */
          <>
            <div style={{ marginBottom: 12 }}>
              <input
                placeholder="Search trips…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', maxWidth: 340, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }}
              />
            </div>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 64, borderRadius: 10, background: '#e2e8f0', marginBottom: 8 }} />)
            ) : trips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                <div style={{ fontSize: 44 }}>📦</div>
                <p style={{ fontSize: 14 }}>No trips with expenses found</p>
              </div>
            ) : (
              trips.map((t, i) => <TripExpenseCard key={t._id || (t as any).id || i} trip={t} onRefresh={loadTrips} />)
            )}
          </>
        ) : (
          /* ── Personal Expenses ── */
          <>
            {/* Month selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px' }}>
                <span style={{ fontSize: 14 }}>📅</span>
                <select
                  value={`${month.getFullYear()}-${month.getMonth()}`}
                  onChange={e => { const [y, m] = e.target.value.split('-').map(Number); setMonth(new Date(y, m)); }}
                  style={{ border: 'none', outline: 'none', fontSize: 13, cursor: 'pointer', background: 'transparent' }}
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const y = new Date().getFullYear();
                    const m = new Date().getMonth() - i;
                    const d = new Date(y, m);
                    return <option key={i} value={`${d.getFullYear()}-${d.getMonth()}`}>{MONTHS[d.getMonth()]} {d.getFullYear()}</option>;
                  })}
                </select>
              </div>
              <div style={{ background: '#eef2ff', color: '#4f46e5', padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                Total: ₹{totalAmt.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Total Expenses', value: `₹${totalAmt.toLocaleString('en-IN')}`, color: '#ef4444', bg: '#fef2f2' },
                { label: 'Count', value: String(expenses.length), color: '#6366f1', bg: '#eef2ff' },
                { label: 'Average', value: `₹${Math.round(avgAmt).toLocaleString('en-IN')}`, color: '#f59e0b', bg: '#fffbeb' },
              ].map(c => (
                <div key={c.label} style={{ background: c.bg, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c.color, marginTop: 2 }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Expense list */}
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 56, borderRadius: 10, background: '#e2e8f0', marginBottom: 6 }} />)
            ) : expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                <div style={{ fontSize: 44 }}>📋</div>
                <p style={{ fontSize: 14 }}>No expenses this month</p>
                <button onClick={() => setShowAdd(true)} style={{ marginTop: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Add one</button>
              </div>
            ) : (
              expenses.map(e => <ExpenseCard key={e._id} expense={e} onRefresh={loadPersonal} />)
            )}
          </>
        )}
      </div>

      <AddExpenseModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={loadPersonal} />
    </div>
  );
};

export default ExpensesPage;
