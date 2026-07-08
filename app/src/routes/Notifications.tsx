import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import { longDate } from '../lib/dates';

const KIND_ICON: Record<string, string> = {
  assigned: '👤',
  due: '⏰',
  overdue: '❗',
  milestone: '🚩',
  comment: '💬',
  weight_alert: '⚠️',
  plan_shift: '🔁',
  invite_joined: '🎉',
  heat_watch: '🩷',
  whelping_started: '🐾',
  litter_cancelled: '⛔',
};

export default function Notifications() {
  const { notifications } = useSpace();

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read_at);
    if (!unread.length) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread.map((n) => n.id));
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <PageHeader
        title="Notifications"
        action={notifications.some((n) => !n.read_at) ? <Button variant="ghost" onClick={markAllRead}>Mark all read</Button> : undefined}
      />

      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet" subtitle="Assignments, due dates, and plan changes will show up here." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {notifications.map((n) => (
            <Card
              key={n.id}
              onClick={() => !n.read_at && markRead(n.id)}
              className={`p-3 flex items-start gap-3 cursor-pointer ${n.read_at ? '' : 'border-accent-softer bg-accent-soft'}`}
            >
              <span className="text-[16px] flex-none">{KIND_ICON[n.kind] || '🔔'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-extrabold">{n.title}</div>
                {n.body && <div className="text-[11.5px] text-muted font-semibold mt-0.5">{n.body}</div>}
                <div className="text-[10px] text-faint font-semibold mt-1">{longDate(n.created_at.slice(0, 10))}</div>
              </div>
              {!n.read_at && <span className="w-2 h-2 rounded-full bg-accent flex-none mt-1.5" />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
