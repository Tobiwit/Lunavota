import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Sheet } from '@/components/ui/Sheet'
import { NumberField, Toggle, Why } from '@/components/ui/controls'
import { CharacterSplash } from '@/components/character/CharacterArt'
import { PriorityGlyph, PRIORITY_LABEL, PRIORITY_MEANING } from '@/components/ui/PriorityGlyph'
import { AffordabilityBadge, PredictionChip, RangeValue } from '@/components/ui/status'
import { useStore } from '@/store/useStore'
import { AFFORDABILITY_MEANING } from '@/engine/planning'
import { confidenceDescription, confidenceLabel, phaseLabel } from '@/engine/predictions'
import { elementLabel } from '@/lib/assets'
import { formatDay } from '@/lib/date'
import { formatChance } from '@/lib/format'
import type { BannerPhase, Priority, PullRule, PullRuleKind, TargetPlan } from '@/types'

/** Selectable reasons. Kept short and human — these are notes to your future self. */
const REASONS = [
  'Favourite', 'Design', 'Story', 'Gameplay', 'Meta',
  'New team', 'Team upgrade', 'Support', 'Exploration', 'Collection',
]

const PULL_RULES: { kind: PullRuleKind; label: string; needsValue?: string }[] = [
  { kind: 'get-c0', label: 'Get C0 regardless' },
  { kind: 'until-first-5star', label: 'Pull until the first 5★' },
  { kind: 'stop-if-5050-lost', label: 'Stop if the 50/50 is lost' },
  { kind: 'stop-after-x', label: 'Stop after X wishes', needsValue: 'Wishes' },
  { kind: 'keep-x-remaining', label: 'Only if X wishes remain after', needsValue: 'Wishes to keep' },
  { kind: 'skip-if-must-within', label: 'Skip if a Must target is close', needsValue: 'Versions' },
  { kind: 'only-if-funded', label: 'Only pull if fully funded' },
  { kind: 'custom', label: 'Custom' },
]

const PRIORITIES: Priority[] = ['must', 'want', 'interested', 'luxury']

export function TargetDetailSheet({ plan, onClose }: { plan: TargetPlan | null; onClose: () => void }) {
  const updateTarget = useStore((s) => s.updateTarget)
  const removeTarget = useStore((s) => s.removeTarget)
  const markAcquired = useStore((s) => s.markAcquired)
  const versions = useStore((s) => s.versions)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const upcoming = useMemo(
    () => versions.filter((v) => v.status !== 'past').slice(0, 8),
    [versions],
  )

  if (!plan) return null
  const { target, character, cost, prediction } = plan
  const set = (patch: Parameters<typeof updateTarget>[1]) => updateTarget(target.id, patch)

  const rule: PullRule = target.pullRule ?? { kind: 'get-c0' }
  const ruleMeta = PULL_RULES.find((r) => r.kind === rule.kind)

  return (
    <Sheet
      open={Boolean(plan)}
      onClose={onClose}
      footer={
        <div className="flex gap-2.5">
          <button
            type="button"
            className="btn btn-quiet flex-1"
            onClick={() => {
              markAcquired(target.id)
              onClose()
            }}
          >
            Mark obtained
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={onClose}>
            Done
          </button>
        </div>
      }
    >
      {/* -- header ------------------------------------------------------ */}
      {/* A banner rather than a thumbnail: this is the character's own screen. */}
      <header className="relative -mx-5 mb-6 h-[212px] overflow-hidden">
        <CharacterSplash character={character} className="inset-y-0 right-0 w-[74%]" fade={40} />
        <div className="relative flex h-full flex-col justify-end px-5 pb-1 pr-[42%]">
          <h2 className="font-display text-[30px] leading-tight text-moon">{character.displayName}</h2>
          <p className="mt-1 text-[12.5px] text-moon-dim">
            {elementLabel(character.element)}
            {character.rarity ? ` · ${character.rarity}★` : ''}
            {character.region ? ` · ${character.region}` : ''}
          </p>
          <div className="mt-3">
            <AffordabilityBadge status={plan.status} />
          </div>
        </div>
      </header>

      {/* -- forecast ---------------------------------------------------- */}
      {prediction?.date && (
        <section className="panel mb-6 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Expected when live</p>
              <p className="num mt-1.5 font-display text-[34px] leading-none text-moon">
                {plan.balanceAtBanner}
              </p>
              <p className="mt-1 text-[12px] text-moon-dim">
                <RangeValue low={plan.balanceAtBannerLow} high={plan.balanceAtBannerHigh} /> wishes ·{' '}
                {formatDay(prediction.date)}
              </p>
            </div>
            <div className="text-right">
              <p className="eyebrow">Chance of C{target.constellationTarget}</p>
              <p
                className="num mt-1.5 text-[34px] leading-none"
                style={{ color: plan.successChance >= 0.9995 ? 'var(--success)' : 'var(--moon-muted)' }}
              >
                {formatChance(plan.successChance)}
              </p>
              <p className="mt-1 text-[12px] text-moon-dim">
                with {plan.reserved} set aside
              </p>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-moon-muted">
            {AFFORDABILITY_MEANING[plan.status]}
          </p>

          {/* At full certainty the planned figure *is* the guarantee; saying both
              would only repeat the same number back. */}
          {plan.targetConfidence < 1 && (
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-moon-dim">
              {PRIORITY_LABEL[target.priority]} targets are planned to{' '}
              {Math.round(plan.targetConfidence * 100)}% certainty —{' '}
              <span className="num text-moon-muted">{plan.plannedCost}</span> wishes. A full guarantee regardless of
              luck would need <span className="num text-moon-muted">{cost.worstCase}</span>.
            </p>
          )}

          {plan.reserved < plan.plannedCost && (
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-moon-dim">
              Of that forecast, <span className="num text-moon-muted">{plan.reserved}</span> is actually set aside
              here — the rest is already committed to higher-priority targets.
            </p>
          )}

          {prediction.earliest && prediction.earliest.date !== prediction.date && (
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-moon-dim">
              Earliest credible appearance is {prediction.earliest.versionName}{' '}
              {phaseLabel(prediction.earliest.phase).toLowerCase()}, which would leave you at{' '}
              <span className="num text-moon-muted">{plan.balanceAtEarliest}</span>.
            </p>
          )}

          <div className="mt-4">
            <Why label="How is this worked out?">
              <p>
                Worst case assumes you lose every 50/50 and reach hard pity every time — {cost.worstCase} wishes for
                C{target.constellationTarget}. That number never depends on luck.
              </p>
              <p className="mt-2">
                {PRIORITY_LABEL[target.priority]} targets are planned to{' '}
                {Math.round(plan.targetConfidence * 100)}% certainty, which is {plan.plannedCost} wishes. With the{' '}
                {plan.reserved} actually set aside, the chance of reaching C{target.constellationTarget} is about{' '}
                {formatChance(plan.successChance)}.
              </p>
              <p className="mt-2">
                Those odds approximate a probability curve HoYoverse has never fully published, so Lunavota keeps
                them separate from anything it calls guaranteed. Half the time the 50/50 falls your way and the cost
                stops near 80; past that it climbs steeply toward the 180 ceiling.
              </p>
              {plan.incomeDuringBanner > 0 && (
                <p className="mt-2">
                  You should earn about {Math.round(plan.incomeDuringBanner)} more wishes during the banner itself.
                </p>
              )}
            </Why>
          </div>
        </section>
      )}

      {/* -- target ------------------------------------------------------ */}
      <Section title="My target">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {[0, 1, 2, 3, 4, 5, 6].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set({ constellationTarget: c })}
              className={clsx('chip num shrink-0', target.constellationTarget === c && 'chip-on')}
            >
              C{c}
            </button>
          ))}
        </div>
        <div className="panel-flat mt-3 px-4">
          <Toggle
            checked={target.signatureWeapon}
            onChange={(v) => set({ signatureWeapon: v })}
            label="I also want the signature weapon"
            hint={
              character.signatureWeaponName
                ? `${character.signatureWeaponName}. Weapon-banner planning arrives in a later version — for now this is a note to yourself.`
                : 'Weapon-banner planning arrives in a later version.'
            }
          />
        </div>
      </Section>

      {/* -- priority ---------------------------------------------------- */}
      <Section title="Priority">
        <div className="grid grid-cols-2 gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set({ priority: p })}
              aria-pressed={target.priority === p}
              className={clsx(
                'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors',
                target.priority === p
                  ? 'border-[rgba(169,213,232,0.45)] bg-[rgba(169,213,232,0.08)]'
                  : 'border-[var(--hairline)] bg-[rgba(16,22,39,0.4)]',
              )}
            >
              <PriorityGlyph priority={p} size={14} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-[14px] text-moon">{PRIORITY_LABEL[p]}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-moon-dim">
                  {PRIORITY_MEANING[p]}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* -- reasons ----------------------------------------------------- */}
      <Section title="Why I want them">
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => {
            const on = target.reasons.includes(r)
            return (
              <button
                key={r}
                type="button"
                className={clsx('chip', on && 'chip-on')}
                aria-pressed={on}
                onClick={() =>
                  set({ reasons: on ? target.reasons.filter((x) => x !== r) : [...target.reasons, r] })
                }
              >
                {r}
              </button>
            )
          })}
        </div>
      </Section>

      {/* -- pull rule --------------------------------------------------- */}
      <Section title="Pull rule" hint="Decide now, so you are not deciding at 3am with 40 wishes left.">
        <div className="space-y-2">
          {PULL_RULES.map((r) => (
            <button
              key={r.kind}
              type="button"
              onClick={() => set({ pullRule: { kind: r.kind, value: target.pullRule?.value } })}
              aria-pressed={rule.kind === r.kind}
              className={clsx(
                'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] transition-colors',
                rule.kind === r.kind
                  ? 'border-[rgba(169,213,232,0.45)] bg-[rgba(169,213,232,0.08)] text-moon'
                  : 'border-[var(--hairline)] text-moon-muted',
              )}
            >
              <span
                aria-hidden
                className={clsx(
                  'h-2 w-2 shrink-0 rounded-full',
                  rule.kind === r.kind ? 'bg-frost' : 'bg-[var(--moon-faint)]',
                )}
              />
              {r.label}
            </button>
          ))}
        </div>

        {ruleMeta?.needsValue && (
          <div className="mt-4">
            <NumberField
              label={ruleMeta.needsValue}
              value={rule.value ?? 0}
              onChange={(v) => set({ pullRule: { ...rule, value: v } })}
              step={rule.kind === 'skip-if-must-within' ? 1 : 10}
            />
          </div>
        )}

        {rule.kind === 'custom' && (
          <textarea
            className="field mt-4 min-h-[88px] py-3"
            placeholder="Write your own rule…"
            value={rule.custom ?? ''}
            onChange={(e) => set({ pullRule: { ...rule, custom: e.target.value } })}
          />
        )}
      </Section>

      {/* -- banner timing ----------------------------------------------- */}
      <Section title="Expected banner">
        {prediction && !prediction.isUserOverride && (
          <div className="mb-3">
            <PredictionChip prediction={prediction} />
            <p className="mt-2 text-[12px] leading-relaxed text-moon-dim">
              {confidenceLabel(prediction.sourceType)} — {confidenceDescription(prediction.sourceType)}
            </p>
            {prediction.alternatives.length > 1 && (
              <div className="mt-3">
                <Why label="See all the possibilities">
                  <ul className="space-y-1.5">
                    {prediction.alternatives.map((alt, i) => (
                      <li key={i} className="flex justify-between gap-4">
                        <span>
                          {alt.versionName} · {phaseLabel(alt.phase)}
                        </span>
                        <span className="num text-moon">{Math.round(alt.probability * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2.5 text-moon-dim">
                    These are community estimates, not announcements. The timeline places them at the most probable
                    point and softens everything that is not confirmed.
                  </p>
                </Why>
              </div>
            )}
          </div>
        )}

        <p className="eyebrow mb-2.5">Override for yourself</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={clsx('chip', !target.bannerVersionOverride && 'chip-on')}
            onClick={() => set({ bannerVersionOverride: null, bannerPhaseOverride: null })}
          >
            Use the community forecast
          </button>
          {upcoming.map((v) =>
            ([1, 2] as BannerPhase[]).map((phase) => (
              <button
                key={`${v.id}-${phase}`}
                type="button"
                className={clsx(
                  'chip',
                  target.bannerVersionOverride === v.id && target.bannerPhaseOverride === phase && 'chip-on',
                )}
                onClick={() => set({ bannerVersionOverride: v.id, bannerPhaseOverride: phase })}
              >
                {v.name} · P{phase}
              </button>
            )),
          )}
        </div>
      </Section>

      {/* -- budget ------------------------------------------------------ */}
      <Section title="Budget">
        <div className="panel-flat grid grid-cols-3 divide-x divide-[var(--hairline)]">
          <Figure label="Reserved" value={plan.reserved} />
          <Figure label="From your pool" value={plan.reservedFromPool} />
          <Figure label="From income" value={plan.reservedFromIncome} />
        </div>

        <div className="mt-4 space-y-4">
          <NumberField
            label="Cap the spend (optional)"
            value={target.maxPulls ?? 0}
            onChange={(v) => set({ maxPulls: v > 0 ? v : undefined })}
            step={10}
            hint="0 means no cap. Lunavota will never reserve more than this."
          />
          <NumberField
            label="Pin the reservation (optional)"
            value={target.lockedReservation ?? 0}
            onChange={(v) => set({ lockedReservation: v > 0 ? v : undefined })}
            step={10}
            hint="0 lets the planner decide. Pin it when you want a fixed number held back."
          />
        </div>
      </Section>

      {/* -- notes ------------------------------------------------------- */}
      <Section title="Notes">
        <textarea
          className="field min-h-[88px] py-3"
          placeholder="Teams, weapons, anything you want to remember…"
          value={target.notes ?? ''}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </Section>

      {/* -- remove ------------------------------------------------------ */}
      <div className="mt-8 border-t border-[var(--hairline)] pt-5">
        {confirmRemove ? (
          <div className="flex items-center gap-2.5">
            <button type="button" className="btn btn-quiet flex-1" onClick={() => setConfirmRemove(false)}>
              Keep them
            </button>
            <button
              type="button"
              className="btn btn-danger flex-1"
              onClick={() => {
                removeTarget(target.id)
                onClose()
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-[13px] text-moon-dim underline-offset-4 hover:text-danger hover:underline"
            onClick={() => setConfirmRemove(true)}
          >
            Remove from roadmap
          </button>
        )}
      </div>
    </Sheet>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className="eyebrow mb-1">{title}</h3>
      {hint && <p className="mb-3 text-[12px] leading-snug text-moon-dim">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-3 text-center">
      <div className="num font-display text-[21px] text-moon">{value}</div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  )
}
