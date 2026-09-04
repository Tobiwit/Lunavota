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

/**
 * Probability, rounded to 5% so it never implies precision the model does not
 * have. Only a deterministic worst-case plan reaches a bare 100%.
 */
export function formatChance(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return '0%'
  if (p >= 0.9995) return '100%'
  if (p < 0.05) return '<5%'
  return `~${Math.round((p * 100) / 5) * 5}%`
}
