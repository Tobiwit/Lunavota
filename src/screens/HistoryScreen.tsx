import { useMemo, useState } from 'react'
import { Screen } from '@/components/ui/Screen'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, NumberField, Toggle } from '@/components/ui/controls'
import { PlusIcon } from '@/components/ui/icons'
import { useStore } from '@/store/useStore'
import { HARD_PITY, PRIMOS_PER_WISH } from '@/engine/wish'
import { formatDayYear, today } from '@/lib/date'

/**
 * History is secondary by design. It exists to explain where the current state
 * came from, and to let the forecast calibrate itself over time.
 */

export function HistoryScreen() {
  const history = useStore((s) => s.history)
  const removeHistoryEntry = useStore((s) => s.removeHistoryEntry)
  const versions = useStore((s) => s.versions)
  const versionActuals = useStore((s) => s.versionActuals)
  const incomeItems = useStore((s) => s.incomeItems)

  const [adding, setAdding] = useState(false)

  const stats = useMemo(() => {
    const fiveStars = history.filter((h) => h.rarity === 5)
    const contested = fiveStars.filter((h) => h.wonFiftyFifty !== null)
    const won = contested.filter((h) => h.wonFiftyFifty === true).length
    const avgPity = fiveStars.length
      ? Math.round(fiveStars.reduce((s, h) => s + h.pity, 0) / fiveStars.length)
      : 0
    return {
      count: fiveStars.length,
      avgPity,
      contested: contested.length,
      won,
      winRate: contested.length ? Math.round((won / contested.length) * 100) : null,
    }
  }, [history])

  const pastVersions = useMemo(
    () => versions.filter((v) => v.status === 'past').slice(-6).reverse(),
    [versions],
  )

  return (
    <Screen
      atmosphere="history"
      eyebrow="Record"
      title="History"
      action={
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(169,213,232,0.4)] bg-[rgba(169,213,232,0.12)] text-frost"
          aria-label="Add a 5★"
        >
          <PlusIcon size={18} />
        </button>
      }
    >
      {stats.count > 0 && (
        <section className="panel mb-8 grid grid-cols-3 divide-x divide-[var(--hairline)]">
          <Figure label="5★ recorded" value={String(stats.count)} />
          <Figure label="Average pity" value={String(stats.avgPity)} />
          <Figure
            label="50/50 won"
            value={stats.winRate === null ? '—' : `${stats.winRate}%`}
            hint={stats.contested ? `${stats.won} of ${stats.contested}` : undefined}
          />
        </section>
      )}

      <section className="mb-11">
        <h2 className="eyebrow mb-3">Five-star pulls</h2>
        {history.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            body="Log the 5★ you pull and Lunavota keeps your pity and guarantee in step automatically. Importing a full wish history is coming later — it was never meant to be required."
            action={
              <button type="button" className="btn btn-quiet" onClick={() => setAdding(true)}>
                <PlusIcon size={16} /> Add a 5★
              </button>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {history.map((entry) => (
              <li key={entry.id} className="panel flex items-center gap-3.5 px-4 py-3.5">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    borderColor:
                      entry.wonFiftyFifty === false ? 'rgba(199,137,145,0.4)' : 'rgba(217,196,141,0.45)',
                    background:
                      entry.wonFiftyFifty === false ? 'rgba(199,137,145,0.1)' : 'rgba(217,196,141,0.1)',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16">
                    <path
                      d="M8 2l1.5 3.6L13 7l-3.5 1.4L8 12l-1.5-3.6L3 7l3.5-1.4z"
                      fill={entry.wonFiftyFifty === false ? 'var(--danger)' : 'var(--star-gold)'}
                      fillOpacity="0.85"
                    />
                  </svg>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[17px] text-moon">{entry.characterName}</p>
                  <p className="mt-0.5 text-[11.5px] text-moon-dim">
                    Pity {entry.pity} · {formatDayYear(entry.date)}
                    {entry.wonFiftyFifty === null && ' · guaranteed'}
                    {entry.wonFiftyFifty === true && ' · won the 50/50'}
                    {entry.wonFiftyFifty === false && ' · lost the 50/50'}
                    {entry.capturingRadiance && ' · Capturing Radiance'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeHistoryEntry(entry.id)}
                  className="shrink-0 text-[12px] text-moon-faint underline-offset-4 hover:text-danger hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pastVersions.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3">Previous versions</h2>
          <ul className="space-y-2">
            {pastVersions.map((v) => {
              const actual = versionActuals.find((a) => a.versionId === v.id)
              // The forecast curve begins today, so a completed version has to be
              // valued from the catalogue rather than projected.
              const contentWishes =
                incomeItems
                  .filter((i) => i.versionId === v.id)
                  .reduce((sum, i) => sum + i.primogems + i.intertwinedFates * PRIMOS_PER_WISH, 0) /
                PRIMOS_PER_WISH
              return (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[rgba(8,12,22,0.4)] px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-display text-[16px] text-moon-muted">{v.name}</span>
                    <span className="block text-[11.5px] text-moon-faint">Completed</span>
                  </span>
                  <span className="num shrink-0 text-[13px] text-moon-dim">
                    {actual
                      ? `+${actual.earnedWishes} earned`
                      : `≈${Math.round(contentWishes)} from version content`}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-moon-faint">
            Once you have recorded what you actually earned across a few versions, Lunavota can suggest a completion
            rate that matches how you really play — with your approval, never silently.
          </p>
        </section>
      )}

      <AddFiveStarSheet open={adding} onClose={() => setAdding(false)} />
    </Screen>
  )
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-3 py-4 text-center">
      <div className="num font-display text-[24px] leading-none text-moon">{value}</div>
      <div className="eyebrow mt-1.5">{label}</div>
      {hint && <div className="mt-1 text-[10.5px] text-moon-faint">{hint}</div>}
    </div>
  )
}

function AddFiveStarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addHistoryEntry = useStore((s) => s.addHistoryEntry)
  const characters = useStore((s) => s.characters)

  const [name, setName] = useState('')
  const [pity, setPity] = useState(75)
  const [won, setWon] = useState(true)
  const [guaranteed, setGuaranteed] = useState(false)
  const [radiance, setRadiance] = useState(false)
  const [date, setDate] = useState(today())

  const matched = useMemo(
    () => characters.find((c) => c.displayName.toLowerCase() === name.trim().toLowerCase()),
    [characters, name],
  )

  const submit = () => {
    addHistoryEntry({
      date,
      characterId: matched?.id,
      characterName: name.trim() || 'Unnamed 5★',
      pity,
      wonFiftyFifty: guaranteed ? null : won,
      capturingRadiance: radiance,
      rarity: 5,
    })
    setName('')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Record"
      title="Add a 5★"
      footer={
        <div className="flex gap-2.5">
          <button type="button" className="btn btn-quiet flex-1" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary flex-[2]" onClick={submit}>
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="fivestar-name" className="eyebrow mb-2 block">
            Character
          </label>
          <input
            id="fivestar-name"
            className="field"
            list="character-names"
            placeholder="Who did you get?"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <datalist id="character-names">
            {characters.map((c) => (
              <option key={c.id} value={c.displayName} />
            ))}
          </datalist>
        </div>

        <NumberField label="Pity" value={pity} onChange={setPity} min={1} max={HARD_PITY} />

        <div>
          <label htmlFor="fivestar-date" className="eyebrow mb-2 block">
            Date
          </label>
          <input
            id="fivestar-date"
            type="date"
            className="field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="panel-flat px-4">
          <Toggle
            checked={guaranteed}
            onChange={setGuaranteed}
            label="This was a guarantee"
            hint="There was no 50/50 to win or lose."
          />
          {!guaranteed && (
            <div className="border-t border-[var(--hairline)]">
              <Toggle checked={won} onChange={setWon} label="I won the 50/50" />
            </div>
          )}
          {!guaranteed && !won && (
            <div className="border-t border-[var(--hairline)]">
              <Toggle checked={radiance} onChange={setRadiance} label="Capturing Radiance triggered" />
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}
