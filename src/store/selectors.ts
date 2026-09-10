import { useMemo } from 'react'
import { useStore } from './useStore'
import { buildForecast } from '@/engine/forecast'
import { buildPlan } from '@/engine/planning'
import { buildTimeline } from '@/engine/timeline'
import { today } from '@/lib/date'
import type { Budget, Character, ForecastCurve, GameVersion, UserWishState } from '@/types'

/**
 * The one place the three engines are wired together.
 *
 * Forecast feeds planning; planning feeds the timeline. Any change to the
 * wishlist, the profile or the catalog re-runs all three.
 */

export function useCharacterMap(): Map<string, Character> {
  const characters = useStore((s) => s.characters)
  return useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
}

export function useForecast(overrideUser?: UserWishState): ForecastCurve {
  const storedUser = useStore((s) => s.user)
  const user = overrideUser ?? storedUser
  const profile = useStore((s) => s.profile)
  const versions = useStore((s) => s.versions)
  const incomeItems = useStore((s) => s.incomeItems)
  const calendarEvents = useStore((s) => s.calendarEvents)
  const recurring = useStore((s) => s.recurring)

  return useMemo(
    () =>
      buildForecast({
        now: today(),
        ownedPrimogems: user.primogems + user.genesisCrystals,
        ownedFates: user.intertwinedFates,
        versions,
        incomeItems,
        calendarEvents,
        profile,
        recurring,
        ignoreFutureIncome: user.ignoreFutureIncome,
      }),
    [user, profile, versions, incomeItems, calendarEvents, recurring],
  )
}

export function useBudget(overrideUser?: UserWishState): Budget {
  const storedUser = useStore((s) => s.user)
  const user = overrideUser ?? storedUser
  const targets = useStore((s) => s.targets)
  const predictions = useStore((s) => s.predictions)
  const versions = useStore((s) => s.versions)
  const characters = useCharacterMap()
  const curve = useForecast(user)

  return useMemo(
    () => buildPlan({ now: today(), user, targets, characters, predictions, versions, curve }),
    [user, targets, characters, predictions, versions, curve],
  )
}

export function useTimeline() {
  const versions = useStore((s) => s.versions)
  const predictions = useStore((s) => s.predictions)
  const characters = useCharacterMap()
  const curve = useForecast()
  const budget = useBudget()
  return useMemo(
    () => buildTimeline({ now: today(), versions, curve, budget, predictions, characters }),
    [versions, curve, budget, predictions, characters],
  )
}

export function useLiveVersion(): GameVersion | undefined {
  const versions = useStore((s) => s.versions)
  const now = today()
  return useMemo(
    () => versions.find((v) => v.startDate <= now && v.endDate >= now),
    [versions, now],
  )
}

export function useCharacter(id: string | undefined): Character | undefined {
  const map = useCharacterMap()
  return id ? map.get(id) : undefined
}
