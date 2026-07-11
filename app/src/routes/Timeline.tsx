import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Avatar, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { diffDays, longDate, niceDate, todayStr } from '../lib/dates';
import { effectiveDate } from '../lib/scheduling';
import TaskDetailSheet from '../components/task/TaskDetailSheet';
import CompleteTaskSheet from '../components/task/CompleteTaskSheet';
import TaskFormSheet from '../components/task/TaskFormSheet';
import TaskViewToggle from '../components/TaskViewToggle';
import type { Task, TaskPhase } from '../lib/types';

const PHASES: { value: TaskPhase | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'prewhelp', label: 'Before birth' },
  { value: 't1_birth', label: 'Wk 1–3' },
  { value: 't2_wean', label: 'Wk 4–6' },
  { value: 't3_social', label: 'Wk 7–9' },
];

// The real stages from the kennel sheet: before birth (IKI GIMDYMO), then the
// after-birth period split into puppy-age thirds (PO GIMDYMO trimesters).
const STAGE_ORDER: TaskPhase[] = ['prewhelp', 't1_birth', 't2_wean', 't3_social'];
const STAGE: Record<TaskPhase, { label: string; icon: string; sub: string; color: string }> = {
  prewhelp: { label: 'Before birth', icon: '🤰', sub: 'Mating → whelping', color: '#8a938e' },
  t1_birth: { label: 'After birth · weeks 1–3', icon: '🐣', sub: 'Newborn & nursing', color: '#17805a' },
  t2_wean: { label: 'After birth · weeks 4–6', icon: '🍼', sub: 'Weaning', color: '#4a6fa5' },
  t3_social: { label: 'After birth · weeks 7–9', icon: '🐕', sub: 'Socialization & handover', color: '#b97324' },
};

/** Frame a task by the birth: "T–5 to birth" before, "Pup day 12 · wk 2" after. */
function birthFraming(startDate: string, whelping: string | null): string {
  if (!whelping) return '';
  const d = diffDays(whelping, startDate);
  if (d < 0) return `T‑${-d} to birth`;
  if (d === 0) return 'Birth day';
  return `Pup day ${d} · wk ${Math.floor((d - 1) / 7) + 1}`;
}

/** Relative-date chip: Today / in 3 days / 5d overdue / Jul 20. */
function relDate(startDate: string, today: string, done: boolean): { label: string; tone: 'late' | 'soon' | 'muted' } {
  const d = diffDays(today, startDate);
  if (!done && d < 0) return { label: `${-d}d overdue`, tone: 'late' };
  if (d === 0) return { label: 'Today', tone: 'soon' };
  if (d === 1) return { label: 'Tomorrow', tone: 'soon' };
  if (d > 1 && d <= 6) return { label: `in ${d} days`, tone: d <= 3 ? 'soon' : 'muted' };
  return { label: niceDate(startDate), tone: 'muted' };
}

export default function Timeline({ mode = 'both' }: { mode?: 'both' | 'list' | 'calendar' }) {
  const { litters, tasks, activeLitterId, members } = useSpace();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'list' | 'calendar'>(mode === 'calendar' ? 'calendar' : 'list');
  const [phase, setPhase] = useState<TaskPhase | 'all'>('all');
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [completeTask, setCompleteTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(params.get('new_task') === '1');
  const [calMonth, setCalMonth] = useState(todayStr().slice(0, 7));
  const [calDay, setCalDay] = useState(todayStr());

  const litter = litters.find((l) => l.id === activeLitterId);
  const litterTasks = useMemo(
    () => tasks.filter((t) => t.litter_id === activeLitterId && (phase === 'all' || t.phase === phase)),
    [tasks, activeLitterId, phase]
  );

  const today = todayStr();
  const whelping = litter ? effectiveDate(litter.dates, 'whelping') : null;

  // Group by stage (before birth / after-birth thirds) — the kennel's own model.
  const stageGroups = useMemo(() => {
    return STAGE_ORDER.map((phase) => {
      const items = litterTasks
        .filter((t) => t.phase === phase)
        .sort((a, b) => a.start_date.localeCompare(b.start_date));
      const done = items.filter((t) => t.status === 'done').length;
      const nextIdx = items.findIndex((t) => t.status !== 'done');
      return { phase, items, done, nextIdx };
    }).filter((g) => g.items.length > 0);
  }, [litterTasks]);

  function closeSheets() {
    setDetailTask(null);
    setCompleteTask(null);
    setEditTask(null);
    setFormOpen(false);
    if (params.get('new_task')) {
      params.delete('new_task');
      setParams(params, { replace: true });
    }
  }

  if (!litter) {
    return (
      <div className="p-6">
        <EmptyState title="No litter selected" subtitle="Create a litter from My dogs to see its timeline." />
      </div>
    );
  }

  const effectiveView = mode === 'both' ? view : mode === 'calendar' ? 'calendar' : 'list';
  const title = mode === 'calendar' ? 'Calendar' : mode === 'list' ? 'Tasks' : 'Timeline';

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader title={title} subtitle={litter.name} />

      <div className="flex flex-col gap-3 mb-4">
        {mode === 'both' && (
          <SegmentedControl value={view} onChange={setView} options={[{ value: 'list', label: 'List' }, { value: 'calendar', label: 'Calendar' }]} />
        )}
        {mode === 'list' && <TaskViewToggle current="list" />}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {PHASES.map((p) => (
            <button
              key={p.value}
              onClick={() => setPhase(p.value)}
              className={`flex-none px-3 py-1.5 rounded-full text-[11.5px] font-extrabold cursor-pointer whitespace-nowrap ${
                phase === p.value ? 'bg-accent text-white' : 'bg-chip-bg text-muted'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setFormOpen(true)}
            className="flex-none ml-auto px-3 py-1.5 rounded-full text-[11.5px] font-extrabold cursor-pointer bg-accent-soft text-accent whitespace-nowrap"
          >
            ＋ New task
          </button>
        </div>
      </div>

      {effectiveView === 'list' ? (
        litterTasks.length === 0 ? (
          <EmptyState title="No tasks in this stage" />
        ) : (
          <div className="flex flex-col gap-6">
            {stageGroups.map(({ phase, items, done }) => {
              const s = STAGE[phase];
              const pct = Math.round((done / items.length) * 100);
              return (
                <div key={phase}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-[17px] leading-none">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] font-extrabold" style={{ color: s.color }}>{s.label}</span>
                        <span className="text-[10.5px] text-faint font-semibold truncate">{s.sub}</span>
                      </div>
                      <div className="mt-1 h-[3px] rounded-full bg-chip-bg overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                      </div>
                    </div>
                    <span className="text-[10.5px] font-extrabold text-faint tabular-nums flex-none">{done}/{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {items.map((t) => (
                      <TaskRow key={t.id} task={t} onOpen={() => setDetailTask(t)} onComplete={() => setCompleteTask(t)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <CalendarView
          month={calMonth}
          setMonth={setCalMonth}
          day={calDay}
          setDay={setCalDay}
          tasks={litterTasks}
          onOpen={(t) => setDetailTask(t)}
          onComplete={(t) => setCompleteTask(t)}
        />
      )}

      <TaskDetailSheet
        task={detailTask}
        onClose={closeSheets}
        onEdit={() => {
          setEditTask(detailTask);
          setDetailTask(null);
        }}
        onComplete={() => {
          setCompleteTask(detailTask);
          setDetailTask(null);
        }}
      />
      <CompleteTaskSheet task={completeTask} onClose={closeSheets} />
      <TaskFormSheet
        open={!!editTask || formOpen}
        task={editTask}
        litterId={activeLitterId}
        defaultDate={view === 'calendar' ? calDay : undefined}
        onClose={closeSheets}
      />
    </div>
  );

  function TaskRow({ task, onOpen, onComplete }: { task: Task; onOpen: () => void; onComplete: () => void }) {
    const done = task.status === 'done';
    const assignees = members.filter((m) => task.assignee_ids.includes(m.user_id));
    const rel = relDate(task.start_date, today, done);
    const framing = birthFraming(task.start_date, whelping);
    const stripe = done ? '#c9cec8' : rel.tone === 'late' ? '#c0392b' : rel.tone === 'soon' ? '#d1852a' : STAGE[task.phase].color;
    const relColor = rel.tone === 'late' ? 'text-danger' : rel.tone === 'soon' ? 'text-[#b7791b]' : 'text-faint';
    return (
      <div
        onClick={onOpen}
        className="flex items-center gap-3 pl-3 pr-3 py-2.5 bg-card border border-card-border rounded-[12px] cursor-pointer hover:border-border-strong transition-colors"
        style={{ boxShadow: 'inset 3px 0 0 0 ' + stripe }}
      >
        <input
          type="checkbox"
          checked={done}
          onClick={(e) => e.stopPropagation()}
          onChange={() => (done ? onOpen() : onComplete())}
          className="w-[19px] h-[19px] flex-none accent-[#17805a]"
          aria-label={done ? `Reopen ${task.name}` : `Complete ${task.name}`}
        />
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-bold truncate ${done ? 'line-through text-faint' : ''}`}>{task.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] font-semibold flex-wrap">
            <span className={relColor}>{rel.label}</span>
            {framing && <><span className="text-border-strong">·</span><span className="text-faint">{framing}</span></>}
            {task.is_pinned_date && <span className="text-faint">· 📌</span>}
          </div>
        </div>
        <div className="flex -space-x-1.5 flex-none">
          {assignees.slice(0, 3).map((m) => (
            <Avatar key={m.user_id} name={m.name} color={m.avatar_color} size={22} />
          ))}
        </div>
      </div>
    );
  }
}

function CalendarView({
  month,
  setMonth,
  day,
  setDay,
  tasks,
  onOpen,
  onComplete,
}: {
  month: string;
  setMonth: (m: string) => void;
  day: string;
  setDay: (d: string) => void;
  tasks: Task[];
  onOpen: (t: Task) => void;
  onComplete: (t: Task) => void;
}) {
  const { members } = useSpace();
  const [y, m] = month.split('-').map(Number);
  const firstOfMonth = new Date(y, m - 1, 1);
  const startDay = (firstOfMonth.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array(startDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!byDay.has(t.start_date)) byDay.set(t.start_date, []);
    byDay.get(t.start_date)!.push(t);
  }

  function shiftMonth(delta: number) {
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const dayTasks = (byDay.get(day) || []).sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-[8px] border border-border grid place-items-center cursor-pointer font-extrabold text-muted">‹</button>
        <div className="text-[13.5px] font-extrabold">{new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
        <button onClick={() => shiftMonth(1)} className="w-8 h-8 rounded-[8px] border border-border grid place-items-center cursor-pointer font-extrabold text-muted">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div key={d} className="text-center text-[10px] font-extrabold text-faint">{d}</div>
        ))}
        {cells.map((d, i) => {
          const count = d ? (byDay.get(d)?.length ?? 0) : 0;
          const isToday = d === todayStr();
          const isSel = d === day;
          return (
            <button
              key={i}
              disabled={!d}
              onClick={() => d && setDay(d)}
              className={`aspect-square rounded-[9px] text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                !d ? 'invisible' : isSel ? 'bg-accent text-white' : isToday ? 'bg-accent-soft text-accent' : 'bg-card border border-border-soft'
              }`}
            >
              <span>{d ? Number(d.slice(-2)) : ''}</span>
              {count > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-accent'}`} />}
            </button>
          );
        })}
      </div>

      <div>
        <div className="text-[11px] font-extrabold text-faint tracking-wide mb-1.5">{longDate(day).toUpperCase()}</div>
        {dayTasks.length === 0 ? (
          <div className="text-[12px] text-faint font-semibold py-4 text-center">Nothing on this day</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {dayTasks.map((t) => {
              const assignees = members.filter((m) => t.assignee_ids.includes(m.user_id));
              return (
                <div key={t.id} onClick={() => onOpen(t)} className="flex items-center gap-2.5 px-3 py-2.5 bg-card border border-card-border rounded-[12px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => (t.status === 'done' ? onOpen(t) : onComplete(t))}
                    className="w-[18px] h-[18px] accent-[#17805a]"
                  />
                  <span className={`flex-1 text-[12.5px] font-bold ${t.status === 'done' ? 'line-through text-faint' : ''}`}>{t.name}</span>
                  <div className="flex -space-x-1.5">
                    {assignees.slice(0, 2).map((m) => (
                      <Avatar key={m.user_id} name={m.name} color={m.avatar_color} size={20} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
