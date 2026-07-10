import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Avatar, Chip, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { addDays, diffDays, longDate, parseDate, todayStr } from '../lib/dates';
import TaskDetailSheet from '../components/task/TaskDetailSheet';
import CompleteTaskSheet from '../components/task/CompleteTaskSheet';
import TaskFormSheet from '../components/task/TaskFormSheet';
import TaskViewToggle from '../components/TaskViewToggle';
import type { Task, TaskPhase } from '../lib/types';

const PHASES: { value: TaskPhase | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'prewhelp', label: 'Pre-whelp' },
  { value: 't1_birth', label: 'Birth' },
  { value: 't2_wean', label: 'Weaning' },
  { value: 't3_social', label: 'Social' },
];

function weekLabel(startOfWeek: string, today: string) {
  const d = diffDays(today, startOfWeek);
  if (d >= -6 && d <= 0) return 'This week';
  if (d > 0 && d <= 7) return 'Next week';
  if (d < 0 && d >= -13) return 'Last week';
  return longDate(startOfWeek).replace(/^\w+, /, '') + ' week';
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

  const weeks = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of litterTasks) {
      const day = parseDate(t.start_date).getDay();
      const monday = addDays(t.start_date, day === 0 ? -6 : 1 - day);
      if (!map.has(monday)) map.set(monday, []);
      map.get(monday)!.push(t);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, items]) => ({
        weekStart,
        items: items.sort((a, b) => a.start_date.localeCompare(b.start_date)),
      }));
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
          <EmptyState title="No tasks in this phase" />
        ) : (
          <div className="flex flex-col gap-5">
            {weeks.map(({ weekStart, items }) => (
              <div key={weekStart}>
                <div className="text-[10.5px] font-extrabold tracking-wider text-faint mb-1.5">{weekLabel(weekStart, today).toUpperCase()}</div>
                <div className="flex flex-col gap-1.5">
                  {items.map((t) => (
                    <TaskRow key={t.id} task={t} onOpen={() => setDetailTask(t)} onComplete={() => setCompleteTask(t)} />
                  ))}
                </div>
              </div>
            ))}
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
    const overdue = task.status !== 'done' && task.start_date < today;
    const assignees = members.filter((m) => task.assignee_ids.includes(m.user_id));
    return (
      <div
        onClick={onOpen}
        className="flex items-center gap-2.5 px-3 py-2.5 bg-card border border-card-border rounded-[12px] cursor-pointer"
      >
        <input
          type="checkbox"
          checked={task.status === 'done'}
          onClick={(e) => e.stopPropagation()}
          onChange={() => (task.status === 'done' ? onOpen() : onComplete())}
          className="w-[19px] h-[19px] flex-none accent-[#17805a]"
        />
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-bold truncate ${task.status === 'done' ? 'line-through text-faint' : ''}`}>{task.name}</div>
          <div className="text-[10.5px] text-faint font-semibold mt-0.5">
            {longDate(task.start_date)}
            {task.is_pinned_date && ' · 📌 pinned'}
          </div>
        </div>
        {overdue && <Chip tone="danger">Overdue</Chip>}
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
