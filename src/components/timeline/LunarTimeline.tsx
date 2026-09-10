import { useState } from 'react'
import clsx from 'clsx'
import type { TimelineNode } from '@/engine/timeline'
import { CharacterSplash } from '@/components/character/CharacterArt'
import { PriorityGlyph, PRIORITY_LABEL, priorityAccent } from '@/components/ui/PriorityGlyph'
import { AffordabilityBadge } from '@/components/ui/status'
import { formatDay, formatRange } from '@/lib/date'
import { formatChance } from '@/lib/format'

/**
 * One continuous Fate Thread runs down the page. Versions are celestial
 * anchors, character banners intersect the thread with a portrait, and small
 * reward events orbit just off it. The running balance travels down the side.
 *
 * The whole point: the player's future assembles itself as a constellation.
 */

const THREAD_X = 30

interface Props {
  nodes: TimelineNode[]
  onSelectNode?: (node: TimelineNode) => void
}

export function LunarTimeline({ nodes, onSelectNode }: Props) {
  return (
    <div className="relative" style={{ paddingLeft: 0 }}>
      {/* The thread itself */}
      <span
        aria-hidden
        className="absolute top-2 bottom-2 w-px"
        style={{
          left: THREAD_X,
          background:
            'linear-gradient(180deg, transparent, rgba(169,213,232,0.34) 6%, rgba(169,213,232,0.22) 60%, rgba(169,213,232,0.06) 92%, transparent)',
        }}
      />

      <ol className="relative space-y-0">
        {nodes.map((node, i) => (
          <li
            key={node.id}
            // No scroll-triggered reveal: a timeline this long must never depend
            // on an observer firing in order to become readable.
            className={clsx('rise relative', node.past && node.kind !== 'today' && 'opacity-45')}
            style={{ animationDelay: `${Math.min(i * 12, 260)}ms` }}
          >
            <NodeRow node={node} onSelect={onSelectNode} />
          </li>
        ))}
      </ol>
    </div>
  )
}

function NodeRow({ node, onSelect }: { node: TimelineNode; onSelect?: (n: TimelineNode) => void }) {
  switch (node.kind) {
    case 'today':
      return <TodayRow node={node} />
    case 'version':
      return <VersionRow node={node} />
    case 'live-version':
      return <LiveVersionRow node={node} />
    case 'phase':
      return <PhaseRow node={node} />
    case 'banner':
      return <BannerRow node={node} onSelect={onSelect} />
    case 'other-banner':
      return <OtherBannerRow node={node} />
    case 'group':
      return <GroupRow node={node} onSelect={onSelect} />
    default:
      return <RewardRow node={node} onSelect={onSelect} />
  }
}

/* ------------------------------------------------------------------ */

function TodayRow({ node }: { node: TimelineNode }) {
  return (
    <div className="relative py-5">
      {/* A luminous line crossing the thread: time passing through the plan. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-px"
        style={{
          background: 'linear-gradient(90deg, rgba(169,213,232,0.55), rgba(169,213,232,0.08) 70%, transparent)',
          boxShadow: '0 0 12px rgba(169,213,232,0.4)',
        }}
      />
      <div className="relative flex items-center justify-between">
        <span
          className="rounded-full border border-[rgba(169,213,232,0.45)] bg-[rgba(9,13,24,0.95)] px-3 py-1 font-display text-[11px] tracking-widest text-frost"
          style={{ marginLeft: THREAD_X - 22 }}
        >
          TODAY
        </span>
        <span className="rounded-full bg-[rgba(9,13,24,0.95)] pl-3 num text-[13px] text-moon">
          {Math.round(node.balance)} wishes
        </span>
      </div>
    </div>
  )
}

function VersionRow({ node }: { node: TimelineNode }) {
  const [open, setOpen] = useState(false)
  const v = node.version
  const breakdown = node.breakdown ?? []
  const content = node.amount ?? 0

  return (
    <div className="relative pb-4 pt-8">
      <Glyph kind="version" />
      <div className="pl-[62px]">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow mb-1">
              {v ? `${formatDay(v.startDate)} · ${v.number}` : formatDay(node.date)}
            </p>
            <h2 className="font-display text-[27px] leading-none text-moon">{node.title}</h2>
          </div>
          <Balance value={node.balance} />
        </div>

        {node.versionIncome != null && node.versionIncome > 0 && (
          <p className="mt-2.5 text-[12.5px] text-moon-dim">
            Expected during this version{' '}
            <span className="num text-moon-muted">+{Math.round(node.versionIncome)}</span> wishes
          </p>
        )}

        {/* The version's own content lives here rather than as a dozen nodes. */}
        <ContentBreakdown amount={content} breakdown={breakdown} open={open} onToggle={() => setOpen((o) => !o)} />
      </div>
    </div>
  )
}

/** Shared by both version headers: the folded-away content, on request. */
function ContentBreakdown({
  amount, breakdown, open, onToggle, label = 'from version content',
}: {
  amount: number
  breakdown: TimelineNode['breakdown']
  open: boolean
  onToggle: () => void
  label?: string
}) {
  if (amount < 0.5 || !breakdown || breakdown.length === 0) return null

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-frost/85 underline-offset-4 hover:underline"
      >
        <span className="num">+{Math.round(amount)}</span>
        {label}
        <span aria-hidden className={clsx('text-[10px] transition-transform', open && 'rotate-180')}>
          ▾
        </span>
      </button>

      {open && (
        <ul className="rise mt-2.5 space-y-1.5 border-l border-[var(--hairline)] pl-3">
          {breakdown.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0">
                <span className="block truncate text-moon-muted">{p.label}</span>
                <span className="block text-[10.5px] text-moon-faint">
                  {p.endDate && p.endDate !== p.date ? formatRange(p.date, p.endDate) : formatDay(p.date)}
                </span>
              </span>
              <span className="num shrink-0 text-moon-dim">+{p.amount.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The version already running.
 *
 * Structurally identical to any other version header - glyph, eyebrow, display
 * name, figure on the right. It is a version, not a card, and boxing it made it
 * read as a character banner. Only the light on the glyph and the progress
 * hairline mark it as the one happening now.
 */
function LiveVersionRow({ node }: { node: TimelineNode }) {
  const [open, setOpen] = useState(false)
  const v = node.version
  const day = node.dayOfVersion ?? 0
  const length = node.versionLength ?? 0
  const progress = length > 0 ? Math.min(100, (day / length) * 100) : 0

  // Derive the increment from the two rounded balances rather than rounding it
  // separately, or "147 now" + "+20 to come" lands on a displayed 168.
  const balanceNow = Math.round(node.balance)
  const balanceAtEnd = Math.round(node.balance + (node.versionIncome ?? 0))
  const remaining = Math.max(0, balanceAtEnd - balanceNow)

  return (
    <div className="relative pb-4 pt-8">
      <Glyph kind="version" live />
      <div className="pl-[62px]">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow mb-1">Now in progress · {node.subtitle}</p>
            <h2 className="font-display text-[27px] leading-none text-moon">{node.title}</h2>
          </div>
          <div className="shrink-0 text-right">
            <div className="num text-[21px] leading-none text-moon-muted">{balanceAtEnd}</div>
            <div className="eyebrow mt-1">by {v ? formatDay(v.endDate) : 'version end'}</div>
          </div>
        </div>

        {/* Progress as a hairline, at the weight every other divider uses. */}
        {length > 0 && (
          <div className="mt-3 h-px w-full bg-[rgba(169,213,232,0.13)]">
            <div
              className="h-px transition-[width] duration-700 ease-lunar"
              style={{
                width: `${progress}%`,
                background: 'var(--frost)',
                boxShadow: '0 0 8px var(--frost)',
              }}
            />
          </div>
        )}

        <p className="mt-2.5 text-[12.5px] text-moon-dim">
          Still to come <span className="num text-moon-muted">+{remaining}</span> wishes
          {length > 0 && (
            <>
              {' · '}
              <span className="num">day {day}</span> of {length}
            </>
          )}
        </p>

        <ContentBreakdown
          amount={node.amount ?? 0}
          breakdown={node.breakdown}
          open={open}
          onToggle={() => setOpen((o) => !o)}
          label="of it from version content"
        />
      </div>
    </div>
  )
}

function PhaseRow({ node }: { node: TimelineNode }) {
  return (
    <div className="relative py-3">
      <span
        aria-hidden
        className="absolute h-px w-5"
        style={{ left: THREAD_X - 10, top: '50%', background: 'rgba(169,213,232,0.45)' }}
      />
      <div className="flex items-center justify-between pl-[62px]">
        <p className="text-[12px] uppercase tracking-widest text-moon-muted">{node.title}</p>
        <span className="num text-[12px] text-moon-dim">{Math.round(node.balance)}</span>
      </div>
    </div>
  )
}

function BannerRow({ node, onSelect }: { node: TimelineNode; onSelect?: (n: TimelineNode) => void }) {
  const plan = node.plan
  if (!plan) return null
  const accent = priorityAccent(plan.target.priority)
  const uncertain = !plan.prediction || plan.prediction.confidence < 0.6

  return (
    <div className="relative py-3">
      {/* The waypoint on the thread. The portrait now lives inside the card, so
          this stays a mark: priority phase inside a probability ring. */}
      <span
        aria-hidden
        className="absolute z-10 flex items-center justify-center"
        style={{ left: THREAD_X - 17, top: 26, width: 34, height: 34 }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'rgba(9,13,24,0.96)',
            border: `1px solid ${accent}${uncertain ? '55' : 'aa'}`,
            boxShadow: uncertain ? 'none' : `0 0 16px -4px ${accent}`,
          }}
        />
        <PriorityGlyph priority={plan.target.priority} size={15} className="relative" />
        {/* How firmly they are anchored to this point in time. */}
        {plan.prediction && !plan.prediction.isUserOverride && (
          <svg className="absolute -inset-[5px] -rotate-90" viewBox="0 0 44 44" aria-hidden>
            <circle
              cx="22" cy="22" r="20"
              fill="none" stroke={accent} strokeOpacity="0.85" strokeWidth="1.4" strokeLinecap="round"
              strokeDasharray={`${plan.prediction.confidence * 125.6} 125.6`}
            />
          </svg>
        )}
      </span>

      {/* Padding on the wrapper, not a margin on a w-full child, or the card
          overflows the page by exactly the thread offset. */}
      <div style={{ paddingLeft: 62 }}>
      <button
        type="button"
        onClick={() => onSelect?.(node)}
        className="panel relative block w-full overflow-hidden px-4 py-3.5 text-left"
      >
        {/* The art owns the right edge; every figure stays clear of it. */}
        <CharacterSplash character={plan.character} className="-top-3 -right-2 bottom-0 w-[46%]" />

        <div className="relative pr-[38%]">
          <h3 className="truncate font-display text-[20px] leading-tight text-moon">
            {plan.character.displayName}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="inline-flex items-center gap-1.5">
              <PriorityGlyph priority={plan.target.priority} size={10} />
              <span className="text-[10.5px] uppercase tracking-wide2" style={{ color: accent }}>
                {PRIORITY_LABEL[plan.target.priority]}
              </span>
            </span>
            <span className="text-[11px] text-moon-dim">C{plan.target.constellationTarget}</span>
            <AffordabilityBadge status={plan.status} showLabel={false} />
          </div>

          {/* The odds lead: they are the answer, and the allocation explains it. */}
          <div className="mt-3.5 flex items-baseline gap-2">
            <span
              className="num text-[30px] leading-none"
              style={{ color: plan.successChance >= 0.9995 ? 'var(--success)' : 'var(--moon)' }}
            >
              {formatChance(plan.successChance)}
            </span>
            <span className="text-[12px] text-moon-dim">chance</span>
          </div>
          <p className="mt-1.5 text-[12px] text-moon-dim">
            {plan.plannedCost > 0 ? (
              <>
                <span className="num text-moon-muted">{plan.reserved - plan.reservedStretch}</span> of{' '}
                <span className="num text-moon-muted">{plan.plannedCost}</span> set aside
              </>
            ) : (
              <>Nothing held back</>
            )}
            {plan.reservedStretch > 0 && (
              <> · <span className="num text-moon-muted">+{plan.reservedStretch}</span> spare</>
            )}
          </p>

          <p className="mt-3 text-[12.5px] leading-relaxed text-moon-muted">
            {bannerSentence(plan)}
          </p>
        </div>
      </button>
      </div>
    </div>
  )
}

/**
 * A banner nobody here is pulling on.
 *
 * Half the height of a planned banner and a great deal quieter, because it
 * answers a smaller question: not "can I afford this" but "what else is
 * running". Everyone sharing a phase shares the row, so a busy patch costs one
 * line rather than three.
 *
 * The height is set rather than left to the content. Proportion is the whole
 * point of this row - it is how the eye sorts a decision from context before
 * reading a word - and content-sized cards would drift with every name length.
 *
 * Deliberately not a button. Every other card on this thread opens something,
 * and a row that looks tappable but is only context would teach the wrong
 * lesson about which of these are decisions.
 */
const OTHER_BANNER_HEIGHT = 104

function OtherBannerRow({ node }: { node: TimelineNode }) {
  const others = node.others ?? []
  if (others.length === 0) return null

  const names = others.map((o) => o.character.displayName).join(' · ')
  // Two characters take an edge each and meet in the middle; one keeps the
  // right, where every planned banner puts its art.
  const right = others[0]
  const left = others[1]

  return (
    <div className="relative py-1.5">
      <span aria-hidden className="absolute z-10" style={{ left: THREAD_X - 4.5, top: 54 }}>
        <svg width="9" height="9" viewBox="0 0 9 9">
          <circle cx="4.5" cy="4.5" r="3.4" fill="rgba(9,13,24,0.96)" />
          <circle
            cx="4.5" cy="4.5" r="3.4"
            fill="none" stroke="var(--moon-dim)" strokeOpacity="0.5" strokeWidth="0.9"
          />
        </svg>
      </span>

      <div style={{ paddingLeft: 62 }}>
        {/* No panel behind it. The art dissolves into the page rather than into
            a card, which is most of what separates this from a decision. */}
        <div className="relative" style={{ height: OTHER_BANNER_HEIGHT }}>
          {left && (
            <CharacterSplash
              character={left.character}
              side="left"
              fade={58}
              muted
              className="-top-2 bottom-0 left-0 w-[40%]"
            />
          )}
          <CharacterSplash
            character={right.character}
            side="right"
            fade={58}
            muted
            className="-top-2 bottom-0 right-0 w-[40%]"
          />

          {/* Centred, unlike every planned card on this thread. The asymmetry is
              doing work: it reads as a caption between two figures rather than
              as a row of figures you are meant to act on. */}
          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="max-w-full truncate text-[15px] leading-tight text-moon-dim">{names}</p>
            <p className="mt-1 text-[11px] leading-tight text-moon-faint">
              {node.endDate ? formatRange(node.date, node.endDate) : formatDay(node.date)}
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-moon-faint">
              Not on your list
              {/* One figure, and only when a single name owns it - two
                  characters sharing a row do not share a probability. */}
              {others.length === 1 && (
                <> · <span className="num">{formatChance(right.probability)}</span></>
              )}
              {others.length > 2 && (
                <> · <span className="num">+{others.length - 2}</span> more</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupRow({ node, onSelect }: { node: TimelineNode; onSelect?: (n: TimelineNode) => void }) {
  return (
    <div className="relative py-1.5">
      <span
        aria-hidden
        className="absolute w-[7px] rounded-full border border-dashed"
        style={{
          left: THREAD_X - 3.5,
          top: 12,
          bottom: 12,
          borderColor: 'rgba(169,213,232,0.28)',
          background: 'rgba(9,13,24,0.9)',
        }}
      />
      <button
        type="button"
        onClick={() => onSelect?.(node)}
        className="flex w-full items-center justify-between gap-3 rounded-lg py-2 pl-[62px] pr-1 text-left transition-colors hover:bg-[rgba(169,213,232,0.04)]"
      >
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-moon-muted">{node.title}</span>
          <span className="block text-[11px] text-moon-faint">
            {node.endDate ? formatRange(node.date, node.endDate) : formatDay(node.date)}
          </span>
        </span>
        {node.amount != null && (
          <span className="num shrink-0 text-[13px] text-frost/85">+{Math.round(node.amount)}</span>
        )}
      </button>
    </div>
  )
}

function RewardRow({ node, onSelect }: { node: TimelineNode; onSelect?: (n: TimelineNode) => void }) {
  return (
    <div className="relative py-1">
      <Glyph kind="reward" />
      <button
        type="button"
        onClick={() => onSelect?.(node)}
        className="flex w-full items-center justify-between gap-3 rounded-lg py-2 pl-[62px] pr-1 text-left transition-colors hover:bg-[rgba(169,213,232,0.04)]"
      >
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-moon-muted">{node.title}</span>
          <span className="block text-[11px] text-moon-faint">
            {formatDay(node.date)}
            {node.subtitle ? ` · ${node.subtitle}` : ''}
          </span>
        </span>
        {node.amount != null && (
          <span className="num shrink-0 text-[13px] text-frost/85">+{Math.round(node.amount)}</span>
        )}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Glyph({ kind, live }: { kind: 'version' | 'reward'; live?: boolean }) {
  if (kind === 'version') {
    return (
      <span
        aria-hidden
        className="absolute z-10"
        style={{
          left: THREAD_X - 13,
          top: 34,
          filter: live ? 'drop-shadow(0 0 8px rgba(169,213,232,0.55))' : undefined,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 26 26">
          <circle cx="13" cy="13" r="12" fill="rgba(9,13,24,0.96)" />
          <circle
            cx="13" cy="13" r="7.5"
            fill="var(--frost)"
            fillOpacity={live ? 0.5 : 0.22}
            stroke="var(--frost)"
            strokeOpacity={live ? 1 : 0.75}
            strokeWidth="1"
          />
          {/* Eclipse notch — the version's identity mark. The running version is
              full, so it keeps its whole disc. */}
          {!live && <circle cx="16.4" cy="10.6" r="6" fill="rgba(9,13,24,0.96)" />}
          <circle
            cx="13" cy="13" r="11.4"
            fill="none" stroke="var(--frost)"
            strokeOpacity={live ? 0.45 : 0.2}
            strokeWidth="0.6"
            strokeDasharray="1.5 4"
          />
        </svg>
      </span>
    )
  }
  return (
    <span aria-hidden className="absolute z-10" style={{ left: THREAD_X - 5, top: 15 }}>
      <svg width="10" height="10" viewBox="0 0 10 10">
        <rect
          x="1.6" y="1.6" width="6.8" height="6.8"
          transform="rotate(45 5 5)"
          fill="rgba(9,13,24,0.96)"
          stroke="var(--lunar-blue)"
          strokeOpacity="0.65"
          strokeWidth="0.9"
        />
      </svg>
    </span>
  )
}

function Balance({ value }: { value: number }) {
  return (
    <div className="shrink-0 text-right">
      <div className="num font-display text-[21px] leading-none text-moon-muted">{Math.round(value)}</div>
      <div className="eyebrow mt-1">wishes</div>
    </div>
  )
}

function bannerSentence(plan: NonNullable<TimelineNode['plan']>): string {
  const short = Math.max(0, plan.plannedCost - plan.reserved)

  // A band that reserves nothing has no plan to be short of, so every sentence
  // below would be measuring against zero and calling the result funded.
  if (plan.plannedCost === 0) {
    return plan.reserved > 0
      ? `Nothing is held back for this. ${plan.reserved} wishes are spare enough to reach for it anyway.`
      : 'Nothing is held back for this, and there is nothing spare to reach with.'
  }

  if (plan.status === 'guaranteed') {
    return 'Fully funded by the time this opens, even on the worst possible run.'
  }
  const toGuarantee = Math.max(0, plan.cost.worstCase - plan.reserved)

  // Checked before the funded-date branch, which would otherwise open with
  // "0 short at the start".
  if (short === 0) {
    return `Funded to plan. ${toGuarantee} more would make it certain regardless of luck.`
  }
  if (plan.fundedDate && plan.prediction?.endDate && plan.fundedDate <= plan.prediction.endDate) {
    return `${short} short at the start — you should reach a guarantee around ${formatDay(plan.fundedDate)}, during the banner.`
  }
  if (plan.status === 'unfunded') {
    return `Higher-priority targets claim these wishes first, leaving this ${short} short of plan.`
  }
  return `${short} short of plan, and ${toGuarantee} short of a guarantee.`
}
