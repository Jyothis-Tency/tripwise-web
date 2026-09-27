import React, { useCallback, useEffect, useState } from 'react';
import type { Reminder } from '../api';
import { fetchReminders } from '../api';
import ReminderCard from '../components/ReminderCard';
import CreateReminderModal from '../components/CreateReminderModal';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Bell } from 'lucide-react';

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
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-main)]">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200/50 bg-[var(--bg-card)] px-4 py-4 sm:px-6 sm:py-5 dark:border-[#1e2638]">
        <PageHeader
          title="Reminders"
          description={`${active.length} active • ${completed.length} completed`}
          actions={
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <span className="hidden sm:inline">+ Create Reminder</span>
              <span className="sm:hidden">+ Create</span>
            </button>
          }
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg-main)] px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
        {loading ? (
          <div className="space-y-2.5 stagger-children">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-200 animate-pulse dark:bg-white/5" />
            ))}
          </div>
        ) : reminders.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8 text-slate-400 dark:text-slate-500" />}
            title="No reminders yet"
            description="Create a reminder to stay on top of important tasks and deadlines."
            action={
              <button
                onClick={() => setShowCreate(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors shadow-sm dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                Create your first reminder
              </button>
            }
          />
        ) : (
          <>
            {/* Active */}
            {active.length > 0 && (
              <div className="mb-6 animate-slide-up">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] sm:text-xs text-white">⏰</span>
                  <span className="font-bold text-sm sm:text-base text-slate-700 dark:text-slate-200">Active Reminders</span>
                  <span className="bg-indigo-100 text-indigo-600 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full dark:bg-indigo-500/15 dark:text-indigo-300">{active.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {active.map(r => <ReminderCard key={r._id} reminder={r} onRefresh={load} />)}
                </div>
              </div>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <div className="animate-slide-up">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] sm:text-xs text-white">✓</span>
                  <span className="font-bold text-sm sm:text-base text-slate-700 dark:text-slate-200">Completed</span>
                  <span className="bg-emerald-100 text-emerald-600 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full dark:bg-emerald-500/15 dark:text-emerald-400">{completed.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {completed.map(r => <ReminderCard key={r._id} reminder={r} onRefresh={load} />)}
                </div>
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
