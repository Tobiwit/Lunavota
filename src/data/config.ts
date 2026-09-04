import type { UserIncomeProfile } from '@/types'

/**
 * Recurring and baseline income constants.
 *
 * These are planning estimates, not game documentation. Every value is editable
 * from the admin CMS so a wrong assumption can be corrected without a release.
 */
export interface RecurringIncomeConfig {
  dailyCommissionPrimos: number
  welkinPrimosPerDay: number
  battlePass: {
    paid: { primogems: number; intertwinedFates: number }
    free: { primogems: number; intertwinedFates: number }
    /** BP cycles roughly track version length. */
    durationDays: number
  }
  spiralAbyss: { fullClearPrimos: number; resetDays: number[] }
  imaginariumTheater: { fullClearPrimos: number; resetDays: number[] }
  stygianOnslaught: { fullClearPrimos: number; resetDays: number[] }
  /** Intertwined Fates buyable each month with Masterless Starglitter. */
  starglitterFatesPerMonth: number
}

export const DEFAULT_RECURRING: RecurringIncomeConfig = {
  dailyCommissionPrimos: 60,
  welkinPrimosPerDay: 90,
  battlePass: {
    paid: { primogems: 680, intertwinedFates: 4 },
    free: { primogems: 0, intertwinedFates: 0 },
    durationDays: 42,
  },
  spiralAbyss: { fullClearPrimos: 600, resetDays: [1, 16] },
  imaginariumTheater: { fullClearPrimos: 800, resetDays: [1] },
  stygianOnslaught: { fullClearPrimos: 450, resetDays: [1] },
  starglitterFatesPerMonth: 5,
}

/**
 * The 25-wish content baseline for an ordinary version.
 *
 * Deliberately excludes dailies, Welkin, Battle Pass, endgame modes, shop resets
 * and celebration gifts - those are modelled separately on the timeline so they
 * are never double-counted.
 */
export const VERSION_BASELINE = {
  events: 1900,
  quests: 650,
  exploration: 450,
  'maintenance-codes': 900,
  misc: 100,
} as const

export const BASELINE_TOTAL_PRIMOS = 4000

/** Days after version start when each baseline category is expected to land. */
export const BASELINE_SCHEDULE: Record<keyof typeof VERSION_BASELINE, { offset: number; spreadDays: number }> = {
  'maintenance-codes': { offset: 0, spreadDays: 0 },
  quests: { offset: 1, spreadDays: 4 },
  events: { offset: 7, spreadDays: 28 },
  exploration: { offset: 0, spreadDays: 42 },
  misc: { offset: 14, spreadDays: 14 },
}

export const DEFAULT_INCOME_PROFILE: UserIncomeProfile = {
  dailyCommissions: true,
  welkin: { active: false },
  battlePass: 'none',
  generalCompletionRate: 0.8,
  categoryCompletionOverrides: {},
  endgame: {
    spiralAbyssFloor: 12,
    imaginariumAct: 8,
    stygianCompletion: 0.8,
  },
  starglitterShop: true,
}

/** How far ahead the forecast is computed. */
export const FORECAST_HORIZON_DAYS = 420

/**
 * Uncertainty band applied to completion-adjustable income.
 * Safe mode plans on `low`, Balanced on the expected value, Risky on `high`.
 */
export const UNCERTAINTY = { low: 0.82, high: 1.12 }
