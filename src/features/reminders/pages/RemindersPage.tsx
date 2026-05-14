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
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-200/50 bg-white shrink-0">
        <PageHeader
          title="Reminders"
          description={`${active.length} active • ${completed.length} completed`}
          actions={
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors shadow-sm active:scale-[0.98] whitespace-nowrap"
            >
              <span className="hidden sm:inline">+ Create Reminder</span>
              <span className="sm:hidden">+ Create</span>
            </button>
          }
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6 pt-4 sm:pt-6">
        {loading ? (
          <div className="space-y-2.5 stagger-children">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : reminders.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8 text-slate-400" />}
            title="No reminders yet"
            description="Create a reminder to stay on top of important tasks and deadlines."
            action={
              <button
                onClick={() => setShowCreate(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors shadow-sm"
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
                  <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] sm:text-xs text-white">⏰</span>
                  <span className="font-bold text-sm sm:text-base text-slate-700">Active Reminders</span>
                  <span className="bg-blue-100 text-blue-600 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full">{active.length}</span>
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
                  <span className="font-bold text-sm sm:text-base text-slate-700">Completed</span>
                  <span className="bg-emerald-100 text-emerald-600 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full">{completed.length}</span>
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
