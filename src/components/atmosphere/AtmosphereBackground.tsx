import { memo, useMemo } from 'react'

export type Atmosphere = 'moon' | 'timeline' | 'wishlist' | 'history' | 'admin'

/**
 * The layered night sky the whole product sits inside.
 *
 * Six layers, all extremely low contrast: base wash, moon glow, stars, two fog
 * banks, a crystalline shard, and film grain. Sections shift the *composition*
 * (where the light falls, how cold it is) rather than swapping palettes.
 */

interface Props {
  variant?: Atmosphere
}

const COMPOSITION: Record<
  Atmosphere,
  { glow: [string, string]; tint: string; fogA: string; fogB: string; shard: number }
> = {
  moon: { glow: ['50%', '14%'], tint: 'rgba(169,213,232,0.16)', fogA: '18%', fogB: '78%', shard: -18 },
  timeline: { glow: ['78%', '8%'], tint: 'rgba(170,160,212,0.14)', fogA: '32%', fogB: '88%', shard: 24 },
  wishlist: { glow: ['22%', '10%'], tint: 'rgba(212,168,203,0.11)', fogA: '12%', fogB: '70%', shard: 8 },
  history: { glow: ['52%', '-4%'], tint: 'rgba(132,172,201,0.12)', fogA: '44%', fogB: '92%', shard: -32 },
  admin: { glow: ['50%', '-8%'], tint: 'rgba(132,172,201,0.07)', fogA: '60%', fogB: '96%', shard: 0 },
}

/** Deterministic star field - the sky must not reshuffle on every render. */
function useStars(count: number) {
  return useMemo(() => {
    let seed = 20260904
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    return Array.from({ length: count }, () => {
      const r = rand()
      return {
        x: +(rand() * 100).toFixed(2),
        y: +(rand() * 100).toFixed(2),
        // Most stars are barely there; a handful carry the eye.
        radius: +(0.35 + r * r * 1.15).toFixed(2),
        opacity: +(0.12 + r * 0.55).toFixed(2),
        gold: rand() > 0.88,
      }
    })
  }, [count])
}

export const AtmosphereBackground = memo(function AtmosphereBackground({ variant = 'moon' }: Props) {
  const c = COMPOSITION[variant]
  const stars = useStars(140)

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* 1 — base wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, #101728 0%, #0a0e1b 45%, #06080f 100%)',
        }}
      />

      {/* 2 — the moon's light */}
      <div
        className="absolute inset-0 animate-[breathe_26s_ease-in-out_infinite]"
        style={{
          background: `radial-gradient(46% 34% at ${c.glow[0]} ${c.glow[1]}, ${c.tint} 0%, transparent 68%)`,
        }}
      />

      {/* 3 — stars */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.radius * 0.08}
            fill={s.gold ? 'var(--star-gold)' : 'var(--moon)'}
            opacity={s.opacity}
          />
        ))}
      </svg>

      {/* 4 — fog banks */}
      <div
        className="absolute left-[-30%] h-[70vh] w-[160%] animate-[driftA_64s_ease-in-out_infinite]"
        style={{
          top: c.fogA,
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(132,172,201,0.10) 0%, transparent 70%)',
          willChange: 'transform',
        }}
      />
      <div
        className="absolute left-[-40%] h-[60vh] w-[180%] animate-[driftB_92s_ease-in-out_infinite]"
        style={{
          top: c.fogB,
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(170,160,212,0.09) 0%, transparent 72%)',
          willChange: 'transform',
        }}
      />

      {/* 5 — a crystalline shard catching light */}
      <svg
        className="absolute right-[-14%] top-[26%] h-[42vh] w-[70vw] opacity-[0.16]"
        viewBox="0 0 200 260"
        style={{ filter: 'blur(1.5px)', transform: `rotate(${c.shard}deg)` }}
      >
        <defs>
          <linearGradient id="shard" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--frost)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--lunar-violet)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M100 4 L152 92 L118 256 L74 150 L48 78 Z" fill="url(#shard)" />
        <path d="M100 4 L152 92 L118 256" fill="none" stroke="var(--frost)" strokeOpacity="0.28" strokeWidth="0.6" />
      </svg>

      {/* 6 — grain, to stop the gradients banding */}
      <div className="absolute inset-0 opacity-[0.045] mix-blend-overlay" style={{ backgroundImage: GRAIN, backgroundSize: '200px 200px' }} />

      {/* A soft vignette keeps the content column dominant. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(130% 90% at 50% 40%, transparent 40%, rgba(4,6,12,0.66) 100%)' }}
      />
    </div>
  )
})

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")"
