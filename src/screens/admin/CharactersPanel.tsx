import { useMemo, useRef, useState } from 'react'
import { AdminCard, AdminField, AdminSection, NumInput, SelectInput, TextInput, Warning } from './adminUi'
import { CharacterArt } from '@/components/character/CharacterArt'
import { useStore } from '@/store/useStore'
import { putBlob } from '@/store/persistence'
import {
  candidateUrls,
  elementLabel,
  fetchOfficialArtwork,
  imageDimensions,
  resolveCharacterArtwork,
  type ProviderAttempt,
} from '@/lib/assets'
import { makePlaceholder } from '@/data/seedCharacters'
import type { ArtworkStatus, Character, CharacterArtwork, Element, ReleaseStatus } from '@/types'

/**
 * Character catalogue and the artwork workflow.
 *
 * The rule this panel enforces: the player-facing app never fetches artwork from
 * a third party. An admin resolves it here once, it is cached locally, and the
 * app renders the cached copy from a stable URL.
 */

const ARTWORK_SLOTS: { slot: keyof Character['assets']; label: string; status: ArtworkStatus }[] = [
  { slot: 'officialGacha', label: 'Official gacha splash', status: 'official' },
  { slot: 'officialPromo', label: 'Official promo', status: 'official-promo' },
  { slot: 'adminApproved', label: 'Admin approved', status: 'admin-approved' },
  { slot: 'leaked', label: 'Leaked', status: 'leaked' },
]

const STATUS_LABEL: Record<ArtworkStatus, string> = {
  official: 'Official',
  'official-promo': 'Official promo',
  'admin-approved': 'Admin approved',
  leaked: 'Leaked',
  placeholder: 'Placeholder',
}

export function CharactersPanel() {
  const characters = useStore((s) => s.characters)
  const upsertCharacter = useStore((s) => s.upsertCharacter)

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>(characters[0]?.id ?? '')
  const [bulk, setBulk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return characters
      .filter((c) => !q || c.displayName.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      .slice(0, 200)
  }, [characters, query])

  const selected = characters.find((c) => c.id === selectedId) ?? filtered[0]

  const createCharacter = () => {
    const id = `temp:new-${Date.now().toString(36)}`
    const character: Character = {
      id,
      displayName: 'New character',
      releaseStatus: 'speculative',
      element: 'unknown',
      rarity: 5,
      assets: { placeholder: makePlaceholder(id) },
      updatedAt: new Date().toISOString(),
    }
    upsertCharacter(character)
    setSelectedId(id)
  }

  /** Checks every character for newly available official artwork. */
  const bulkRefresh = async () => {
    setBusy(true)
    let found = 0
    let unavailable = 0
    let skipped = 0

    for (const c of characters) {
      if (c.assets.officialGacha || !c.internalName || c.releaseStatus !== 'released') {
        skipped++
        continue
      }
      const result = await fetchOfficialArtwork(c)
      if (result.ok && result.blob) {
        const key = `${c.id}:officialGacha`
        const dims = await imageDimensions(result.blob).catch(() => ({ width: 0, height: 0 }))
        await putBlob(key, result.blob, dims)
        upsertCharacter({
          ...c,
          assets: {
            ...c.assets,
            officialGacha: buildArtwork(c.id, 'official', key, result.url, dims, result.provider),
          },
          updatedAt: new Date().toISOString(),
        })
        found++
      } else {
        unavailable++
      }
    }

    setBusy(false)
    setBulk(`${skipped} unchanged · ${found} new official assets found · ${unavailable} source${unavailable === 1 ? '' : 's'} unavailable`)
  }

  return (
    <>
      <AdminSection
        title="Characters"
        description="Identity is keyed on a stable id, never on a display name. Leaked entries use a temp: id until an official one exists."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-quiet !min-h-[38px] !px-4 !text-[13px]"
              onClick={bulkRefresh}
              disabled={busy}
            >
              {busy ? 'Checking…' : 'Refresh assets'}
            </button>
            <button type="button" className="btn btn-quiet !min-h-[38px] !px-4 !text-[13px]" onClick={createCharacter}>
              Add
            </button>
          </div>
        }
      >
        {bulk && <div className="mb-4"><Warning>{bulk}</Warning></div>}

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* -- list --------------------------------------------------- */}
          <div>
            <input
              className="field !min-h-[40px] !text-[13.5px]"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search characters"
            />
            <ul className="scroll-pane mt-2 max-h-[440px] space-y-0.5 pr-1">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] transition-colors ${
                      selected?.id === c.id ? 'bg-[rgba(169,213,232,0.1)] text-moon' : 'text-moon-dim hover:text-moon-muted'
                    }`}
                  >
                    <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-[var(--hairline)]">
                      <CharacterArt character={c} variant="thumb" className="h-full w-full rounded-full" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.displayName}</span>
                    {!c.assets.officialGacha && (
                      <span className="shrink-0 text-[10px] text-moon-faint">no art</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* -- editor ------------------------------------------------- */}
          {selected && <CharacterEditor key={selected.id} character={selected} />}
        </div>
      </AdminSection>
    </>
  )
}

function CharacterEditor({ character }: { character: Character }) {
  const upsertCharacter = useStore((s) => s.upsertCharacter)
  const setCharacterArtwork = useStore((s) => s.setCharacterArtwork)

  const fileInput = useRef<HTMLInputElement>(null)
  const [attempts, setAttempts] = useState<ProviderAttempt[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [targetSlot, setTargetSlot] = useState<keyof Character['assets']>('adminApproved')

  const resolved = resolveCharacterArtwork(character.assets)
  const set = (patch: Partial<Character>) =>
    upsertCharacter({ ...character, ...patch, updatedAt: new Date().toISOString() })

  const statusOf = (slot: keyof Character['assets']) =>
    ARTWORK_SLOTS.find((s) => s.slot === slot)?.status ?? 'admin-approved'

  const store = async (blob: Blob, slot: keyof Character['assets'], sourceUrl?: string, source?: string) => {
    const key = `${character.id}:${String(slot)}:${Date.now().toString(36)}`
    const dims = await imageDimensions(blob).catch(() => ({ width: 0, height: 0 }))
    await putBlob(key, blob, dims)
    setCharacterArtwork(
      character.id,
      slot,
      buildArtwork(character.id, statusOf(slot), key, sourceUrl, dims, source),
    )
  }

  const fetchOfficial = async () => {
    setBusy(true)
    setAttempts(null)
    const result = await fetchOfficialArtwork(character)
    setAttempts(result.attempts)
    if (result.ok && result.blob) {
      await store(result.blob, 'officialGacha', result.url, result.provider)
    }
    setBusy(false)
  }

  const addFromUrl = async () => {
    if (!manualUrl.trim()) return
    setBusy(true)
    try {
      const res = await fetch(manualUrl.trim(), { mode: 'cors' })
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) {
        setAttempts([{ provider: 'enka', url: manualUrl, ok: false, error: `Not an image (${blob.type || 'unknown'})` }])
      } else {
        await store(blob, targetSlot, manualUrl.trim(), 'manual-url')
        setManualUrl('')
        setAttempts(null)
      }
    } catch {
      setAttempts([{ provider: 'enka', url: manualUrl, ok: false, error: 'Blocked by CORS, or the URL is unreachable' }])
    }
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      <AdminCard>
        <div className="grid grid-cols-2 gap-3">
          <AdminField label="Display name">
            <TextInput value={character.displayName} onChange={(displayName) => set({ displayName })} />
          </AdminField>
          <AdminField label="Internal name" hint="Used to build UI_Gacha_AvatarImg_… lookups">
            <TextInput
              value={character.internalName ?? ''}
              onChange={(internalName) => set({ internalName: internalName || undefined })}
            />
          </AdminField>
          <AdminField label="Stable id" hint="Migrating temp: → official id keeps wishlists intact">
            <TextInput value={character.id} onChange={() => undefined} />
          </AdminField>
          <AdminField label="Game character id">
            <NumInput
              value={character.gameCharacterId ?? 0}
              onChange={(n) => set({ gameCharacterId: n > 0 ? n : undefined })}
            />
          </AdminField>
          <AdminField label="Release status">
            <SelectInput<ReleaseStatus>
              value={character.releaseStatus}
              onChange={(releaseStatus) => set({ releaseStatus })}
              options={[
                { value: 'released', label: 'Released' },
                { value: 'official-unreleased', label: 'Announced, unreleased' },
                { value: 'leaked', label: 'Leaked' },
                { value: 'speculative', label: 'Speculative' },
              ]}
            />
          </AdminField>
          <AdminField label="Element">
            <SelectInput<Element>
              value={character.element ?? 'unknown'}
              onChange={(element) => set({ element })}
              options={(['anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo', 'unknown'] as Element[]).map(
                (e) => ({ value: e, label: elementLabel(e) }),
              )}
            />
          </AdminField>
          <AdminField label="Rarity">
            <NumInput value={character.rarity ?? 5} min={4} max={5} onChange={(rarity) => set({ rarity })} />
          </AdminField>
          <AdminField label="Region">
            <TextInput value={character.region ?? ''} onChange={(region) => set({ region: region || undefined })} />
          </AdminField>
        </div>
      </AdminCard>

      {/* -- artwork ------------------------------------------------------ */}
      <AdminCard>
        <h3 className="mb-3 font-display text-[16px] text-moon">Artwork</h3>

        <div className="flex gap-4">
          <div className="h-[150px] w-[116px] shrink-0 overflow-hidden rounded-xl border border-[var(--hairline)]">
            <CharacterArt character={character} variant="card" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-moon-dim">Currently resolved</p>
            <p className="mt-0.5 text-[14px] text-moon">{STATUS_LABEL[resolved.status]}</p>
            <p className="mt-1 break-all text-[11px] text-moon-faint">{resolved.localUrl}</p>
            {resolved.sourceUrl && (
              <p className="mt-1 break-all text-[11px] text-moon-faint">from {resolved.sourceUrl}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-quiet !min-h-[34px] !px-3 !text-[12px]"
                onClick={fetchOfficial}
                disabled={busy || !character.internalName}
              >
                {busy ? 'Working…' : 'Fetch official artwork'}
              </button>
              <button
                type="button"
                className="btn btn-quiet !min-h-[34px] !px-3 !text-[12px]"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
              >
                Upload
              </button>
              <button
                type="button"
                className="btn btn-quiet !min-h-[34px] !px-3 !text-[12px]"
                onClick={() => {
                  for (const { slot } of ARTWORK_SLOTS) setCharacterArtwork(character.id, slot, undefined)
                }}
              >
                Reset to placeholder
              </button>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setBusy(true)
                  await store(file, targetSlot, undefined, 'admin-upload')
                  setBusy(false)
                }
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {/* -- slot management --------------------------------------------- */}
        <div className="mt-5 grid gap-3 sm:grid-cols-[180px_1fr]">
          <AdminField label="Upload / URL target slot">
            <SelectInput<keyof Character['assets']>
              value={targetSlot}
              onChange={setTargetSlot}
              options={ARTWORK_SLOTS.map((s) => ({ value: s.slot, label: s.label }))}
            />
          </AdminField>
          <AdminField label="Add image URL">
            <div className="flex gap-2">
              <TextInput value={manualUrl} onChange={setManualUrl} placeholder="https://…" />
              <button
                type="button"
                className="btn btn-quiet !min-h-[40px] shrink-0 !px-3 !text-[12px]"
                onClick={addFromUrl}
                disabled={busy}
              >
                Fetch
              </button>
            </div>
          </AdminField>
        </div>

        <ul className="mt-4 space-y-1.5">
          {ARTWORK_SLOTS.map(({ slot, label }) => {
            const artwork = character.assets[slot] as CharacterArtwork | undefined
            return (
              <li
                key={String(slot)}
                className="flex items-center justify-between gap-3 border-b border-[rgba(169,213,232,0.07)] pb-1.5 text-[12px] last:border-0"
              >
                <span className="text-moon-dim">{label}</span>
                {artwork ? (
                  <span className="flex items-center gap-3">
                    <span className="num text-moon-faint">
                      {artwork.width ? `${artwork.width}×${artwork.height}` : 'cached'}
                    </span>
                    <label className="flex items-center gap-1.5 text-moon-muted">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[var(--frost)]"
                        checked={artwork.approved}
                        onChange={(e) =>
                          setCharacterArtwork(character.id, slot, { ...artwork, approved: e.target.checked })
                        }
                      />
                      approved
                    </label>
                    <button
                      type="button"
                      className="text-moon-faint hover:text-danger"
                      onClick={() => setCharacterArtwork(character.id, slot, undefined)}
                    >
                      Remove
                    </button>
                  </span>
                ) : (
                  <span className="text-moon-faint">—</span>
                )}
              </li>
            )
          })}
        </ul>

        {/* -- warnings ---------------------------------------------------- */}
        <div className="mt-4 space-y-2">
          {!character.assets.officialGacha && character.releaseStatus === 'released' && (
            <Warning>No official splash cached. The app is showing a placeholder.</Warning>
          )}
          {character.assets.leaked && !character.assets.officialGacha && (
            <Warning>
              Using leaked artwork. The player-facing UI marks it as unofficial and never dresses it up as an official
              asset.
            </Warning>
          )}
          {attempts && (
            <div className="rounded-lg border border-[var(--hairline)] bg-[rgba(8,12,22,0.6)] p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wide2 text-moon-faint">Providers checked</p>
              <ul className="space-y-1 text-[11.5px]">
                {attempts.map((a, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3">
                    <span className="text-moon-dim">{a.provider}</span>
                    <span style={{ color: a.ok ? 'var(--success)' : 'var(--danger)' }}>
                      {a.ok ? 'ok' : a.error}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-moon-faint">
                Community CDNs frequently block cross-origin requests from the browser. When that happens, upload the
                file directly — the result is identical, because the app only ever serves the cached copy.
              </p>
            </div>
          )}
          {character.internalName && (
            <details className="text-[11.5px] text-moon-faint">
              <summary className="cursor-pointer">Candidate source URLs</summary>
              <ul className="mt-1.5 space-y-1">
                {candidateUrls(character).map((c) => (
                  <li key={c.url} className="break-all">
                    {c.provider}: {c.url}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </AdminCard>
    </div>
  )
}

function buildArtwork(
  characterId: string,
  status: ArtworkStatus,
  blobKey: string,
  sourceUrl: string | undefined,
  dims: { width: number; height: number },
  source?: string,
): CharacterArtwork {
  const now = new Date().toISOString()
  const slug = characterId.replace(/^temp:/, '')
  return {
    id: blobKey,
    characterId,
    status,
    sourceType:
      source === 'admin-upload'
        ? 'admin-upload'
        : source === 'manual-url'
          ? 'manual-url'
          : source === 'enka'
            ? 'enka'
            : source === 'hakush'
              ? 'hakush'
              : source === 'project-amber'
                ? 'project-amber'
                : 'manual-url',
    sourceUrl,
    // Stable, app-owned URL. Versioned so a replacement never serves a stale cache.
    localUrl: `/assets/characters/${slug}/timeline-${Date.now().toString(36)}.webp`,
    blobKey,
    transparentBackground: true,
    width: dims.width || undefined,
    height: dims.height || undefined,
    addedAt: now,
    updatedAt: now,
    approved: true,
  }
}
