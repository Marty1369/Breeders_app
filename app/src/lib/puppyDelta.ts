// Weigh-in gain helpers — the "delta verdict" language from the design spec (§5.3)
// plus previous/latest weight lookups over a puppy's weigh_log.
//
// weigh_log shape: { "YYYY-MM-DD": { am?: grams, pm?: grams } }. A "reading" is a
// single am/pm entry; readings are ordered by date then am-before-pm.

export type WeighLog = Record<string, { am?: number; pm?: number }>;

function readings(log: WeighLog): { key: string; grams: number }[] {
  const out: { key: string; grams: number }[] = [];
  for (const date of Object.keys(log).sort()) {
    const day = log[date];
    // `am` sorts before `pm` lexicographically, and the date prefix is fixed
    // width, so `${date}#${session}` gives a correct chronological key.
    if (day.am != null) out.push({ key: `${date}#am`, grams: day.am });
    if (day.pm != null) out.push({ key: `${date}#pm`, grams: day.pm });
  }
  return out;
}

/** The most recent reading strictly before the (date, session) slot, if any. */
export function previousWeight(log: WeighLog, date: string, session: 'am' | 'pm'): number | null {
  const cur = `${date}#${session}`;
  const before = readings(log).filter((r) => r.key < cur);
  return before.length ? before[before.length - 1].grams : null;
}

/** The single most recent reading overall (for list/summary display). */
export function latestWeight(log: WeighLog): number | null {
  const r = readings(log);
  return r.length ? r[r.length - 1].grams : null;
}

export type DeltaTone = 'good' | 'watch' | 'bad';
export interface DeltaVerdict {
  delta: number;
  label: string;
  tone: DeltaTone;
}

function grams(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n)} g`;
}

/**
 * Verdict for a new weight vs the previous reading (spec §5.3):
 *   +30…+70 → good "+45 g ✓"   · >+70 → good "+82 g — big jump"
 *   +10…+29 → watch "only +18 g –" · 0…+9 → watch "only +3 g !"
 *   <0      → bad "−12 g — lost weight !"
 * Returns null when there is nothing to compare against yet.
 */
export function deltaVerdict(current: number, previous: number | null): DeltaVerdict | null {
  if (previous == null || !Number.isFinite(current)) return null;
  const d = current - previous;
  if (d < 0) return { delta: d, label: `${grams(d)} — lost weight !`, tone: 'bad' };
  if (d <= 9) return { delta: d, label: `only ${grams(d)} !`, tone: 'watch' };
  if (d <= 29) return { delta: d, label: `only ${grams(d)} –`, tone: 'watch' };
  if (d <= 70) return { delta: d, label: `${grams(d)} ✓`, tone: 'good' };
  return { delta: d, label: `${grams(d)} — big jump`, tone: 'good' };
}
