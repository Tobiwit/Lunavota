import type { BannerPrediction, GameVersion } from '@/types'

/**
 * Seed banner predictions.
 *
 * Every entry ships as `speculation` on purpose. Nothing here is confirmed by
 * HoYoverse, and the app must never render it as though it were. Admins replace
 * these with sourced predictions as real information appears.
 */
const NOTE = 'Placeholder forecast shipped with the app. Replace in Admin.'

interface Seed {
  characterId: string
  /** Offset in versions from the currently live one. */
  versionOffset: number
  phase: 1 | 2
  probability: number
}

const SEEDS: Seed[] = [
  { characterId: 'temp:mitya', versionOffset: 0, phase: 2, probability: 0.2 },
  { characterId: 'temp:mitya', versionOffset: 1, phase: 1, probability: 0.65 },
  { characterId: 'temp:mitya', versionOffset: 1, phase: 2, probability: 0.15 },

  { characterId: 'columbina', versionOffset: 1, phase: 1, probability: 0.3 },
  { characterId: 'columbina', versionOffset: 1, phase: 2, probability: 0.5 },
  { characterId: 'columbina', versionOffset: 2, phase: 1, probability: 0.2 },

  { characterId: 'temp:valeriy', versionOffset: 1, phase: 2, probability: 0.35 },
  { characterId: 'temp:valeriy', versionOffset: 2, phase: 1, probability: 0.4 },

  { characterId: 'lauma', versionOffset: 0, phase: 2, probability: 0.55 },
  { characterId: 'lauma', versionOffset: 1, phase: 1, probability: 0.3 },

  { characterId: 'flins', versionOffset: 1, phase: 1, probability: 0.45 },
  { characterId: 'flins', versionOffset: 1, phase: 2, probability: 0.35 },

  { characterId: 'temp:tsaritsa', versionOffset: 2, phase: 2, probability: 0.2 },
  { characterId: 'temp:tsaritsa', versionOffset: 3, phase: 1, probability: 0.5 },
  { characterId: 'temp:tsaritsa', versionOffset: 3, phase: 2, probability: 0.15 },
]

export function buildSeedPredictions(versions: GameVersion[], now: string): BannerPrediction[] {
  const liveIndex = Math.max(
    0,
    versions.findIndex((v) => v.startDate <= now && v.endDate >= now),
  )

  return SEEDS.flatMap((s, i) => {
    const version = versions[liveIndex + s.versionOffset]
    if (!version) return []
    return [
      {
        id: `seed-pred-${i}`,
        characterId: s.characterId,
        versionId: version.id,
        phase: s.phase,
        probability: s.probability,
        sourceType: 'speculation' as const,
        sourceLabel: 'Seed data',
        lastUpdated: now,
        notes: NOTE,
        publishState: 'published' as const,
      },
    ]
  })
}
