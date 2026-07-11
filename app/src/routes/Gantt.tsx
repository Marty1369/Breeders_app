import { useEffect, useMemo, useRef, useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { Button, EmptyState } from '../components/ui';
import { addDays, diffDays, niceDate, todayStr } from '../lib/dates';
import TaskDetailSheet from '../components/task/TaskDetailSheet';
import CompleteTaskSheet from '../components/task/CompleteTaskSheet';
import TaskFormSheet from '../components/task/TaskFormSheet';
import RuleFormSheet from '../components/RuleFormSheet';
import TaskViewToggle from '../components/TaskViewToggle';
import type { Task, TaskPhase } from '../lib/types';

const DAY_W = 20;
const ROW_H = 28;
const HEAD_H = 24;
const NAME_W = 172;

const PHASE_LABEL: Record<TaskPhase, string> = {
  prewhelp: 'Pre-whelp', t1_birth: 'Birth (T1)', t2_wean: 'Weaning (T2)', t3_social: 'Socialization (T3)',
};
const PHASE_COLOR: Record<TaskPhase, string> = {
  prewhelp: '#8a938e', t1_birth: '#17805a', t2_wean: '#4a6fa5', t3_social: '#b97324',
};
const PHASE_ORDER: TaskPhase[] = ['prewhelp', 't1_birth', 't2_wean', 't3_social'];

const DONE_COLOR = '#c9cec8';
const LATE_COLOR = '#c0392b';
const SOON_COLOR = '#d1852a';
const TODAY_LINE = '#334155';

interface Entry {
  kind: 'phase' | 'task';
  y: number;
  task?: Task;
  phase: TaskPhase;
}

interface Layout {
  min: string;
  max: string;
  totalDays: number;
  entries: Entry[];
  height: number;
  yByTask: Map<string, number>;
  xOf: (d: string) => number;
}

/** Status treatment for a task's bar: done greyed, overdue red, due-soon orange, else phase colour. */
function barStyle(t: Task, phase: TaskPhase, today: string): { bg: string; opacity: number } {
  if (t.status === 'done') return { bg: DONE_COLOR, opacity: 0.75 };
  const due = t.due_date ?? t.start_date;
  if (due < today) return { bg: LATE_COLOR, opacity: 1 };
  // Due soon = the DUE date is within 3 days (not the start — a long task that
  // began last week but is due next month is not "due soon").
  if (due >= today && due <= addDays(today, 3)) return { bg: SOON_COLOR, opacity: 1 };
  return { bg: PHASE_COLOR[phase], opacity: 1 };
}

export default function Gantt() {
  const { litters, tasks, activeLitterId } = useSpace();
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [completeTask, setCompleteTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newRepeatOpen, setNewRepeatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);
  const onOpen = (t: Task) => setDetailTask(t);
  const litter = litters.find((l) => l.id === activeLitterId);
  const today = todayStr();
  const litterTasks = useMemo(
    () => tasks.filter((t) => t.litter_id === activeLitterId),
    [tasks, activeLitterId]
  );

  const layout = useMemo(() => {
    if (litterTasks.length === 0) return null;
    const starts = litterTasks.map((t) => t.start_date);
    const dues = litterTasks.map((t) => t.due_date ?? t.start_date);
    const min = addDays(starts.reduce((a, b) => (a < b ? a : b)), -2);
    const max = addDays(dues.reduce((a, b) => (a > b ? a : b)), 2);
    const totalDays = diffDays(min, max) + 1;

    const entries: Entry[] = [];
    let y = 0;
    for (const phase of PHASE_ORDER) {
      const inPhase = litterTasks
        .filter((t) => t.phase === phase)
        .sort((a, b) => a.start_date.localeCompare(b.start_date));
      if (!inPhase.length) continue;
      entries.push({ kind: 'phase', y, phase });
      y += HEAD_H;
      for (const t of inPhase) {
        entries.push({ kind: 'task', y, task: t, phase });
        y += ROW_H;
      }
    }
    const yByTask = new Map<string, number>();
    for (const e of entries) if (e.kind === 'task' && e.task) yByTask.set(e.task.id, e.y);

    const xOf = (date: string) => diffDays(min, date) * DAY_W;
    return { min, max, totalDays, entries, height: y, yByTask, xOf };
  }, [litterTasks]);

  // Scroll to today once per litter (not on every realtime-driven layout rebuild,
  // which would yank the user's scroll position back).
  useEffect(() => {
    if (!scrollRef.current || !layout) return;
    if (scrolledFor.current === activeLitterId) return;
    const nowX = diffDays(layout.min, today) * DAY_W;
    scrollRef.current.scrollLeft = Math.max(0, NAME_W + nowX - 140);
    scrolledFor.current = activeLitterId ?? null;
  }, [activeLitterId, layout, today]);

  if (!litter) return <div className="p-6"><EmptyState title="No litter selected" /></div>;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-0.5">
        <div>
          <div className="text-[19px] font-extrabold">Gantt</div>
          <div className="text-[11.5px] text-faint font-semibold">{litter.name} · lines show task dependencies</div>
        </div>
        <div className="flex gap-2 flex-none">
          <Button variant="secondary" size="sm" icon="⟳" onClick={() => setNewRepeatOpen(true)}>Repeat</Button>
          <Button size="sm" icon="＋" onClick={() => setNewTaskOpen(true)}>New task</Button>
        </div>
      </div>
      <div className="my-3"><TaskViewToggle current="gantt" /></div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-3 text-[10.5px] font-bold text-muted">
        {PHASE_ORDER.map((p) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm" style={{ background: PHASE_COLOR[p] }} /> {PHASE_LABEL[p]}
          </span>
        ))}
        <span className="w-px h-3 bg-border-strong mx-1" />
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ background: SOON_COLOR }} /> Due soon</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ background: LATE_COLOR }} /> Late</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ background: DONE_COLOR }} /> Done</span>
      </div>

      {!layout ? (
        <EmptyState title="No tasks yet" />
      ) : (
        <GanttChart
          layout={layout}
          litterTasks={litterTasks}
          today={today}
          scrollRef={scrollRef}
          onOpen={onOpen}
        />
      )}

      <TaskDetailSheet
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onEdit={() => { setEditTask(detailTask); setDetailTask(null); }}
        onComplete={() => { setCompleteTask(detailTask); setDetailTask(null); }}
      />
      <CompleteTaskSheet task={completeTask} onClose={() => setCompleteTask(null)} />
      <TaskFormSheet open={!!editTask} task={editTask} litterId={activeLitterId} onClose={() => setEditTask(null)} />
      <TaskFormSheet open={newTaskOpen} task={null} litterId={activeLitterId} onClose={() => setNewTaskOpen(false)} />
      <RuleFormSheet open={newRepeatOpen} rule={null} onClose={() => setNewRepeatOpen(false)} />
    </div>
  );
}

function GanttChart({
  layout, litterTasks, today, scrollRef, onOpen,
}: {
  layout: Layout;
  litterTasks: Task[];
  today: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onOpen: (t: Task) => void;
}) {
  const { min, totalDays, entries, height, yByTask, xOf } = layout;
  const chartW = totalDays * DAY_W;
  const nowX = diffDays(min, today) * DAY_W;

  const ticks: { x: number; label: string }[] = [];
  for (let i = 0; i < totalDays; i += 7) ticks.push({ x: i * DAY_W, label: niceDate(addDays(min, i)) });

  // dependency connectors: end of predecessor bar → front of dependent bar
  const links: { d: string }[] = [];
  for (const t of litterTasks) {
    const depY = yByTask.get(t.id);
    if (depY == null) continue;
    for (const dep of t.depends_on ?? []) {
      const predY = yByTask.get(dep.taskId);
      const pred = litterTasks.find((p) => p.id === dep.taskId);
      if (predY == null || !pred) continue;
      const px = dep.type === 'FS' ? xOf(pred.due_date ?? pred.start_date) + DAY_W : xOf(pred.start_date);
      const py = predY + ROW_H / 2;
      const dx = xOf(t.start_date);
      const dy = depY + ROW_H / 2;
      const midX = Math.max(px + 8, dx - 10);
      links.push({ d: `M ${px} ${py} L ${midX} ${py} L ${midX} ${dy} L ${dx} ${dy}` });
    }
  }

  return (
    <div ref={scrollRef} className="border border-card-border rounded-[12px] bg-card overflow-auto" style={{ maxHeight: '72vh' }}>
      <div style={{ width: NAME_W + chartW, position: 'relative' }}>
        {/* date header */}
        <div className="sticky top-0 z-20 bg-card border-b border-border-soft" style={{ height: HEAD_H }}>
          <div style={{ position: 'absolute', left: NAME_W, top: 0, width: chartW, height: HEAD_H }}>
            {ticks.map((tk, i) => (
              <div key={i} className="absolute text-[9px] font-bold text-faint" style={{ left: tk.x + 2, top: 6 }}>{tk.label}</div>
            ))}
            {nowX >= 0 && nowX <= chartW && (
              <div className="absolute text-[8.5px] font-extrabold text-white rounded-[3px] px-1" style={{ left: nowX, top: 4, background: TODAY_LINE }}>TODAY</div>
            )}
          </div>
        </div>

        <div style={{ position: 'relative', height }}>
          {ticks.map((tk, i) => (
            <div key={i} className="absolute top-0 bottom-0 border-l border-border-soft" style={{ left: NAME_W + tk.x }} />
          ))}
          {/* today line */}
          {nowX >= 0 && nowX <= chartW && (
            <div className="absolute top-0 bottom-0 z-10" style={{ left: NAME_W + nowX, width: 2, background: TODAY_LINE }} />
          )}

          {/* dependency connectors */}
          <svg className="absolute top-0 pointer-events-none z-10" style={{ left: NAME_W, width: chartW, height }}>
            <defs>
              <marker id="garrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#6b7580" />
              </marker>
            </defs>
            {links.map((l, i) => (
              <path key={i} d={l.d} fill="none" stroke="#6b7580" strokeWidth={1.3} markerEnd="url(#garrow)" opacity={0.75} />
            ))}
          </svg>

          {/* rows */}
          {entries.map((e, i) => {
            if (e.kind === 'phase') {
              return (
                <div key={`p${i}`} className="absolute font-extrabold text-[10px] tracking-wide" style={{ left: 8, top: e.y + 6, color: PHASE_COLOR[e.phase] }}>
                  {PHASE_LABEL[e.phase].toUpperCase()}
                </div>
              );
            }
            const t = e.task!;
            const x = xOf(t.start_date);
            const w = Math.max(DAY_W, (diffDays(t.start_date, t.due_date ?? t.start_date) + 1) * DAY_W);
            const style = barStyle(t, e.phase, today);
            const done = t.status === 'done';
            return (
              <div key={t.id}>
                <button
                  className={`absolute text-[11px] font-semibold truncate cursor-pointer hover:text-accent text-left ${done ? 'text-faint line-through' : ''}`}
                  style={{ left: 8, top: e.y + 7, width: NAME_W - 14 }}
                  onClick={() => onOpen(t)}
                  title={t.name}
                >
                  {t.name}
                </button>
                <button
                  onClick={() => onOpen(t)}
                  className="absolute rounded-[5px] cursor-pointer flex items-center px-1.5 overflow-hidden"
                  style={{ left: NAME_W + x, top: e.y + 5, width: w, height: ROW_H - 10, background: style.bg, opacity: style.opacity }}
                  title={`${t.name} · ${niceDate(t.start_date)}${t.duration_days ? `–${niceDate(t.due_date ?? t.start_date)}` : ''}`}
                >
                  {w > 40 && <span className="text-white text-[9px] font-bold truncate">{niceDate(t.start_date)}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
