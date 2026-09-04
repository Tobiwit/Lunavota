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

/**
 * Version eras.
 *
 * The era name restarts at each major version: 6.0-6.8 are Luna I-IX, and the
 * naming changes to Snezhnaya at 7.0 rather than continuing to Luna X. The
 * ordinal restarts with the era, so 7.0 is Snezhnaya I.
 */
interface Era {
  name: string
  major: number
  /** How many minor versions the era covers. The last era is open-ended. */
  length: number
}

const ERAS: Era[] = [
  // 6.0 opened on 2025-09-10; 6.7 is the last of the Luna era, and 7.0 begins
  // on 2026-08-12 — eight versions at the 42-day cadence.
  { name: 'Luna', major: 6, length: 8 },
  { name: 'Snezhnaya', major: 7, length: Number.POSITIVE_INFINITY },
]

/** A name the seed could have produced, as opposed to one an admin typed. */
export const SEEDED_VERSION_NAME = /^(?:Luna|Snezhnaya) [IVXL]+$/

function eraFor(index: number): { era: Era; ordinal: number; number: string } {
  let remaining = index
  for (const era of ERAS) {
    if (remaining < era.length) {
      return { era, ordinal: remaining + 1, number: `${era.major}.${remaining}` }
    }
    remaining -= era.length
  }
  const last = ERAS[ERAS.length - 1]
  return { era: last, ordinal: remaining + 1, number: `${last.major}.${remaining}` }
}

function displayName(era: Era, ordinal: number): string {
  return `${era.name} ${ROMAN[ordinal - 1] ?? ordinal}`
}

/**
 * The name the seed would give a version with this number.
 *
 * Used by the store migration to correct rows that still carry an outdated
 * seeded name, without touching anything an admin has renamed themselves.
 */
export function seedNameForNumber(number: string): string | undefined {
  const [majorRaw, minorRaw] = number.split('.')
  const major = Number(majorRaw)
  const minor = Number(minorRaw)
  if (!Number.isFinite(major) || !Number.isFinite(minor) || minor < 0) return undefined
  const era = ERAS.find((e) => e.major === major)
  if (!era || minor >= era.length) return undefined
  return displayName(era, minor + 1)
}

export function buildSeedVersions(now = today()): GameVersion[] {
  const out: GameVersion[] = []
  for (let i = 0; i < VERSION_COUNT; i++) {
    const startDate = addDays(ANCHOR_START, i * VERSION_LENGTH_DAYS)
    const endDate = addDays(startDate, VERSION_LENGTH_DAYS - 1)
    const status = now < startDate ? 'upcoming' : now > endDate ? 'past' : 'live'
    const { era, ordinal, number } = eraFor(i)
    out.push({
      id: `${era.name.toLowerCase()}-${ordinal}`,
      name: displayName(era, ordinal),
      number,
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
