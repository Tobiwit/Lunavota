import type { Budget, ForecastCurve, ForecastPoint, GameVersion, IncomeKind, TargetPlan } from '@/types'
import { addDays, daysBetween, today } from '@/lib/date'
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
  | 'live-version'
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
  /** Wishes still expected during this node's span, for version headers. */
  versionIncome?: number
  /** Live version only: how far through it today is. */
  dayOfVersion?: number
  versionLength?: number
}

const KIND_SORT: Record<TimelineNodeKind, number> = {
  today: 0, 'live-version': 1, version: 2, phase: 3, banner: 4, group: 5, reward: 6,
}

/**
 * Income that belongs to a version's own content.
 *
 * None of it is a moment the player acts on - dailies, quests, events, codes and
 * exploration simply accrue while the version runs. Listing each one as its own
 * node buries the things that *are* decisions, so it all folds into the version
 * header and opens on tap.
 */
const VERSION_CONTENT: IncomeKind[] = [
  'dailies', 'welkin', 'battle-pass', 'events', 'quests',
  'exploration', 'maintenance-codes', 'misc',
]

/**
 * Everything else keeps its own node: recurring resets and one-off gifts are
 * dated events you plan around, not background accrual.
 */
function isVersionContent(kind: IncomeKind): boolean {
  return VERSION_CONTENT.includes(kind)
}

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

  const content = curve.points.filter((p) => isVersionContent(p.kind))
  const standalone = curve.points.filter((p) => !isVersionContent(p.kind))

  // -- Level 1: versions ------------------------------------------------
  for (const v of visibleVersions) {
    // The version already running is the one thing on this screen that is not
    // in the future. Its header would otherwise sit at its own start date,
    // behind the "show earlier events" fold, taking the answer to "what is
    // left in this patch?" with it. So it is pinned to today instead.
    const isLive = v.startDate <= now && v.endDate >= now
    if (!isLive && !inRange(v.startDate)) continue

    // A live version measures from the balance TODAY shows, not from
    // balanceAt(now) — the latter already includes today's own accrual, which
    // would leave the card's "+N still to come" one short of its own total.
    const baseline = isLive ? curve.start : curve.balanceAt(v.startDate < now ? now : v.startDate)
    const income = Math.max(0, curve.balanceAt(v.endDate) - baseline)

    // Fold the version's own content into its header, prorated to the part of
    // the version that is still ahead.
    const from = v.startDate < now ? now : v.startDate
    const to = v.endDate > horizon ? horizon : v.endDate
    // Prorated copies, so the listed figures sum to the header total.
    const breakdown =
      to < from
        ? []
        : contentWithin(content, from, to).map((p) => ({
            ...p,
            amount: prorate(p, from, to),
            low: prorate({ ...p, amount: p.low }, from, to),
            high: prorate({ ...p, amount: p.high }, from, to),
            date: p.date < from ? from : p.date,
            endDate: p.endDate ? (p.endDate > to ? to : p.endDate) : undefined,
          }))

    push({
      id: `version-${v.id}`,
      kind: isLive ? 'live-version' : 'version',
      date: isLive ? now : v.startDate,
      endDate: v.endDate,
      title: v.name,
      subtitle: v.number,
      // TODAY already carries the balance immediately above a live version.
      showBalance: !isLive,
      balance: baseline,
      versionId: v.id,
      version: v,
      versionIncome: income,
      amount: breakdown.reduce((sum, p) => sum + p.amount, 0),
      breakdown,
      dayOfVersion: isLive ? daysBetween(v.startDate, now) + 1 : undefined,
      versionLength: isLive ? daysBetween(v.startDate, v.endDate) + 1 : undefined,
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

  // -- Level 4: standalone rewards ---------------------------------------
  // One node each. These are the resets a player actually plans around, so
  // collapsing four of them into "Spiral Abyss +3 more" hides the useful part -
  // and with version content folded away there is room for them.
  for (const p of standalone) {
    if (!inRange(p.date)) continue
    if (p.amount < 0.5) continue
    push({
      id: `reward-${p.id}`,
      kind: 'reward',
      date: p.date,
      title: p.label,
      subtitle: p.detail,
      amount: p.amount,
      showBalance: false,
      incomeKind: p.kind,
      versionId: p.versionId,
      breakdown: [p],
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

/** Version-content points overlapping a window, ordered by date. */
function contentWithin(points: ForecastPoint[], from: string, to: string): ForecastPoint[] {
  return points
    .filter((p) => (p.endDate ?? p.date) >= from && p.date <= to)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
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

export function isVersionHeader(node: TimelineNode): boolean {
  return node.kind === 'version' || node.kind === 'live-version'
}

export function filterTimeline(nodes: TimelineNode[], filter: TimelineFilter): TimelineNode[] {
  if (filter === 'all') return nodes
  return nodes.filter((n) => {
    if (n.kind === 'today') return true
    switch (filter) {
      case 'characters':
        return isVersionHeader(n) || n.kind === 'banner' || n.kind === 'phase'
      case 'rewards':
        return isVersionHeader(n) || n.kind === 'reward' || n.kind === 'group'
      case 'versions':
        return isVersionHeader(n) || n.kind === 'phase'
    }
  })
}

/** Targets with no credible banner placement live below the timeline. */
export function beyondHorizon(budget: Budget): TargetPlan[] {
  return budget.plans.filter((p) => !p.prediction?.date)
}
