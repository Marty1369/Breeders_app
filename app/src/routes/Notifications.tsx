import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Button, EmptyState, PageHeader } from '../components/ui';
import {
  UsersIcon, ClockIcon, HeartPulseIcon, BellIcon, ScaleIcon, RepeatIcon, XIcon,
} from '../components/icons';
import { longDate } from '../lib/dates';
import type { NotificationKind } from '../lib/types';

// One stroke-icon set for all chrome (spec §1.3) — no emoji.
const KIND_ICON: Record<string, typeof BellIcon> = {
  assigned: UsersIcon,
  due: ClockIcon,
  overdue: ClockIcon,
  milestone: HeartPulseIcon,
  comment: BellIcon,
  weight_alert: ScaleIcon,
  plan_shift: RepeatIcon,
  invite_joined: UsersIcon,
  heat_watch: HeartPulseIcon,
  whelping_started: HeartPulseIcon,
  litter_cancelled: XIcon,
};

// Where each notification kind should take you when tapped.
const KIND_ROUTE: Record<NotificationKind, string> = {
  weight_alert: '/weigh-in',
  whelping_started: '/whelping',
  assigned: '/plan',
  due: '/plan',
  overdue: '/plan',
  comment: '/plan',
  plan_shift: '/plan',
  milestone: '/plan',
  heat_watch: '/dogs',
  invite_joined: '/team',
  litter_cancelled: '/litters',
};

// Kinds whose ref_id is a task — these can deep-link straight to the task.
const TASK_KINDS: NotificationKind[] = ['assigned', 'due', 'overdue', 'comment'];

export default function Notifications() {
  const { notifications, litters, tasks, setActiveLitterId } = useSpace();
  const navigate = useNavigate();

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read_at);
    if (!unread.length) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread.map((n) => n.id));
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  }

  // Tap a notification: focus its litter, jump to the exact target when the
  // kind implies one (task kinds carry a task id in ref_id), and mark it read.
  const openNotification = (n: (typeof notifications)[number]) => {
    if (!n.read_at) markRead(n.id);
    const refTask = TASK_KINDS.includes(n.kind) && n.ref_id ? tasks.find((t) => t.id === n.ref_id) : undefined;
    if (refTask) {
      setActiveLitterId(refTask.litter_id);
      navigate(`/plan?task=${refTask.id}`);
      return;
    }
    if (n.ref_id && litters.some((l) => l.id === n.ref_id)) setActiveLitterId(n.ref_id);
    navigate(KIND_ROUTE[n.kind] || '/');
  };

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
          {notifications.map((n) => {
            const Icon = KIND_ICON[n.kind] || BellIcon;
            return (
            <button
              key={n.id}
              type="button"
              onClick={() => openNotification(n)}
              className={`w-full text-left rounded-[var(--radius-card)] border p-3 flex items-start gap-3 cursor-pointer ${n.read_at ? 'bg-card border-card-border' : 'border-accent-softer bg-accent-soft'}`}
            >
              <span className="flex-none text-accent mt-0.5"><Icon size={18} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-extrabold">{n.title}</div>
                {n.body && <div className="text-[11.5px] text-muted font-semibold mt-0.5">{n.body}</div>}
                <div className="text-[10px] text-faint font-semibold mt-1">{longDate(n.created_at.slice(0, 10))}</div>
              </div>
              {!n.read_at && <span className="w-2 h-2 rounded-full bg-accent flex-none mt-1.5" />}
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
