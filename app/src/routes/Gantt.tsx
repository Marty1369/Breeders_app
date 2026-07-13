import { useEffect, useMemo, useRef, useState } from 'react';
import { useSpace } from '../state/SpaceProvider';
import { Button, EmptyState } from '../components/ui';
import { addDays, diffDays, niceDate, todayStr } from '../lib/dates';
import { effectiveDate } from '../lib/scheduling';
import { PlusIcon, RepeatIcon } from '../components/icons';
import TaskDetailSheet from '../components/task/TaskDetailSheet';
import CompleteTaskSheet from '../components/task/CompleteTaskSheet';
import TaskFormSheet from '../components/task/TaskFormSheet';
import RuleFormSheet from '../components/RuleFormSheet';
import type { Task, TaskPhase } from '../lib/types';
import { STAGE_LABEL as PHASE_LABEL, STAGE_COLOR as PHASE_COLOR, STAGE_ORDER as PHASE_ORDER } from '../lib/stages';

const DAY_W = 20;
const ROW_H = 28;
const HEAD_H = 24;
const NAME_W = 0; // names now live on the bars, not in a frozen left column

const LATE_COLOR = '#c0392b';
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

interface Milestone { key: string; label: string; date: string; color: string }

function okMs(key: string, label: string, date: string | null, color: string): Milestone | null {
  return date ? { key, label, date, color } : null;
}

// Single colour encoding (spec §4.3): bar colour = stage colour only. Done and
// late are shown as a ✓ glyph + fade and a red ring, not a colour swap.
function barStyle(t: Task, phase: TaskPhase, today: string): { bg: string; opacity: number; done: boolean; lateDays: number } {
  const done = t.status === 'done';
  const due = t.due_date ?? t.start_date;
  const lateDays = !done && due < today ? diffDays(due, today) : 0;
  return { bg: PHASE_COLOR[phase], opacity: done ? 0.45 : 1, done, lateDays };
}

export default function Gantt({ embedded = false }: { embedded?: boolean }) {
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

  // Milestone rules (spec §4.3): dashed vertical lines from the litter's dates.
  const milestones = useMemo<Milestone[]>(() => {
    if (!litter) return [];
    const w = effectiveDate(litter.dates, 'whelping');
    const items: (Milestone | null)[] = [
      okMs('ovulation', 'Ovulation', effectiveDate(litter.dates, 'ovulation'), '#4a6fa5'),
      okMs('birth', 'Birth', w, '#17805a'),
      okMs('vaccine', 'Vaccine #1', w ? addDays(w, 49) : null, '#b97324'),
      okMs('weaning', 'Weaning', effectiveDate(litter.dates, 'weaning'), '#4a6fa5'),
      okMs('home', 'Home day', effectiveDate(litter.dates, 'handover'), '#17805a'),
    ];
    return items.filter((m): m is Milestone => m != null);
  }, [litter]);

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
    // Center today in the viewport (spec §4.3), not pinned near the left edge.
    const vw = scrollRef.current.clientWidth || 0;
    scrollRef.current.scrollLeft = Math.max(0, NAME_W + nowX - vw / 2);
    scrolledFor.current = activeLitterId ?? null;
  }, [activeLitterId, layout, today]);

  if (!litter) return <div className="p-6"><EmptyState title="No litter selected" /></div>;

  return (
    <div className={embedded ? '' : 'p-4 sm:p-6'}>
      <div className="flex items-start justify-between gap-3 mb-2">
        {!embedded ? (
          <div>
            <div className="text-[22px] font-extrabold">Plan & timeline</div>
            <div className="text-[12px] text-faint font-semibold">{litter.name} · lines show task dependencies</div>
          </div>
        ) : (
          <div className="text-[12px] text-faint font-semibold self-center">Lines show task dependencies · dashed rules are milestones</div>
        )}
        <div className="flex gap-2 flex-none">
          <Button variant="secondary" size="sm" icon={<RepeatIcon size={15} />} onClick={() => setNewRepeatOpen(true)}>Repeat</Button>
          <Button size="sm" icon={<PlusIcon size={15} />} onClick={() => setNewTaskOpen(true)}>New task</Button>
        </div>
      </div>

      {/* Legend: the 4 stage keys only (spec §4.3). Done/late are shown on the bars. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-3 text-[11px] font-bold text-muted">
        {PHASE_ORDER.map((p) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm" style={{ background: PHASE_COLOR[p] }} /> {PHASE_LABEL[p]}
          </span>
        ))}
      </div>

      {!layout ? (
        <EmptyState title="No tasks yet" />
      ) : (
        <GanttChart
          layout={layout}
          litterTasks={litterTasks}
          milestones={milestones}
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
  layout, litterTasks, milestones, today, scrollRef, onOpen,
}: {
  layout: Layout;
  litterTasks: Task[];
  milestones: Milestone[];
  today: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onOpen: (t: Task) => void;
}) {
  const { min, totalDays, entries, height, yByTask, xOf } = layout;
  const chartW = totalDays * DAY_W;
  const nowX = diffDays(min, today) * DAY_W;
  const msX = milestones
    .map((m) => ({ ...m, x: diffDays(min, m.date) * DAY_W }))
    .filter((m) => m.x >= 0 && m.x <= chartW);

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
            {msX.map((m) => (
              <div
                key={m.key}
                className="absolute text-[8.5px] font-extrabold text-white rounded-[4px] px-1 whitespace-nowrap"
                style={{ left: m.x + 2, top: 4, background: m.color }}
              >
                {m.label} · {niceDate(m.date)}
              </div>
            ))}
            {nowX >= 0 && nowX <= chartW && (
              <div className="absolute text-[8.5px] font-extrabold text-white rounded-[4px] px-1 whitespace-nowrap z-10" style={{ left: nowX + 2, top: 4, background: TODAY_LINE }}>TODAY · {niceDate(today)}</div>
            )}
          </div>
        </div>

        <div style={{ position: 'relative', height }}>
          {ticks.map((tk, i) => (
            <div key={i} className="absolute top-0 bottom-0 border-l border-border-soft" style={{ left: NAME_W + tk.x }} />
          ))}
          {/* dashed milestone rules */}
          {msX.map((m) => (
            <div
              key={m.key}
              className="absolute top-0 bottom-0"
              style={{ left: NAME_W + m.x, width: 0, borderLeft: `2px dashed ${m.color}`, opacity: 0.7 }}
            />
          ))}
          {/* today line — solid, distinct from the dashed milestones */}
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

          {/* Phase group labels — pinned to the left over the empty separator rows */}
          {entries.map((e, i) =>
            e.kind === 'phase' ? (
              <div
                key={`p${i}`}
                className="absolute font-extrabold text-[11px] whitespace-nowrap z-[15] px-1 rounded"
                style={{ position: 'sticky', left: 4, top: e.y + 6, width: 'fit-content', color: PHASE_COLOR[e.phase], background: 'var(--color-card)' }}
              >
                {PHASE_LABEL[e.phase]}
              </div>
            ) : null,
          )}

          {/* Bars — each labelled with its task name (inside if it fits, else to the right) */}
          {entries.map((e) => {
            if (e.kind !== 'task') return null;
            const t = e.task!;
            const x = xOf(t.start_date);
            const w = Math.max(DAY_W, (diffDays(t.start_date, t.due_date ?? t.start_date) + 1) * DAY_W);
            const style = barStyle(t, e.phase, today);
            const nameFits = w > t.name.length * 6.2 + 20;
            const late = style.lateDays > 0;
            return (
              <div key={t.id}>
                <button
                  onClick={() => onOpen(t)}
                  className="absolute rounded-[6px] cursor-pointer flex items-center gap-1 px-1.5 overflow-hidden z-[5]"
                  style={{
                    left: x,
                    top: e.y + 4,
                    width: w,
                    height: ROW_H - 8,
                    background: style.bg,
                    opacity: style.opacity,
                    boxShadow: late ? `0 0 0 2px ${LATE_COLOR}` : undefined,
                  }}
                  title={`${t.name} · ${niceDate(t.start_date)}${t.duration_days ? `–${niceDate(t.due_date ?? t.start_date)}` : ''}`}
                >
                  {style.done && <span className="text-white text-[10px] font-extrabold flex-none">✓</span>}
                  {nameFits && (
                    <span className={`text-white text-[10.5px] font-semibold truncate ${style.done ? 'line-through' : ''}`}>{t.name}</span>
                  )}
                </button>
                {!nameFits && (
                  <button
                    onClick={() => onOpen(t)}
                    className={`absolute text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:text-accent text-left ${style.done ? 'line-through text-faint' : ''}`}
                    style={{ left: x + w + 6, top: e.y + 6, color: late ? LATE_COLOR : undefined }}
                  >
                    {t.name}{late ? ` · ${style.lateDays}d late` : ''}
                  </button>
                )}
                {nameFits && late && (
                  <span className="absolute text-[10px] font-extrabold whitespace-nowrap" style={{ left: x + w + 6, top: e.y + 7, color: LATE_COLOR }}>
                    {style.lateDays}d late
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
