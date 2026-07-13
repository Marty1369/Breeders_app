// Single source of truth for the four rearing stages and birth-relative framing.
// Design spec §1.5: ONE taxonomy everywhere — "Before birth · Weeks 1–3 ·
// Weeks 4–6 · Weeks 7–9". The DB enum values (prewhelp/t1_birth/t2_wean/
// t3_social) are unchanged; only the human labels are centralised here so the
// List, Gantt, task detail, and task form surfaces can't drift apart.

import type { Litter, TaskPhase } from './types';
import { diffDays, niceDate, todayStr } from './dates';
import { effectiveDate } from './scheduling';

// Terminal litters (closed / did-not-take) are archives — care and money
// screens must not accept new writes for them (QA DATA-03).
export const isLitterTerminal = (l: Litter) => l.status === 'closed' || l.status === 'did_not_take';

export const STAGE_ORDER: TaskPhase[] = ['prewhelp', 't1_birth', 't2_wean', 't3_social'];

export const STAGE_LABEL: Record<TaskPhase, string> = {
  prewhelp: 'Before birth',
  t1_birth: 'Weeks 1–3',
  t2_wean: 'Weeks 4–6',
  t3_social: 'Weeks 7–9',
};

export const STAGE_SUB: Record<TaskPhase, string> = {
  prewhelp: 'Mating → birth',
  t1_birth: 'Newborn & nursing',
  t2_wean: 'Weaning',
  t3_social: 'Socialising & going home',
};

export const STAGE_COLOR: Record<TaskPhase, string> = {
  prewhelp: '#8a938e',
  t1_birth: '#17805a',
  t2_wean: '#4a6fa5',
  t3_social: '#b97324',
};

/**
 * Frame a task relative to birth (spec §1.5): "5 days to birth" before the
 * whelping date, "Pup day 12 · week 2" after. Returns '' when no whelping date.
 */
export function birthFraming(startDate: string, whelping: string | null): string {
  if (!whelping) return '';
  const d = diffDays(whelping, startDate);
  if (d < 0) {
    const n = -d;
    return `${n} day${n === 1 ? '' : 's'} to birth`;
  }
  if (d === 0) return 'Birth day';
  return `Pup day ${d} · week ${Math.floor((d - 1) / 7) + 1}`;
}

export interface LitterProgress {
  /** e.g. "Puppies are 3 weeks old", "5 days to birth", "Planning a litter". */
  headline: string;
  /** e.g. "they go home in 38 days (Aug 18)", "born around Sep 24". Never a bare counter. */
  detail: string;
  /** Age in days since whelping, once born; else null. */
  ageDays: number | null;
  weeks: number | null;
}

/**
 * The explained day counter (spec §1.5): never a bare "Day N of 63". Derives a
 * plain-words headline + detail from litter status and effective dates.
 */
export function litterProgress(litter: Litter, today: string = todayStr()): LitterProgress {
  const whelp = effectiveDate(litter.dates, 'whelping');
  const handover = effectiveDate(litter.dates, 'handover');
  const closed = litter.status === 'closed' || litter.status === 'did_not_take';
  // "Born" is a real event, not merely the predicted date arriving: a pregnant
  // bitch is routinely a day or two overdue before whelping is logged, and we
  // must not announce puppies until birth actually happened. Trust the actual
  // whelping date / status, never the predicted fallback.
  const born =
    litter.dates.whelping?.actual != null || litter.status === 'born' || litter.status === 'closed';

  // Born → age-based framing.
  if (born && whelp) {
    const ageDays = Math.max(0, diffDays(whelp, today));
    const weeks = Math.floor(ageDays / 7);
    let headline: string;
    if (ageDays === 0) headline = 'Puppies were born today';
    else if (weeks < 1) headline = `Puppies are ${ageDays} day${ageDays === 1 ? '' : 's'} old`;
    else headline = `Puppies are ${weeks} week${weeks === 1 ? '' : 's'} old`;

    let detail = '';
    if (litter.status === 'closed') detail = 'Litter closed';
    else if (handover && handover > today) {
      const m = diffDays(today, handover);
      detail = `they go home in ${m} day${m === 1 ? '' : 's'} (${niceDate(handover)})`;
    } else if (handover) detail = `home day was ${niceDate(handover)}`;
    return { headline, detail, ageDays, weeks };
  }

  // Terminal but never whelped (did_not_take, or an empty closed litter).
  if (closed) {
    return { headline: 'Litter closed', detail: '', ageDays: null, weeks: null };
  }

  // Before birth → countdown framing. Covers the overdue-but-not-yet-logged case
  // too (n ≤ 0), where we keep pointing at the due date rather than claim a birth.
  if (whelp) {
    const n = diffDays(today, whelp);
    if (n > 0) {
      return {
        headline: `${n} day${n === 1 ? '' : 's'} to birth`,
        detail: `puppies due around ${niceDate(whelp)}`,
        ageDays: null,
        weeks: null,
      };
    }
    return {
      headline: n === 0 ? 'Puppies due today' : 'Birth is due',
      detail: `due around ${niceDate(whelp)}`,
      ageDays: null,
      weeks: null,
    };
  }

  // No whelping date yet (planned/early).
  return {
    headline: 'Planning a litter',
    detail: 'dates fill in as they come',
    ageDays: null,
    weeks: null,
  };
}
