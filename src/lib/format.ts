/**
 * Grouped number formatting pinned to the interface language.
 *
 * The browser locale is deliberately ignored: all copy here is English, and a
 * locale that groups with "." turns 4,000 Primogems into "4.000 Primogems".
 */
const GROUPED = new Intl.NumberFormat('en-US')

export function formatNumber(n: number): string {
  return GROUPED.format(Math.round(n))
}
