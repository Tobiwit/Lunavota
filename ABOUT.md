# Lunavota — what it is, and what it isn't

A mobile-first wish planner for Genshin Impact, built to be added to an iOS home
screen. It is **not a pity tracker**. Plenty of those exist and they answer a
question you can already answer by opening the game.

Lunavota answers a harder one:

> How many of the wishes I hold today are already spoken for, and what would
> pulling now cost me later?

---

## The use case

You have a wishlist and not enough wishes for all of it. Two characters you want
are three patches apart. You are 40 pulls from a guarantee and a banner you
half-care about just went live.

The question is never "how much pity do I have". It is **"if I spend here, what
breaks?"** — and answering it by hand means holding the version calendar, your
income rate, the 50/50, and four competing characters in your head at once.

That is the entire job. Lunavota exists to make that one decision legible.

It is for a player who plans. If you pull on whatever looks interesting and never
think past the current banner, this app has nothing to offer you and you should
not install it.

---

## What it does

### Tells you what you can actually spend

The Moon screen leads with one number: **wishes safe to spend right now**. Behind
it, a reservation engine allocates your pool across your wishlist by priority,
consuming projected future income *latest-first* so a distant Must target does
not starve a nearer Want of income that arrives long before its banner opens.

Tap **Why?** and it shows its working — which target is holding which wishes.

### Distinguishes a guarantee from a hope

This is the line the whole app is built around, and it never blurs it:

- **Deterministic.** Hard pity is 90. Without a guarantee, a limited 5★ costs at
  most 180 wishes. This is arithmetic. Only these numbers are ever called
  *guaranteed*.
- **Estimated.** Everything else rests on a soft-pity curve HoYoverse has never
  published. It appears as *likely* / *at risk* and as odds rounded to 5%.

Priority decides how certain the plan insists on being. For a C0 limited 5★ from
zero pity:

| Certainty | Wishes | |
|---|---:|---|
| 50% | 80 | the 50/50 went your way |
| 80% | 150 | Balanced funds a **Want** here |
| 100% | 180 | deterministic — **Must** targets are planned here |

The curve is deliberately not linear: half the time the 50/50 is won and the cost
stops near 80, after which the second 5★ pushes everything toward the 180 ceiling.
The tiers between 150 and 180 buy very little.

*Interested* and *Luxury* never hold back wishes you already have — by definition
they are for what is left over.

### Forecasts forward, by date

A vertical timeline projects your resources across the version calendar. The
running version is pinned to today with what is still to come in it. Each future
version carries the wishes expected during it, and each planned character shows
what is set aside, what the plan needs, and the resulting **chance**.

Income is modelled per source and per date — dailies, Welkin, Battle Pass, Spiral
Abyss, Imaginarium Theater, Stygian Onslaught, shop resets, and a 4,000-Primogem
content baseline per version distributed across the days it actually lands on. So
it can answer "how many wishes will I have on the 17th?", not just "how many are
in this patch?".

You tell it how you play — completion rate, endgame clears, subscriptions — and
it recalculates.

### Lets you test a decision before making it

**What if I pull?** runs a full simulation on a copy of your state: win the 50/50,
lose it, spend 20, go for C1, take the weapon, skip. It re-runs the entire
planning engine and shows what each outcome does to the *rest* of your roadmap —
which characters drop from Guaranteed to At risk. Nothing is written until you
tap **Apply outcome**.

### Keeps intent separate from mechanics

A wishlist of four priorities (Must / Want / Interested / Luxury), constellation
targets, reasons, notes, and pull rules you set *before* the banner arrives —
while you are calm — instead of at 3am with 40 wishes left.

### Runs offline, owned by you

Installable PWA. Everything lives in your browser. No account, no wall, no server,
nothing sent anywhere. JSON export and import in Settings.

---

## What it does not do

**It does not tell you to pull.** There is no celebration, no confetti, no urgency,
no casino. It reports what a choice costs and stops. If it talks you *out* of a
pull, that is the app working.

**It does not import your wish history.** You log 5★ pulls by hand, or just keep
pity and guarantee up to date. Automatic import is deliberately not required to
use the app, and is not built.

**It does not plan weapon banners.** The signature-weapon toggle on a target is a
note to yourself; Epitomized Path and weapon pity are not modelled. Standard,
Beginner and Chronicled Wish banners are not planned either.

**It does not know when characters actually release.** Nobody does. Predictions
are probabilities with a source and a confidence attached, and everything shipped
in the app is marked *speculation* until an admin replaces it. A character with no
credible placement holds back nothing and states no affordability at all — it sits
under "Beyond the horizon" and stays out of your way.

**It does not claim precision it lacks.** Odds are rounded to 5%. Income carries a
low/expected/high band. Capturing Radiance is modelled as upside only and can
never reduce a worst case, so the planner cannot tell you a Must target is safe
when it is not.

**It does not sync.** Data lives in one browser on one device. Clear your site data
and it is gone. Export a backup.

**It does not ship character artwork.** Art is resolved once by an admin, cached
locally, and served from there — the app never fetches from a third party at
runtime. Until then you get a deliberate lunar placeholder, never a broken image.

**It does not track your roster.** No constellation inventory, no owned-character
list, no team building.

**It does not notify you.** No push, no reminders, no background anything.

Two pull rules — *only if X wishes remain after* and *only pull if fully funded* —
are stored and displayed but **not enforced by the budget engine**. They are notes
to yourself, not constraints. The other rules do affect costing.

---

## Honest limitations

- **The shipped version schedule is a scaffold**, not confirmed information: 42-day
  versions from a fixed anchor. Correct it in `/admin` and every forecast
  recalculates. Nothing you edit there is ever overwritten by the defaults unless
  you reset the catalogue yourself.
- **The soft-pity curve is a community approximation.** Every probability in the
  app inherits that uncertainty. The deterministic numbers do not.
- **The income model is an estimate keyed to your own honesty** about how much of a
  version you finish. Set it wrong and the forecast is wrong.
- **Forecast calibration is not built yet.** The app cannot yet compare what you
  expected to earn against what you actually earned.
- **One user, one browser.** There is no multi-device story.

---

## Not affiliated with HoYoverse

Lunavota is an unofficial fan-made planning tool. Genshin Impact, its characters
and its artwork are the property of HoYoverse. Nothing here is endorsed by them,
and no prediction in this app should be read as an announcement.
