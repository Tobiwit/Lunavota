import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Screen } from '@/components/ui/Screen'
import { NumberField, Segmented, Slider, Toggle, Why } from '@/components/ui/controls'
import { useStore, exportSnapshot } from '@/store/useStore'
import { clearEverything } from '@/store/persistence'
import { PLANNING_MODE_DESCRIPTION, PLANNING_MODE_LABEL } from '@/engine/planning'
import { imaginariumPrimos, spiralAbyssPrimos, stygianPrimos } from '@/engine/forecast'
import { DEFAULT_RECURRING } from '@/data/config'
import type { BattlePassKind, CompletionCategory, PlanningMode } from '@/types'

const FINE_TUNE: { key: CompletionCategory; label: string }[] = [
  { key: 'events', label: 'Events' },
  { key: 'exploration', label: 'Exploration' },
  { key: 'quests', label: 'Quests' },
]

export function SettingsScreen() {
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const importSnapshot = useStore((s) => s.importSnapshot)
  const resetEverything = useStore((s) => s.resetEverything)

  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [fineTune, setFineTune] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const setOverride = (key: CompletionCategory, value: number | undefined) => {
    const next = { ...profile.categoryCompletionOverrides }
    if (value === undefined) delete next[key]
    else next[key] = value
    setProfile({ categoryCompletionOverrides: next })
  }

  const download = () => {
    const blob = new Blob([exportSnapshot()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lunavota-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ tone: 'ok', text: 'Backup saved.' })
  }

  const upload = async (file: File) => {
    try {
      const result = importSnapshot(JSON.parse(await file.text()))
      setMessage(
        result.ok
          ? { tone: 'ok', text: 'Backup restored.' }
          : { tone: 'bad', text: result.error },
      )
    } catch {
      setMessage({ tone: 'bad', text: 'That file could not be read as JSON.' })
    }
  }

  return (
    <Screen atmosphere="admin" eyebrow="Your instrument" title="Settings" showSettings={false}>
      {/* ---- Planning -------------------------------------------------- */}
      <Section title="Planning" hint="How much Lunavota holds back for what has not arrived yet.">
        <div className="space-y-2.5">
          {(['safe', 'balanced', 'risky'] as PlanningMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setUser({ planningMode: m })}
              aria-pressed={user.planningMode === m}
              className={clsx(
                'w-full rounded-2xl border px-4 py-3.5 text-left transition-colors',
                user.planningMode === m
                  ? 'border-[rgba(169,213,232,0.46)] bg-[rgba(169,213,232,0.08)]'
                  : 'border-[var(--hairline)] bg-[rgba(16,22,39,0.4)]',
              )}
            >
              <span className="block font-display text-[18px] text-moon">{PLANNING_MODE_LABEL[m]}</span>
              <span className="mt-1 block text-[12.5px] leading-snug text-moon-dim">
                {PLANNING_MODE_DESCRIPTION[m]}
              </span>
            </button>
          ))}
        </div>

        <div className="panel-flat mt-4 px-4">
          <Toggle
            checked={user.ignoreFutureIncome}
            onChange={(v) => setUser({ ignoreFutureIncome: v })}
            label="Ignore future income"
            hint="Plan strictly on the wishes you already hold. Nothing is funded by a forecast."
          />
        </div>
      </Section>

      {/* ---- Banner state ---------------------------------------------- */}
      <Section title="Banner state">
        <div className="space-y-5">
          <NumberField
            label="Current pity"
            value={user.characterPity}
            onChange={(v) => setUser({ characterPity: v })}
            max={89}
          />
          <div className="panel-flat px-4">
            <Toggle
              checked={user.characterGuaranteed}
              onChange={(v) => setUser({ characterGuaranteed: v })}
              label="Next limited 5★ is guaranteed"
            />
          </div>
          <NumberField
            label="Consecutive lost 50/50s"
            value={user.capturingRadianceState}
            onChange={(v) => setUser({ capturingRadianceState: v })}
            max={3}
            hint="Feeds the Capturing Radiance estimate only. It never reduces a worst case."
          />
        </div>
      </Section>

      {/* ---- Income ----------------------------------------------------- */}
      <Section title="My income" hint="What the forecast assumes about the way you play.">
        <div className="panel-flat px-4">
          <Toggle
            checked={profile.dailyCommissions}
            onChange={(v) => setProfile({ dailyCommissions: v })}
            label="I do my dailies"
            hint={`${DEFAULT_RECURRING.dailyCommissionPrimos} Primogems a day.`}
          />
          <div className="border-t border-[var(--hairline)]">
            <Toggle
              checked={profile.welkin.active}
              onChange={(v) => setProfile({ welkin: v ? { active: true } : { active: false } })}
              label="Welkin active"
              hint={`${DEFAULT_RECURRING.welkinPrimosPerDay} Primogems a day while it runs.`}
            />
          </div>
          {profile.welkin.active && (
            <div className="border-t border-[var(--hairline)] py-3.5">
              <label htmlFor="welkin-end" className="eyebrow mb-2 block">
                Runs until (optional)
              </label>
              <input
                id="welkin-end"
                type="date"
                className="field"
                value={profile.welkin.endDate ?? ''}
                onChange={(e) =>
                  setProfile({ welkin: { active: true, endDate: e.target.value || undefined } })
                }
              />
              <p className="mt-2 text-[11.5px] text-moon-dim">
                Leave blank to assume it keeps running. This matters if it expires mid-forecast.
              </p>
            </div>
          )}
          <div className="border-t border-[var(--hairline)] py-3.5">
            <p className="eyebrow mb-2.5">Battle Pass</p>
            <Segmented
              label="Battle Pass"
              size="sm"
              value={profile.battlePass}
              onChange={(v: BattlePassKind) => setProfile({ battlePass: v })}
              options={[
                { value: 'none', label: 'None' },
                { value: 'free', label: 'Free' },
                { value: 'paid', label: 'Gnostic Hymn' },
              ]}
            />
          </div>
          <div className="border-t border-[var(--hairline)]">
            <Toggle
              checked={profile.starglitterShop}
              onChange={(v) => setProfile({ starglitterShop: v })}
              label="I buy Fates with Starglitter"
              hint={`${DEFAULT_RECURRING.starglitterFatesPerMonth} Intertwined Fates each month.`}
            />
          </div>
        </div>

        <div className="mt-6">
          <Slider
            label="How much of each version do you finish?"
            value={Math.round(profile.generalCompletionRate * 100)}
            onChange={(v) => setProfile({ generalCompletionRate: v / 100 })}
            min={20}
            max={100}
            step={5}
            format={(v) => `${v}%`}
            marks={[
              { value: 20, label: 'Casual' },
              { value: 60, label: 'Most content' },
              { value: 100, label: 'Everything' },
            ]}
          />
          <p className="mt-3 text-[12px] leading-relaxed text-moon-dim">
            This adjusts events, quests, exploration and miscellaneous rewards. Dailies, Welkin, the Battle Pass and
            the endgame modes are worked out separately, so they are never scaled twice.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFineTune((v) => !v)}
          className="mt-4 text-[12px] text-frost/80 underline-offset-4 hover:underline"
          aria-expanded={fineTune}
        >
          {fineTune ? 'Hide' : 'Fine tune'} individual categories
        </button>

        {fineTune && (
          <div className="mt-5 space-y-5">
            {FINE_TUNE.map(({ key, label }) => {
              const override = profile.categoryCompletionOverrides[key]
              return (
                <div key={key}>
                  <Slider
                    label={label}
                    value={Math.round((override ?? profile.generalCompletionRate) * 100)}
                    onChange={(v) => setOverride(key, v / 100)}
                    min={0}
                    max={100}
                    step={5}
                    format={(v) => `${v}%`}
                  />
                  {override !== undefined && (
                    <button
                      type="button"
                      className="mt-1 text-[11px] text-moon-dim underline-offset-4 hover:underline"
                      onClick={() => setOverride(key, undefined)}
                    >
                      Follow the main slider again
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ---- Endgame ---------------------------------------------------- */}
      <Section title="Endgame" hint="Told the way you would describe it, not in Primogems.">
        <div className="space-y-6">
          <div>
            <Slider
              label="Spiral Abyss"
              value={profile.endgame.spiralAbyssFloor}
              onChange={(v) => setProfile({ endgame: { ...profile.endgame, spiralAbyssFloor: v } })}
              min={8}
              max={12}
              format={(v) => (v <= 8 ? 'I skip it' : `Floor ${v}`)}
            />
            <p className="num mt-1.5 text-[11.5px] text-moon-dim">
              Highest floor you usually clear · ≈{spiralAbyssPrimos(profile, DEFAULT_RECURRING)} Primogems per reset
            </p>
          </div>

          <div>
            <Slider
              label="Imaginarium Theater"
              value={profile.endgame.imaginariumAct}
              onChange={(v) => setProfile({ endgame: { ...profile.endgame, imaginariumAct: v } })}
              min={0}
              max={8}
              format={(v) => (v === 0 ? 'I skip it' : `Act ${v}`)}
            />
            <p className="num mt-1.5 text-[11.5px] text-moon-dim">
              Act you usually reach · ≈{imaginariumPrimos(profile, DEFAULT_RECURRING)} Primogems per cycle
            </p>
          </div>

          <div>
            <Slider
              label="Stygian Onslaught"
              value={Math.round(profile.endgame.stygianCompletion * 100)}
              onChange={(v) => setProfile({ endgame: { ...profile.endgame, stygianCompletion: v / 100 } })}
              min={0}
              max={100}
              step={10}
              format={(v) => `${v}%`}
            />
            <p className="num mt-1.5 text-[11.5px] text-moon-dim">
              Typical reward completion · ≈{stygianPrimos(profile, DEFAULT_RECURRING)} Primogems per cycle
            </p>
          </div>
        </div>
      </Section>

      {/* ---- Data -------------------------------------------------------- */}
      <Section title="Your data" hint="Everything lives in this browser. Nothing is sent anywhere.">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button type="button" className="btn btn-quiet flex-1" onClick={download}>
            Export backup
          </button>
          <button type="button" className="btn btn-quiet flex-1" onClick={() => fileInput.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
              e.target.value = ''
            }}
          />
        </div>

        {message && (
          <p
            className="mt-3 text-[12.5px]"
            style={{ color: message.tone === 'ok' ? 'var(--success)' : 'var(--danger)' }}
            role="status"
          >
            {message.text}
          </p>
        )}

        <div className="mt-6">
          <Why label="Where is my data kept?">
            Lunavota stores your plan in this browser's IndexedDB. That makes it instant and private, but it also
            means clearing site data — or switching device — loses it. Export a backup before you do either. The
            storage layer sits behind one small interface, so optional cloud sync can be added later without
            rewriting the app.
          </Why>
        </div>

        <div className="mt-7 border-t border-[var(--hairline)] pt-5">
          {confirmReset ? (
            <div className="flex items-center gap-2.5">
              <button type="button" className="btn btn-quiet flex-1" onClick={() => setConfirmReset(false)}>
                Keep everything
              </button>
              <button
                type="button"
                className="btn btn-danger flex-1"
                onClick={async () => {
                  resetEverything()
                  await clearEverything()
                  window.location.href = '/'
                }}
              >
                Erase everything
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-[13px] text-moon-dim underline-offset-4 hover:text-danger hover:underline"
              onClick={() => setConfirmReset(true)}
            >
              Start over
            </button>
          )}
        </div>
      </Section>

      <div className="mt-10 text-center">
        <Link to="/admin" className="text-[12px] text-moon-faint underline-offset-4 hover:text-moon-dim hover:underline">
          Catalogue admin
        </Link>
      </div>
    </Screen>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-11">
      <h2 className="eyebrow mb-1">{title}</h2>
      {hint && <p className="mb-4 text-[12.5px] leading-relaxed text-moon-dim">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </section>
  )
}
