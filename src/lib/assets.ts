import type { Character, CharacterArtwork, CharacterAssets, Element } from '@/types'
import { PLACEHOLDER_URL } from '@/data/seedCharacters'

/**
 * CharacterAssetResolver (client half).
 *
 * The user-facing app only ever consumes `resolvedArtworkUrl`. It does not know
 * or care which provider the bytes originally came from - artwork is fetched
 * once by an admin, normalised, cached locally, and served from there.
 */

export function resolveCharacterArtwork(assets: CharacterAssets): CharacterArtwork {
  return (
    approvedOnly(assets.officialGacha) ??
    approvedOnly(assets.officialPromo) ??
    approvedOnly(assets.adminApproved) ??
    approvedOnly(assets.leaked) ??
    assets.placeholder
  )
}

function approvedOnly(a: CharacterArtwork | undefined): CharacterArtwork | undefined {
  return a && a.approved ? a : undefined
}

/** The chain the renderer walks when a source fails at runtime. */
export function artworkFallbackChain(assets: CharacterAssets): CharacterArtwork[] {
  return [
    assets.officialGacha,
    assets.officialPromo,
    assets.adminApproved,
    assets.leaked,
    assets.placeholder,
  ].filter((a): a is CharacterArtwork => Boolean(a) && (a as CharacterArtwork).approved !== false)
}

export function isPlaceholder(artwork: CharacterArtwork): boolean {
  return artwork.status === 'placeholder' || artwork.localUrl === PLACEHOLDER_URL
}

/** A leaked source is shown, but never dressed up as official. */
export function needsUnofficialNotice(artwork: CharacterArtwork): boolean {
  return artwork.status === 'leaked'
}

/* ------------------------------------------------------------------ */
/* Provider lookup (admin-only)                                        */
/* ------------------------------------------------------------------ */

export type ProviderId = 'enka' | 'hakush' | 'project-amber'

export interface ProviderAttempt {
  provider: ProviderId
  url: string
  ok: boolean
  error?: string
}

/**
 * Candidate URLs for a character's official gacha splash, in priority order.
 *
 * Nothing here runs in the normal app. It is invoked from /admin, the response
 * is validated and cached, and only the cached copy is ever rendered.
 */
export function candidateUrls(character: Character): { provider: ProviderId; url: string }[] {
  const key = character.internalName
  if (!key) return []
  return [
    { provider: 'enka', url: `https://enka.network/ui/UI_Gacha_AvatarImg_${key}.png` },
    { provider: 'hakush', url: `https://api.hakush.in/gi/UI/UI_Gacha_AvatarImg_${key}.webp` },
    {
      provider: 'project-amber',
      url: `https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_${key}.png`,
    },
  ]
}

export interface FetchResult {
  ok: boolean
  blob?: Blob
  provider?: ProviderId
  url?: string
  attempts: ProviderAttempt[]
}

/**
 * Try each provider until one returns a real image.
 *
 * Rejects HTML error pages masquerading as 200s - a surprisingly common failure
 * mode for community CDNs when a character is too new to exist yet.
 */
export async function fetchOfficialArtwork(character: Character): Promise<FetchResult> {
  const attempts: ProviderAttempt[] = []

  for (const candidate of candidateUrls(character)) {
    try {
      const res = await fetch(candidate.url, { mode: 'cors' })
      if (!res.ok) {
        attempts.push({ ...candidate, ok: false, error: `HTTP ${res.status}` })
        continue
      }
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) {
        attempts.push({ ...candidate, ok: false, error: `Not an image (${blob.type || 'unknown'})` })
        continue
      }
      if (blob.size < 2048) {
        attempts.push({ ...candidate, ok: false, error: 'Response too small to be artwork' })
        continue
      }
      attempts.push({ ...candidate, ok: true })
      return { ok: true, blob, provider: candidate.provider, url: candidate.url, attempts }
    } catch (e) {
      attempts.push({
        ...candidate,
        ok: false,
        error: e instanceof TypeError ? 'Blocked by CORS or offline' : String(e),
      })
    }
  }

  return { ok: false, attempts }
}

export async function imageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('Could not decode the image.'))
      img.src = url
    })
    return { width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* ------------------------------------------------------------------ */
/* Element colours                                                     */
/* ------------------------------------------------------------------ */

/** Muted to sit inside the lunar palette rather than fight it. */
export const ELEMENT_COLOR: Record<Element, string> = {
  anemo: '#93cbb8',
  geo: '#d3bb84',
  electro: '#b6a3d6',
  dendro: '#a9c98d',
  hydro: '#8ab6d8',
  pyro: '#d2988c',
  cryo: '#a9d5e8',
  unknown: '#8492a8',
}

export function elementColor(element: Element | undefined): string {
  return ELEMENT_COLOR[element ?? 'unknown']
}

export function elementLabel(element: Element | undefined): string {
  if (!element || element === 'unknown') return 'Element unknown'
  return element[0].toUpperCase() + element.slice(1)
}
