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
engine/simulation.ts   Non-destructive single-banner outcomes
engine/chain.ts        Chained "what if I pull?" across the whole wishlist
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

Every band but **Luxury** can hold back wishes you already have. Luxury is
explicitly for spare resources, so it is never allowed to drive "safe to spend"
toward zero — it is still costed and still graded, but it draws only on what is
left over. Neither does a **stretch**, whatever its owner's band.

Allocation runs in two passes. The first covers every target's `planned`
reservation in priority order — that is the commitment. The second hands out what
is still unclaimed afterwards, so a Want reaches for its stretch only once nothing
with a firmer claim needs those wishes, and a Luxury only after that. Because the
passes are ordered, a stretch can never take income a base reservation needed.

`REFERENCE_RESERVE` states each band as the wishes it sets aside for the ordinary
case — a C0 goal from zero pity — and `confidenceForReserve` converts that to a
quantile of the cost curve once. The engine plans with the quantile, which is what
lets banked pity and a constellation goal above C0 move the reservation; a literal
155 would be nonsense for a C2 target and wasteful at 70 pity. Mode also picks
which edge of the income band a decision may lean on.

In Balanced mode, for a C0 limited 5★ from zero pity:

| Band | Sets aside | Stretches to | |
|---|---:|---:|---|
| Must | 180 | — | deterministic — the full guarantee |
| Dream | 155 | — | p90 |
| Want | 120 | 155 | p70, stretching to p90 |
| Try | 90 | — | hard pity for one 5★ — deterministic |
| Luxury | 0 | 75 | p27, entirely from what is spare |

The curve is deliberately not linear: half the time the 50/50 is won and the cost
stops near 80, after which the second 5★ pushes everything toward the 180 ceiling,
so the tiers between 150 and 180 buy very little. A Must is planned to the full
guarantee in every mode but Risky, because that is what "I would strongly regret
missing them" has to mean.

**Try** carries a stopping rule rather than a certainty, so no mode moves it: it
budgets to the first 5★, won or lost. Its odds are discounted by the 50/50, since
reaching *a* 5★ is not reaching *that* one — and a fully funded Try reads as
"Funded", never "Guaranteed", because only its budget is certain.

Banners nobody on the wishlist is pulling on still appear, at half the height of a
planned one and a great deal quieter. They carry the same borderless splash
treatment: two characters take an edge each and meet in the middle, one keeps the
right, and the art dissolves into the page rather than into a card. `muted` drains
colour without removing it — a fully grey figure reads as disabled, and these
characters are perfectly real, just not on the plan — without them a phase reads as empty when it
is merely not yours. Everyone slotted into the same version and phase shares one
row, unknown phases grouping with each other; each character is placed once, at
its strongest prediction, so a speculative name cannot appear in four phases at
once. The height is fixed rather than content-sized, because the proportion is how
the eye sorts a decision from context before reading a word.

Cards show what this buys — **set aside**, **needs**, and the resulting **chance** —
rather than the banner-timing confidence, which is a different question and is
carried by the probability ring around each portrait.

### Timeline density

A version's own content — dailies, Welkin, Battle Pass, events, quests,
exploration, codes, misc — is not a moment anyone acts on, so it folds into the
version header and opens on tap. What keeps its own node is what you plan around:
Spiral Abyss, Imaginarium Theater, Stygian Onslaught, shop resets and one-off
gifts.

The version already running is pinned to TODAY rather than sitting at its own
start date, where it would fall behind the "show earlier events" fold and take
*how much is still to come this patch* with it. It measures from the balance the
TODAY marker shows rather than from `balanceAt(now)`, which already contains
today's own accrual and would leave the card a wish short of its own total.

### Forecasting

The version content baseline is 4,000 Primogems (~25 wishes), split across events,
quests, exploration, maintenance/codes and misc, and **distributed across dates**
so the forecast can answer "how many wishes will I have on the 17th?" rather than
"how many are in this patch?". Dailies, Welkin, Battle Pass, endgame resets and
the shop are modelled separately so nothing is counted twice.

Anything spread across a window is prorated to the part of that window still
ahead — half a version's events are gone once half their window is. Clamping the
window forward to today without clamping the amount is the bug that made a
patch's events worth as much on its last day as on its first. Gifts (anniversary,
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
from a fixed anchor at 2025-09-10. Era naming restarts at each major version — Luna
I–VIII across 6.0–6.7, then Snezhnaya I onward from 7.0 on 2026-08-12 — so `ERAS`
in `data/seedVersions.ts` is the one place to change when the next era is
announced. The same applies to the recurring income constants.

**The seed only runs on a fresh install.** Once a catalogue exists it is the user's,
and nothing reapplies the defaults on load; only an explicit reset, "Start over", or
a backup import replaces it. Schema migrations are the sole exception and are
written to be conservative: they bail out if the shipped schedule has been edited at
all, skip any row carrying a hand-written name, and never rewrite a version id,
because banner predictions reference those and a rename would orphan the forecasts
attached to them.

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
