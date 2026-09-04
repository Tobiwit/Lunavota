import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  BannerPrediction,
  CalendarEvent,
  Character,
  CharacterArtwork,
  GameVersion,
  Priority,
  UserIncomeProfile,
  UserWishState,
  VersionActual,
  VersionIncomeItem,
  WishHistoryEntry,
  WishTarget,
} from '@/types'
import { indexedDbAdapter } from './persistence'
import { DEFAULT_INCOME_PROFILE, DEFAULT_RECURRING, type RecurringIncomeConfig } from '@/data/config'
import { buildSeedCharacters, makePlaceholder } from '@/data/seedCharacters'
import {
  buildSeedIncome,
  buildSeedVersions,
  recomputeVersionStatuses,
  seedNameForNumber,
} from '@/data/seedVersions'
import { buildSeedPredictions } from '@/data/seedPredictions'
import { today } from '@/lib/date'
import { addWishes, spendWishes } from '@/engine/simulation'

export const SCHEMA_VERSION = 2

const DEFAULT_USER: UserWishState = {
  intertwinedFates: 0,
  primogems: 0,
  genesisCrystals: 0,
  characterPity: 0,
  characterGuaranteed: false,
  capturingRadianceState: 0,
  planningMode: 'safe',
  ignoreFutureIncome: false,
}

function seedCatalog() {
  const versions = buildSeedVersions()
  return {
    characters: buildSeedCharacters(),
    versions,
    incomeItems: buildSeedIncome(versions),
    calendarEvents: [] as CalendarEvent[],
    predictions: buildSeedPredictions(versions, today()),
    recurring: DEFAULT_RECURRING,
  }
}

export interface AppState {
  schemaVersion: number
  onboarded: boolean

  // ---- user ----------------------------------------------------------
  user: UserWishState
  profile: UserIncomeProfile
  targets: WishTarget[]
  history: WishHistoryEntry[]
  versionActuals: VersionActual[]

  // ---- catalog (admin-owned) -----------------------------------------
  characters: Character[]
  versions: GameVersion[]
  incomeItems: VersionIncomeItem[]
  calendarEvents: CalendarEvent[]
  predictions: BannerPrediction[]
  recurring: RecurringIncomeConfig

  /** Fingerprint of the predictions the user has already been shown. */
  seenForecastHash: string

  // ---- actions -------------------------------------------------------
  completeOnboarding(patch: Partial<UserWishState>): void
  setUser(patch: Partial<UserWishState>): void
  setProfile(patch: Partial<UserIncomeProfile>): void
  addResources(add: { intertwinedFates?: number; primogems?: number; genesisCrystals?: number }): void
  spend(wishes: number): void

  addTarget(characterId: string, priority: Priority, patch?: Partial<WishTarget>): string
  updateTarget(id: string, patch: Partial<WishTarget>): void
  removeTarget(id: string): void
  reorderTarget(id: string, direction: -1 | 1): void
  markAcquired(id: string): void

  addHistoryEntry(entry: Omit<WishHistoryEntry, 'id'>): void
  removeHistoryEntry(id: string): void

  // ---- admin ---------------------------------------------------------
  upsertVersion(version: GameVersion): void
  removeVersion(id: string): void
  upsertIncomeItem(item: VersionIncomeItem): void
  removeIncomeItem(id: string): void
  upsertCalendarEvent(event: CalendarEvent): void
  removeCalendarEvent(id: string): void
  upsertPrediction(prediction: BannerPrediction): void
  removePrediction(id: string): void
  upsertCharacter(character: Character): void
  setCharacterArtwork(characterId: string, slot: keyof Character['assets'], artwork: CharacterArtwork | undefined): void
  setRecurring(patch: Partial<RecurringIncomeConfig>): void
  publishAll(): void

  setSeenForecastHash(hash: string): void
  importSnapshot(data: unknown): { ok: true } | { ok: false; error: string }
  resetEverything(): void
  resetCatalog(): void
}

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function replaceById<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const next = list.slice()
  next[i] = item
  return next
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      schemaVersion: SCHEMA_VERSION,
      onboarded: false,
      user: DEFAULT_USER,
      profile: DEFAULT_INCOME_PROFILE,
      targets: [],
      history: [],
      versionActuals: [],
      ...seedCatalog(),
      seenForecastHash: '',

      completeOnboarding: (patch) =>
        set((s) => ({ onboarded: true, user: { ...s.user, ...patch } })),

      setUser: (patch) => set((s) => ({ user: { ...s.user, ...patch } })),

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      addResources: (add) => set((s) => ({ user: addWishes(s.user, add) })),

      spend: (wishes) => set((s) => ({ user: spendWishes(s.user, wishes) })),

      addTarget: (characterId, priority, patch) => {
        const id = uid('target')
        const existingInBand = get().targets.filter((t) => t.priority === priority).length
        const target: WishTarget = {
          id,
          characterId,
          priority,
          constellationTarget: 0,
          signatureWeapon: false,
          bannerVersionOverride: null,
          bannerPhaseOverride: null,
          reasons: [],
          acquired: false,
          archived: false,
          order: existingInBand,
          createdAt: new Date().toISOString(),
          ...patch,
        }
        set((s) => ({ targets: [...s.targets, target] }))
        return id
      },

      updateTarget: (id, patch) =>
        set((s) => ({ targets: s.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      removeTarget: (id) => set((s) => ({ targets: s.targets.filter((t) => t.id !== id) })),

      reorderTarget: (id, direction) =>
        set((s) => {
          const target = s.targets.find((t) => t.id === id)
          if (!target) return {}
          const band = s.targets
            .filter((t) => t.priority === target.priority && !t.acquired && !t.archived)
            .sort((a, b) => a.order - b.order)
          const index = band.findIndex((t) => t.id === id)
          const swapWith = band[index + direction]
          if (!swapWith) return {}
          return {
            targets: s.targets.map((t) => {
              if (t.id === target.id) return { ...t, order: swapWith.order }
              if (t.id === swapWith.id) return { ...t, order: target.order }
              return t
            }),
          }
        }),

      markAcquired: (id) =>
        set((s) => ({
          targets: s.targets.map((t) =>
            t.id === id ? { ...t, acquired: true, acquiredAt: new Date().toISOString() } : t,
          ),
        })),

      addHistoryEntry: (entry) =>
        set((s) => ({ history: [{ ...entry, id: uid('wish') }, ...s.history] })),

      removeHistoryEntry: (id) => set((s) => ({ history: s.history.filter((h) => h.id !== id) })),

      // ---- admin -------------------------------------------------------
      upsertVersion: (version) =>
        set((s) => ({ versions: recomputeVersionStatuses(replaceById(s.versions, version)) })),

      removeVersion: (id) =>
        set((s) => ({
          versions: s.versions.filter((v) => v.id !== id),
          incomeItems: s.incomeItems.filter((i) => i.versionId !== id),
          predictions: s.predictions.filter((p) => p.versionId !== id),
          calendarEvents: s.calendarEvents.filter((e) => e.versionId !== id),
        })),

      upsertIncomeItem: (item) => set((s) => ({ incomeItems: replaceById(s.incomeItems, item) })),
      removeIncomeItem: (id) => set((s) => ({ incomeItems: s.incomeItems.filter((i) => i.id !== id) })),

      upsertCalendarEvent: (event) => set((s) => ({ calendarEvents: replaceById(s.calendarEvents, event) })),
      removeCalendarEvent: (id) => set((s) => ({ calendarEvents: s.calendarEvents.filter((e) => e.id !== id) })),

      upsertPrediction: (prediction) => set((s) => ({ predictions: replaceById(s.predictions, prediction) })),
      removePrediction: (id) => set((s) => ({ predictions: s.predictions.filter((p) => p.id !== id) })),

      upsertCharacter: (character) => set((s) => ({ characters: replaceById(s.characters, character) })),

      setCharacterArtwork: (characterId, slot, artwork) =>
        set((s) => ({
          characters: s.characters.map((c) => {
            if (c.id !== characterId) return c
            const assets = { ...c.assets }
            if (slot === 'placeholder') {
              assets.placeholder = artwork ?? makePlaceholder(characterId)
            } else if (artwork) {
              assets[slot] = artwork
            } else {
              delete assets[slot]
            }
            return { ...c, assets, updatedAt: new Date().toISOString() }
          }),
        })),

      setRecurring: (patch) => set((s) => ({ recurring: { ...s.recurring, ...patch } })),

      publishAll: () =>
        set((s) => ({
          versions: s.versions.map((v) => (v.publishState === 'draft' ? { ...v, publishState: 'published' } : v)),
          predictions: s.predictions.map((p) =>
            p.publishState === 'draft' ? { ...p, publishState: 'published' } : p,
          ),
          calendarEvents: s.calendarEvents.map((e) =>
            e.publishState === 'draft' ? { ...e, publishState: 'published' } : e,
          ),
        })),

      setSeenForecastHash: (hash) => set({ seenForecastHash: hash }),

      importSnapshot: (data) => {
        if (typeof data !== 'object' || data === null) return { ok: false, error: 'That file is not a Lunavota backup.' }
        const d = data as Partial<AppState> & { schemaVersion?: number }
        if (!d.user || !Array.isArray(d.targets)) {
          return { ok: false, error: 'The backup is missing its wish state.' }
        }
        if ((d.schemaVersion ?? 0) > SCHEMA_VERSION) {
          return { ok: false, error: 'This backup was made by a newer version of Lunavota.' }
        }
        const seeded = seedCatalog()
        set({
          schemaVersion: SCHEMA_VERSION,
          onboarded: d.onboarded ?? true,
          user: { ...DEFAULT_USER, ...d.user },
          profile: { ...DEFAULT_INCOME_PROFILE, ...(d.profile ?? {}) },
          targets: d.targets,
          history: d.history ?? [],
          versionActuals: d.versionActuals ?? [],
          characters: d.characters?.length ? d.characters : seeded.characters,
          versions: recomputeVersionStatuses(d.versions?.length ? d.versions : seeded.versions),
          incomeItems: d.incomeItems?.length ? d.incomeItems : seeded.incomeItems,
          calendarEvents: d.calendarEvents ?? [],
          predictions: d.predictions?.length ? d.predictions : seeded.predictions,
          recurring: { ...DEFAULT_RECURRING, ...(d.recurring ?? {}) },
        })
        return { ok: true }
      },

      resetEverything: () =>
        set({
          onboarded: false,
          user: DEFAULT_USER,
          profile: DEFAULT_INCOME_PROFILE,
          targets: [],
          history: [],
          versionActuals: [],
          seenForecastHash: '',
          ...seedCatalog(),
        }),

      resetCatalog: () => set({ ...seedCatalog() }),
    }),
    {
      name: 'lunavota-state',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => indexedDbAdapter),
      migrate: (persisted, fromVersion) => {
        const state = persisted as Partial<AppState> | undefined
        // v2: 7.x is the Snezhnaya era, not a continuation of Luna. Only rows
        // still carrying the old seeded name are corrected — anything an admin
        // renamed is theirs to keep.
        if (fromVersion < 2 && state?.versions) {
          state.versions = state.versions.map((v) => {
            const seeded = seedNameForNumber(v.number)
            if (!seeded || seeded === v.name) return v
            if (!v.name.startsWith('Luna ') || seeded.startsWith('Luna ')) return v
            return { ...v, name: seeded }
          })
        }
        return state as AppState
      },
      onRehydrateStorage: () => (state) => {
        // Version status is a function of today's date, never of stored data.
        if (state) state.versions = recomputeVersionStatuses(state.versions)
      },
    },
  ),
)

/** Everything the JSON backup contains. Derived state is deliberately excluded. */
export function exportSnapshot(): string {
  const s = useStore.getState()
  return JSON.stringify(
    {
      app: 'lunavota',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      onboarded: s.onboarded,
      user: s.user,
      profile: s.profile,
      targets: s.targets,
      history: s.history,
      versionActuals: s.versionActuals,
      characters: s.characters,
      versions: s.versions,
      incomeItems: s.incomeItems,
      calendarEvents: s.calendarEvents,
      predictions: s.predictions,
      recurring: s.recurring,
    },
    null,
    2,
  )
}
