# Resource Projection Logic

How the calculator turns a user's resources and planned banners into the numbers
on each row. Read this before touching the maths.

One engine, the ledger engine, entered at `hooks/useBannerResources.ts` (the
per-banner rows) and `hooks/useAverageMonthlyIncome.ts` (the "Income & Resources"
tiles). Both read the same ledger, so the rows and the tiles above them cannot
disagree — a user sees both at once, and that agreement is now structural rather
than a rule to remember.

A legacy windowed walk shipped alongside it behind `USE_INCOME_ENGINE_V2` until
2026-08-18, when it was deleted along with the flag and the per-window occurrence
helpers in `utils/incomeCalculationUtils.ts`. The section below is why.

---

## The model

> Build one flat, dated timeline of every reward. Then, for each banner, ask that
> timeline for the **total income from today up to that banner's end date**, and
> subtract what the banners resolving earlier already spent.

That is what the source spreadsheet does, and matching it is why the rewrite
happened.

### Why the walk was replaced

The legacy engine stepped a cursor banner to banner, accruing income into chained
half-open `(prevEnd, thisEnd]` windows. Every income source needed its own
occurrence counter, and every counter had to **tile** — `(a,b] + (b,c] === (a,c]`
— or totals drifted with how many banners the user happened to plan.

Tiling is a property you have to prove separately for each counter and can lose
silently. Losing it was the root cause of a long run of drift bugs against the
sheet: the Daily Carat Pack losing a day per window, misc earnings sawtoothing
0..+1,800, the throughout-carat model wandering between +1,164 and +9,643. Each
was found and fixed individually.

A closed form measured from a fixed anchor has nothing to lose. **Income is now a
pure function of a banner's end date** — nothing about the rest of the plan
reaches the calculation.

### The consequence worth internalising

Banner order no longer affects income at all. It only decides **who has already
spent** by the time a given banner is reached. So the sheet's "self-join over the
other banner rows" is still implementable as a single forward pass carrying a
running spend total — it just stops carrying income.

---

## Where each piece lives

| Module | Responsibility |
|---|---|
| `backend/calculatorapi/ledger.py` | Builds the flat dated timeline; served as `income_ledger` |
| `utils/utcDates.ts` | `DATEDIF` / `EOMONTH` / `WEEKDAY` / `CEILING` equivalents, in UTC |
| `utils/cumulativeIncome.ts` | One closed form per income source |
| `utils/incomeLedger.ts` | Queries over the ledger (event lumps, race counts, throughout decay) |
| `hooks/useBannerResources.ts` | The engine: income − spend, per banner |
| `utils/bannerHelpers.ts` | `applyPullStrategy`, `applyStepUpStrategy`, `allocateReservedCopies` |
| `utils/stepUpLadder.ts` | The step-up cost ladder and its odds, in closed form |

Every function in the first three names the spreadsheet cell it reproduces.
Where we knowingly differ, the comment says so.

---

## The pass

```
today = midnight UTC          // the sheet's $AG$3 (TODAY) — measures spans
now   = the live instant      // the sheet's $AG$2 (NOW)  — filters reward instants

sort banners by (start day, display position)
spent = { free, paid, umaTickets, supportTickets, ssrCrystals } = 0

for each banner:
    E        = its end date
    income   = cumulativeIncome(today, now, E)     // absolute, order-independent
    free     = startingFree + income.free - spent.free
    paid     = max(0, startingPaid + income.paid - spent.paid)
    strategy = applyPullStrategy(...)              // OR applyStepUpStrategy on a step-up row
    reserved = allocateReservedCopies(...)         // reservedCopies forced to 0 on a step-up
    results[displayIndex] = snapshot(...)
    spent += (pre-spend balance − post-spend balance)
```

**The two anchors are not interchangeable.** `today` measures spans, so every
estimate on a given calendar day is identical no matter when the page is opened.
`now` filters reward instants: an event that already opened today has paid out,
and its carats are in the balance the user typed in — counting them again would
double them.

**Ordering.** Keyed on the banner's start day, which is the sheet's `AH44`. The
sheet implements the tiebreak by nudging duplicate start dates forward a day
each; sorting by `(start day, display position)` is the same ordering without the
artifact that a nudged banner can collide with one genuinely starting the next
day.

**Results are written to each banner's display slot**, so `bannerResources[i]`
always belongs to `userPlannedBannerData[i]` regardless of pass order.

---

## Income sources

Each is a closed form from `today` to the banner's end date `E`.

| Source | Rule | Sheet |
|---|---|---|
| Daily quests + weekly login | `CEILING(days × (base + weekly/7), 10)` — a **blended** rate | `AN42` |
| Team Trials | Complete weeks since the Monday of the current week | `AO42` |
| Club Rank | Complete months since the 1st of the current month | `AP42` |
| Training Pass | Complete months since launch; carats either/or, tickets base + bonus, SSR shard paid-tier only | `AQ42`/`BA42`/`BH42` (the shard is ours — the sheet has no cell for it) |
| Daily Carat Pack | Daily drip (free) + a lump per cycle (paid) | `AR42`/`AZ42` |
| Champions Meeting / LoH | Count of ledger rows × the user's rank payout | `AS42`/`AT42` |
| 50-day login + Valentine's + White Day | Completed cycles, plus each gift the window reaches | `AU42` |
| Misc earnings | Daily drip after a ramp-in; **monthly** figure ÷ 30 | `AV42` |
| Event lump rewards | Ledger rows with `now ≤ date ≤ E` | `AL42` |
| Throughout carats | Decay curve, evaluated once from today | `AL43` |
| Campaign purchases | Paid carats (plus free carats for the webstore bonus), credited at the campaign's resolved **main part** start | `AM42`/`AY42` |

**The daily rate is blended, not day-by-day.** The legacy engine walked each day
and added the bonus on specific weekdays, phased off `today`. Same long-run rate,
but a different figure for any given banner — and it made every estimate depend
on which weekday the user opened the page.

**Complete months, not month boundaries crossed.** `DATEDIF(a, b, "M")` only
completes a month when the day-of-month comes round again: Jan 31 → Feb 28 is
**0**. Measuring from the 1st is what makes that agree with the old
boundary-crossing count.

**Everything is UTC.** The legacy engine mixed local (`startOfDay`,
`eachDayOfInterval`) with UTC (the throughout curve only). The sheet is UTC
throughout — its anchor cell is literally labelled "Today's Date UTC" — and a
local reading makes estimates depend on the viewer's timezone.

---

## The ledger

A flat, date-sorted row per reward instant, built server-side from `GameEvent`,
`ChampionsMeeting` and `LeagueOfHeroes`. See `backend/docs/api-reference.md`
(`IncomeLedgerRow`) for the field-by-field contract. Four things matter here:

- **`date` is when the reward lands** — an event's start; a race event's **end,
  less that kind's lead time**. A Champions Meeting settles 24 hours before its
  window closes, so its row is a day ahead of the end date the Timeline shows;
  League of Heroes has no lead time. The offset lives server-side
  (`RACE_REWARD_LEAD_TIME`) so nothing on the client re-derives it.
- **Race rows carry no amounts.** They are indicators; what a placement pays
  depends on the user's rank, which only the client knows. Once, it depends on
  the event too: League of Heroes #1 only ran to Platinum 1, so it pays at
  `min(user's rank, Platinum 1)`. Rows say which event they are via
  `event_number`; the rule lives in `RACE_RANK_CAPS` (`utils/incomeLedger.ts`).
- **`throughout_end` is the linked banner's end**, with the game-event buffer
  already removed, because the decay curve runs over the banner rather than the
  event. The client no longer keeps its own copy of that constant.
- **No row is filtered by "today" server-side.** The ledger is a set of dated
  facts; the projection applies `today < date ≤ E` client-side so the whole
  calculation shares one anchor.

### The throughout curve

An event's `carats_throughout` is a *pool*, not a lump. The curve blends a fast
exponential early decay with a slower linear tail, taking whichever leg has more
left — so it front-loads just after a banner opens and tapers after.

It is evaluated **once, from today**, and the result credited whole to a single
banner. An earlier model spread each pool across every banner window it
overlapped, which made a banner's estimate depend on how the user had sliced
their plan.

> The curve's shape (`throughout_decay_k`, `throughout_decay_linear_slope`) and
> its two offsets are admin-editable. `ceilToTen` exists because the sheet's
> `CEILING(..., 10)` is what its published figures are rounded to, and matching a
> specific banner's 1,120 exactly is what confirmed the rest of the model.

---

## Constants

Every tunable number comes from `GET /calculator-data`'s `calculation_constants`
key, editable in Django admin under **Configuration → Calculation constants**.
The engine takes them **as a parameter** — importing them at module scope would
freeze them at build time, defeating the point.

`DEFAULT_CONSTANTS` in `constants/gameConstants.ts` is the fallback when the key
is absent (fresh database, older API, a deploy where the two sides are briefly
out of step). The provider overlays server values on top of it, so a constant the
API doesn't know about yet keeps its default rather than arriving `undefined` and
turning every downstream total into `NaN`.

Two shape differences between the wire format and the legacy constants, handled
at the boundary: months are **1-indexed** (as a human editing the admin page
expects, not `Date.getMonth()`'s 0-indexed), and misc earnings is a **monthly**
figure dripped as `monthly / 30`.

---

## Invariants

- **A banner's income depends only on its end date** — not its position, not how
  many other banners are planned. This replaces the legacy engine's "banner count
  invariance" and is strictly stronger.
- **Free and paid carats are tracked separately.** Paid is floored at 0; free
  absorbs any shortfall and goes negative, which is what the row's red state
  reads. Only paid carats fund discounted pulls.
- **Overplanning is reported, not clamped** — the debt cascades to later banners.
- **Uma tickets only offset uma pulls; support tickets only support pulls.** No
  cross-substitution.
- **A campaign's paid carats credit at its MAIN part, not at its opening.** An
  anniversary spends its Part 1 announcing itself with login rewards; the packs
  go on sale with the anniversary proper, which is Part 2 and about ten days
  later. `main_start_date` on the wire carries that instant, and `start_date` /
  `end_date` remain the campaign's whole window. Only `anniversary` campaigns
  have a run-up — for every other kind the backend resolves the two to the same
  instant, so `main_start_date ?? start_date` is always the right read.
- **The webstore bonus is FREE carats, not paid.** A pack's own carats are paid —
  they were bought. The extra the webstore adds on top (`webstore_multiplier`,
  1.1x or 1.2x) is granted as free currency, so it never enlarges the paid
  balance a step-up or a discounted pull may spend. Both the Selectors totals and
  the projection go through `purchaseCarats()` in
  `utils/campaignPurchases.ts`; never re-multiply at a call site.
- **Selector tickets are banked up front**, outside the pass, and never fund a
  pull. A selector isn't spent at a banner — it takes a card from the back
  catalogue, which stays available after its banner ends. What constrains it is
  its **cutoff**, which is calendar-independent. They are a bucketed pool
  (`{ jpCutoff, targetCardId, count }[]`), not a scalar: two tickets with
  different cutoffs, or different picks, are different resources. Spending takes
  picked tickets first, then the *weakest qualifying* cutoff within each group.
- **A purchased selector pays only for the card picked for it.** The pick is
  `UserPlannedPurchase.target_uma` / `target_support`, set on the Selectors page,
  and rides on the bucket as `targetCardId`. Such a ticket funds a reserved copy
  only on a banner whose selectable featured cards include that id, and the
  cutoff is re-checked against that card's own `first_jp_date` at spend time (an
  admin can edit a cutoff or a release date after the pick was saved). When the
  card is on several planned banners, the earliest one that reserves a copy takes
  the ticket, which is just the date-order pass. A purchased selector with **no
  pick funds nothing** and never enters the pool; the engine reports it per row
  as `unpickedSelectorTickets` so `BannerRow` can explain the red field. Tickets
  the account already **owns** (`uma_selector_ticket` / `support_selector_ticket`)
  have no pick anywhere and keep `targetCardId: null`, the rule below. A pick
  does NOT reserve a copy by itself: `reserved_copies` stays a plan choice typed
  on the row, the pick stays an account fact.
- **An unpicked (owned) selector only has to reach ONE card on a banner.** The
  engine derives `oldestFeaturedJpDate`; gating on the newest let a single
  recent unit make a whole multi-uma banner read as unfundable.
- **Barred umas are filtered out BEFORE that date is taken.** An uma flagged
  `is_time_limited`, or not `is_three_star`, can never be taken by a selector at
  any cutoff, so it must not set the bar for one — otherwise a banner whose only
  old featured unit is time-limited reads as fundable off a card no selector can
  grant. Filtering rather than blocking keeps the ONE-card rule intact: barred
  units sit alongside ordinary ones and the siblings still qualify the banner.
  Go through `isCardSelectable` (`utils/selectorTickets.ts`), which mirrors the
  backend's `eligibility.is_intrinsically_selectable`.
- **`selectorsBarred` is a separate input to `allocateReservedCopies`, and has
  to be.** `oldestFeaturedJpDate` cannot carry "nothing here is takeable":
  an unrestricted (`null`-cutoff) ticket short-circuits `isCardEligible` before
  it reads the date, so a `null` date still funds. Null there means "no dated
  card", which an unrestricted ticket is right to ignore; `selectorsBarred`
  means "no card a selector could take at all", which it must not. A banner with
  an EMPTY featured list is not barred — that is a data gap, and unknowns here
  neither qualify a banner nor block one.
- **A step-up spends paid carats and nothing else** — never free carats, never
  tickets, never free pulls. Its deficit stays on the paid balance (floored at 0
  for display on the next row, the sheet's `MAX(0, N43)`) rather than becoming a
  free-carat debt, because there is no free-carat route to pay it.
- **A step-up's step count clamps at `banner_count * 5` for both cost and odds.**
  Affordability does not clamp it — see the asymmetry above.
- **Reserved copies change the odds, not the pull maths.** Selectors first, then
  SSR crystals; uma banners can only use selectors (no ★3 crystal in this data
  model). Over-reserving is reported via `reservedFunding.unfunded`.

## Step-up banners

A **Select Step-Up** is a third kind of planner row, alongside Uma and Support.
It is not a banner you pull on: it is a five-step cost ladder you climb with
**paid carats only**, where the fifth step of each round hands over a card you
choose from the back catalogue.

### The ladder

Five costs that repeat forever:

| Step in round | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Cost | 500 | 700 | 1,000 | 1,300 | 1,500 |
| Cumulative | 500 | 1,200 | 2,200 | 3,500 | **5,000** |

So a full round is 50 pulls for 5,000 paid carats, against 7,500 at the standard
150-per-pull rate. The discount is the entire point of the format.

`utils/stepUpLadder.ts` implements this as a **closed form**, not the sheet's
36-row lookup table:

```
cumulativeStepCost(n) = floor(n / 5) * 5000 + partialCum[n % 5]
stepsAffordable(p)    = floor(p / 5000) * 5 + largest r in 0..4 with partialCum[r] <= p % 5000
```

The table was only ever the sheet's way of writing down a repeating cycle, and it
stopped at 35 steps because the rows ran out — not because the game does. The
costs come from `CalculationConstants`, so an admin edit moves them.

### The two clamps are asymmetric, deliberately

```
stepsInExistence = banner_count * 5              // no more banners to buy
maxPossibleSteps = min(stepsInExistence, stepsAffordable(paidCarats))
chargeableSteps  = min(plannedSteps, stepsInExistence)   // NOT clamped by affordability
```

Over-planning past your **budget** still charges in full and shows the optimistic
odds, because the resulting deficit is the message — the same way an over-planned
pull count already behaves. Over-planning past what **exists** is not
unaffordable, it is impossible, so it is clamped away instead of reported.

### Odds

Three things differ from a standard banner, which is why `stepUpCopyDistribution`
exists rather than reusing `calculateCopyDistribution`:

| | Standard banner | Step-up |
|---|---|---|
| Trials | the planned pull count | `chargeableSteps * 10` |
| Rate | 0.75% (single featured card) | **0.3%** — the ~3% pool split across your 10 picks |
| Guarantees | one per 200 pulls (pity) | one per completed 5-step round |

Reading a step-up's step count as a pull count would understate a plan tenfold,
on top of the other two being wrong. `copyDistribution({ trials, rate, guaranteed })`
in `utils/probabilityCalculations.ts` is the shared core both go through.

The sheet credits only the step-5 "you choose" guarantee. Steps 3 and 4 also hand
over a card, but a *random* one of your ten selections, and the sheet ignores
them; we match the sheet. Modelling them properly is a second binomial at
`p = 0.1` layered on the first — a refinement past parity, not parity.

### Paid carats are contended

Step-ups and discounted pulls draw from the **same paid-carat pool**, and walk
order (banner start date) decides who drains it first. This is a real,
user-visible interaction with no equivalent anywhere else in the projection: a
step-up planned earlier in the timeline can leave a later banner unable to fund
its once-per-day discounted pulls.

### What a step-up does NOT touch

Free carats, uma tickets, support tickets, free pulls, SSR crystals, and the
daily discount allowance all pass through a step-up row unchanged. **Reserved
copies are disabled** on step-up rows: allocating one needs a featured-card list
to date a selector ticket against, and a step-up has none — its candidates are
back-catalogue cards bounded by the campaign's `jp_cutoff_date`. The sheet has no
equivalent concept either.

### Card selections change nothing

A step-up row can carry the ten cards the user intends to select
(`UserStepUpSelection`, edited on the campaign card in `/app/selectors`). **None of
it reaches the projection.** The target rate is `step_up_target_rate` = 3% ÷ 10 —
the pool rate split across the ten cards you named — and that holds whichever ten
they are, so a partial, empty or edited selection moves no number. It is a planning
record, exactly as on the source sheet, whose Selection 1–10 columns feed no formula
either.

The tempting mistake is deriving the rate from how many slots are filled (six
selections → 3% ÷ 6 = 0.5%). Don't: the game fixes the selection at ten, so a partial
selection is an unfinished plan, not a narrower pool, and floating the rate on it
would invent a number neither the sheet nor the game has.

A selection is also **not a reserved copy**. A reserved copy is one taken *instead of
pulling*, funded by a ticket or crystal; a selection is a candidate for pulls already
being paid for. Reserved copies stay disabled on step-up rows for the reason above.

The one thing selections do affect is presentation: the row named `is_target` (the
step 5 pick) supplies the planner row's thumbnail, resolving
guaranteed pick → `BannerStepUp.image` → the typographic `★3` / `SSR` chip.

Slot bookkeeping lives in `utils/stepUpSelection.ts`, deliberately free of React.

### The default selection

A step-up the user has never touched shows the **ten most recently available cards**,
with the most recent marked as the step 5 pick. The source sheet ships its Selection 1–10
columns pre-filled, so an untouched planner should not look emptier than the thing it
mirrors. A *rule* is used rather than a copy of the sheet's own (hand-curated, and near
but not equal to this one) because a hard-coded list silently rots as new banners land.

`useEligibleCardCatalogue` already sorts newest-first and filters to the campaign cutoff,
so "most recently available" is just the top of that list.

**The default is virtual.** It is never written until the user edits something, at which
point the edit lands on top of the ten and materialises all of them. That matters in both
directions: writing it eagerly would create eighty rows per account nobody asked for and
freeze "the ten newest" at whatever was newest the day the account first loaded the page,
whereas leaving it virtual lets an untouched default keep tracking new releases while a
touched selection stays exactly as its owner left it.

**No stored rows means untouched, not "deliberately empty."** The game gives you ten picks
and no way to decline them, so there is no plan a user could express by choosing nothing —
which is why clearing every slot returns you to the default rather than stranding you on
an empty one. Read it through `effectiveSelections()`; the picker, the campaign-card row
and the planner thumbnail all do, so the three can never disagree.

### `number_of_pulls` carries steps

A step-up row stores its step count in `number_of_pulls` — one column, two
meanings. Read it through `plannedSteps()` / `plannedPulls()` in
`utils/bannerHelpers.ts`, which return 0 for the kind of row they don't apply to.
Never read the field directly.

---

## Adding a new income source

1. If it's event-driven, add it to `backend/calculatorapi/ledger.py` and the
   serializer; if it's a rate or schedule, add a field to `CalculationConstants`.
2. Add a closed form to `utils/cumulativeIncome.ts` (or a query to
   `utils/incomeLedger.ts`), naming the sheet cell it reproduces.
3. Call it from `incomeTo()` in `useBannerResources` **and** from
   `useAverageMonthlyIncome` — unless it is one-off rather than recurring
   (campaign purchases are the standing exception; averaging them would report a
   recurring income nobody earns).
4. Update `backend/docs/income-calculation.md`.

There is no longer a tiling requirement to satisfy — that was the old engine's
step 7 and the source of most of its bugs.

## Sheet parity

The numbers are not yet confirmed to match the spreadsheet end to end. The
harness and the remaining known differences are documented in the `sheet-parity`
skill (`.claude/skills/sheet-parity/SKILL.md`); the fetcher is
`backend/scripts/fetch_sheet_parity_snapshot.py`.
