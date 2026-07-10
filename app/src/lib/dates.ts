// Plain YYYY-MM-DD string date helpers — mirrors the design prototype's date utils
// so scheduling math matches the reference implementation exactly.

export function pad(n: number): string {
  return (n < 10 ? '0' : '') + n;
}

export function fmt(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function todayStr(): string {
  return fmt(new Date());
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
}

export function addMonths(s: string, n: number): string {
  const [y, m, day] = s.split('-').map(Number);
  const targetMonthIndex = m - 1 + n;
  const ty = y + Math.floor(targetMonthIndex / 12);
  const tm = ((targetMonthIndex % 12) + 12) % 12; // 0-11
  // Clamp the day to the last valid day of the target month so e.g.
  // Dec 31 + 2mo -> Feb 28/29 (not Mar 3), and Jul 31 + 2mo -> Sep 30 (not Oct 1).
  const lastDay = new Date(ty, tm + 1, 0).getDate();
  return fmt(new Date(ty, tm, Math.min(day, lastDay)));
}

export function diffDays(a: string, b: string): number {
  return Math.round((+parseDate(b) - +parseDate(a)) / 86400000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function niceDate(s: string): string {
  const d = parseDate(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function longDate(s: string): string {
  const d = parseDate(s);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function isPast(s: string): boolean {
  return s < todayStr();
}

export function isToday(s: string): boolean {
  return s === todayStr();
}
