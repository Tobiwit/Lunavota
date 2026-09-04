import type { Budget, ForecastCurve, ForecastPoint, GameVersion, IncomeKind, TargetPlan } from '@/types'
import { addDays, daysBetween, formatRange, today } from '@/lib/date'
import { FORECAST_HORIZON_DAYS } from '@/data/config'

/**
 * Builds the vertical Fate Timeline.
 *
 * The timeline is a resource trajectory, not a calendar. Every node exists
 * because it moves the running balance or because it is a moment the player
 * has to make a decision at.
 */

export type TimelineNodeKind =
  | 'today'
  | 'version'
  | 'phase'
  | 'banner'
  | 'reward'
  | 'group'

export type TimelineFilter = 'all' | 'characters' | 'rewards' | 'versions'

export interface TimelineNode {
  id: string
  kind: TimelineNodeKind
  date: string
  endDate?: string
  title: string
  subtitle?: string
  /** Wish-equivalent gained at this node. */
  amount?: number
  /** Running balance. Only rendered where `showBalance` is set. */
  balance: number
  showBalance: boolean
  past: boolean
  versionId?: string
  version?: GameVersion
  plan?: TargetPlan
  incomeKind?: IncomeKind
  /** Constituent income for the "why" breakdown. */
  breakdown?: ForecastPoint[]
  /** Versions expected during this node's span, for version headers. */
  versionIncome?: number
}

const KIND_SORT: Record<TimelineNodeKind, number> = {
  today: 0, version: 1, phase: 2, banner: 3, group: 4, reward: 5,
}

/** Income kinds that accrue continuously and would otherwise flood the timeline. */
const CONTINUOUS: IncomeKind[] = ['dailies', 'welkin', 'exploration']

export interface TimelineInput {
  now?: string
  versions: GameVersion[]
  curve: ForecastCurve
  budget: Budget
  horizonDays?: number
  /** How far back completed versions remain visible. */
  pastDays?: number
}

export function buildTimeline(input: TimelineInput): TimelineNode[] {
  const now = input.now ?? today()
  const horizon = addDays(now, input.horizonDays ?? FORECAST_HORIZON_DAYS)
  const past = addDays(now, -(input.pastDays ?? 120))
  const { curve, versions, budget } = input

  const nodes: TimelineNode[] = []
  const push = (n: Omit<TimelineNode, 'balance' | 'past'> & { balance?: number }) => {
    nodes.push({
      ...n,
      balance: n.balance ?? curve.balanceAt(n.date),
      past: n.date < now,
    })
  }

  const inRange = (d: string) => d >= past && d <= horizon
  const visibleVersions = versions.filter((v) => v.endDate >= past && v.startDate <= horizon)

  // -- Level 1: versions ------------------------------------------------
  for (const v of visibleVersions) {
    if (!inRange(v.startDate)) continue
    const income = Math.max(0, curve.balanceAt(v.endDate) - curve.balanceAt(v.startDate < now ? now : v.startDate))
    push({
      id: `version-${v.id}`,
      kind: 'version',
      date: v.startDate,
      endDate: v.endDate,
      title: v.name,
      subtitle: v.number,
      showBalance: true,
      versionId: v.id,
      version: v,
      versionIncome: income,
    })

    // -- Level 3: phase change -----------------------------------------
    if (inRange(v.phase2Date)) {
      push({
        id: `phase-${v.id}`,
        kind: 'phase',
        date: v.phase2Date,
        title: 'Phase 2',
        subtitle: v.name,
        showBalance: true,
        versionId: v.id,
        version: v,
      })
    }
  }

  // -- Level 2: character banners ---------------------------------------
  for (const plan of budget.plans) {
    const date = plan.prediction?.date
    if (!date || !inRange(date)) continue
    push({
      id: `banner-${plan.target.id}`,
      kind: 'banner',
      date,
      endDate: plan.prediction?.endDate,
      title: plan.character.displayName,
      showBalance: true,
      versionId: plan.prediction?.versionId,
      plan,
    })
  }

  // -- Level 4: rewards --------------------------------------------------
  const continuous = curve.points.filter((p) => CONTINUOUS.includes(p.kind))
  const discrete = curve.points.filter((p) => !CONTINUOUS.includes(p.kind))

  // Continuous income is grouped per version so the timeline reads as
  // "Sep 5-18 · Daily activity · +14" rather than fourteen identical nodes.
  for (const v of visibleVersions) {
    const from = v.startDate < now ? now : v.startDate
    if (from > horizon) continue
    const to = v.endDate > horizon ? horizon : v.endDate
    if (to < from) continue

    const overlapping = continuous.filter((p) => {
      const pStart = p.date
      const pEnd = p.endDate ?? p.date
      return pEnd >= from && pStart <= to
    })
    if (overlapping.length === 0) continue

    const amount = overlapping.reduce((sum, p) => sum + prorate(p, from, to), 0)
    if (amount < 0.5) continue

    push({
      id: `group-${v.id}-continuous`,
      kind: 'group',
      date: from,
      endDate: to,
      title: 'Daily activity',
      subtitle: formatRange(from, to),
      amount,
      showBalance: false,
      versionId: v.id,
      breakdown: overlapping,
    })
  }

  // Discrete rewards, merged when several land on the same day.
  const byDate = new Map<string, ForecastPoint[]>()
  for (const p of discrete) {
    if (!inRange(p.date)) continue
    const list = byDate.get(p.date) ?? []
    list.push(p)
    byDate.set(p.date, list)
  }

  for (const [date, list] of byDate) {
    const total = list.reduce((s, p) => s + p.amount, 0)
    if (total < 0.5) continue
    const primary = list.slice().sort((a, b) => b.amount - a.amount)[0]
    const title = list.length === 1 ? primary.label : `${primary.label} +${list.length - 1} more`
    push({
      id: `reward-${date}`,
      kind: 'reward',
      date,
      title,
      subtitle: list.length === 1 ? primary.detail : undefined,
      amount: total,
      showBalance: false,
      incomeKind: primary.kind,
      versionId: primary.versionId,
      breakdown: list,
    })
  }

  // -- The present -------------------------------------------------------
  push({
    id: 'today',
    kind: 'today',
    date: now,
    title: 'Today',
    showBalance: true,
    balance: curve.start,
  })

  return nodes.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return KIND_SORT[a.kind] - KIND_SORT[b.kind]
  })
}

function prorate(point: ForecastPoint, from: string, to: string): number {
  const pStart = point.date
  const pEnd = point.endDate ?? point.date
  const totalDays = Math.max(1, daysBetween(pStart, pEnd) + 1)
  const overlapStart = pStart > from ? pStart : from
  const overlapEnd = pEnd < to ? pEnd : to
  const overlapDays = Math.max(0, daysBetween(overlapStart, overlapEnd) + 1)
  return (point.amount * overlapDays) / totalDays
}

export function filterTimeline(nodes: TimelineNode[], filter: TimelineFilter): TimelineNode[] {
  if (filter === 'all') return nodes
  return nodes.filter((n) => {
    if (n.kind === 'today') return true
    switch (filter) {
      case 'characters': return n.kind === 'banner' || n.kind === 'version' || n.kind === 'phase'
      case 'rewards': return n.kind === 'reward' || n.kind === 'group' || n.kind === 'version'
      case 'versions': return n.kind === 'version' || n.kind === 'phase'
    }
  })
}

/** Targets with no credible banner placement live below the timeline. */
export function beyondHorizon(budget: Budget): TargetPlan[] {
  return budget.plans.filter((p) => !p.prediction?.date)
}
