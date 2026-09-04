import { useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { NumberField, Segmented, Toggle } from '@/components/ui/controls'
import { useStore } from '@/store/useStore'
import { HARD_PITY } from '@/engine/wish'
import { spendWishes } from '@/engine/simulation'
import { today } from '@/lib/date'

/**
 * "Log pull" — either move pity along, or record a 5★ and let the app derive
 * the new banner state from it.
 */

type Mode = 'pity' | 'fivestar'

export function LogPullSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const characters = useStore((s) => s.characters)
  const targets = useStore((s) => s.targets)
  const addHistoryEntry = useStore((s) => s.addHistoryEntry)
  const markAcquired = useStore((s) => s.markAcquired)

  const [mode, setMode] = useState<Mode>('pity')

  // -- pity mode --------------------------------------------------------
  const [wishesSpent, setWishesSpent] = useState(10)
  const [deduct, setDeduct] = useState(true)

  // -- five-star mode ---------------------------------------------------
  const [atPity, setAtPity] = useState(Math.min(HARD_PITY, user.characterPity + 10))
  const [won, setWon] = useState(true)
  const [radiance, setRadiance] = useState(false)
  const [characterId, setCharacterId] = useState('')

  const plannedCharacters = useMemo(() => {
    const map = new Map(characters.map((c) => [c.id, c]))
    return targets
      .filter((t) => !t.acquired && !t.archived)
      .map((t) => ({ target: t, character: map.get(t.characterId) }))
      .filter((x): x is { target: (typeof targets)[number]; character: NonNullable<typeof x.character> } =>
        Boolean(x.character),
      )
  }, [characters, targets])

  const submit = () => {
    if (mode === 'pity') {
      const nextPity = Math.min(HARD_PITY - 1, user.characterPity + wishesSpent)
      const base = deduct ? spendWishes(user, wishesSpent) : user
      setUser({ ...base, characterPity: nextPity })
    } else {
      const spent = Math.max(1, atPity - user.characterPity)
      const base = deduct ? spendWishes(user, spent) : user
      const chosen = plannedCharacters.find((p) => p.target.characterId === characterId)

      setUser({
        ...base,
        characterPity: 0,
        // Losing the 50/50 guarantees the next limited 5★.
        characterGuaranteed: !won,
        capturingRadianceState: won ? 0 : Math.min(3, (user.capturingRadianceState ?? 0) + 1),
      })

      addHistoryEntry({
        date: today(),
        characterId: chosen?.character.id,
        characterName: chosen?.character.displayName ?? (won ? 'Featured 5★' : 'Standard 5★'),
        pity: atPity,
        wonFiftyFifty: user.characterGuaranteed ? null : won,
        capturingRadiance: radiance,
        rarity: 5,
      })

      if (won && chosen) markAcquired(chosen.target.id)
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Update your banner"
      title="Log a pull"
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
      <Segmented
        label="Log type"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'pity', label: 'Wishes spent' },
          { value: 'fivestar', label: 'I got a 5★' },
        ]}
      />

      <div className="mt-6 space-y-5">
        {mode === 'pity' ? (
          <>
            <NumberField
              label="Wishes spent"
              value={wishesSpent}
              onChange={setWishesSpent}
              max={HARD_PITY - user.characterPity}
              hint={`Pity moves from ${user.characterPity} to ${Math.min(HARD_PITY - 1, user.characterPity + wishesSpent)}.`}
            />
          </>
        ) : (
          <>
            <NumberField
              label="Pity when it dropped"
              value={atPity}
              onChange={setAtPity}
              min={Math.max(1, user.characterPity)}
              max={HARD_PITY}
              hint={`That is ${Math.max(1, atPity - user.characterPity)} wishes from where you were.`}
            />

            {user.characterGuaranteed ? (
              <p className="rounded-xl border border-[var(--hairline)] bg-[rgba(8,12,22,0.5)] px-4 py-3 text-[13px] leading-relaxed text-moon-muted">
                You were on a guarantee, so there was no 50/50 to win or lose.
              </p>
            ) : (
              <div className="panel-flat px-4">
                <Toggle
                  checked={won}
                  onChange={setWon}
                  label="I won the 50/50"
                  hint={won ? 'You got the featured character.' : 'Your next limited 5★ is now guaranteed.'}
                />
                {!won && (
                  <div className="border-t border-[var(--hairline)]">
                    <Toggle
                      checked={radiance}
                      onChange={setRadiance}
                      label="Capturing Radiance triggered"
                      hint="Optional. Lunavota never counts on it when protecting your wishes."
                    />
                  </div>
                )}
              </div>
            )}

            {(won || user.characterGuaranteed) && plannedCharacters.length > 0 && (
              <div>
                <p className="eyebrow mb-2.5">Who did you get?</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={characterId === '' ? 'chip chip-on' : 'chip'}
                    onClick={() => setCharacterId('')}
                  >
                    Not on my list
                  </button>
                  {plannedCharacters.map(({ target, character }) => (
                    <button
                      key={target.id}
                      type="button"
                      className={characterId === character.id ? 'chip chip-on' : 'chip'}
                      onClick={() => setCharacterId(character.id)}
                    >
                      {character.displayName}
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-[12px] leading-snug text-moon-dim">
                  Choosing someone from your roadmap moves them into your history and frees their reserved wishes.
                </p>
              </div>
            )}
          </>
        )}

        <div className="panel-flat px-4">
          <Toggle
            checked={deduct}
            onChange={setDeduct}
            label="Deduct the wishes I spent"
            hint="Turn this off if you already corrected your balance."
          />
        </div>
      </div>
    </Sheet>
  )
}
