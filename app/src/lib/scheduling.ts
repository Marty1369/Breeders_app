import { addDays, addMonths } from './dates';
import { computeSchedule } from './dependencies';
import type { LitterDates, Task, TaskTemplate } from './types';

// ---------------------------------------------------------------------------
// Key-date formulas (verified against the kennel's spreadsheet):
//   ovulation      = heat + 13 d
//   2nd mating     = ovulation + 2 d
//   whelping       = mating + 60 d
//   weaning (8wk)  = whelping + 56 d
//   handover       = whelping + 2 calendar months
//   next heat (Dog)= last heat + 6 months
// Every key date is a {predicted, actual} pair; actual always wins.
// ---------------------------------------------------------------------------

export type AnchorKey = 'heat' | 'ovulation' | 'mating' | 'whelping' | 'handover';
export type DateKey = AnchorKey | 'weaning';

// Offsets verified against the kennel's production spreadsheet ("Vados
// auginimo grafikas"): ovulation = heat+13, whelping = mating+60,
// weaning (8 wk) = birth+56. Handover is "birth + 2 calendar months", so it
// is computed with addMonths (not a fixed day count) — see recompute below.
const OFFSETS: Record<Exclude<DateKey, 'heat' | 'handover'>, { from: DateKey; days: number }> = {
  ovulation: { from: 'heat', days: 13 },
  mating: { from: 'ovulation', days: 2 },
  whelping: { from: 'mating', days: 60 },
  weaning: { from: 'whelping', days: 56 },
};

const CHAIN_ORDER: DateKey[] = ['heat', 'ovulation', 'mating', 'whelping', 'weaning', 'handover'];

/** actual date if set, otherwise the predicted date, otherwise null. */
export function effectiveDate(dates: LitterDates, key: DateKey): string | null {
  const pair = dates[key];
  return pair?.actual ?? pair?.predicted ?? null;
}

/**
 * Recomputes every `predicted` field top-down from whatever `actual` values
 * are already present, per the formula chain. Actual values are preserved
 * as-is. Call this any time an actual date is entered/edited.
 */
export function recomputeLitterDates(dates: LitterDates): LitterDates {
  const out: LitterDates = {};
  for (const key of CHAIN_ORDER) {
    const existing = dates[key];
    if (key === 'heat') {
      out.heat = { predicted: existing?.predicted ?? null, actual: existing?.actual ?? null };
      continue;
    }
    if (key === 'handover') {
      // birth + 2 calendar months
      const whelpEff = effectiveDate(out, 'whelping');
      out.handover = {
        predicted: whelpEff ? addMonths(whelpEff, 2) : null,
        actual: existing?.actual ?? null,
      };
      continue;
    }
    const { from, days } = OFFSETS[key as Exclude<DateKey, 'heat' | 'handover'>];
    const fromEff = effectiveDate(out, from);
    out[key] = {
      predicted: fromEff ? addDays(fromEff, days) : null,
      actual: existing?.actual ?? null,
    };
  }
  return out;
}

export function setActualDate(dates: LitterDates, key: DateKey, value: string | null): LitterDates {
  return recomputeLitterDates({ ...dates, [key]: { ...dates[key], actual: value } });
}

export function nextHeatPredicted(lastHeatStart: string): string {
  return addMonths(lastHeatStart, 6);
}

/** Computes the new start/due dates for tasks affected by a litter-date change. */
export function applyCascade(
  tasks: Task[],
  newDates: LitterDates
): { id: string; start_date: string; due_date: string | null }[] {
  const out: { id: string; start_date: string; due_date: string | null }[] = [];
  for (const t of tasks) {
    // Dependent tasks are re-flowed by the dependency engine, not the anchor cascade.
    if (t.depends_on && t.depends_on.length) continue;
    if (t.is_pinned_date || t.anchor_mode !== 'anchor+offset' || !t.anchor || t.offset_days == null) continue;
    const anchorDate = effectiveDate(newDates, t.anchor);
    if (!anchorDate) continue;
    const start = addDays(anchorDate, t.offset_days);
    const due = addDays(start, t.duration_days || 0);
    if (start !== t.start_date) out.push({ id: t.id, start_date: start, due_date: due });
  }
  return out;
}

/**
 * Expands task templates into concrete task rows for a newly created litter.
 * Templates with a `repeat` block produce one row per occurrence.
 */
type NewTaskRow = Pick<Task,
  'id' | 'space_id' | 'litter_id' | 'template_id' | 'name' | 'phase' | 'start_date' | 'due_date' |
  'status' | 'assignee_ids' | 'is_pinned_date' | 'anchor_mode' | 'anchor' | 'offset_days' |
  'duration_days' | 'depends_on' | 'notes' | 'comments' | 'checklist' | 'cost_expected' | 'result_log'
>;

/**
 * Expands task templates into concrete task rows for a newly created litter.
 * Templates with a `repeat` block produce one row per occurrence. Each row gets
 * a client-generated id up front so template dependencies (referenced by the
 * predecessor's sort_order) can be rewritten into concrete task-id links.
 */
export function tasksFromTemplates(
  templates: TaskTemplate[],
  litter: { id: string; space_id: string },
  dates: LitterDates
): NewTaskRow[] {
  const idFor = () => (crypto?.randomUUID ? crypto.randomUUID() : `t_${Math.random().toString(36).slice(2)}`);
  // First template (non-repeat) per sort_order → its generated id, for dep wiring.
  const idBySortOrder = new Map<number, string>();
  const rows: (NewTaskRow & { _tpl: TaskTemplate })[] = [];

  for (const tpl of templates) {
    const anchorDate = effectiveDate(dates, tpl.anchor);
    if (!anchorDate) continue;
    const occurrences = tpl.repeat?.count ?? 1;
    const every = tpl.repeat?.every ?? 1;
    for (let i = 0; i < occurrences; i++) {
      const offset = tpl.offset_days + i * every;
      const start = addDays(anchorDate, offset);
      const id = idFor();
      if (i === 0) idBySortOrder.set(tpl.sort_order, id);
      rows.push({
        _tpl: tpl,
        id,
        space_id: litter.space_id,
        litter_id: litter.id,
        template_id: tpl.id,
        name: occurrences > 1 ? `${tpl.name} — day ${i + 1}` : tpl.name,
        phase: tpl.phase,
        start_date: start,
        due_date: addDays(start, tpl.duration_days || 0),
        status: 'todo',
        assignee_ids: [],
        is_pinned_date: false,
        anchor_mode: 'anchor+offset',
        anchor: tpl.anchor,
        offset_days: offset,
        duration_days: tpl.duration_days || 0,
        depends_on: [],
        notes: null,
        comments: [],
        checklist: [],
        cost_expected: false,
        result_log: null,
      });
    }
  }

  // Rewrite template deps (predecessor sort_order → concrete task id).
  for (const row of rows) {
    const deps = row._tpl.depends_on ?? [];
    row.depends_on = deps
      .map((d) => {
        const taskId = idBySortOrder.get(d.ref);
        return taskId ? { taskId, type: d.type, lag: d.lag } : null;
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }

  const clean = rows.map(({ _tpl, ...row }) => { void _tpl; return row; });

  // Re-flow dependent tasks off their predecessors so they start correctly on day one.
  const sched = computeSchedule(clean as unknown as Task[]);
  for (const row of clean) {
    const s = sched.get(row.id);
    if (s) {
      row.start_date = s.start_date;
      row.due_date = s.due_date;
    }
  }

  return clean.sort((a, b) => a.start_date.localeCompare(b.start_date));
}

/** Weight-alert rule: flat/near-flat gain over 4 consecutive logged weights. */
export function hasWeightAlert(weighLog: Record<string, { am?: number; pm?: number }>): boolean {
  const flat: number[] = [];
  const days = Object.keys(weighLog).sort();
  for (const d of days) {
    const entry = weighLog[d];
    if (entry.am != null) flat.push(entry.am);
    if (entry.pm != null) flat.push(entry.pm);
  }
  if (flat.length < 4) return false;
  const last4 = flat.slice(-4);
  return last4[3] - last4[0] <= 5;
}
