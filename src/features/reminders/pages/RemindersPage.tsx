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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔔</span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Reminders</h2>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Create Reminder
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 90, borderRadius: 10, background: '#e2e8f0', marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
          ))
        ) : reminders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 48 }}>📋</div>
            <p style={{ fontSize: 15, marginTop: 8 }}>No reminders yet</p>
            <button onClick={() => setShowCreate(true)} style={{ marginTop: 8, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
              Create your first reminder
            </button>
          </div>
        ) : (
          <>
            {/* Active */}
            {active.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff' }}>⏰</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#334155' }}>Active Reminders</span>
                  <span style={{ background: '#e0e7ff', color: '#4f46e5', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{active.length}</span>
                </div>
                {active.map(r => <ReminderCard key={r._id} reminder={r} onRefresh={load} />)}
              </div>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff' }}>✓</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#334155' }}>Completed</span>
                  <span style={{ background: '#d1fae5', color: '#059669', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{completed.length}</span>
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
