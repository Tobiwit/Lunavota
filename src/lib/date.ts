/** Date helpers. Everything in the app uses ISO `YYYY-MM-DD` day keys. */

export type DayKey = string

export function toKey(d: Date | string): DayKey {
  if (typeof d === 'string') return d.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: DayKey): Date {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function today(): DayKey {
  return toKey(new Date())
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = fromKey(key)
  d.setDate(d.getDate() + days)
  return toKey(d)
}

export function daysBetween(a: DayKey, b: DayKey): number {
  const ms = fromKey(b).getTime() - fromKey(a).getTime()
  return Math.round(ms / 86_400_000)
}

export function isBefore(a: DayKey, b: DayKey): boolean {
  return a < b
}

export function clampDate(key: DayKey, min: DayKey, max: DayKey): DayKey {
  if (key < min) return min
  if (key > max) return max
  return key
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDay(key: DayKey): string {
  const d = fromKey(key)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function formatDayYear(key: DayKey): string {
  const d = fromKey(key)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function formatRange(a: DayKey, b: DayKey): string {
  const da = fromKey(a)
  const db = fromKey(b)
  if (da.getMonth() === db.getMonth()) {
    return `${MONTHS[da.getMonth()]} ${da.getDate()}–${db.getDate()}`
  }
  return `${formatDay(a)} – ${formatDay(b)}`
}

/** "in 12 days" / "today" / "8 days ago" */
export function relativeDays(from: DayKey, to: DayKey): string {
  const n = daysBetween(from, to)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  if (n > 0) return `in ${n} days`
  return `${-n} days ago`
}

/** First day of each month intersecting the range, inclusive. */
export function monthStarts(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = []
  const d = fromKey(from)
  d.setDate(1)
  while (toKey(d) <= to) {
    const k = toKey(d)
    if (k >= from) out.push(k)
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

/** Every `nth` day-of-month occurrence in the range (e.g. Spiral Abyss on 1 and 16). */
export function daysOfMonth(from: DayKey, to: DayKey, days: number[]): DayKey[] {
  const out: DayKey[] = []
  const cursor = fromKey(from)
  cursor.setDate(1)
  while (toKey(cursor) <= to) {
    for (const day of days) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day)
      const k = toKey(d)
      if (k >= from && k <= to && d.getDate() === day) out.push(k)
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return out.sort()
}
