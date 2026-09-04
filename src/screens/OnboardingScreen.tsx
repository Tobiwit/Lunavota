import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { useStore } from '@/store/useStore'
import { AtmosphereBackground } from '@/components/atmosphere/AtmosphereBackground'
import { NumberField, Toggle, Why } from '@/components/ui/controls'
import { PLANNING_MODE_DESCRIPTION, PLANNING_MODE_LABEL } from '@/engine/planning'
import { HARD_PITY, totalWishes } from '@/engine/wish'
import type { PlanningMode } from '@/types'

/**
 * Three questions, then the dashboard. No account, no wall.
 *
 * Everything here is changeable later, and the copy says so - the point is to
 * get someone to a useful number in under a minute.
 */

const STEPS = ['Resources', 'Banner', 'Planning'] as const

export function OnboardingScreen() {
  const complete = useStore((s) => s.completeOnboarding)
  const [step, setStep] = useState(0)

  const [fates, setFates] = useState(0)
  const [primos, setPrimos] = useState(0)
  const [crystals, setCrystals] = useState(0)
  const [showCrystals, setShowCrystals] = useState(false)

  const [pity, setPity] = useState(0)
  const [guaranteed, setGuaranteed] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [radiance, setRadiance] = useState(0)

  const [mode, setMode] = useState<PlanningMode>('safe')

  const wishes = totalWishes({ intertwinedFates: fates, primogems: primos, genesisCrystals: crystals })

  const finish = () =>
    complete({
      intertwinedFates: fates,
      primogems: primos,
      genesisCrystals: crystals,
      characterPity: pity,
      characterGuaranteed: guaranteed,
      capturingRadianceState: radiance,
      planningMode: mode,
    })

  return (
    <>
      <AtmosphereBackground variant="moon" />
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-6" style={{ paddingTop: 'calc(var(--sat) + 34px)' }}>
        <header className="mb-9 text-center">
          <h1 className="font-display text-[32px] tracking-[0.16em] text-moon">LUNAVOTA</h1>
          <p className="mt-2.5 text-[13px] leading-relaxed text-moon-dim">
            A planning instrument for your wishes. Three questions, then you are done.
          </p>
        </header>

        <Progress step={step} />

        <div className="relative mt-8 flex-1">
            <section key={step} className="slide-in">
              {step === 0 && (
                <div className="space-y-6">
                  <StepHeading
                    title="What do you have right now?"
                    body="Primogems stay as Primogems. Nothing is converted until you actually pull."
                  />

                  <NumberField label="Intertwined Fates" value={fates} onChange={setFates} step={1} max={9999} />
                  <NumberField label="Primogems" value={primos} onChange={setPrimos} step={160} max={999999} />

                  {showCrystals ? (
                    <NumberField
                      label="Genesis Crystals"
                      value={crystals}
                      onChange={setCrystals}
                      step={160}
                      max={999999}
                      hint="Counted at parity with Primogems."
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-[12px] text-frost/80 underline-offset-4 hover:underline"
                      onClick={() => setShowCrystals(true)}
                    >
                      I also have Genesis Crystals
                    </button>
                  )}

                  <div className="panel px-5 py-5 text-center">
                    <div className="num font-display text-[42px] leading-none text-moon">{wishes}</div>
                    <div className="eyebrow mt-2">Wishes available</div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <StepHeading
                    title="Where is your character banner?"
                    body="Your pity is the number of wishes since your last 5★ on the Character Event banner."
                  />

                  <NumberField
                    label="Current pity"
                    value={pity}
                    onChange={setPity}
                    max={HARD_PITY - 1}
                    hint={`Hard pity is ${HARD_PITY}. If you are unsure, an estimate is fine.`}
                  />

                  <div className="panel-flat px-4">
                    <Toggle
                      checked={guaranteed}
                      onChange={setGuaranteed}
                      label="Next limited 5★ is guaranteed"
                      hint="True if you lost your last 50/50."
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((v) => !v)}
                      className="text-[12px] text-frost/80 underline-offset-4 hover:underline"
                      aria-expanded={showAdvanced}
                    >
                      {showAdvanced ? 'Hide' : 'Add'} Capturing Radiance state
                    </button>
                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-5">
                            <NumberField
                              label="Consecutive lost 50/50s"
                              value={radiance}
                              onChange={setRadiance}
                              max={3}
                              hint="Most players will not know this. Leaving it at 0 is safe — Lunavota never assumes Capturing Radiance will save you."
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <StepHeading
                    title="How careful should the plan be?"
                    body="This decides how much Lunavota holds back for the characters you have not reached yet."
                  />

                  <div className="space-y-2.5">
                    {(['safe', 'balanced', 'risky'] as PlanningMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        aria-pressed={mode === m}
                        className={clsx(
                          'w-full rounded-2xl border px-5 py-4 text-left transition-all duration-200',
                          mode === m
                            ? 'border-[rgba(169,213,232,0.46)] bg-[rgba(169,213,232,0.09)]'
                            : 'border-[var(--hairline)] bg-[rgba(16,22,39,0.45)]',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display text-[19px] text-moon">{PLANNING_MODE_LABEL[m]}</span>
                          {m === 'safe' && <span className="chip text-[10px]">Recommended</span>}
                        </div>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-moon-dim">
                          {PLANNING_MODE_DESCRIPTION[m]}
                        </p>
                      </button>
                    ))}
                  </div>

                  <Why label="What actually changes?">
                    <p>
                      Priority decides how certain the plan insists on being, and the mode decides how hard it works
                      for everything below a Must.
                    </p>
                    <p className="mt-2">
                      Safe guarantees your Must <em>and</em> Want targets outright — the 180 wishes a worst-case run
                      needs — and plans income at the low end of its range. Balanced still guarantees Musts, and funds
                      Wants to around 150, which covers roughly four runs in five. Risky plans on what typically
                      happens.
                    </p>
                    <p className="mt-2">
                      None of them change the game. They change how much Lunavota is willing to call free.
                    </p>
                  </Why>
                </div>
              )}
            </section>
        </div>

        <footer className="sticky bottom-0 flex gap-3 pt-6" style={{ paddingBottom: 'calc(22px + var(--sab))' }}>
          {step > 0 && (
            <button type="button" className="btn btn-quiet flex-1" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary flex-[2]" onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          ) : (
            <button type="button" className="btn btn-primary flex-[2]" onClick={finish}>
              Open my moon
            </button>
          )}
        </footer>
      </div>
    </>
  )
}

function StepHeading({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="text-balance font-display text-[25px] leading-tight text-moon">{title}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-moon-dim">{body}</p>
    </div>
  )
}

/** Progress drawn as a waxing moon rather than a bar. */
function Progress({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-3" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={3}>
      {STEPS.map((label, i) => {
        const done = i <= step
        return (
          <div key={label} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="5.6" fill="none" stroke="var(--frost)" strokeOpacity={done ? 0.9 : 0.3} strokeWidth="1" />
                {done && <circle cx="8" cy="8" r="5.6" fill="var(--frost)" fillOpacity={i === step ? 0.95 : 0.45} />}
              </svg>
              <span className={clsx('text-[10px] tracking-wide2', done ? 'text-moon-muted' : 'text-moon-faint')}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="mb-4 h-px w-8" style={{ background: 'var(--hairline-strong)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
