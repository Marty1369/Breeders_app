import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { useAuth } from '../state/AuthProvider';
import { Avatar, Chip, EmptyState, PageHeader } from '../components/ui';
import { addDays, longDate, todayStr } from '../lib/dates';
import { checkKey, occurrencesForDate, type Occurrence } from '../lib/recurrence';
import { markTaskDone, setOccurrence } from '../lib/actions';
import type { RuleCheck, Task } from '../lib/types';

type Row =
  | { kind: 'occ'; occ: Occurrence; time: string }
  | { kind: 'task'; task: Task; time: string };

const SLOTS: { label: string; test: (t: string) => boolean }[] = [
  { label: 'MORNING', test: (t) => t < '12:00' },
  { label: 'MIDDAY', test: (t) => t >= '12:00' && t < '17:00' },
  { label: 'EVENING', test: (t) => t >= '17:00' },
];

export default function Today() {
  const { litters, tasks, activeLitterId, recurrenceRules, ruleChecks, members, space } = useSpace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = todayStr();
  const yesterday = addDays(today, -1);

  const litter = litters.find((l) => l.id === activeLitterId) || null;
  const litterDates = litter?.dates ?? null;

  const checkMap = useMemo(() => {
    const m = new Map<string, RuleCheck>();
    for (const c of ruleChecks) m.set(checkKey(c.rule_id, c.occ_date, c.occ_time), c);
    return m;
  }, [ruleChecks]);

  const todayOccs = useMemo(
    () => occurrencesForDate(recurrenceRules, checkMap, today, litterDates, activeLitterId, today),
    [recurrenceRules, checkMap, today, litterDates, activeLitterId]
  );
  const missedYesterday = useMemo(
    () =>
      occurrencesForDate(recurrenceRules, checkMap, yesterday, litterDates, activeLitterId, today).filter(
        (o) => !o.check
      ),
    [recurrenceRules, checkMap, yesterday, litterDates, activeLitterId]
  );

  const dueTasks = tasks.filter((t) => t.litter_id === activeLitterId && t.start_date === today);

  const rows: Row[] = [
    ...todayOccs.map((o) => ({ kind: 'occ' as const, occ: o, time: o.time })),
    ...dueTasks.map((t) => ({ kind: 'task' as const, task: t, time: '' })),
  ];

  const [busy, setBusy] = useState(false);
  async function logLateAll() {
    setBusy(true);
    await Promise.all(missedYesterday.map((o) => setOccurrence(space!.id, o.rule.id, o.date, o.time, 'done', user?.id)));
    setBusy(false);
  }
  async function skipAll() {
    setBusy(true);
    await Promise.all(missedYesterday.map((o) => setOccurrence(space!.id, o.rule.id, o.date, o.time, 'skip', user?.id)));
    setBusy(false);
  }

  if (!litter) {
    return (
      <div className="p-6">
        <EmptyState title="No litter selected" subtitle="Pick a litter to see today's plan." />
      </div>
    );
  }

  const total = rows.length;
  const done = todayOccs.filter((o) => o.check?.status === 'done').length + dueTasks.filter((t) => t.status === 'done').length;

  const anytime = rows.filter((r) => !r.time);
  const slotGroups = SLOTS.map((s) => ({ label: s.label, rows: rows.filter((r) => r.time && s.test(r.time)) })).filter((g) => g.rows.length);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title="Today" subtitle={longDate(today)} action={<Chip tone="accent">{done}/{total}</Chip>} />

      {missedYesterday.length > 0 && (
        <div className="flex items-center gap-2.5 bg-card border-[1.5px] rounded-[12px] px-3.5 py-2.5 mb-4" style={{ borderColor: '#e5c9a3' }}>
          <span className="text-amber font-extrabold">!</span>
          <div className="flex-1 text-[12px] font-bold">{missedYesterday.length} missed yesterday</div>
          <button disabled={busy} onClick={logLateAll} className="text-[11px] font-extrabold text-accent cursor-pointer">Log late</button>
          <button disabled={busy} onClick={skipAll} className="text-[11px] font-extrabold text-faint cursor-pointer">Skip</button>
        </div>
      )}

      {total === 0 ? (
        <EmptyState title="Nothing scheduled today" subtitle="Enjoy the quiet." />
      ) : (
        <div className="flex flex-col gap-4">
          {slotGroups.map((g) => (
            <Slot key={g.label} label={g.label} rows={g.rows} />
          ))}
          {anytime.length > 0 && <Slot label="ANYTIME TODAY" rows={anytime} />}
        </div>
      )}
    </div>
  );

  function Slot({ label, rows }: { label: string; rows: Row[] }) {
    return (
      <div>
        <div className="text-[11px] font-extrabold tracking-wide text-faint mb-1.5">{label}</div>
        <div className="bg-card border border-card-border rounded-[14px] overflow-hidden">
          {rows.map((r, i) => (r.kind === 'occ' ? <OccRow key={r.occ.key} occ={r.occ} last={i === rows.length - 1} /> : <TaskRow key={r.task.id} task={r.task} last={i === rows.length - 1} />))}
        </div>
      </div>
    );
  }

  function OccRow({ occ, last }: { occ: Occurrence; last: boolean }) {
    const done = occ.check?.status === 'done';
    const skip = occ.check?.status === 'skip';
    const who = occ.assigneeId ? members.find((m) => m.user_id === occ.assigneeId) : null;
    return (
      <div className={`flex items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-border-soft'}`}>
        <button
          onClick={() => setOccurrence(space!.id, occ.rule.id, occ.date, occ.time, done ? null : 'done', user?.id)}
          className={`w-[26px] h-[26px] flex-none rounded-[8px] grid place-items-center text-[13px] font-extrabold cursor-pointer border ${done ? 'bg-accent border-accent text-white' : 'bg-white border-border'}`}
        >
          {done ? '✓' : skip ? '–' : ''}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`text-[13.5px] font-bold ${done ? 'line-through text-faint' : skip ? 'text-faint' : ''}`}>{occ.rule.name}</div>
          <div className="text-[10.5px] text-faint font-semibold">{who ? who.name : 'Unassigned'}</div>
        </div>
        {who && <Avatar name={who.name} color={who.avatar_color} size={22} />}
        <div className="flex-none text-[9px] font-extrabold px-2 py-1 rounded-full bg-chip-bg text-muted">{occ.time}</div>
      </div>
    );
  }

  function TaskRow({ task, last }: { task: Task; last: boolean }) {
    const done = task.status === 'done';
    return (
      <div className={`flex items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-border-soft'}`}>
        <button
          onClick={() => markTaskDone(task, !done)}
          className={`w-[26px] h-[26px] flex-none rounded-[8px] grid place-items-center text-[13px] font-extrabold cursor-pointer border ${done ? 'bg-accent border-accent text-white' : 'bg-white border-border'}`}
        >
          {done ? '✓' : ''}
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate('/tasks')}>
          <div className={`text-[13.5px] font-bold ${done ? 'line-through text-faint' : ''}`}>{task.name}</div>
          <div className="text-[10.5px] text-faint font-semibold">One-off task</div>
        </div>
        <div className="flex-none text-[9px] font-extrabold px-2 py-1 rounded-full bg-chip-bg text-muted">task</div>
      </div>
    );
  }
}
