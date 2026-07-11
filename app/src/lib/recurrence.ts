import { addDays, diffDays } from './dates';
import { effectiveDate } from './scheduling';
import type { LitterDates, RecurrenceRule, RuleCheck } from './types';

// ---------------------------------------------------------------------------
// Recurrence engine — ports the design prototype's rules/checks occurrence
// model. A rule fires on `times[]` slots for every date its frequency matches
// between start and its end condition. Each fired slot is one "occurrence";
// completion/skip is tracked per occurrence in rule_checks.
// ---------------------------------------------------------------------------

/** Step size in days between firing dates, per frequency. */
export function ruleStep(rule: Pick<RecurrenceRule, 'freq' | 'interval'>): number {
  if (rule.freq === 'daily') return rule.interval || 1;
  if (rule.freq === 'weekly') return 7 * (rule.interval || 1);
  return rule.interval || 14; // everyN
}

/** Does the rule fire on the date that is `dayDiff` days after its start? */
export function ruleMatches(rule: Pick<RecurrenceRule, 'freq' | 'interval'>, dayDiff: number): boolean {
  if (dayDiff < 0) return false;
  return dayDiff % ruleStep(rule) === 0;
}

/** The rule's last active date, or null if it never ends. */
export function ruleEndDate(rule: RecurrenceRule, litterDates: LitterDates | null): string | null {
  if (rule.end_type === 'keydate') {
    if (!litterDates || !rule.end_key) return null;
    return effectiveDate(litterDates, rule.end_key as Parameters<typeof effectiveDate>[1]);
  }
  if (rule.end_type === 'date') return rule.end_date;
  if (rule.end_type === 'count') {
    let count = 0;
    const per = rule.times.length || 1;
    for (let i = 0; i < 1000; i++) {
      if (ruleMatches(rule, i)) {
        count += per;
        if (count >= (rule.end_count || 1)) return addDays(rule.start_date, i);
      }
    }
    return null;
  }
  return null; // never
}

type KeyDate = Parameters<typeof effectiveDate>[1];

/**
 * Recompute start/end for a litter's anchored recurrence rules against new litter
 * dates, so the daily-care schedule re-flows when whelping (etc.) moves. Returns
 * only the rules whose dates actually changed.
 */
export function reanchorRules(
  rules: RecurrenceRule[],
  litterId: string,
  newDates: LitterDates
): Array<{ id: string; start_date: string; end_date: string | null }> {
  const out: Array<{ id: string; start_date: string; end_date: string | null }> = [];
  for (const r of rules) {
    if (r.litter_id !== litterId || !r.start_anchor) continue;
    const anchor = effectiveDate(newDates, r.start_anchor as KeyDate);
    if (!anchor) continue;
    const start_date = addDays(anchor, r.start_offset ?? 0);
    let end_date = r.end_date;
    if (r.end_type === 'date' && r.end_anchor) {
      const ea = effectiveDate(newDates, r.end_anchor as KeyDate);
      if (ea) end_date = addDays(ea, r.end_offset ?? 0);
    }
    if (start_date !== r.start_date || end_date !== r.end_date) {
      out.push({ id: r.id, start_date, end_date });
    }
  }
  return out;
}

export function ruleOccursOn(rule: RecurrenceRule, date: string, litterDates: LitterDates | null): boolean {
  if (date < rule.start_date) return false;
  const end = ruleEndDate(rule, litterDates);
  if (end && date > end) return false;
  return ruleMatches(rule, diffDays(rule.start_date, date));
}

/** Round-robin the assignee across occurrences (date-sequence × time-slot). */
export function rotateAssignee(rule: RecurrenceRule, date: string, timeIndex: number): string | null {
  const ids = rule.assignee_ids || [];
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0];
  const seq = Math.floor(diffDays(rule.start_date, date) / ruleStep(rule));
  return ids[(seq * (rule.times.length || 1) + timeIndex) % ids.length];
}

export function checkKey(ruleId: string, date: string, time: string): string {
  return `${ruleId}|${date}|${time}`;
}

export interface Occurrence {
  key: string;
  rule: RecurrenceRule;
  date: string;
  time: string;
  assigneeId: string | null;
  check: RuleCheck | undefined;
}

/**
 * All occurrences firing on `date` for the given scope. Litter-scoped rules
 * are filtered to `activeLitterId`; paused rules are hidden for today/future.
 */
export function occurrencesForDate(
  rules: RecurrenceRule[],
  checks: Map<string, RuleCheck>,
  date: string,
  litterDates: LitterDates | null,
  activeLitterId: string | null,
  today: string,
  scope?: 'kennel' | 'litter'
): Occurrence[] {
  const out: Occurrence[] = [];
  for (const rule of rules) {
    if (scope && rule.scope !== scope) continue;
    if (rule.scope === 'litter' && rule.litter_id && rule.litter_id !== activeLitterId) continue;
    if (rule.paused && date >= today) continue;
    if (!ruleOccursOn(rule, date, litterDates)) continue;
    rule.times.forEach((time, ti) => {
      const key = checkKey(rule.id, date, time);
      out.push({
        key,
        rule,
        date,
        time,
        assigneeId: rotateAssignee(rule, date, ti),
        check: checks.get(key),
      });
    });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.rule.name.localeCompare(b.rule.name));
}

/** Count of not-yet-done occurrences on a date (for dashboard/agenda rollups). */
export function openCountForDate(
  rules: RecurrenceRule[],
  checks: Map<string, RuleCheck>,
  date: string,
  litterDates: LitterDates | null,
  activeLitterId: string | null,
  today: string
): { total: number; done: number } {
  const occ = occurrencesForDate(rules, checks, date, litterDates, activeLitterId, today);
  const done = occ.filter((o) => o.check?.status === 'done').length;
  return { total: occ.length, done };
}

/**
 * Default litter-scoped recurring rules generated when a litter is created —
 * mirrors the prototype's seed (weigh 2×/day, box temp, clean box, socialization).
 * Dates anchor to the litter's whelping/weaning/handover key dates.
 */
export function defaultRulesForLitter(
  litter: { id: string; space_id: string },
  dates: LitterDates
): Array<Omit<RecurrenceRule, 'id' | 'created_at'>> {
  const whelping = effectiveDate(dates, 'whelping');
  if (!whelping) return [];
  const socialStart = addDays(whelping, 21);
  return [
    {
      space_id: litter.space_id, litter_id: litter.id, name: 'Weigh puppies', scope: 'litter',
      freq: 'daily', interval: 1, times: ['08:00', '20:00'], start_date: whelping,
      end_type: 'keydate', end_key: 'weaning', end_date: null, end_count: null,
      start_anchor: 'whelping', start_offset: 0, end_anchor: null, end_offset: null,
      assignee_ids: [], paused: false,
    },
    {
      space_id: litter.space_id, litter_id: litter.id, name: 'Whelping box temperature', scope: 'litter',
      freq: 'daily', interval: 1, times: ['08:00'], start_date: whelping,
      end_type: 'date', end_key: null, end_date: addDays(whelping, 21), end_count: null,
      start_anchor: 'whelping', start_offset: 0, end_anchor: 'whelping', end_offset: 21,
      assignee_ids: [], paused: false,
    },
    {
      space_id: litter.space_id, litter_id: litter.id, name: 'Clean whelping box', scope: 'litter',
      freq: 'daily', interval: 1, times: ['20:00'], start_date: whelping,
      end_type: 'keydate', end_key: 'weaning', end_date: null, end_count: null,
      start_anchor: 'whelping', start_offset: 0, end_anchor: null, end_offset: null,
      assignee_ids: [], paused: false,
    },
    {
      space_id: litter.space_id, litter_id: litter.id, name: 'Socialization — 15 min handling', scope: 'litter',
      freq: 'daily', interval: 1, times: ['12:00'], start_date: socialStart,
      end_type: 'keydate', end_key: 'handover', end_date: null, end_count: null,
      start_anchor: 'whelping', start_offset: 21, end_anchor: null, end_offset: null,
      assignee_ids: [], paused: false,
    },
  ];
}
