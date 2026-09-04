import type { BannerPhase, BannerPrediction, GameVersion, ResolvedPrediction, WishTarget } from '@/types'
import { addDays } from '@/lib/date'

/**
 * BannerPredictionService - collapses a set of probabilistic appearances into
 * one primary placement, while preserving the alternatives and the earliest
 * credible date that Safe planning has to defend against.
 */

/** Predictions below this probability are noise, not a risk worth reserving for. */
export const CREDIBLE_THRESHOLD = 0.1

export function phaseWindow(
  version: GameVersion,
  phase: BannerPhase,
): { date: string; endDate: string } {
  if (phase === 2) return { date: version.phase2Date, endDate: version.endDate }
  if (phase === 1) return { date: version.startDate, endDate: addDays(version.phase2Date, -1) }
  return { date: version.startDate, endDate: version.endDate }
}

export function resolvePrediction(
  target: WishTarget,
  predictions: BannerPrediction[],
  versions: GameVersion[],
): ResolvedPrediction | undefined {
  const versionById = new Map(versions.map((v) => [v.id, v]))

  // A user override replaces the community forecast entirely - for this user only.
  if (target.bannerVersionOverride) {
    const version = versionById.get(target.bannerVersionOverride)
    if (version) {
      const phase = target.bannerPhaseOverride ?? 1
      const w = phaseWindow(version, phase)
      return {
        versionId: version.id,
        versionName: version.name,
        phase,
        confidence: 1,
        sourceType: 'user',
        date: w.date,
        endDate: w.endDate,
        alternatives: [],
        isUserOverride: true,
      }
    }
  }

  const mine = predictions
    .filter((p) => p.characterId === target.characterId && p.publishState === 'published')
    .filter((p) => versionById.has(p.versionId))

  if (mine.length === 0) return undefined

  const enriched = mine
    .map((p) => {
      const version = versionById.get(p.versionId)!
      const w = phaseWindow(version, p.phase)
      return { p, version, ...w }
    })
    .sort((a, b) => b.p.probability - a.p.probability)

  const primary = enriched[0]

  const credible = enriched
    .filter((e) => e.p.probability >= CREDIBLE_THRESHOLD)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const earliest = credible[0]

  return {
    versionId: primary.version.id,
    versionName: primary.version.name,
    phase: primary.p.phase,
    confidence: primary.p.probability,
    sourceType: primary.p.sourceType,
    date: primary.date,
    endDate: primary.endDate,
    isUserOverride: false,
    alternatives: enriched
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((e) => ({
        versionId: e.version.id,
        versionName: e.version.name,
        phase: e.p.phase,
        probability: e.p.probability,
        date: e.date,
      })),
    earliest: earliest
      ? {
          versionId: earliest.version.id,
          versionName: earliest.version.name,
          phase: earliest.p.phase,
          date: earliest.date,
          probability: earliest.p.probability,
        }
      : undefined,
  }
}

/** How the confidence should be described without ever sounding confirmed. */
export function confidenceLabel(source: BannerPrediction['sourceType']): string {
  switch (source) {
    case 'official': return 'Official'
    case 'reliable-leak': return 'Strong signal'
    case 'speculation': return 'Speculative'
    case 'user': return 'Your estimate'
  }
}

export function confidenceDescription(source: BannerPrediction['sourceType']): string {
  switch (source) {
    case 'official': return 'Confirmed by HoYoverse.'
    case 'reliable-leak': return 'Multiple or historically reliable sources.'
    case 'speculation': return 'Community speculation. Treat as a rough guess.'
    case 'user': return 'You set this timing yourself.'
  }
}

export function phaseLabel(phase: BannerPhase): string {
  return phase === 'unknown' ? 'Phase unknown' : `Phase ${phase}`
}
