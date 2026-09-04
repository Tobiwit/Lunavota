import type { GameVersion, VersionIncomeItem } from '@/types'
import { addDays, today, toKey } from '@/lib/date'
import { BASELINE_SCHEDULE, VERSION_BASELINE } from './config'

/**
 * Seed version schedule.
 *
 * These dates are a *planning scaffold*, not confirmed HoYoverse information.
 * The admin CMS exists precisely so they can be corrected: edit a version in
 * /admin and the whole forecast recalculates.
 */
const ANCHOR_START = '2025-09-10'
const VERSION_LENGTH_DAYS = 42
const PHASE_2_OFFSET_DAYS = 21
const VERSION_COUNT = 18

const ROMAN = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII',
]

function versionNumberFor(index: number): string {
  // Luna I..IX map onto 6.0..6.8; the era continues into 7.x after that.
  if (index <= 8) return `6.${index}`
  return `7.${index - 9}`
}

export function buildSeedVersions(now = today()): GameVersion[] {
  const out: GameVersion[] = []
  for (let i = 0; i < VERSION_COUNT; i++) {
    const startDate = addDays(ANCHOR_START, i * VERSION_LENGTH_DAYS)
    const endDate = addDays(startDate, VERSION_LENGTH_DAYS - 1)
    const status = now < startDate ? 'upcoming' : now > endDate ? 'past' : 'live'
    out.push({
      id: `luna-${i + 1}`,
      name: `Luna ${ROMAN[i]}`,
      number: versionNumberFor(i),
      startDate,
      phase2Date: addDays(startDate, PHASE_2_OFFSET_DAYS),
      endDate,
      status,
      publishState: 'published',
      notes: i === 0 ? 'Seeded schedule. Correct the dates in Admin as they are confirmed.' : undefined,
    })
  }
  return out
}

/** The default 4,000-Primogem content split, distributed across a version. */
export function buildBaselineIncome(version: GameVersion): VersionIncomeItem[] {
  const labels: Record<keyof typeof VERSION_BASELINE, string> = {
    events: 'Version events',
    quests: 'Quests & story',
    exploration: 'Exploration',
    'maintenance-codes': 'Maintenance & livestream codes',
    misc: 'Trials, web events & misc.',
  }

  return (Object.keys(VERSION_BASELINE) as (keyof typeof VERSION_BASELINE)[]).map((cat) => {
    const schedule = BASELINE_SCHEDULE[cat]
    const availableDate = addDays(version.startDate, schedule.offset)
    return {
      id: `${version.id}-${cat}`,
      versionId: version.id,
      category: cat,
      label: labels[cat],
      primogems: VERSION_BASELINE[cat],
      intertwinedFates: 0,
      availableDate,
      endDate: schedule.spreadDays > 0 ? addDays(availableDate, schedule.spreadDays) : undefined,
      completionAdjustable: cat !== 'maintenance-codes',
      guaranteed: cat === 'maintenance-codes',
      baselineIncluded: true,
    }
  })
}

export function buildSeedIncome(versions: GameVersion[]): VersionIncomeItem[] {
  return versions.flatMap(buildBaselineIncome)
}

export function recomputeVersionStatuses(versions: GameVersion[], now = toKey(new Date())): GameVersion[] {
  return versions.map((v) => ({
    ...v,
    status: now < v.startDate ? 'upcoming' : now > v.endDate ? 'past' : 'live',
  }))
}
