/**
 * Generates the PWA icon set without pulling in an image library.
 *
 * Everything is drawn per-pixel and encoded as a minimal RGBA PNG: a night-blue
 * field, a moon lit from the upper left, a thin orbital ring and a few stars.
 * Run with `node scripts/make-icons.mjs`.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')

/* ---- PNG encoding ---------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---- Drawing --------------------------------------------------------- */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const mix = (a, b, t) => a + (b - a) * clamp(t, 0, 1)
const smooth = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Deterministic star field, so regenerating the icons produces the same sky. */
function stars(count) {
  let seed = 20260904
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  return Array.from({ length: count }, () => ({
    x: rand(), y: rand(), r: 0.004 + rand() * 0.006, a: 0.25 + rand() * 0.6,
  }))
}

const STARS = stars(26)

function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  // A maskable icon must survive a circular crop, so the moon shrinks inward.
  const moonR = maskable ? 0.24 : 0.3
  const moonCx = 0.5
  const moonCy = 0.5

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size

      // Background: deep night, lifted slightly toward the moon.
      const dCentre = Math.hypot(u - moonCx, v - 0.42)
      let r = mix(16, 6, smooth(0.1, 0.72, dCentre))
      let g = mix(23, 8, smooth(0.1, 0.72, dCentre))
      let b = mix(40, 15, smooth(0.1, 0.72, dCentre))

      // Stars, behind the moon.
      for (const s of STARS) {
        const d = Math.hypot(u - s.x, v - s.y)
        const glow = (1 - smooth(0, s.r, d)) * s.a
        if (glow > 0) {
          r = mix(r, 238, glow)
          g = mix(g, 244, glow)
          b = mix(b, 250, glow)
        }
      }

      // Orbital ring.
      const ringD = Math.abs(Math.hypot(u - moonCx, v - moonCy) - (moonR + 0.085))
      const ring = (1 - smooth(0, 0.006, ringD)) * 0.34
      if (ring > 0) {
        r = mix(r, 169, ring)
        g = mix(g, 213, ring)
        b = mix(b, 232, ring)
      }

      // The moon: a lit disc with a soft terminator from the upper left.
      const dMoon = Math.hypot(u - moonCx, v - moonCy)
      const disc = 1 - smooth(moonR - 0.008, moonR + 0.008, dMoon)
      if (disc > 0) {
        const light = clamp(1 - (Math.hypot(u - (moonCx - 0.09), v - (moonCy - 0.09)) / (moonR * 1.9)), 0, 1)
        const lum = 0.35 + light * 0.72
        r = mix(r, clamp(210 * lum + 34, 0, 255), disc)
        g = mix(g, clamp(226 * lum + 34, 0, 255), disc)
        b = mix(b, clamp(240 * lum + 34, 0, 255), disc)

        // Bite out a crescent so the mark reads at 16px.
        const dShadow = Math.hypot(u - (moonCx + 0.115), v - (moonCy - 0.085))
        const shadow = (1 - smooth(moonR - 0.01, moonR + 0.01, dShadow)) * disc
        if (shadow > 0) {
          r = mix(r, 10, shadow * 0.94)
          g = mix(g, 15, shadow * 0.94)
          b = mix(b, 28, shadow * 0.94)
        }
      }

      const i = (y * size + x) * 4
      rgba[i] = Math.round(clamp(r, 0, 255))
      rgba[i + 1] = Math.round(clamp(g, 0, 255))
      rgba[i + 2] = Math.round(clamp(b, 0, 255))
      rgba[i + 3] = 255
    }
  }

  return encodePng(size, size, rgba)
}

/* ---- Output ---------------------------------------------------------- */

mkdirSync(outDir, { recursive: true })

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
]

for (const [name, size, opts] of targets) {
  writeFileSync(resolve(outDir, name), drawIcon(size, opts))
  console.log(`wrote icons/${name} (${size}px)`)
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#0B0F1C"/>
  <circle cx="16" cy="16" r="8" fill="#EEF4FA"/>
  <circle cx="20" cy="13" r="7.4" fill="#0B0F1C"/>
  <circle cx="16" cy="16" r="11" fill="none" stroke="#A9D5E8" stroke-opacity="0.35" stroke-width="0.9"/>
</svg>
`
writeFileSync(resolve(outDir, 'moon.svg'), favicon)
console.log('wrote icons/moon.svg')
