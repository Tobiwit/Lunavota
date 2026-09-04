import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Sheet } from '@/components/ui/Sheet'
import { NumberField } from '@/components/ui/controls'
import { AffordabilityBadge } from '@/components/ui/status'
import { PriorityGlyph } from '@/components/ui/PriorityGlyph'
import { useStore } from '@/store/useStore'
import { useBudget } from '@/store/selectors'
import { compareBudgets, recommendStoppingPoint, runScenario, type ScenarioStep } from '@/engine/simulation'
import { likelyFiveStarAt, HARD_PITY } from '@/engine/wish'
import { AFFORDABILITY_LABEL } from '@/engine/planning'

/**
 * Scenario planner.
 *
 * Simulation mode is entirely non-destructive: the sheet builds a parallel user
 * state, re-runs the whole planning engine against it, and shows the difference.
 * Real data only moves when "Apply outcome" is tapped.
 */

type Preset =
  | 'spend'
  | 'first-5star'
  | 'lose-5050'
  | 'lose-then-win'
  | 'constellation'
  | 'weapon'
  | 'skip'

/**
 * Labels are literal. Without a guarantee, reaching a 5★ is not the same as
 * getting the character - calling it "the first 5★" would quietly assume a win.
 */
function presetsFor(guaranteed: boolean): { id: Preset; label: string }[] {
  return [
    { id: 'spend', label: 'Spend some wishes' },
    { id: 'first-5star', label: guaranteed ? 'Reach the first 5★' : 'Win the 50/50' },
    { id: 'lose-5050', label: 'Lose the 50/50' },
    { id: 'lose-then-win', label: 'Lose it, then win' },
    { id: 'constellation', label: 'Go for C1' },
    { id: 'weapon', label: 'Pull the weapon' },
    { id: 'skip', label: 'Skip the banner' },
  ]
}

export function ScenarioSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const markAcquired = useStore((s) => s.markAcquired)
  const budget = useBudget()

  const [preset, setPreset] = useState<Preset>('first-5star')
  const [spendAmount, setSpendAmount] = useState(20)
  const [weaponAmount, setWeaponAmount] = useState(80)
  const [targetId, setTargetId] = useState<string>('')

  const plan = budget.plans.find((p) => p.target.id === targetId) ?? budget.nextPlan
  const targetName = plan?.character.displayName ?? 'this banner'
  const likelyAt = likelyFiveStarAt(user.characterPity)

  const steps = useMemo<ScenarioStep[]>(() => {
    switch (preset) {
      case 'spend': return [{ kind: 'spend', wishes: spendAmount }]
      case 'first-5star':
        return [{ kind: 'win-5050', at: likelyAt }]
      case 'lose-5050': return [{ kind: 'lose-5050', at: likelyAt }]
      case 'lose-then-win': return [{ kind: 'lose-5050', at: likelyAt }, { kind: 'obtain-copy' }]
      case 'constellation': return [{ kind: 'win-5050', at: likelyAt }, { kind: 'obtain-copy' }]
      case 'weapon': return [{ kind: 'weapon', wishes: weaponAmount }]
      case 'skip': return [{ kind: 'skip' }]
    }
  }, [preset, spendAmount, weaponAmount, likelyAt, user.characterGuaranteed])

  const result = useMemo(() => runScenario(user, steps, targetName), [user, steps, targetName])
  const simulatedBudget = useBudget(result.user)

  const impacts = useMemo(
    () => compareBudgets(budget, simulatedBudget, plan?.target.id),
    [budget, simulatedBudget, plan],
  )

  const obtained = result.copiesObtained > 0
  const affordable = result.wishesSpent <= budget.ownedWishes

  const apply = () => {
    setUser(result.user)
    if (obtained && plan && result.copiesObtained > plan.target.constellationTarget) {
      markAcquired(plan.target.id)
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Simulation — nothing is saved yet"
      title={`What if you pull ${targetName}?`}
      footer={
        <div className="flex gap-2.5">
          <button type="button" className="btn btn-quiet flex-1" onClick={onClose}>
            Discard
          </button>
          <button
            type="button"
            className="btn btn-primary flex-[2]"
            onClick={apply}
            disabled={preset === 'skip' || !affordable}
          >
            Apply outcome
          </button>
        </div>
      }
    >
      {/* -- which target ------------------------------------------------ */}
      {budget.plans.length > 1 && (
        <div className="mb-5">
          <p className="eyebrow mb-2.5">Pulling for</p>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {budget.plans.map((p) => (
              <button
                key={p.target.id}
                type="button"
                onClick={() => setTargetId(p.target.id)}
                className={clsx('chip shrink-0', p.target.id === plan?.target.id && 'chip-on')}
              >
                <PriorityGlyph priority={p.target.priority} size={11} />
                {p.character.displayName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* -- scenario ---------------------------------------------------- */}
      <p className="eyebrow mb-2.5">What happens</p>
      <div className="flex flex-wrap gap-2">
        {presetsFor(user.characterGuaranteed).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={clsx('chip', preset === p.id && 'chip-on')}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'spend' && (
        <div className="mt-5">
          <NumberField
            label="Wishes spent"
            value={spendAmount}
            onChange={setSpendAmount}
            max={Math.min(budget.ownedWishes, HARD_PITY - user.characterPity)}
            step={10}
          />
        </div>
      )}
      {preset === 'weapon' && (
        <div className="mt-5">
          <NumberField label="Wishes on the weapon banner" value={weaponAmount} onChange={setWeaponAmount} step={10} />
        </div>
      )}

      {/* -- outcome ----------------------------------------------------- */}
      <div key={preset + result.wishesSpent} className="rise panel mt-6 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-[var(--hairline)]">
          <Cell label="Spent" value={result.wishesSpent} tone={affordable ? 'default' : 'danger'} />
          <Cell label="Remaining" value={Math.max(0, budget.ownedWishes - result.wishesSpent)} />
          <Cell label="New pity" value={result.user.characterPity} />
        </div>

        <div className="rule" />

        <ul className="space-y-2 px-4 py-3.5 text-[13px] leading-relaxed">
          {result.log.map((line, i) => (
            <li key={i} className="text-moon-muted">
              {line}
            </li>
          ))}
          {!affordable && (
            <li className="text-danger">
              You do not have enough wishes for this run — it needs {result.wishesSpent - budget.ownedWishes} more.
            </li>
          )}
          {result.gainedGuarantee && (
            <li className="text-success">✓ Your next limited 5★ is guaranteed.</li>
          )}
        </ul>
      </div>

      {/* -- knock-on effects -------------------------------------------- */}
      {impacts.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow mb-2.5">What it does to the rest of your roadmap</p>
          <ul className="space-y-2">
            {impacts.map((impact) => (
              <li
                key={impact.targetId}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[rgba(8,12,22,0.42)] px-4 py-3"
              >
                <span className="min-w-0 truncate text-[14px] text-moon">{impact.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-[12px]">
                  {impact.worsened ? (
                    <>
                      <span className="text-moon-faint line-through">{AFFORDABILITY_LABEL[impact.before]}</span>
                      <span aria-hidden className="text-moon-faint">→</span>
                      <AffordabilityBadge status={impact.after} />
                    </>
                  ) : (
                    <AffordabilityBadge status={impact.after} />
                  )}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 rounded-xl border border-[var(--hairline)] bg-[rgba(169,213,232,0.06)] px-4 py-3.5 text-[13px] leading-relaxed text-moon-muted">
            {recommendStoppingPoint(impacts, result.user.characterGuaranteed, targetName)}
          </p>
        </div>
      )}
    </Sheet>
  )
}

function Cell({
  label, value, tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'danger'
}) {
  return (
    <div className="px-3 py-3.5 text-center">
      <div
        className="num font-display text-[24px] leading-none"
        style={{ color: tone === 'danger' ? 'var(--danger)' : 'var(--moon)' }}
      >
        {value}
      </div>
      <div className="eyebrow mt-1.5">{label}</div>
    </div>
  )
}
