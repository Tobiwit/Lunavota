# Lunavota

A mobile-first wish planner for Genshin Impact, built to be added to an iOS home screen.

It is not a pity tracker. It answers a different question:

> How many of the wishes I hold today are already spoken for, and what does pulling
> now cost me later?

```bash
npm install
npm run dev
```

## The three surfaces

| | Screen | Question |
|---|---|---|
| Present | **Moon** | What can I safely spend today? |
| Future | **Timeline** | What will I have when my characters arrive? |
| Intent | **Wishlist** | Who am I actually saving for? |

Each feeds the others: a wishlist change moves the forecast, the forecast moves
affordability, a pull moves the Moon.

`/admin` holds the shared game catalogue — versions, income, banner predictions and
character artwork — so players never type in a version schedule themselves.

## Architecture

Game mechanics are kept out of the UI entirely. `src/engine/` is plain TypeScript
with no React in it:

```
engine/wish.ts         Character Event Wish mechanics
engine/forecast.ts     Calendar-aware income projection
engine/planning.ts     Reservation, protection and affordability
engine/simulation.ts   Non-destructive "what if I pull?"
engine/predictions.ts  Weighted banner placement
engine/timeline.ts     Timeline node assembly and grouping
```

`store/selectors.ts` is the only place the engines are wired together.

### The line that runs through everything

`wish.ts` separates two kinds of number, and the UI never blurs them:

- **Deterministic** — `worstCaseCost`. Hard pity is 90; without a guarantee a
  limited 5★ costs at most 180. Pure arithmetic on documented mechanics. Only
  these may be called *guaranteed*.
- **Estimated** — everything built on `fiveStarRate`. HoYoverse has never
  published the soft-pity curve, so this is a community approximation. It appears
  as *likely* / *at risk*, never as a guarantee.

Capturing Radiance is modelled as upside only. It never reduces a worst case, so
the planner cannot tell you a Must target is safe when it is not.

### What "protected" means

Reservations are allocated greedily by priority. Future income is consumed
**latest-first**, so a distant Must target does not starve a nearer Want of income
that arrives long before the Must banner opens.

Only **Must** and **Want** can hold back wishes you already have. *Interested* is
explicitly conditional and *Luxury* is explicitly for spare resources, so neither
is allowed to drive "safe to spend" toward zero — they are still costed, still
graded, but they draw on projected income instead.

Priority decides how certain the plan insists on being; mode decides how hard it
works below a Must. `TARGET_CONFIDENCE` maps the two onto a percentile of the cost
distribution, and mode also picks which edge of the income band a decision may
lean on.

For a C0 limited 5★ from zero pity those percentiles land at:

| Certainty | Wishes | |
|---|---:|---|
| 0.50 | 80 | the 50/50 went your way |
| 0.80 | 150 | Balanced funds a Want here |
| 0.90 | 155 | |
| 1.00 | 180 | deterministic — Musts are planned here |

The curve is deliberately not linear: half the time the 50/50 is won and the cost
stops near 80, after which the second 5★ pushes everything toward the 180 ceiling,
so the tiers between 150 and 180 buy very little. A Must is planned to the full
guarantee in every mode but Risky, because that is what "I would strongly regret
missing them" has to mean.

Cards show what this buys — **set aside**, **needs**, and the resulting **chance** —
rather than the banner-timing confidence, which is a different question and is
carried by the probability ring around each portrait.

### Timeline density

A version's own content — dailies, Welkin, Battle Pass, events, quests,
exploration, codes, misc — is not a moment anyone acts on, so it folds into the
version header and opens on tap. What keeps its own node is what you plan around:
Spiral Abyss, Imaginarium Theater, Stygian Onslaught, shop resets and one-off
gifts.

### Forecasting

The version content baseline is 4,000 Primogems (~25 wishes), split across events,
quests, exploration, maintenance/codes and misc, and **distributed across dates**
so the forecast can answer "how many wishes will I have on the 17th?" rather than
"how many are in this patch?". Dailies, Welkin, Battle Pass, endgame resets and
the shop are modelled separately so nothing is counted twice. Gifts (anniversary,
Lantern Rite) sit on top of the baseline rather than changing it.

### Predictions

Nothing shipped in `seedPredictions.ts` is confirmed — every entry is
`speculation` with a note saying to replace it. Predictions always render as a
version, a phase and a percentage with the reasoning one tap away; there is no
sensational leak surface anywhere. Users can override any prediction for
themselves without touching the shared catalogue.

### Artwork

The player-facing app never fetches artwork from a third party. An admin resolves
it once (Enka → Hakush → Project Amber, with content-type validation), it is
cached as a blob in IndexedDB, and components consume only a stable app-owned URL.
When nothing is available the renderer draws a deliberate lunar placeholder —
a silhouette for a known character, a constellation mark for an unknown one. It
never invents a face that could be mistaken for a leak, and a broken image icon is
not a reachable state.

Characters are keyed on stable ids (`temp:mitya` until an official id exists), never
on display names.

**Presentation.** `CharacterSplash` makes the art part of the card rather than a
thumbnail beside it. Official gacha splashes ship with a *painted* background
rather than a cutout, so a straight edge reads as a photo pasted on; two crossed
linear masks dissolve all four sides, and a night wash — inside the mask, or it
paints the very rectangle it was meant to hide — settles the brightness into the
same room as the rest of the interface. Everything that is not a placeholder gets
`object-position: top`, because a face is never the thing that should be cropped.

## Data

Local-first: everything lives in IndexedDB behind `PersistenceAdapter` in
`store/persistence.ts`, so cloud sync can be added later without touching the app.
JSON export/import is in Settings. There is no account and no wall.

## Notes on the seed data

The version schedule is a **scaffold**, not confirmed information: 42-day versions
from a fixed anchor. Era naming restarts at each major version — Luna I–IX across
6.0–6.8, then Snezhnaya I onward from 7.0 — so `ERAS` in `data/seedVersions.ts` is
the one place to extend when the next era is announced. Correct the names and dates
in `/admin` and every forecast recalculates. The same applies to the recurring
income constants.

## Conventions

- Entrance motion is CSS keyframes with `backwards` fill, not JS tweens — an
  animation that never runs must still leave content visible. Framer Motion is
  reserved for genuinely interactive motion (sheets, drag, layout indicators).
- `.num` forces the interface face onto every figure; Marcellus has no legible `1`.
- Priority is never encoded by colour alone: moon-phase glyph, word and accent
  always travel together.
- A target with no credible banner placement states no affordability at all. It
  cannot be funded against a date, so it does not lock the pool and does not get a
  status badge — it says "no known banner yet" and stays out of the way.
- `prefers-reduced-motion` is honoured globally in `styles/index.css`.

## Stack

React 18 · TypeScript · Vite · Tailwind · Zustand · Dexie · Framer Motion ·
`vite-plugin-pwa`. Icons are generated by `node scripts/make-icons.mjs`, which
draws them per-pixel and encodes PNGs directly rather than adding an image
dependency.
