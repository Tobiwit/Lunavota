/**
 * Lunavota domain model.
 *
 * Three data families are kept deliberately separate:
 *   1. Catalog  - shared game knowledge (characters, versions, predictions, income).
 *                 Owned by the admin CMS, never written by normal use.
 *   2. User     - this player's resources, wishlist, profile, history.
 *   3. Derived  - everything the engines compute. Never persisted.
 */

/* ------------------------------------------------------------------ */
/* Characters & artwork                                                */
/* ------------------------------------------------------------------ */

export type ReleaseStatus = 'released' | 'official-unreleased' | 'leaked' | 'speculative'

export type Element =
  | 'anemo' | 'geo' | 'electro' | 'dendro' | 'hydro' | 'pyro' | 'cryo' | 'unknown'

export type ArtworkStatus =
  | 'official' | 'official-promo' | 'admin-approved' | 'leaked' | 'placeholder'

export type ArtworkSourceType =
  | 'hoyoverse' | 'enka' | 'hakush' | 'project-amber'
  | 'admin-upload' | 'manual-url' | 'generated-placeholder'

export interface CharacterArtwork {
  id: string
  characterId: string
  status: ArtworkStatus
  sourceType: ArtworkSourceType
  sourceUrl?: string
  assetKey?: string
  /** Stable app-owned URL. Never a third-party CDN at runtime. */
  localUrl: string
  /** Key into the local blob store when the asset is cached in IndexedDB. */
  blobKey?: string
  transparentBackground: boolean
  width?: number
  height?: number
  addedAt: string
  updatedAt: string
  approved: boolean
}

/** Layered, in priority order. Only `placeholder` is guaranteed to exist. */
export interface CharacterAssets {
  officialGacha?: CharacterArtwork
  officialPromo?: CharacterArtwork
  adminApproved?: CharacterArtwork
  leaked?: CharacterArtwork
  placeholder: CharacterArtwork
}

export interface Character {
  id: string
  /** Present once the character has a real in-game id; absent for `temp:` entries. */
  gameCharacterId?: number
  internalName?: string
  displayName: string
  aliases?: string[]
  releaseStatus: ReleaseStatus
  element?: Element
  rarity?: number
  weaponType?: string
  region?: string
  signatureWeaponName?: string
  assets: CharacterAssets
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* Versions, banners, calendar                                         */
/* ------------------------------------------------------------------ */

export type VersionStatus = 'upcoming' | 'live' | 'past'
export type PublishState = 'draft' | 'published' | 'archived'

export interface GameVersion {
  id: string
  /** Era name, e.g. "Luna IX". */
  name: string
  /** Numeric version, e.g. "6.8". */
  number: string
  startDate: string
  phase2Date: string
  endDate: string
  status: VersionStatus
  publishState: PublishState
  notes?: string
}

export type BannerPhase = 1 | 2 | 'unknown'

export type PredictionSource = 'official' | 'reliable-leak' | 'speculation' | 'user'

export interface BannerPrediction {
  id: string
  characterId: string
  versionId: string
  phase: BannerPhase
  /** 0..1 */
  probability: number
  sourceType: PredictionSource
  sourceLabel?: string
  sourceUrl?: string
  lastUpdated: string
  notes?: string
  publishState: PublishState
}

export type VersionIncomeCategory =
  | 'events' | 'quests' | 'exploration' | 'maintenance-codes' | 'misc' | 'gift'

export interface VersionIncomeItem {
  id: string
  versionId: string
  category: VersionIncomeCategory
  label: string
  primogems: number
  intertwinedFates: number
  /** When the reward becomes claimable. Omitted = spread across the version. */
  availableDate?: string
  endDate?: string
  /** Fixed compensation counts fully; content rewards scale with completion. */
  completionAdjustable: boolean
  guaranteed: boolean
  /** `gift` items sit on top of the 25-wish content baseline. */
  baselineIncluded: boolean
  notes?: string
}

export type CalendarEventType =
  | 'version-start' | 'phase-change' | 'banner' | 'spiral-abyss'
  | 'imaginarium-theater' | 'stygian-onslaught' | 'event' | 'shop-reset'
  | 'reward' | 'custom'

export interface RewardValue {
  primogems?: number
  intertwinedFates?: number
  acquaintedFates?: number
}

export interface CalendarEvent {
  id: string
  versionId?: string
  type: CalendarEventType
  date: string
  endDate?: string
  label: string
  income?: RewardValue
  completionAdjustable?: boolean
  notes?: string
  publishState: PublishState
}

/* ------------------------------------------------------------------ */
/* User state                                                          */
/* ------------------------------------------------------------------ */

export type PlanningMode = 'safe' | 'balanced' | 'risky'

export interface UserWishState {
  intertwinedFates: number
  primogems: number
  genesisCrystals: number
  characterPity: number
  characterGuaranteed: boolean
  /** Consecutive lost 50/50s feeding the Capturing Radiance estimate. */
  capturingRadianceState: number
  planningMode: PlanningMode
  /** Strict planning: never let projected income fund a target. */
  ignoreFutureIncome: boolean
}

export type Priority = 'must' | 'want' | 'interested' | 'luxury'

export type PullRuleKind =
  | 'get-c0'
  | 'until-first-5star'
  | 'stop-if-5050-lost'
  | 'stop-after-x'
  | 'keep-x-remaining'
  | 'skip-if-must-within'
  | 'only-if-funded'
  | 'custom'

export interface PullRule {
  kind: PullRuleKind
  /** Meaning depends on `kind`: wishes to spend, wishes to keep, versions ahead. */
  value?: number
  custom?: string
}

export type BannerConfidence = 'official' | 'expected' | 'unknown'

export interface WishTarget {
  id: string
  characterId: string
  priority: Priority
  constellationTarget: number
  signatureWeapon: boolean
  /** User override of the community forecast. `null` = use community forecast. */
  bannerVersionOverride?: string | null
  bannerPhaseOverride?: BannerPhase | null
  maxPulls?: number
  pullRule?: PullRule
  /** Manually pinned reservation; overrides the computed one. */
  lockedReservation?: number
  reasons: string[]
  notes?: string
  acquired: boolean
  acquiredAt?: string
  archived: boolean
  /** Manual ordering within a priority band. */
  order: number
  createdAt: string
}

export type BattlePassKind = 'none' | 'free' | 'paid'

export type CompletionCategory =
  | 'events' | 'exploration' | 'quests'
  | 'spiralAbyss' | 'imaginariumTheater' | 'stygianOnslaught'

export interface UserIncomeProfile {
  dailyCommissions: boolean
  welkin: { active: boolean; endDate?: string }
  battlePass: BattlePassKind
  /** 0..1 - applies to events, exploration, quests and misc content. */
  generalCompletionRate: number
  categoryCompletionOverrides: Partial<Record<CompletionCategory, number>>
  /** Endgame performance expressed the way the player understands it. */
  endgame: {
    spiralAbyssFloor: number
    imaginariumAct: number
    stygianCompletion: number
  }
  /** Monthly Intertwined Fates bought with Masterless Starglitter. */
  starglitterShop: boolean
}

export interface WishHistoryEntry {
  id: string
  date: string
  characterId?: string
  characterName: string
  pity: number
  wonFiftyFifty: boolean | null
  capturingRadiance: boolean
  rarity: 4 | 5
  notes?: string
}

/** Actual wishes earned in a version, used for forecast calibration. */
export interface VersionActual {
  versionId: string
  earnedWishes: number
  recordedAt: string
}

/* ------------------------------------------------------------------ */
/* Derived planning results (never persisted)                          */
/* ------------------------------------------------------------------ */

export type Affordability = 'guaranteed' | 'likely' | 'at-risk' | 'unfunded'

export interface TargetCost {
  /** Deterministic worst case. No probability assumptions whatsoever. */
  worstCase: number
  /** 75th-percentile estimate. */
  likely: number
  /** Median estimate. */
  median: number
  /** Mean number of wishes. */
  expected: number
  /** Cost at the certainty this target is planned to. */
  planned: number
}

export interface ResolvedPrediction {
  versionId: string
  versionName: string
  phase: BannerPhase
  /** 0..1 confidence in this particular placement. */
  confidence: number
  sourceType: PredictionSource
  date?: string
  endDate?: string
  alternatives: {
    versionId: string
    versionName: string
    phase: BannerPhase
    probability: number
    date?: string
  }[]
  isUserOverride: boolean
  earliest?: {
    versionId: string
    versionName: string
    phase: BannerPhase
    date: string
    probability: number
  }
}

export interface TargetPlan {
  target: WishTarget
  character: Character
  cost: TargetCost
  /** What the plan aims to set aside, after caps and any pinned reservation. */
  plannedCost: number
  /** The certainty this priority is planned to, under the active mode. 0..1. */
  targetConfidence: number
  /** Wishes this target locks out of today's pool. */
  reservedFromPool: number
  /** Wishes this target expects to draw from future income. */
  reservedFromIncome: number
  reserved: number
  /** Resources forecast to exist when the banner opens. */
  balanceAtBanner: number
  balanceAtBannerLow: number
  balanceAtBannerHigh: number
  /** Balance at the earliest credible appearance. */
  balanceAtEarliest: number
  balanceAtBannerEnd: number
  incomeDuringBanner: number
  status: Affordability
  shortfall: number
  /** Estimated date the target becomes fully funded, if within the horizon. */
  fundedDate?: string
  prediction?: ResolvedPrediction
  /** Chance of reaching the target with the wishes forecast to be available. */
  successChance: number
  skippedByRule?: string
}

export interface Budget {
  ownedWishes: number
  ownedFates: number
  ownedFromPrimos: number
  protectedWishes: number
  free: number
  plans: TargetPlan[]
  nextPlan?: TargetPlan
}

/* ------------------------------------------------------------------ */
/* Forecast                                                            */
/* ------------------------------------------------------------------ */

export type IncomeKind =
  | 'dailies' | 'welkin' | 'battle-pass' | 'spiral-abyss' | 'imaginarium-theater'
  | 'stygian-onslaught' | 'shop' | 'events' | 'quests' | 'exploration'
  | 'maintenance-codes' | 'misc' | 'gift'

export interface ForecastPoint {
  id: string
  date: string
  /** Wish-equivalent income granted on this date (expected value). */
  amount: number
  low: number
  high: number
  kind: IncomeKind
  label: string
  versionId?: string
  detail?: string
  /** Set for grouped nodes such as "Sep 5-18 - Daily activity". */
  endDate?: string
  count?: number
}

export interface ForecastCurve {
  start: number
  points: ForecastPoint[]
  balanceAt: (date: string) => number
  balanceRangeAt: (date: string) => { low: number; expected: number; high: number }
  /** First date on which the balance reaches `amount`, if within the horizon. */
  dateWhenBalanceReaches: (amount: number) => string | undefined
}
