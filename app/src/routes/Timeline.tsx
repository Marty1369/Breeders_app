import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Avatar, CircleCheckbox, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { diffDays, longDate, niceDate, todayStr } from '../lib/dates';
import { effectiveDate } from '../lib/scheduling';
import { markTaskDone, isLoggable } from '../lib/actions';
import { STAGE_ORDER, STAGE_LABEL, STAGE_SUB, STAGE_COLOR, birthFraming } from '../lib/stages';

// Tasks that record a measurement (progesterone / ultrasound) open the Complete
// sheet; every other task just toggles done (spec §4.2).
import TaskDetailSheet from '../components/task/TaskDetailSheet';
import CompleteTaskSheet from '../components/task/CompleteTaskSheet';
import TaskFormSheet from '../components/task/TaskFormSheet';
import type { Task, TaskPhase } from '../lib/types';

// One taxonomy for every task surface lives in lib/stages.ts. The filter row
// reuses those labels; "All" is prepended here.
const PHASES: { value: TaskPhase | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...STAGE_ORDER.map((p) => ({ value: p, label: STAGE_LABEL[p] })),
];

/** Relative-date chip: Today / in 3 days / 5d overdue / Jul 20. */
function relDate(startDate: string, today: string, done: boolean): { label: string; tone: 'late' | 'soon' | 'muted' } {
  const d = diffDays(today, startDate);
  if (!done && d < 0) return { label: `${-d}d overdue`, tone: 'late' };
  if (d === 0) return { label: 'Today', tone: 'soon' };
  if (d === 1) return { label: 'Tomorrow', tone: 'soon' };
  if (d > 1 && d <= 6) return { label: `in ${d} days`, tone: d <= 3 ? 'soon' : 'muted' };
  return { label: niceDate(startDate), tone: 'muted' };
}

export default function Timeline({ mode = 'both', embedded = false }: { mode?: 'both' | 'list' | 'calendar'; embedded?: boolean }) {
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
  const [undoTask, setUndoTask] = useState<Task | null>(null);

  // Auto-dismiss the Undo snackbar.
  useEffect(() => {
    if (!undoTask) return;
    const id = setTimeout(() => setUndoTask(null), 4500);
    return () => clearTimeout(id);
  }, [undoTask]);

  // Deep link: /plan?task=<id> opens the task's detail sheet (search results,
  // notifications). Consumed once so back/refresh doesn't re-open it.
  const deepLinkId = params.get('task');
  useEffect(() => {
    if (!deepLinkId) return;
    const t = tasks.find((x) => x.id === deepLinkId);
    if (!t) return; // tasks may still be loading — retry on the next data tick
    setDetailTask(t);
    params.delete('task');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, tasks]);

  const toggleCircle = (task: Task) => {
    if (task.status === 'done') { markTaskDone(task, false); return; } // uncheck
    if (isLoggable(task)) { setCompleteTask(task); return; }           // record a result
    markTaskDone(task, true);                                          // instant complete
    setUndoTask(task);
  };

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
    <div className={embedded ? '' : 'p-4 sm:p-6 max-w-3xl mx-auto'}>
      {!embedded && <PageHeader title={title} subtitle={litter.name} />}

      <div className="flex flex-col gap-3 mb-4">
        {mode === 'both' && (
          <SegmentedControl value={view} onChange={setView} options={[{ value: 'list', label: 'List' }, { value: 'calendar', label: 'Calendar' }]} />
        )}
        {/* Stages live once, as group headers — no redundant phase-filter pills
            in the Plan tab (spec §4.1). Keep them only on the standalone screen. */}
        {embedded ? (
          <div className="flex">
            <button
              onClick={() => setFormOpen(true)}
              className="ml-auto px-3 py-1.5 rounded-full text-[12px] font-extrabold cursor-pointer bg-accent-soft text-accent whitespace-nowrap"
            >
              ＋ New task
            </button>
          </div>
        ) : (
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
        )}
      </div>

      {effectiveView === 'list' ? (
        litterTasks.length === 0 ? (
          <EmptyState title="No tasks in this stage" />
        ) : (
          <div className="flex flex-col gap-6">
            {stageGroups.map(({ phase, items, done }) => {
              const color = STAGE_COLOR[phase];
              const pct = Math.round((done / items.length) * 100);
              return (
                <div key={phase}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="w-3 h-3 rounded-full flex-none" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[15px] font-extrabold" style={{ color }}>{STAGE_LABEL[phase]}</span>
                        <span className="text-[12px] text-faint font-semibold truncate">{STAGE_SUB[phase]}</span>
                      </div>
                      <div className="mt-1 h-[4px] rounded-full bg-chip-bg overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                    <span className="text-[12px] font-extrabold text-faint tabular-nums flex-none">{done}/{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {items.map((t) => (
                      <TaskRow key={t.id} task={t} onOpen={() => setDetailTask(t)} />
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

      {undoTask && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[#191c1a] text-white rounded-full pl-4 pr-2 py-2 shadow-lg" role="status">
          <span className="text-[13px] font-bold truncate max-w-[200px]">{undoTask.name} — done</span>
          <button
            onClick={() => { markTaskDone(undoTask, false); setUndoTask(null); }}
            className="text-[13px] font-extrabold text-[#7fd4ae] px-3 py-1 rounded-full hover:bg-white/10 cursor-pointer"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );

  function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
    const done = task.status === 'done';
    const assignees = members.filter((m) => task.assignee_ids.includes(m.user_id));
    const rel = relDate(task.start_date, today, done);
    const framing = birthFraming(task.start_date, whelping);
    const stripe = done ? '#c9cec8' : rel.tone === 'late' ? '#c0392b' : rel.tone === 'soon' ? '#d1852a' : STAGE_COLOR[task.phase];
    const relColor = rel.tone === 'late' ? 'text-danger' : rel.tone === 'soon' ? 'text-[#b7791b]' : 'text-faint';
    return (
      <div
        className="flex items-center gap-3 pl-3 pr-3 py-3 min-h-[56px] bg-card border border-card-border rounded-[14px] hover:border-border-strong transition-colors"
        style={{ boxShadow: 'inset 3px 0 0 0 ' + stripe }}
      >
        <CircleCheckbox
          checked={done}
          size={30}
          onClick={() => toggleCircle(task)}
          aria-label={done ? `Reopen ${task.name}` : `Complete ${task.name}`}
        />
        <button onClick={onOpen} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className={`text-[15px] font-bold truncate ${done ? 'line-through text-faint' : ''}`}>{task.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[12px] font-semibold flex-wrap">
            <span className={relColor}>{rel.label}</span>
            {framing && <><span className="text-border-strong">·</span><span className="text-faint">{framing}</span></>}
            {task.is_pinned_date && <span className="text-faint">· pinned</span>}
          </div>
        </button>
        <div className="flex -space-x-1.5 flex-none" aria-hidden="true">
          {assignees.slice(0, 3).map((m) => (
            <Avatar key={m.user_id} name={m.name} color={m.avatar_color} size={24} />
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
