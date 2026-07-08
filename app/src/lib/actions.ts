// Shared write operations that touch more than one table, so the cascade /
// notification rules only live in one place.

import { supabase } from './supabase';
import { applyCascade, cascadePreview, recomputeLitterDates, setActualDate } from './scheduling';
import { scheduleUpdates } from './dependencies';
import { todayStr } from './dates';
import type { DateKey } from './scheduling';
import type { Litter, NotificationKind, SpaceMember, Task } from './types';

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

/** Preview how many tasks would shift if `key` were set to `value` (before writing anything). */
export function previewDateChange(litter: Litter, tasks: Task[], key: DateKey, value: string | null) {
  const newDates = setActualDate(litter.dates, key, value);
  const litterTasks = tasks.filter((t) => t.litter_id === litter.id);
  return { newDates, changed: cascadePreview(litterTasks, litter.dates, newDates) };
}

/** Writes the new litter dates and cascades every affected non-pinned task. */
export async function applyDateChange(
  litter: Litter,
  tasks: Task[],
  members: SpaceMember[],
  newDatesInput: ReturnType<typeof recomputeLitterDates>,
  actorUserId?: string
) {
  const litterTasks = tasks.filter((t) => t.litter_id === litter.id);
  const shifts = applyCascade(litterTasks, newDatesInput);

  // Apply anchor shifts to an in-memory copy, then re-flow task-to-task
  // dependencies topologically on top of the new anchor dates.
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const updated = litterTasks.map((t) => {
    const s = shiftMap.get(t.id);
    return s ? { ...t, start_date: s.start_date, due_date: s.due_date } : t;
  });
  const depUpdates = scheduleUpdates(updated);

  const merged = new Map<string, { id: string; start_date: string; due_date: string | null }>();
  for (const s of shifts) merged.set(s.id, s);
  for (const s of depUpdates) merged.set(s.id, s);
  const all = [...merged.values()];

  await supabase.from('litters').update({ dates: newDatesInput }).eq('id', litter.id);
  await Promise.all(
    all.map((s) => supabase.from('tasks').update({ start_date: s.start_date, due_date: s.due_date }).eq('id', s.id))
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

export async function completeTaskWithResult(
  task: Task,
  resultLog: Task['result_log'],
  litter: Litter | undefined,
  tasks: Task[],
  members: SpaceMember[],
  actorUserId?: string
) {
  await supabase.from('tasks').update({ status: 'done', result_log: resultLog }).eq('id', task.id);

  if (!litter) return { confirmedOvulation: false };

  if (resultLog?.type === 'progesterone' && Number(resultLog.value) >= 18) {
    const newDates = recomputeLitterDates({ ...litter.dates, ovulation: { predicted: litter.dates.ovulation?.predicted ?? null, actual: task.start_date } });
    await applyDateChange(litter, tasks, members, newDates, actorUserId);
    return { confirmedOvulation: true };
  }
  return { confirmedOvulation: false };
}

/** Whelping birth log: opening it fires whelping_started; finishing sets actual birth date + cascade. */
export async function startWhelping(litter: Litter, members: SpaceMember[], actorUserId?: string) {
  if (litter.status !== 'born') {
    await supabase.from('litters').update({ status: 'born' }).eq('id', litter.id);
  }
  await notifyMembers(litter.space_id, members, 'whelping_started', `${litter.name}: whelping started`, undefined, litter.id, actorUserId);
}

export async function finishWhelping(litter: Litter, tasks: Task[], members: SpaceMember[], actorUserId?: string) {
  const birthDate = litter.whelping_log.find((e) => e.type === 'born')?.ts.slice(0, 10) ?? todayStr();
  const newDates = setActualDate(litter.dates, 'whelping', birthDate);
  await applyDateChange(litter, tasks, members, newDates, actorUserId);
}
