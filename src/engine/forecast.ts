import type {
  CalendarEvent,
  ForecastCurve,
  ForecastPoint,
  GameVersion,
  IncomeKind,
  PlanningMode,
  UserIncomeProfile,
  VersionIncomeItem,
} from '@/types'
import { PRIMOS_PER_WISH } from './wish'
import { DEFAULT_RECURRING, FORECAST_HORIZON_DAYS, UNCERTAINTY, type RecurringIncomeConfig } from '@/data/config'
import { addDays, daysBetween, daysOfMonth, today, toKey } from '@/lib/date'

/**
 * ForecastEngine - projects resources forward across the version calendar.
 *
 * The output is deliberately *not* a single number. Income is uncertain, so the
 * curve carries a low/expected/high band and the planning mode decides which
 * edge of it a decision is allowed to lean on.
 */

export interface ForecastInput {
  now: string
  ownedPrimogems: number
  ownedFates: number
  versions: GameVersion[]
  incomeItems: VersionIncomeItem[]
  calendarEvents: CalendarEvent[]
  profile: UserIncomeProfile
  recurring?: RecurringIncomeConfig
  horizonDays?: number
  /** Strict planning - produces a flat curve with no future income at all. */
  ignoreFutureIncome?: boolean
}

interface RawIncome {
  id: string
  kind: IncomeKind
  label: string
  detail?: string
  date: string
  /** Inclusive end for income that accrues gradually. */
  endDate?: string
  primogems: number
  intertwinedFates: number
  /** Scales with the player's completion profile. */
  adjustable: boolean
  versionId?: string
}

/* ------------------------------------------------------------------ */
/* Profile-derived amounts                                             */
/* ------------------------------------------------------------------ */

const COMPLETION_CATEGORY: Partial<Record<IncomeKind, keyof UserIncomeProfile['categoryCompletionOverrides']>> = {
  events: 'events',
  exploration: 'exploration',
  quests: 'quests',
}

export function completionFor(profile: UserIncomeProfile, kind: IncomeKind): number {
  const key = COMPLETION_CATEGORY[kind]
  const override = key ? profile.categoryCompletionOverrides[key] : undefined
  return clamp01(override ?? profile.generalCompletionRate)
}

/** Spiral Abyss floors 9-12 each carry roughly a quarter of the cycle reward. */
export function spiralAbyssPrimos(profile: UserIncomeProfile, cfg: RecurringIncomeConfig): number {
  const floors = clamp(profile.endgame.spiralAbyssFloor - 8, 0, 4)
  const override = profile.categoryCompletionOverrides.spiralAbyss
  const base = (cfg.spiralAbyss.fullClearPrimos * floors) / 4
  return Math.round(base * (override ?? 1))
}

export function imaginariumPrimos(profile: UserIncomeProfile, cfg: RecurringIncomeConfig): number {
  const acts = clamp(profile.endgame.imaginariumAct, 0, 8)
  const override = profile.categoryCompletionOverrides.imaginariumTheater
  return Math.round(((cfg.imaginariumTheater.fullClearPrimos * acts) / 8) * (override ?? 1))
}

export function stygianPrimos(profile: UserIncomeProfile, cfg: RecurringIncomeConfig): number {
  const override = profile.categoryCompletionOverrides.stygianOnslaught
  return Math.round(cfg.stygianOnslaught.fullClearPrimos * clamp01(override ?? profile.endgame.stygianCompletion))
}

/* ------------------------------------------------------------------ */
/* Raw income assembly                                                 */
/* ------------------------------------------------------------------ */

export function collectRawIncome(input: ForecastInput): RawIncome[] {
  const cfg = input.recurring ?? DEFAULT_RECURRING
  const { profile, now } = input
  const horizon = addDays(now, input.horizonDays ?? FORECAST_HORIZON_DAYS)
  const out: RawIncome[] = []

  // -- Dailies ----------------------------------------------------------
  if (profile.dailyCommissions) {
    out.push({
      id: 'dailies',
      kind: 'dailies',
      label: 'Daily commissions',
      detail: `${cfg.dailyCommissionPrimos} Primogems each day`,
      date: now,
      endDate: horizon,
      primogems: cfg.dailyCommissionPrimos * (daysBetween(now, horizon) + 1),
      intertwinedFates: 0,
      adjustable: false,
    })
  }

  // -- Welkin -----------------------------------------------------------
  if (profile.welkin.active) {
    const end = profile.welkin.endDate && profile.welkin.endDate < horizon ? profile.welkin.endDate : horizon
    const days = daysBetween(now, end) + 1
    if (days > 0) {
      out.push({
        id: 'welkin',
        kind: 'welkin',
        label: 'Blessing of the Welkin Moon',
        detail: profile.welkin.endDate ? `Active until ${profile.welkin.endDate}` : 'Assumed continuously active',
        date: now,
        endDate: end,
        primogems: cfg.welkinPrimosPerDay * days,
        intertwinedFates: 0,
        adjustable: false,
      })
    }
  }

  // -- Battle Pass ------------------------------------------------------
  if (profile.battlePass !== 'none') {
    const bp = profile.battlePass === 'paid' ? cfg.battlePass.paid : cfg.battlePass.free
    if (bp.primogems > 0 || bp.intertwinedFates > 0) {
      for (const v of input.versions) {
        // The BP reward lands late in the cycle, not on day one.
        const payout = addDays(v.startDate, Math.round(cfg.battlePass.durationDays * 0.85))
        if (payout < now || payout > horizon) continue
        out.push({
          id: `bp-${v.id}`,
          kind: 'battle-pass',
          label: 'Battle Pass rewards',
          detail: v.name,
          date: payout,
          primogems: bp.primogems,
          intertwinedFates: bp.intertwinedFates,
          adjustable: false,
          versionId: v.id,
        })
      }
    }
  }

  // -- Endgame resets ---------------------------------------------------
  const endgame: [IncomeKind, string, number, number[]][] = [
    ['spiral-abyss', 'Spiral Abyss', spiralAbyssPrimos(profile, cfg), cfg.spiralAbyss.resetDays],
    ['imaginarium-theater', 'Imaginarium Theater', imaginariumPrimos(profile, cfg), cfg.imaginariumTheater.resetDays],
    ['stygian-onslaught', 'Stygian Onslaught', stygianPrimos(profile, cfg), cfg.stygianOnslaught.resetDays],
  ]
  for (const [kind, label, amount, resetDays] of endgame) {
    if (amount <= 0) continue
    for (const date of daysOfMonth(now, horizon, resetDays)) {
      out.push({
        id: `${kind}-${date}`,
        kind,
        label,
        detail: 'Based on your usual clear',
        date,
        primogems: amount,
        intertwinedFates: 0,
        adjustable: false,
      })
    }
  }

  // -- Starglitter shop -------------------------------------------------
  if (profile.starglitterShop && cfg.starglitterFatesPerMonth > 0) {
    for (const date of daysOfMonth(now, horizon, [1])) {
      out.push({
        id: `shop-${date}`,
        kind: 'shop',
        label: 'Paimon’s Bargains',
        detail: 'Masterless Starglitter exchange',
        date,
        primogems: 0,
        intertwinedFates: cfg.starglitterFatesPerMonth,
        adjustable: false,
      })
    }
  }

  // -- Version content baseline ----------------------------------------
  const versionById = new Map(input.versions.map((v) => [v.id, v]))
  for (const item of input.incomeItems) {
    const version = versionById.get(item.versionId)
    if (!version) continue
    const start = item.availableDate ?? version.startDate
    const end = item.endDate
    if ((end ?? start) < now || start > horizon) continue
    out.push({
      id: item.id,
      kind: categoryToKind(item.category),
      label: item.label,
      detail: version.name,
      date: start < now ? now : start,
      endDate: end,
      primogems: item.primogems,
      intertwinedFates: item.intertwinedFates,
      adjustable: item.completionAdjustable,
      versionId: item.versionId,
    })
  }

  // -- Admin calendar events -------------------------------------------
  for (const ev of input.calendarEvents) {
    if (!ev.income) continue
    if (ev.publishState !== 'published') continue
    const primos = (ev.income.primogems ?? 0)
    const fates = ev.income.intertwinedFates ?? 0
    if (primos === 0 && fates === 0) continue
    if ((ev.endDate ?? ev.date) < now || ev.date > horizon) continue
    out.push({
      id: ev.id,
      kind: 'misc',
      label: ev.label,
      date: ev.date < now ? now : ev.date,
      endDate: ev.endDate,
      primogems: primos,
      intertwinedFates: fates,
      adjustable: ev.completionAdjustable ?? false,
      versionId: ev.versionId,
    })
  }

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

function categoryToKind(c: VersionIncomeItem['category']): IncomeKind {
  switch (c) {
    case 'events': return 'events'
    case 'quests': return 'quests'
    case 'exploration': return 'exploration'
    case 'maintenance-codes': return 'maintenance-codes'
    case 'gift': return 'gift'
    default: return 'misc'
  }
}

/* ------------------------------------------------------------------ */
/* Curve construction                                                  */
/* ------------------------------------------------------------------ */

interface Accrual {
  primosLow: number
  primosExpected: number
  primosHigh: number
  fates: number
}

export function buildForecast(input: ForecastInput): ForecastCurve {
  const now = input.now || today()
  const ownedFates = Math.max(0, Math.floor(input.ownedFates))
  const ownedPrimos = Math.max(0, Math.floor(input.ownedPrimogems))
  const startBalance = ownedFates + Math.floor(ownedPrimos / PRIMOS_PER_WISH)

  if (input.ignoreFutureIncome) {
    return flatCurve(startBalance, now)
  }

  const raw = collectRawIncome({ ...input, now })
  const daily = new Map<string, Accrual>()
  const points: ForecastPoint[] = []

  for (const item of raw) {
    const completion = item.adjustable ? completionFor(input.profile, item.kind) : 1
    const primosExpected = item.primogems * completion
    const primosLow = item.adjustable ? primosExpected * UNCERTAINTY.low : primosExpected
    const primosHigh = item.adjustable ? primosExpected * UNCERTAINTY.high : primosExpected

    const from = item.date
    const to = item.endDate && item.endDate > item.date ? item.endDate : item.date
    const days = Math.max(1, daysBetween(from, to) + 1)

    for (let i = 0; i < days; i++) {
      const key = addDays(from, i)
      const acc = daily.get(key) ?? { primosLow: 0, primosExpected: 0, primosHigh: 0, fates: 0 }
      acc.primosLow += primosLow / days
      acc.primosExpected += primosExpected / days
      acc.primosHigh += primosHigh / days
      acc.fates += item.intertwinedFates / days
      daily.set(key, acc)
    }

    points.push({
      id: item.id,
      date: from,
      endDate: item.endDate,
      kind: item.kind,
      label: item.label,
      detail: item.detail,
      versionId: item.versionId,
      amount: toWishes(primosExpected, item.intertwinedFates),
      low: toWishes(primosLow, item.intertwinedFates),
      high: toWishes(primosHigh, item.intertwinedFates),
    })
  }

  // Cumulative index for O(log n) lookups.
  const dates = [...daily.keys()].sort()
  const cumPrimosLow: number[] = []
  const cumPrimosExp: number[] = []
  const cumPrimosHigh: number[] = []
  const cumFates: number[] = []
  let pl = 0, pe = 0, ph = 0, f = 0
  for (const d of dates) {
    const a = daily.get(d)!
    pl += a.primosLow; pe += a.primosExpected; ph += a.primosHigh; f += a.fates
    cumPrimosLow.push(pl); cumPrimosExp.push(pe); cumPrimosHigh.push(ph); cumFates.push(f)
  }

  const indexFor = (date: string): number => {
    // Rightmost index whose date <= `date`.
    let lo = 0
    let hi = dates.length - 1
    let ans = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (dates[mid] <= date) { ans = mid; lo = mid + 1 } else { hi = mid - 1 }
    }
    return ans
  }

  const balanceOf = (date: string, primos: number[], multiplier = 1) => {
    if (date < now) return startBalance
    const i = indexFor(date)
    if (i < 0) return startBalance
    const gainedPrimos = primos[i] * multiplier
    const gainedFates = cumFates[i]
    return Math.floor(ownedFates + gainedFates + (ownedPrimos + gainedPrimos) / PRIMOS_PER_WISH)
  }

  const balanceAt = (date: string) => balanceOf(date, cumPrimosExp)

  return {
    start: startBalance,
    points: points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    balanceAt,
    balanceRangeAt: (date: string) => ({
      low: balanceOf(date, cumPrimosLow),
      expected: balanceAt(date),
      high: balanceOf(date, cumPrimosHigh),
    }),
    dateWhenBalanceReaches: (amount: number) => {
      if (startBalance >= amount) return now
      for (let i = 0; i < dates.length; i++) {
        if (balanceAt(dates[i]) >= amount) return dates[i]
      }
      return undefined
    },
  }
}

function flatCurve(start: number, now: string): ForecastCurve {
  return {
    start,
    points: [],
    balanceAt: () => start,
    balanceRangeAt: () => ({ low: start, expected: start, high: start }),
    dateWhenBalanceReaches: (amount: number) => (start >= amount ? now : undefined),
  }
}

export function toWishes(primogems: number, fates = 0): number {
  return fates + primogems / PRIMOS_PER_WISH
}

/** Which edge of the uncertainty band a planning mode is allowed to rely on. */
export function balanceForMode(
  curve: ForecastCurve,
  date: string,
  mode: PlanningMode,
): number {
  const r = curve.balanceRangeAt(date)
  if (mode === 'safe') return r.low
  if (mode === 'risky') return r.high
  return r.expected
}

/** Expected wishes obtainable across a whole version, for the live-version card. */
export function versionIncomeSummary(
  curve: ForecastCurve,
  version: GameVersion,
  now = toKey(new Date()),
): { earned: number; remaining: number; total: number } {
  const startRef = version.startDate < now ? version.startDate : now
  const atStart = curve.balanceAt(startRef)
  const atEnd = curve.balanceAt(version.endDate)
  const atNow = curve.balanceAt(now)
  const total = Math.max(0, atEnd - atStart)
  const remaining = Math.max(0, atEnd - atNow)
  return { earned: Math.max(0, total - remaining), remaining, total }
}

function clamp01(n: number): number {
  return clamp(n, 0, 1)
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))
}
