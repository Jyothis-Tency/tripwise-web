import React, { useCallback, useEffect, useState } from 'react';
import type { Reminder } from '../api';
import { fetchReminders } from '../api';
import ReminderCard from '../components/ReminderCard';
import CreateReminderModal from '../components/CreateReminderModal';

const RemindersPage: React.FC = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchReminders({ limit: 100 });
      setReminders(res.reminders);
    } catch { setReminders([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = reminders.filter(r => !r.isCompleted);
  const completed = reminders.filter(r => r.isCompleted);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 lg:px-6 lg:py-4 border-b border-slate-200/50">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🔔</span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 m-0">Reminders</h2>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border-0 rounded-xl px-4 py-2 sm:py-2.5 text-sm font-semibold cursor-pointer transition-colors shadow-sm whitespace-nowrap">
          <span className="hidden sm:inline">+ Create Reminder</span>
          <span className="sm:hidden">+ Create</span>
        </button>
      </div>

      {/* Content */}
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6 lg:px-6 pt-4 sm:pt-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-200 animate-pulse mb-2.5" />
          ))
        ) : reminders.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-2">📋</div>
            <p className="text-sm mt-3">No reminders yet</p>
            <button onClick={() => setShowCreate(true)} className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white border-0 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors shadow-sm">
              Create your first reminder
            </button>
          </div>
        ) : (
          <>
            {/* Active */}
            {active.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] sm:text-xs text-white">⏰</span>
                  <span className="font-bold text-[15px] sm:text-base text-slate-700">Active Reminders</span>
                  <span className="bg-indigo-100 text-indigo-600 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full">{active.length}</span>
                </div>
                {active.map(r => <ReminderCard key={r._id} reminder={r} onRefresh={load} />)}
              </div>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] sm:text-xs text-white">✓</span>
                  <span className="font-bold text-[15px] sm:text-base text-slate-700">Completed</span>
                  <span className="bg-emerald-100 text-emerald-600 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full">{completed.length}</span>
                </div>
                {completed.map(r => <ReminderCard key={r._id} reminder={r} onRefresh={load} />)}
              </div>
            )}
          </>
        )}
      </div>

      <CreateReminderModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
    </div>
  );
};

export default RemindersPage;
