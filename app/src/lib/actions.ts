// Shared write operations that touch more than one table, so the cascade /
// notification rules only live in one place.

import { supabase } from './supabase';
import { applyCascade, recomputeLitterDates, setActualDate } from './scheduling';
import { scheduleUpdates } from './dependencies';
import { reanchorRules } from './recurrence';
import { fmt, todayStr } from './dates';
import type { DateKey } from './scheduling';
import type { BirthEvent, Litter, NotificationKind, Puppy, RecurrenceRule, SpaceMember, Task } from './types';

/** Set/clear the completion state of a single recurring-rule occurrence. */
export async function setOccurrence(
  spaceId: string,
  ruleId: string,
  occDate: string,
  occTime: string,
  status: 'done' | 'skip' | null,
  userId?: string
) {
  if (status === null) {
    await supabase.from('rule_checks').delete().eq('rule_id', ruleId).eq('occ_date', occDate).eq('occ_time', occTime);
    return;
  }
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  await supabase.from('rule_checks').upsert(
    {
      space_id: spaceId,
      rule_id: ruleId,
      occ_date: occDate,
      occ_time: occTime,
      status,
      done_by: status === 'done' ? userId ?? null : null,
      done_at: status === 'done' ? hhmm : null,
    },
    { onConflict: 'rule_id,occ_date,occ_time' }
  );
}

export async function notifyMembers(
  spaceId: string,
  members: SpaceMember[],
  kind: NotificationKind,
  title: string,
  body?: string,
  refId?: string,
  excludeUserId?: string
) {
  const rows = members
    .filter((m) => m.user_id !== excludeUserId)
    .map((m) => ({ space_id: spaceId, user_id: m.user_id, kind, title, body: body ?? null, ref_id: refId ?? null }));
  if (!rows.length) return;
  await supabase.from('notifications').insert(rows);
}

/**
 * Pure: exactly the task shifts applyDateChange would write — the anchor
 * cascade plus the dependency re-flow on top of it. Used by both the preview
 * and the write so "N dates will shift" never overstates (CASC-10).
 */
export function computeDateShifts(litterTasks: Task[], newDates: Litter['dates']) {
  const shifts = applyCascade(litterTasks, newDates);
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const updated = litterTasks.map((t) => {
    const s = shiftMap.get(t.id);
    return s ? { ...t, start_date: s.start_date, due_date: s.due_date } : t;
  });
  const depUpdates = scheduleUpdates(updated);
  const merged = new Map<string, { id: string; start_date: string; due_date: string | null }>();
  for (const s of shifts) merged.set(s.id, s);
  for (const s of depUpdates) merged.set(s.id, s);
  return [...merged.values()];
}

/** Preview how many tasks would shift if `key` were set to `value` (before writing anything). */
export function previewDateChange(litter: Litter, tasks: Task[], key: DateKey, value: string | null) {
  const newDates = setActualDate(litter.dates, key, value);
  const litterTasks = tasks.filter((t) => t.litter_id === litter.id);
  return { newDates, changed: computeDateShifts(litterTasks, newDates) };
}

/** Writes the new litter dates and cascades every affected non-pinned task. */
export async function applyDateChange(
  litter: Litter,
  tasks: Task[],
  members: SpaceMember[],
  newDatesInput: ReturnType<typeof recomputeLitterDates>,
  actorUserId?: string,
  rules: RecurrenceRule[] = []
) {
  const litterTasks = tasks.filter((t) => t.litter_id === litter.id);
  // Anchor cascade + dependency re-flow, same computation the preview showed.
  const all = computeDateShifts(litterTasks, newDatesInput);

  // Re-anchor the litter's recurrence rules (weigh/box-temp/clean/socialization)
  // to the new dates so the daily-care schedule follows the real whelping date.
  const ruleShifts = reanchorRules(rules, litter.id, newDatesInput);

  const { error: litErr } = await supabase.from('litters').update({ dates: newDatesInput }).eq('id', litter.id);
  if (litErr) throw litErr; // don't cascade tasks off dates that didn't persist
  await Promise.all(
    all.map((s) => supabase.from('tasks').update({ start_date: s.start_date, due_date: s.due_date }).eq('id', s.id))
  );
  await Promise.all(
    ruleShifts.map((r) => supabase.from('recurrence_rules').update({ start_date: r.start_date, end_date: r.end_date }).eq('id', r.id))
  );

  if (all.length) {
    await notifyMembers(
      litter.space_id,
      members,
      'plan_shift',
      `${litter.name}: ${all.length} date${all.length === 1 ? '' : 's'} re-shifted`,
      undefined,
      litter.id,
      actorUserId
    );
  }
  return all;
}

/** Ultrasound negative / did-not-take: cancel open tasks, keep expenses & history, log heat, predict next heat. */
export async function endPlan(litter: Litter, tasks: Task[], members: SpaceMember[], actorUserId?: string) {
  const openTasks = tasks.filter((t) => t.litter_id === litter.id && t.status !== 'done');
  await Promise.all(openTasks.map((t) => supabase.from('tasks').update({ status: 'done', notes: (t.notes ? t.notes + '\n' : '') + '(cancelled — litter ended)' }).eq('id', t.id)));
  await supabase.from('litters').update({ status: 'did_not_take' }).eq('id', litter.id);
  await notifyMembers(litter.space_id, members, 'litter_cancelled', `${litter.name} ended — did not take`, undefined, litter.id, actorUserId);
}

export async function markTaskDone(task: Task, done: boolean) {
  await supabase.from('tasks').update({ status: done ? 'done' : 'todo' }).eq('id', task.id);
}

// Tasks whose completion must record a result (progesterone/ultrasound) because
// it can re-anchor litter dates or flip status — never complete these with a
// plain check-off; route them through CompleteTaskSheet.
export const isLoggable = (t: Task) => /progesterone|ultrasound/i.test(t.name);

export async function completeTaskWithResult(
  task: Task,
  resultLog: Task['result_log'],
  litter: Litter | undefined,
  tasks: Task[],
  members: SpaceMember[],
  actorUserId?: string,
  rules: RecurrenceRule[] = []
) {
  const { error: taskErr } = await supabase.from('tasks').update({ status: 'done', result_log: resultLog }).eq('id', task.id);
  if (taskErr) throw taskErr; // the caller keeps its sheet open and shows this

  if (!litter) return { confirmedOvulation: false };

  // Positive ultrasound moves the litter into the pregnant state (was never written).
  if (resultLog?.type === 'ultrasound' && resultLog.value === 'pregnant' && litter.status === 'planned') {
    await supabase.from('litters').update({ status: 'pregnant' }).eq('id', litter.id);
  }

  if (resultLog?.type === 'progesterone') {
    // Normalise to nmol/L (1 ng/mL ≈ 3.18 nmol/L) for the ovulation threshold.
    const nmol = resultLog.unit === 'ng/ml' ? Number(resultLog.value) * 3.18 : Number(resultLog.value);
    if (nmol >= 18) {
      // Anchor ovulation to the actual TEST date the user entered, not the task's
      // scheduled date (an off-schedule test would otherwise misdate the litter).
      const ovulationActual = resultLog.date || task.start_date;
      const newDates = recomputeLitterDates({ ...litter.dates, ovulation: { predicted: litter.dates.ovulation?.predicted ?? null, actual: ovulationActual } });
      await applyDateChange(litter, tasks, members, newDates, actorUserId, rules);
      return { confirmedOvulation: true };
    }
  }
  return { confirmedOvulation: false };
}

/**
 * Whelping birth log (writes to whelping_sessions + birth_events, migration 0008/0010).
 *
 * startWhelping opens the session but does NOT flip the litter to `born` (that
 * used to happen before a single puppy existed). logBirth atomically creates
 * the puppy + birth event via the RPC. finishWhelping closes the session, sets
 * the actual birth date from the first live birth, and cascades.
 */
export async function startWhelping(litter: Litter, members: SpaceMember[], actorUserId?: string) {
  // One session per litter (unique on litter_id); ignore if it already exists.
  await supabase
    .from('whelping_sessions')
    .upsert({ space_id: litter.space_id, litter_id: litter.id, started_at: new Date().toISOString() }, { onConflict: 'litter_id', ignoreDuplicates: true });
  await notifyMembers(litter.space_id, members, 'whelping_started', `${litter.name}: whelping started`, undefined, litter.id, actorUserId);
}

/** Atomically create the puppy (for a live birth) + birth event. Returns the new birth_event id. */
export async function logBirth(litter: Litter, type: 'born' | 'stillborn'): Promise<string | null> {
  const { data, error } = await supabase.rpc('log_birth', {
    p_litter_id: litter.id,
    p_type: type,
    p_born_at: new Date().toISOString(),
  });
  if (error) {
    console.error('log_birth', error);
    return null;
  }
  return (data as string) ?? null;
}

/** Save one birth event's details and mirror the fields the rest of the app reads off the puppy row. */
export async function saveBirthDetails(event: BirthEvent, patch: Partial<BirthEvent>) {
  await supabase.from('birth_events').update(patch).eq('id', event.id);
  if (event.puppy_id) {
    const puppyPatch: Partial<Puppy> = {};
    if ('sex' in patch) puppyPatch.sex = patch.sex ?? null;
    if ('color' in patch) puppyPatch.color = patch.color ?? null;
    if ('collar_color' in patch) puppyPatch.collar_color = patch.collar_color ?? null;
    if ('markings' in patch) puppyPatch.markings = patch.markings ?? null;
    if ('weight_g' in patch) puppyPatch.birth_weight = patch.weight_g ?? null;
    if (Object.keys(puppyPatch).length) {
      await supabase.from('puppies').update(puppyPatch).eq('id', event.puppy_id);
    }
  }
}

export async function finishWhelping(
  litter: Litter,
  tasks: Task[],
  members: SpaceMember[],
  birthEvents: BirthEvent[],
  actorUserId?: string,
  rules: RecurrenceRule[] = []
) {
  // Read birth_events fresh — a just-tapped birth may not have arrived via
  // realtime yet, and relying on the stale client cache would misdate whelping.
  const { data: freshEvents } = await supabase
    .from('birth_events')
    .select('type, born_at')
    .eq('litter_id', litter.id);
  const events = freshEvents && freshEvents.length
    ? freshEvents
    : birthEvents.filter((e) => e.litter_id === litter.id);
  // Earliest delivery of ANY type (an all-stillborn litter still has a birth date).
  const withTime = events.filter((e) => e.born_at).sort((a, b) => (a.born_at! < b.born_at! ? -1 : 1));
  // LOCAL calendar date (not a UTC slice, which could roll an overnight birth to the wrong day).
  const birthDate = withTime[0]?.born_at ? fmt(new Date(withTime[0].born_at!)) : todayStr();

  await supabase.from('whelping_sessions').update({ ended_at: new Date().toISOString() }).eq('litter_id', litter.id);
  if (litter.status !== 'born') {
    await supabase.from('litters').update({ status: 'born' }).eq('id', litter.id);
  }

  const newDates = setActualDate(litter.dates, 'whelping', birthDate);
  await applyDateChange(litter, tasks, members, newDates, actorUserId, rules);
}
