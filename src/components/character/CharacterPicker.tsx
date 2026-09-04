import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Sheet } from '@/components/ui/Sheet'
import { CharacterAvatar } from './CharacterArt'
import { PriorityGlyph, PRIORITY_LABEL, PRIORITY_MEANING } from '@/components/ui/PriorityGlyph'
import { SearchIcon } from '@/components/ui/icons'
import { useStore } from '@/store/useStore'
import { elementLabel } from '@/lib/assets'
import type { Character, Priority } from '@/types'

/**
 * "Add to your sky".
 *
 * Two taps: find the character, say how badly you want them. Everything else is
 * optional and lives in the detail sheet. This should take under ten seconds.
 */

const PRIORITIES: Priority[] = ['must', 'want', 'interested', 'luxury']

const STATUS_NOTE: Record<Character['releaseStatus'], string | undefined> = {
  released: undefined,
  'official-unreleased': 'Announced, not yet playable',
  leaked: 'Unreleased — timing is speculative',
  speculative: 'Not announced',
}

export function CharacterPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const characters = useStore((s) => s.characters)
  const targets = useStore((s) => s.targets)
  const addTarget = useStore((s) => s.addTarget)

  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Character | null>(null)

  // The sheet stays mounted while it animates out, so a stale selection can
  // survive into the next open. Reset whenever it is opened.
  useEffect(() => {
    if (open) {
      setChosen(null)
      setQuery('')
    }
  }, [open])

  const alreadyPlanned = useMemo(
    () => new Set(targets.filter((t) => !t.archived).map((t) => t.characterId)),
    [targets],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = characters.filter((c) => (c.rarity ?? 5) >= 5 || q.length > 0)
    const matched = q
      ? pool.filter(
          (c) =>
            c.displayName.toLowerCase().includes(q) ||
            c.aliases?.some((a) => a.toLowerCase().includes(q)) ||
            c.region?.toLowerCase().includes(q) ||
            c.element?.toLowerCase().includes(q),
        )
      : pool

    // Unreleased characters first when browsing: those are what people plan for.
    return matched
      .slice()
      .sort((a, b) => {
        const rank = (c: Character) => (c.releaseStatus === 'released' ? 1 : 0)
        if (rank(a) !== rank(b)) return rank(a) - rank(b)
        return a.displayName.localeCompare(b.displayName)
      })
      .slice(0, 60)
  }, [characters, query])

  const close = () => {
    setChosen(null)
    setQuery('')
    onClose()
  }

  const commit = (priority: Priority) => {
    if (!chosen) return
    addTarget(chosen.id, priority)
    close()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      eyebrow={chosen ? 'One more thing' : 'Search'}
      title={chosen ? `How badly do you want ${chosen.displayName}?` : 'Add to your sky'}
    >
      {/* Enter-only, keyed by step: an exit animation here buys nothing and can
          strand the outgoing panel when the sheet unmounts mid-transition. */}
      <div>
        {chosen ? (
          <div key="priority" className="slide-in">
            <div className="mb-6 flex items-center gap-3">
              <CharacterAvatar character={chosen} size={52} />
              <div className="min-w-0">
                <p className="truncate font-display text-[19px] text-moon">{chosen.displayName}</p>
                <p className="text-[12px] text-moon-dim">
                  {elementLabel(chosen.element)}
                  {chosen.region ? ` · ${chosen.region}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="ml-auto shrink-0 text-[12px] text-frost/80 underline-offset-4 hover:underline"
                onClick={() => setChosen(null)}
              >
                Change
              </button>
            </div>

            <div className="space-y-2.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => commit(p)}
                  className="flex w-full items-start gap-3.5 rounded-2xl border border-[var(--hairline)] bg-[rgba(16,22,39,0.45)] px-4 py-3.5 text-left transition-colors hover:border-[rgba(169,213,232,0.4)] hover:bg-[rgba(169,213,232,0.07)]"
                >
                  <PriorityGlyph priority={p} size={17} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block font-display text-[18px] text-moon">{PRIORITY_LABEL[p]}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-moon-dim">
                      {PRIORITY_MEANING[p]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div key="search" className="rise">
            <div className="relative mb-4">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-moon-dim">
                <SearchIcon />
              </span>
              <input
                type="search"
                autoFocus
                className="field pl-11"
                placeholder="Search characters…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search characters"
              />
            </div>

            {results.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-moon-dim">
                No one by that name yet. Unannounced characters can be added from Admin.
              </p>
            ) : (
              <ul className="-mx-1">
                {results.map((c) => {
                  const planned = alreadyPlanned.has(c.id)
                  const note = STATUS_NOTE[c.releaseStatus]
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={planned}
                        onClick={() => setChosen(c)}
                        className={clsx(
                          'flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition-colors',
                          planned ? 'opacity-40' : 'hover:bg-[rgba(169,213,232,0.06)]',
                        )}
                      >
                        <CharacterAvatar character={c} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] text-moon">{c.displayName}</span>
                          <span className="block truncate text-[11.5px] text-moon-dim">
                            {elementLabel(c.element)}
                            {c.rarity ? ` · ${c.rarity}★` : ''}
                            {note ? ` · ${note}` : ''}
                          </span>
                        </span>
                        {planned && <span className="shrink-0 text-[11px] text-moon-faint">On your list</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
