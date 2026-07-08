import { addDays } from './dates';
import type { Task } from './types';

export interface SchedRow {
  start_date: string;
  due_date: string;
}

/**
 * Resolves start/due for a set of tasks honoring task-to-task dependencies.
 * A task with no `depends_on` keeps its anchor-derived `start_date` (a fixed
 * point). A dependent task re-flows to the latest of its predecessors:
 *   FS → predecessor.due + lag,  SS → predecessor.start + lag.
 * due = start + duration_days. Cycles fall back to the stored date.
 */
export function computeSchedule(tasks: Task[]): Map<string, SchedRow> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const result = new Map<string, SchedRow>();
  const visiting = new Set<string>();

  function resolve(t: Task): SchedRow {
    const cached = result.get(t.id);
    if (cached) return cached;
    if (visiting.has(t.id)) {
      // dependency cycle — break it by trusting the stored date
      const r = { start_date: t.start_date, due_date: t.due_date ?? addDays(t.start_date, t.duration_days || 0) };
      result.set(t.id, r);
      return r;
    }
    visiting.add(t.id);

    let start = t.start_date;
    if (t.depends_on && t.depends_on.length) {
      let latest: string | null = null;
      for (const dep of t.depends_on) {
        const pred = byId.get(dep.taskId);
        if (!pred) continue;
        const pr = resolve(pred);
        const base = dep.type === 'FS' ? pr.due_date : pr.start_date;
        const cand = addDays(base, dep.lag);
        if (!latest || cand > latest) latest = cand;
      }
      if (latest) start = latest;
    }
    const r = { start_date: start, due_date: addDays(start, t.duration_days || 0) };
    result.set(t.id, r);
    visiting.delete(t.id);
    return r;
  }

  for (const t of tasks) resolve(t);
  return result;
}

/** Diff of tasks whose dates change once dependencies are resolved. */
export function scheduleUpdates(tasks: Task[]): { id: string; start_date: string; due_date: string }[] {
  const sched = computeSchedule(tasks);
  const out: { id: string; start_date: string; due_date: string }[] = [];
  for (const t of tasks) {
    const s = sched.get(t.id);
    if (!s) continue;
    if (s.start_date !== t.start_date || s.due_date !== (t.due_date ?? '')) {
      out.push({ id: t.id, start_date: s.start_date, due_date: s.due_date });
    }
  }
  return out;
}

/** Tasks that (directly or transitively) depend on the given task. */
export function dependentsOf(tasks: Task[], taskId: string): Task[] {
  const out: Task[] = [];
  const seen = new Set<string>();
  let frontier = [taskId];
  while (frontier.length) {
    const next: string[] = [];
    for (const t of tasks) {
      if (seen.has(t.id)) continue;
      if (t.depends_on?.some((d) => frontier.includes(d.taskId))) {
        out.push(t);
        seen.add(t.id);
        next.push(t.id);
      }
    }
    frontier = next;
  }
  return out;
}
