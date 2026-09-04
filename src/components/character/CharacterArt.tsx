import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Character, CharacterArtwork } from '@/types'
import { artworkFallbackChain, elementColor, isPlaceholder, resolveCharacterArtwork } from '@/lib/assets'
import { blobUrl } from '@/store/persistence'

/**
 * The only component that renders character artwork.
 *
 * It walks the resolved fallback chain on error and lands on a deliberate lunar
 * placeholder. A broken image icon is not a possible outcome.
 */

type Variant = 'thumb' | 'card' | 'timeline' | 'full'

const SIZES: Record<Variant, { className: string }> = {
  thumb: { className: 'h-11 w-11 rounded-full' },
  card: { className: 'h-full w-full' },
  timeline: { className: 'h-full w-full' },
  full: { className: 'h-full w-full' },
}

interface Props {
  character: Character
  variant?: Variant
  className?: string
  /** Timeline art is cut out and allowed to break the card edge. */
  bleed?: boolean
}

export function CharacterArt({ character, variant = 'card', className, bleed }: Props) {
  const chain = useMemo(() => artworkFallbackChain(character.assets), [character.assets])
  const [index, setIndex] = useState(0)
  const artwork: CharacterArtwork = chain[index] ?? character.assets.placeholder
  const [src, setSrc] = useState<string | undefined>()

  useEffect(() => {
    setIndex(0)
  }, [character.id])

  useEffect(() => {
    let cancelled = false
    if (isPlaceholder(artwork)) {
      setSrc(undefined)
      return
    }
    if (artwork.blobKey) {
      blobUrl(artwork.blobKey).then((url) => {
        if (cancelled) return
        if (url) setSrc(url)
        else setIndex((i) => Math.min(i + 1, chain.length - 1))
      })
    } else {
      setSrc(artwork.localUrl)
    }
    return () => {
      cancelled = true
    }
  }, [artwork, chain.length])

  const wrapper = clsx('relative overflow-hidden', SIZES[variant].className, className)

  if (!src || isPlaceholder(artwork)) {
    return (
      <div className={wrapper}>
        <LunarPlaceholder character={character} variant={variant} />
      </div>
    )
  }

  return (
    <div className={wrapper}>
      {/* Moonlight behind the cutout, so transparent art never floats. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(58% 46% at 50% 34%, ${elementColor(character.element)}22, transparent 72%)`,
        }}
      />
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={clsx(
          'relative h-full w-full object-cover object-top',
          bleed && 'scale-[1.08] object-contain',
        )}
        onError={() => setIndex((i) => Math.min(i + 1, chain.length - 1))}
      />
      {bleed && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(8,11,22,0.92))' }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Placeholders                                                        */
/* ------------------------------------------------------------------ */

/**
 * Three deliberate placeholder treatments. None of them invent a face - a
 * fabricated design could be mistaken for a real leak.
 */
function LunarPlaceholder({ character, variant }: { character: Character; variant: Variant }) {
  const accent = elementColor(character.element)
  const unknown = character.releaseStatus === 'speculative'
  const initial = character.displayName.trim().charAt(0).toUpperCase()
  const compact = variant === 'thumb'

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      style={{
        background: `radial-gradient(70% 58% at 50% 28%, ${accent}1f 0%, rgba(11,15,28,0.9) 68%)`,
      }}
      role="img"
      aria-label={`${character.displayName} — artwork unavailable`}
    >
      <svg viewBox="0 0 120 160" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`halo-${character.id}`} cx="50%" cy="30%" r="52%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.42" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`sil-${character.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* Halo */}
        <circle cx="60" cy="48" r="46" fill={`url(#halo-${character.id})`} />
        <circle cx="60" cy="48" r="27" fill="none" stroke={accent} strokeOpacity="0.34" strokeWidth="0.8" />
        <circle
          cx="60" cy="48" r="34"
          fill="none" stroke={accent} strokeOpacity="0.18" strokeWidth="0.6"
          strokeDasharray="2 6"
        />

        {unknown ? (
          // Unknown identity: a constellation mark, not a portrait.
          <g stroke={accent} strokeOpacity="0.5" strokeWidth="0.8" fill="none">
            <path d="M46 40 L60 30 L74 40 L69 58 L51 58 Z" />
            <circle cx="60" cy="30" r="1.6" fill={accent} fillOpacity="0.9" />
            <circle cx="46" cy="40" r="1.2" fill={accent} fillOpacity="0.7" />
            <circle cx="74" cy="40" r="1.2" fill={accent} fillOpacity="0.7" />
            <circle cx="51" cy="58" r="1.2" fill={accent} fillOpacity="0.7" />
            <circle cx="69" cy="58" r="1.2" fill={accent} fillOpacity="0.7" />
          </g>
        ) : (
          // Known but unillustrated: an abstract silhouette that reads as a figure.
          <g fill={`url(#sil-${character.id})`}>
            <circle cx="60" cy="46" r="15" />
            <path d="M60 62 C42 62 33 78 30 104 C28 122 30 148 32 160 L88 160 C90 148 92 122 90 104 C87 78 78 62 60 62 Z" />
          </g>
        )}
      </svg>

      {!compact && (
        <span
          className="pointer-events-none absolute bottom-2 left-0 right-0 text-center font-display text-[13px] tracking-wide2"
          style={{ color: `${accent}cc` }}
        >
          {unknown ? '—' : initial}
        </span>
      )}
    </div>
  )
}

/** Small round portrait used in lists and pickers. */
export function CharacterAvatar({ character, size = 44 }: { character: Character; size?: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full border border-[var(--hairline)]"
      style={{ width: size, height: size }}
    >
      <CharacterArt character={character} variant="thumb" className="h-full w-full rounded-full" />
    </div>
  )
}

export function unofficialArtworkNotice(character: Character): boolean {
  return resolveCharacterArtwork(character.assets).status === 'leaked'
}
