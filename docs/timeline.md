# The Timeline

How the Timeline page (`/app/timeline`, `components/timeline/`, `src/timeline.css`) is put
together, and the rules that are easy to break. Moved out of `ui-conventions.md` on
2026-11-24, when the page's layout moved out of class strings and into its own stylesheet.

**Before changing anything here, know the two checks:**

- `src/__tests__/timelineCss.test.ts` reads `timeline.css` and fails on the declarations
  that have each broken the page before. `sectionLayout.test.ts` is the table of which
  layout a section gets.
- The **geometry check** measures the real page before and after a change: every element's
  box and every computed style, on four themes at fourteen widths. A change that is meant
  to be invisible passes at zero differences. It lives in the notes repo
  (`.claude/skills/verify/timeline/geometry.mjs`); `/verify` says how to run it.

## Where things are

| What | Where |
|---|---|
| The page: filter, search, paging, infinite scroll, deep-link arrival | `Timeline.tsx` |
| Grouping rows, markers, focus matching, the countdown label | `timelineShared.ts` |
| The shell every card sits in, its header row, the countdown pill | `TimelineCard.tsx` |
| A banner window: the header and its list of sections | `BannerWindowCard.tsx` |
| One banner: its chip, its art, its two panels | `BannerSection.tsx` |
| Which layout a section gets (a pure function) | `sectionLayout.ts` |
| A panel: title line, chips, tiles, the Stage button | `FeaturePanel.tsx`, `bannerCardStatus.ts` |
| One uma or support card | `FeaturedTile.tsx` |
| A Champions Meeting or League of Heroes event | `RaceEventCard.tsx`, `CourseDetails.tsx`, `RaceRewards.tsx` |
| A scenario launch or a campaign opening | `EventMarkerCard.tsx` |
| The strips attached to a card | `AnniversaryEventStrip.tsx`, `StoryEventStrip.tsx` |
| Every width, track and cap; the chips; the hook names | `src/timeline.css` |

## What changes at which width

The page is fluid between these points. Nothing else switches.

| From | Tailwind's name | What changes |
|---|---|---|
| 40rem (640px) | `sm` | A card's header becomes one row (title left, pills right). Card padding goes from 8px to 12px. In a `three` or `support-led` section the two panels share a row under the art. Titles step up a size. |
| 48rem (768px) | `md` | A marker pair (campaign and scenario) sits side by side with a rule between. A story event's row lays out sideways. The control bar's buttons lose their 40px minimum height. |
| 64rem (1024px) | `lg` | The control bar becomes three groups on one line, and the "Showing N of M" count becomes a pill in the middle. With a window at least 32rem tall (`app-shell`), the bar sticks to the top. |
| 80rem (1280px) | `xl` | **The big one.** A section's row becomes art beside panels (`three`, `support-led`, `pair`), and every piece of art takes the one shared width, `--timeline-art-width`. A race card puts its course details beside its art. Below this, everything is one stacked column and the art is capped at 41rem. |
| 96rem (1536px) | `2xl` | The tile caps grow: an uma tile from 10rem to 13.5rem, a support tile from 8.75rem to 11.75rem (7.75rem to 9.5rem in a band). |
| never | | **A band.** It is one line at every width, and scrolls sideways inside itself when its tiles don't fit. |

Two things switch on a **container's** width, never the window's:

- `--timeline-art-width` is measured against the card's panel (`100cqw`), so the art is the
  same width however deeply it is nested.
- The chips in a panel's title line step down by that line's own width (18, 20, 23, 26 and
  30rem), so a narrow panel on a wide screen still gets the short form.

## The hooks a theme may select

A hook is a class or attribute that says what a part **is**. It carries no paint of its own.
Hooks are the only thing `personalityThemes.css` may select on this page (its rule 2), so a
theme never has to reach for a utility class. The full list, with what each one names, is
the header of `src/timeline.css`: `tl-bar`, `tl-control`, `tl-readout`, `tl-card`,
`tl-icon-box`, `tl-title`, `tl-pill` (with `data-size`), `tl-countdown`, `tl-panel` (with
`data-kind` and `data-layout`), `tl-panel-title`, `tl-tile`, `tl-plate`, `tl-plate-skirt`,
`tl-stage` (with `data-status`), `tl-stat`, `tl-month`.

Three rules ride on them:

- **A tile's picture and its name are one plane.** The skirt behind the art's lower half
  (`tl-plate-skirt`) and the name block (`tl-plate`) share one fill, so the art's round
  bottom corners run into the name. Repaint both or neither, and draw nothing across the
  join (the owner, 2026-11-24).
- **Nothing between a tile's art and its card may clip.** A layered uma's ears and hat reach
  past her frame and past her tile. No `overflow: hidden`, `clip-path` or `contain` on a
  tile, a panel or a card's inner boxes. A clip moves no box, so only the geometry check's
  computed styles, and `timelineCss.test.ts`, would notice.
- **A theme paints, it never sizes.** Anything that changes a box's size belongs in
  `timeline.css`, behind the geometry check.

### The Timeline on Tracen

Tracen is the one theme that repaints the Timeline so far (`personalityThemes.css`, "The
Timeline on Tracen"; the owner's picks of 2026-11-24). What it does, all through hooks:

| Part | On Tracen |
|---|---|
| `tl-stage` | "Stage banner" is the game's lime action button. A banner already staged, in the calculator or ended is a plain white key with readable words. |
| `tl-panel-title` | A tinted strip in the kind's colour: blue for Umamusume, orange for Support Cards. A recommended panel keeps its gold. |
| `tl-countdown` | Coloured by `data-state` (`getCountdownState`, from the dates): a white key when not open yet or over, pale green while open, the warning pink when three days or fewer are left. Colorblind mode swaps in its blue and orange. |
| `tl-control` | The bar's buttons, filter and search field as the navbar's key buttons. |
| `tl-plate`, `tl-plate-skirt` | A tile that links to its Encyclopedia page is a key on three sides: down both sides of the name and under it, never across the top. |
| `tl-stat` | A race card's course boxes as the game's stat panel, a slate header over a white value. |
| `tl-month` | The month heading on the game's slanted green rule: a lime tab laid behind the words by a pseudo-element, and a lime line. |

A restyle like this is checked with `geometry.mjs diff --boxes`: paint may change, no box
may move, except the title strips and stat labels, which grow into padding that is given
back as negative margin. The themes it must not reach are checked at plain zero.
`timelineCss.test.ts` holds a theme's Timeline rules to the same promises as the layout:
no clip, no size, the plate and its skirt one fill, nothing across the top of a name.

## Month headings

"December 2026" sits before the first card of each month (`TimelineMonthHeading` in
`TimelineCard.tsx`; the owner's pick, 2026-11-24). The rules:

- **It is on every theme**, because it is a real element and a theme may not hide one. Its
  box is `.tl-month` in `timeline.css`, the same everywhere; its default paint is a quiet
  grey label and line; Tracen repaints it.
- **It lives INSIDE its row**, above the card, so the list still has exactly one child per
  row. `timelineRowKey`, the scroll tripwire and the deep-link anchor all count rows.
- **A heading opens a month, and also opens whatever is first on screen**: page 2 of the
  paged view and a filtered list both start by saying which month they are in.
- **The month is the one the card's own printed date falls in**: `formatMonthName` reads
  the row's start (`timelineRowStartDate`) in the viewer's zone, as `formatDate` does.
- **A deep link lands the card below the sticky control bar, with its month heading.** The
  card's wrapper (`tl-anchor`) is the scroll target, and `timeline.css` section 6 gives it a
  scroll margin of the bar's height where the bar is pinned, plus the heading's when the
  card has one. Before 2026-11-24 the scroller's padding only knew about the screen's tab
  bar, and a deep-linked card arrived with its title under the controls.
- A change like this one, which adds an element between cards, is checked with
  `geometry.mjs snapshot --ignore ".tl-month"` and `diff --relative`: every card moves down
  the page, and nothing inside any card may move or change.

## The list

Renders `organizedTimelineData` — banner timelines, Champions Meetings and League of
Heroes events merged into one date-sorted list (~250 rows) — filtered by past/future and
a search box.

**Two card shapes, three event types.** Champions Meetings and League of Heroes events
share one course-details card, `components/timeline/RaceEventCard.tsx`; banner
windows use the wider card in `components/timeline/BannerWindowCard.tsx` (one component per
file: the card, `BannerSection`, `FeaturePanel`, `FeaturedTile`). `RaceEventCard`
never branches on which of the two it has — if it ever needs to, they've stopped being the
same card and should be split again. `RaceEventCard.test.tsx` renders one of each from the
same data and diffs the markup, so a change applied to only one type fails there.

**All three cards sit in one shell**, `TimelineCard` (the gutter, the panel, the focus
ring), and the banner and race cards share one header row, `TimelineCardHeader`. A marker
card has no header row; its chip and name sit inline. Where the cards differ on purpose
(a race's title is an `h2` a size larger than a banner's `h3`), the difference is the
caller's to pass in, never a second copy of the shell.

### Concurrent banners are one card, grouped at render time

`groupTimelineEvents` (`timelineShared.ts`) folds banner events sharing an **exact**
`start_date` into one `BannerWindowGroup`, rendered as a single card: shared header with the
union window, then one section per constituent banner, each keeping its own panels and its
own "Add to Planner". A section whose own end date differs from the header's says so.

- **Grouping runs last**, after the past/future and search filters. Grouping first would let
  a window straddle the boundary and pull an ended banner into the current view.
- **Exact string equality, not the calendar day.** Both agree on every row in production
  (eight groups, sixteen rows); exact equality can't merge two banners a reader west of GMT
  sees on different dates.
- **The rows must not be merged in the database.** They are separate gacha pools with
  separate pity, `UserPlannedBanner` foreign-keys `BannerUma` rather than the timeline, and
  their end dates can differ — and income is a pure function of a banner's end date.
- A group of one is the common case and is the *same* code path, so there is no second
  layout to keep in sync.
- **A shared `jp_start_date` groups too: the staggered release.** JP runs a release as one
  window; global can open its uma and support banners on different days (first seen
  2026-10, Hokko Tarumae). That is entered as **two `BannerTimeline` rows with the same JP
  dates and their own global dates**, and the shared JP start is what puts them on one
  card. There is no flag to set. The rule is a union with the start rule, never a
  replacement: the launch window has one global start and two JP starts.
- **Complementary halves fuse into one section** (`buildWindowSections`): an uma-only row
  and a support-only row of the same category draw as the ordinary art | umas | supports
  row, each panel reading its banner, expiry and dates from its own row. When the halves'
  dates differ, the **card header** says how each side differs from the window it states
  ("Support banner starts 2026/10/27"). Never inside a panel: a line there makes the panel
  taller and the art row grows with it. Anything else stacks as separate sections.

### Count drives the layout, category drives the accents

The **card count** decides whether a panel abandons its column for a full-width band
(`COLUMN_TILE_CAPACITY`, currently 2 — a feature column is ~260px, two tiles across).
`banner_category` picks the chip (`CATEGORY_CHROME` in `BannerSection.tsx`) and the column
weighting, and can still *force* a band (`CATEGORY_LAYOUT`). The whole decision is one pure
function, `sectionLayout()` in `components/timeline/sectionLayout.ts`, which returns the
section's shape and where each panel goes; `sectionLayout.test.ts` is the table of every
case below, and the JSX only writes the answer down as `data-shape` and `data-layout`.

That way round because of the JP launch banner: a `standard` row with 9 umas and 20 support
cards and no art. No category flagged it, and none should have to — the counts are right
there. A miscategorised revival therefore still renders every card.

**Banding is PER PANEL, not per section.** Only the cards that don't fit take the extra
width; the other panel keeps its place beside the art. This was briefly section-wide, which
reads plausibly and is wrong on the commonest shape we hold: 22 of the 29 race-prep rows are
one uma and ten support cards *with* art, and banding the section threw the art onto its own
line and left a single uma tile adrift in a full-width panel. Five combinations occur in
production — race-prep with art (22), race-prep without art (4), race-prep with no uma (3),
revival (4), launch banner (1) — and any change here should be checked against all five.

- The art cell needs **real art** to appear once anything has banded. A "Banner art coming
  soon" placeholder is a third of an ordinary three-column row and reads as pending, but
  beside a lone uma tile with the real content banded below it is ~1030px of empty box. Where
  dropping it leaves a single panel, the panel keeps its column width (`.tl-lone-panel`) rather
  than stretching across a row it is the only occupant of.
- Two column panels implies nothing banded — a banded panel is by definition not in a column
  — so the `three` row is only ever reached by the ordinary case and can be reasoned about
  as such.
- **From `xl` up, every piece of timeline art is ONE width: `--timeline-art-width`.** It is
  the ordinary three-column row's art share, `(row - 2rem) * 1.28/2.94`, declared once in
  `timeline.css` and used as the first track of every banner template, as the width
  of the art-only branch, and as the width of the marker cards' art, paired or alone. The
  length is in `cqw` against the card panel's `@container`, not `%`, so it resolves to the
  same pixels however deeply the art is nested — the marker pair's art sits in a half-width
  column and a percentage there would be half the size. Before this the one-panel row gave
  the art half the row and the marker cards gave it the whole row, and each hit the 41rem cap
  at a width the ordinary row never reaches: four visibly different banner sizes down one
  list. Below `xl` the templates collapse to one column and the cap below is the rule.
  The three templates are rules in `timeline.css` (`.tl-row[data-shape="three" |
  "support-led" | "pair"]`), not class strings in the component: Tailwind generates a class
  only where it finds the complete string in the source, and a template built from a shared
  constant quietly yielded a single stacked column.
- **Banner art is capped on its WIDTH (`.tl-art`, `--tl-art-max`: 41rem), never its height, and it sits
  hard left.** The assets are 16:9, so an uncapped `w-full` makes the height a function of
  whichever column template the section landed in: ~358px on an ordinary three-column row,
  but ~580px under the old weighted pair template, and taller still below `xl`
  where the grid collapses to one column. 41rem sits just above the three-column ceiling, so
  ordinary rows are untouched and only the wider shapes clamp, landing at ~369px.
  Do **not** reach for `max-h` instead: with a percentage width the used width is already
  definite, so a height clamp just squashes the picture (measured 1030×580 → 1030×368,
  aspect 1.78 → 2.80). Capping width leaves `height: auto` free to track the intrinsic
  ratio. The cap only ever eats space to the art's *right*, so its left edge stays on the
  section's left edge in every template — the ordinary three-column row has no slack to
  distribute, and centring the capped shapes was what put them out of line with it.
  `data-place="alone"` is the sole exception: the art-only branch (every panel banded, e.g.
  race-prep with no uma) has a full-width row and no column edge to align to, so it centres.
- **The `pair` row is the art track then the rest, and both occupants are pinned to
  an outer edge** — art hard left at the shared width, panel hard right (`.tl-pair-cell`)
  and capped at 28rem, the width it has in a three-column row, rather than filling what is
  left. It was two equal halves before the shared track, and a weighted 1.6fr/0.7fr split
  before that, which only worked while the art expanded to fill whatever column it was
  handed; once the art was width-capped the two stopped agreeing, leaving the art adrift
  mid-column beside a panel flush right. Pinning both is what makes that right edge read as
  deliberate instead of accidental — the slack collects in one span between them rather than
  in three uneven ones. Both caps are `xl`-only: below that every template collapses to one
  stacked column and both should fill it.
- **A band is exactly one line at every width, and nothing about it is breakpoint-driven.**
- The line is a flex row, and the card count sets a **minimum** tile width rather than an
  exact one: each tile grows to an equal share of the row, refuses to shrink past
  `bandMinWidthClass` (7rem uma / 6rem support), and the row overflows into the band's own
  `overflow-x-auto` scroller when the minimums don't fit. Only the launch banner's twenty
  supports actually scroll on a desktop screen.
- **Growth sits on a wrapper around each tile, not on the tile.** That is what reproduces
  the old grid's `justify-items-center` spread — the wrapper takes its share of the line, the
  tile stays centred inside it at its own capped width. Put the growth on the tile and a
  four-uma revival stretches into four wide slabs.
- The row carries no `justify-*`. The wrappers always fill the line exactly, so there is
  never free space to distribute — and `justify-center` on a row that *does* overflow strands
  its first tile off the left edge where scrolling cannot reach it.
- This replaced a table of `xl:grid-cols-N` classes that produced the line only above
  1280px; below that the band fell back to two columns, so a ten-card race-prep batch
  rendered as a 2×5 tower. **Don't reintroduce a breakpoint here.** Tests assert the line by
  counting a flex row's children, which is what makes "one line" checkable in jsdom at all.
- **Band names shrink one measured tier** — ~160px column (two lines), band (three lines,
  13px). The old ~72px "dense" tier went with the squeeze that forced it; no band tile now
  renders below its minimum width.
- `race_prep_support` inverts the section's column weights (narrow uma, wide support grid) and
  must degrade to zero umas; two of the sheet's 32 rows have none.
- `standard` gets no chip at all. A badge on every card is noise, not signal.
- **`CATEGORY_LABELS` in `timelineShared.ts` is the only place the category names are
  written.** They appear both on the chip and in the filter's dropdown, and a reader
  filtering for "Golden Week Revival" has to see that exact phrase on the cards that
  come back.
- **The category filter runs on groups, not events**, and a window survives if *any* of
  its banners matches — filtering for revivals must keep the ordinary banner sharing that
  card, or the week looks emptier than it was. Race events drop out whenever a category is
  selected, since a Champions Meeting has no banner category to match. The dropdown only
  offers categories actually present in the data, so `race_prep_support` stays hidden until
  the support backfill lands rather than being an option that can only return
  "No events found."
- **Never reintroduce `grid-rows-1`, `xl:overflow-hidden` or `xl:[contain:size]` on a feature
  panel.** That trio pinned the panel to the banner art's height and silently discarded every
  tile past the first row — two of eleven umas shown, nine gone, nothing on screen saying so.
  jsdom applies no CSS, so only the class-name assertions in `Timeline.test.tsx` catch it.

**Narrow with `isRaceEvent()` / `isBannerTimeline()`** (from `types/calculator.ts`), never
by sniffing properties. The three shapes are not reliably distinguishable structurally: the
two race types are field-identical apart from their number, and a banner window shares
every base field with both. The guards read the backend's `event_type` tag instead. The old
`"track" in event` checks needed `as unknown as` casts to compile — a signal the narrowing
was fictional — and would have silently mis-sorted every League of Heroes event as a
Champions Meeting once the two shapes converged.

**Two list modes**, chosen by the user and remembered in
`localStorage["uma-planner-timeline-view"]`. Infinite scroll is the default; `"paged"` is
the opt-in value that restores the original 10-per-page view. Anything else (including a
blocked or absent store) falls back to infinite.

**The paged view's current page is remembered too**, in
`sessionStorage["uma-planner-timeline-page"]` — the route unmounts on every trip to the
calculator, so without it the reader was thrown back to page 1 each time. Session, not
local, storage: a page index is a position within one visit, and the list is date-filtered,
so restoring page 12 days later would point at unrelated events. `goToPage` is the only
writer, so the filter resets clear it as well. A restored page that now exceeds
`totalPages` is clamped in render (`effectivePage`) rather than corrected from an effect —
the fetch hasn't resolved on the first render, and resetting state there would both flash
the wrong list and permanently discard the saved position. Search text and the past/future
toggle deliberately do *not* persist.

### Recommended panels and purpose overlays — both zero-layout

Two editorial layers sit on a banner section, and neither may move anything: a recommended
card is exactly as tall as the same card unticked.

**A recommended banner's feature panel becomes an SSR card** (`.ssr-panel` in `App.css`,
switched on by `FeaturePanel`'s `recommended`): a gold surface, a prismatic foil edge, a
slow light sweep and a few glints, plus a solid gold "★ Recommended" chip in the title line.

- The panel *swaps* its `bg-gray-800 border-gray-600 shadow-sm` for the class rather than
  layering over them, so nothing has to win a specificity fight with Tailwind.
- The foil is the existing 1px border made transparent with a gradient painted under it
  (`padding-box` / `border-box`); the sweep and glints are absolutely positioned
  pseudo-elements; the glow is a box-shadow. None of it takes space.
- The glow stays within 6px: `.card-panel` is `overflow-hidden` with only 8px of padding on a
  phone, so anything wider is sheared off at the card's edge.
- Only `transform` and `opacity` animate, which the compositor handles without a per-frame
  repaint. Reduced motion, and ended banners (`ssr-panel--still`), keep the static foil and
  drop the motion.
- The chip is sized to the title's 20px line box, and truncates its own label before it lets
  the title wrap — a wrapped title is a taller row.

**A banner's free pulls are a chip on the same title line** (`.free-pulls-chip`, fed by
`free_pulls` on the `BannerUma` / `BannerSupport`), under the same rule: the 20px line box,
and an inset ring instead of a border because a border is 2px of height. Its text is the
title's own size (14px on a 20px line, no vertical padding), so the line-height IS the box.
Neither chip truncates when the two share a line; they step down with the title line's own
width instead (the line is a `@container`), on a ladder measured against the real widths
(icon + title 213px; chip about 59 / 99 / 144px for "120", "120 free", "120 free pulls";
gold pill 28px as a star, 104px with its word; 8px gaps):

| Line width | Free pulls alone | With Recommended |
|---|---|---|
| under 18rem | nothing | nothing (the chip; the gold pill is hidden too) |
| from 18rem | `50` | `50`, gold pill hidden |
| from 20rem | `50 free` | star + `50` |
| from 23rem | `50 free pulls` | star + `50 free` |
| from 26rem | | star + `50 free pulls` |
| from 30rem | | `Recommended` + `50 free pulls` |

Under 18rem is only the ~200px uma column beside a race-prep batch, where the title already
fills the line. When something has to give, the gold pill goes before the number: the foil
panel already says "recommended", nothing else says how many pulls are free. Both words stay
in the accessibility tree at every width, and zero renders no chip at all. A Recommended
chip with NO free pulls beside it keeps its word and truncates as before. Neither chip class
sets `display` in `timeline.css`: they show and hide through container-query utilities, which an
unlayered `display` would outrank. If a chip's font, padding or the titles change, re-measure
before trusting the ladder (the title icon is `shrink-0` so an overflow shows as one instead
of as a squashed icon).

The Timeline's event filter offers **"Free pulls"** beside "Recommended only", on the same
terms (`bannerWindowHasFreePulls`): only when some banner has any, and a window stays if
either side of any banner in it does.

**A card's `purpose` is an overlay on its own tile art** (`FeaturedTileArt`), revealed on
hover, keyboard focus (`:focus-visible`) or a touch tap. It lives *inside* the art box
because three ancestors clip — the band scroller, a recommended panel's `overflow: hidden`
and the card — so a floating tooltip would need a portal and a positioning library. The
field's 100-character cap is what keeps the text inside the narrowest tile. An empty purpose
renders the tile exactly as before: no overlay, no tab stop, no handlers.

**Each tile is a link to its Encyclopedia page** (`FeaturedTile`, keyed
by the payload's `game_id`; none when it is null, as on a placeholder card). The link then
owns the overlay's triggers: it is the one tab stop and the `group` the hover and focus
classes answer to, and a tap follows the link, so a touch screen doesn't toggle the note.
For everyone since the Encyclopedia opened (2026-11-18).

### Infinite scroll — the reveal-count dependency is intentional

The list reveals `INFINITE_CHUNK_SIZE` more cards each time a 1px sentinel `div` at the
end of the list comes within `INFINITE_ROOT_MARGIN` of the viewport.

**The effect that owns the `IntersectionObserver` lists `revealCount` in its dependencies
on purpose.** An observer fires only on a *change* in intersection, so one left attached
across an append goes silent while the sentinel is still on screen — and the list stalls
one chunk in. That's the failure mode on tall viewports, where a chunk doesn't fill the
fold. Rebuilding the observer per append forces a fresh evaluation.

`revealCount`, not the raw `visibleCount` state, because a deep link can widen the
revealed prefix without touching that state — see "Deep links from the sheet to the
Timeline". `revealMore` measures from the same value, which is what keeps every append
visible and so keeps this dependency changing on every one of them.

Guarded by `src/__tests__/Timeline.test.tsx`, whose fake observer fires each instance
**once**. A more permissive fake lets that regression through silently — see Testing below.

### Step-ups are announced on the campaign strip

`AnniversaryEventStrip` renders a chip such as "2 ★3 + 3 SSR Step-Up" from the
`banner_step_ups` summary on each timeline row, summed per pool by `formatStepUpChip`.

It is there for discoverability, not decoration: nothing else on the site indicates
step-up banners exist until you press the calculator's third Add button. Because a
step-up's FK points at the campaign **Part** it runs in, the chip lands on exactly one
card per campaign with no filtering.

### SR and R rate-ups: a tile, a row under the card, or nothing

A support banner sends its SSRs as `support_cards` and its SRs and Rs as `other_rate_ups`, each
with `display`, which the API resolves (notes/banner-sr-r-plan.md). The panel draws
`timelineSupportTiles()`: the SSRs plus any `picture` SR (an SR alone on a one-SSR banner, by
default). `RateUpRow` lists the `named` ones (`timelineNamedRateUps()`) as "Also on rate-up",
first in the strip below, one row per banner that has any, named by its banner only when the
card holds two such banners. Each name links to its Encyclopedia page with the card popup
(`hoverCardProps`). `hidden` ones are on neither, and the Timeline's search finds a banner by
any of its rate-ups (`allRateUps()`).

### Free card events sit flush beneath their banner's card

`StoryEventStrip` (`components/timeline/StoryEventStrip.tsx`) draws each free card event
under the banner it runs with (`story_event_data`, grouped by `storyEventsByBanner`). Four
kinds share the row (`kind`): story events, main story chapters, anniversary missions and
special events. Each row has its picture when one is uploaded (one slot and one size for every
kind; the art is 2:1), the kind's pill, the name (the kind's label when it has no English one),
the kind's line, the reward chips (non-zero only), and each free card and uma. It is the mirror
of `AnniversaryEventStrip`: outside the panel, which squares its bottom corners, so the art row
can't grow. Plans: `notes/story-events-plan.md`, `notes/story-events-plan-2.md`.

- **Every kind's words live in `STORY_EVENT_KINDS` and `storyEventLine()`**
  (`utils/storyEvents.ts`): the pill, the stacking order under one banner (story event first),
  and the line. A story event says "Runs with this banner." and no date, a main story chapter
  never closes, and anniversary missions and special events give their last day through
  `formatDate`. Read the kind through `storyEventKind()` and the umas through
  `storyEventUmas()`: an API older than the kinds sends neither.
- **An uma reward is `FramedUma`** from its `portrait`, rainbow for the viewer's favorites,
  with the same click and tap rules as a card (`FreeRewardTile` serves both). `cards` stays
  support cards only, and `umas` is its own list.
- **An event's uma dates her release** where she is on no banner (Special Week (Commander),
  Rhein Kraft (Alt Version)): the PvP release check (`cardReleases`), the uma list's date sort
  (`withEventDates`) and her page's Global date (`firstEventGivingUma`). The Collection's sort
  doesn't read events.

- **Display only.** The rewards are the event's own and nothing reads them for the projection.
  The cards carry no `first_jp_date`, and the selectors build their catalogue from banners, so
  a free card never becomes selectable.
- **On a computer a click on a free card opens the shared card** (`hoverCardProps("card", id)`,
  drawn by `HoverCardLayer` like every other tile), whose "Open its page" goes to its page.
- **On a touch screen a tap opens the row's own details, never navigates** (owner,
  2026-11-17, for this row; `HoverCardLayer` ignores touch). "Open its page" inside does the
  navigating. Its popup is `useHoverPopup(..., { tapOnly: true })` (hover and focus off), so a
  mouse or keyboard never opens it beside the shared card, and `FreeRewardTile` holds the click
  back only for a touch (a ref,
  because the tap's own re-render lands before the click). The banner tiles still send a tap
  to the page.
- **For everyone**, like the Encyclopedia, since 2026-11-18 (early access only before).
- **"Must get" is the one mark**, outlined in brand, never filled (black on brand fails on the
  light theme). No scale.
- Search finds a banner by its events' names and their free cards' and umas' names.

### Other Timeline rules

- **A featured tile's name breaks at a seam, never mid-word** (`withSeams` in
  `FeaturedTile.tsx`). Two names are one 18-letter word, "Matikanetannhauser" and
  "Matikanefukukitaru", too wide for a support tile at any readable size, so a soft hyphen
  after "Matikane" (`NAME_SEAMS`) lets them break as "Matikane-" over the rest, at the tile's
  normal size (Daptrius, board "Timeline, Support Card, Longest Name Fix", 2026-11-17; he
  agreed). Checked 2026-11-17: no other uma or card name has a word over 12 letters; a new
  one goes in the list.
- **`SUPPORTS_INTERSECTION_OBSERVER`** is read once at module scope. Where there is no
  observer (jsdom, pre-2019 browsers) the list renders unwindowed, rather than stranding
  the reader partway down with no way to advance.
- **Both windows reset through `resetListWindow()` in the filter handlers, not from an
  effect.** Resetting in an effect commits the stale window and re-renders over it — a
  visible flash, and what `react-hooks/set-state-in-effect` flags.
- **Narrowing restarts the list; widening holds the reader's place.** Cutting the list
  down is a new question and belongs at the top of the answer. Going back to the whole
  list is the opposite — the reader found what they wanted and now wants its context — so
  `handleSearchChange` / `handleFilterChange` capture the row on screen first and rebuild
  around it. Each control has one un-narrowed value (an empty query, `"all"`) and the
  capture happens only on the transition *into* it; a move between two narrow values
  degrades on its own, because the row simply won't resolve in the new list.
- **Cards key off `timelineRowKey(row)`** — `cm-` / `loh-` + id for race events, `win-` +
  the shared start date for a banner window, `sce-` / `ann-` + id for a marker and
  `sce-N+ann-M` for a paired one. Ids are unique only *within* a model, and
  positional keys make React reuse a card's DOM — including decoded images — for a
  different event when the list grows or re-filters. A window keys on its date rather than
  its first banner's id so the key survives the API reordering banners inside a group.
- Card images carry `loading="lazy"`; a banner card holds up to five, so a fully-revealed
  list is several hundred.
- **Every timeline image DECLARES its aspect ratio, and this is not decoration.** Banner,
  marker and race art are `aspect-[16/9]`, uma tiles `aspect-square`, support tiles
  `aspect-[3/4]` — measured across the live CDN (1024×576 / 680×383, 360×360, 450×600,
  no exceptions). A lazy image with only `h-auto` is 0px tall until it decodes and then
  snaps to full height: eight banner images measured in Chrome moved the content below
  them by **2952px**, so a seventy-card reveal shifts by some 26,000px while you read.
  That is what made the deep-link scroll below unable to arrive. `object-contain` rides
  along with each ratio so an asset that is ever *not* that shape letterboxes instead of
  stretching — the same distortion the width-cap rule above is about, from the other side.
- **`BannerArtPlaceholder` holds the same 16:9 box**, not a min-height of its own. A
  stand-in of a different height still moves the page when the real art arrives.

### Deep links from the sheet to the Timeline

`/app/timeline?focus=<kind>-<id>`, built by `timelineFocusHref` and parsed by
`parseTimelineFocus` in `utils/timelineFocus.ts`. The calculator's scenario bands and its
rows' card art both link through it, and so does the PvP page's "View on Timeline"
(`cm-<id>` / `loh-<id>`, the same form as its own `?event=`, so a `PvpEventRef` is a
`TimelineFocus`); the Timeline resolves the target.

Every Timeline card also carries a **Copy link** pill (`CopyTimelineLink`) that copies the
same URL for itself: a banner window by its first banner, a race by its `cm`/`loh` ref, a
marker by `kind` + `sourceId` (each half of a pair links to itself; both land on the pair).
The URL is built in the click handler from `window.location.origin`, never at render time.
**A banner window's pill copies `/banner/<id>` instead** (`bannerLinkPath`, 2026-11-25): the
API serves that path with the banner's own link preview (the card's title, its dates and a
branded picture over its art; backend `views/banner_share.py`, `banner_preview.py`) and sends people on to `?focus=banner-<id>`, since the
static host answers every `?focus=` with the one prerendered Timeline page and its generic
tags. Races and markers keep the `?focus=` link.

- **Why not a `#hash`.** The Timeline windows its list (ten cards a page, or a growing
  prefix under infinite scroll) and hides past events by default, so the element a browser
  would scroll to is usually not in the DOM. The link therefore *names* a target and the
  route widens its own window to reach it.
- **The id is a `BannerTimeline`**, never the `BannerUma` / `BannerSupport` /
  `BannerStepUp` a planner row points at. Concurrent banners merge into one card, and all
  three row kinds carry the same `banner_timeline` FK, so it is the only id that identifies
  a card from any of them. `rowMatchesFocus` matches a window by **any** banner inside it.
- **Kind-prefixed, because ids are unique only within a model.** `banner` / `scenario` /
  `anniversary`; the latter two are `TimelineMarker["kind"]` verbatim, so neither end needs
  a translation table. Both marker types carry a `sourceId` for this — the primary key,
  held separately from the React `key` rather than parsed back out of it.
- **A malformed value degrades to "no focus".** It comes off the URL, where a user can edit
  or truncate it. Note `Number("")` is `0` and `0` is an integer, so the parser requires a
  *positive* id or `banner-` focuses primary key 0.
- **Resolution is DERIVED, not pushed into state from an effect** — the past/future half
  (`showPastOverride ?? focusIsPast ?? false`), the page, and the revealed prefix
  (`revealCount`). Writing state once the data arrives commits the un-focused list first
  and re-renders over it, which is the same flash `resetListWindow()` exists to avoid.
  Only the `scrollIntoView` is an effect, because it is a genuine DOM side effect —
  and it is guarded, since jsdom implements no `scrollIntoView` at all. It is a **layout**
  effect: a passive one can leave a frame of the un-scrolled list on screen first, which
  is tolerable for a deep link arriving on a fresh route and is the entire bug when the
  hook is asked to hold a card still (below).
- **The focus scroll is INSTANT, and then re-corrects until the page stops moving.**
  Not a downgrade from the smooth scroll it replaced: `scrollIntoView` fixes its
  destination when called, so anything growing above the target mid-animation leaves it
  short — and because images are lazy, the animation itself drags the viewport past them
  and triggers exactly those loads. It missed by more the further it travelled. Reserved
  art boxes (above) remove the cause; the settle loop — `useFocusScroll`, shared with the
  Selectors page — covers what a declared ratio cannot
  predict — a heading that wraps, a font that swaps, a panel that renders late. It
  re-aligns each frame until the target's `top` holds within `SETTLE_TOLERANCE_PX` for
  `SETTLE_STABLE_FRAMES`, or `SETTLE_TIMEOUT_MS` elapses. **A `wheel`, `touchstart` or
  `keydown` abandons it immediately** — hauling the page back under a reader who has
  taken over is just a different way of losing their place.
- **`revealMore` measures from `revealCount`, not from `visibleCount`.** After a jump the
  state still says 10 while 90 rows are on screen, and `count + 10` would append nothing
  visible for eight scrolls running.
- **Any control that moves or narrows the list clears the parameter** (`clearFocus`, called
  from `goToPage`). The focus target overrides the current page, so holding on to it would
  make "Next" look broken; dropping it also retires the arrival ring
  (`TIMELINE_FOCUS_HIGHLIGHT`) at the moment the reader moves on. It drops the local
  anchor (below) as well, and does so *before* its own early return — that return only
  knows about the URL, and an anchor left standing overrides the page identically.
- **A target needs ROWS BELOW IT to be scrollable to the top.** `scrollIntoView` cannot
  scroll past the bottom of a scroller, so a card with nothing under it stays wherever the
  last scroll position leaves it whatever `block` says. `revealCount` therefore adds
  `FOCUS_TRAILING_ROWS` (one whole chunk) *past* the target's own chunk — without it the
  target is always in the LAST revealed chunk, with 0–9 rows beneath it, and the landing
  looks intermittent because it depends on where the target falls inside that chunk.
  Measured live: Project L'Arc (row 44, five rows below) landed correctly; Grand Masters
  (row 19, last of its chunk) did not.
- **`FOCUS_TAILROOM` covers the case revealing cannot** — a target within one
  chunk of the end of the whole list, where there are no more rows to reveal. One screen
  of `dvh` padding, rendered *only* then: permanent padding would put a screen of dead air
  under every timeline, which is worse than the bug. Paged mode keeps a residual limit —
  a page holds ten rows, so a target last on its page has nothing below it and no way to
  reveal more.
- **It lands on the card's TOP (`block: "start"`), not its middle**, offset by
  `FOCUS_SCROLL_MARGIN` (`scroll-mt-6`). Cards are tall — banner art alone is
  ~369px — so centring one put its heading halfway down the screen. The margin goes on
  whichever node carries `focusRef`, which is *not* always the node wearing
  `TIMELINE_FOCUS_HIGHLIGHT`: a banner window rings its panel but scrolls its wrapper, so
  that the campaign strip above the panel comes into view too.
- **One ref for the ANCHORED card**, handed to whichever card matches via
  `TimelineFocusProps` — so there is no per-row ref bookkeeping and two cards cannot claim
  it at once. On `BannerWindowCard` the ref goes on the outer wrapper (so scrolling
  accounts for the campaign strip) and the ring on the panel (whose rounding it has to
  follow).
- **The ref and the ring are no longer the same question.** The ref follows whichever row
  the list is anchored on, from either source; `isFocused` follows the deep link alone.
  `RaceEventCard` takes both since the PvP page links to race events: a `cm` / `loh` focus
  matches through `refForRaceEvent`, and a race event is past once it has ENDED (like a
  banner), which flips the Timeline to the past for an old meeting.

### The anchor: two sources, one row index

`anchorRowIndex` is the single answer to "which row is the list built around", resolved
from a deep link's `focus` **or** from `anchorRowKey`, the local state set when a filter is
lifted (see "Narrowing restarts the list" above). Everything downstream — `revealCount`,
`anchorPage`, `anchorNeedsTailroom`, the scroll — only ever wanted *which row*, so they
read one index rather than each learning about both sources. The URL wins where both
exist, though in practice they cannot: typing in the search box drops the deep link.

- **The anchor is a `timelineRowKey`, not a `TimelineFocus`.** A key exists for every
  row kind, and a search matches race events, so one is routinely on screen when the box
  is cleared. It also stays out of the
  URL, leaving `utils/timelineFocus.ts` to the one job it was written for.
- **The row is found by measuring, once, at the moment of the lift** — `measureAnchorRow`
  reads the list container's leading children, which are the rendered cards one-for-one.
  A standing `IntersectionObserver` would run every scroll frame of a page holding 250
  image-heavy cards to produce a value wanted once a visit, if ever.
- **"Topmost" means topmost below the CONTROLS BAND**, which is sticky at the app-shell
  breakpoint and covers the top of the scrollport. It pins under the Timeline screen's bar
  (Timeline, Legend Races), so its `top` is `--screen-tabs-h`, never 0: see ui-conventions,
  "Screen bars". A row is the one being read if any part
  of it is still below that line — hence `bottom`, not `top`: someone halfway down a tall
  banner card is reading that card, not the one after it.
- **The row is put back where it was, not at the top.** `useFocusScroll`'s optional
  `offset` ref carries the row's pre-lift screen position. It cannot be applied with
  `scrollBy` — the window is not the scroller at app-shell (see `useBackToTop`) — so it
  goes on as `scroll-margin-top`, which the browser resolves against whatever scroller is
  live. The margin is **calibrated, not the offset itself**: park flush, measure where
  flush landed, and the difference is the margin. Calibrate **once** — re-calibrating a
  node that already carries a margin measures the margin's own effect and oscillates.
  The cleanup clears it, or it silently displaces the next landing on that node.
- **Under jsdom every rect is zero, so the measurement returns null and the ordinary reset
  stands.** That is why no pre-existing test changed behaviour, and why the new ones stub
  `getBoundingClientRect` per card to fake a scroll position.

Covered by `src/__tests__/timelineFocus.test.ts`, the "Timeline deep links" suite and
"Timeline keeps its place when a filter is lifted".

### Marker cards: scenario launches and campaign openings

`EventMarkerCard` is the timeline's third card, fed by a third `TimelineRow` kind
(`{ kind: "marker" }`) and built by `buildTimelineMarkers` / `mergeTimelineMarkers`.
A fourth kind, `{ kind: "marker_pair" }`, holds a scenario and a campaign that land on
the same UTC day and renders as `EventMarkerPairCard`.

- **The marker row kind is a FRONTEND union member, not a backend one.**
  `organizedTimelineData` narrows on the backend's `event_type` tag, but
  `AnniversaryEvent.event_type` already means the campaign kind
  (`anniversary` / `new_year` / `campaign`). Tagging markers server-side would collide with
  a shipped field. Key prefixes are `sce-` and `ann-`.
- **`mergeTimelineMarkers` runs AFTER `groupTimelineEvents`**, for the same reason grouping
  runs after filtering: it inserts against the final row order, so running earlier would
  let a marker land inside a window that later folds together.
- **A scenario and a campaign on the same day are ONE row.** Scenarios almost always
  debut alongside an anniversary, and two full-width cards for one launch read as two
  events on two dates. `pairSameDayMarkers` folds the sorted markers into a pair row
  before splicing, so the pair is one card, one page slot and one scroll anchor —
  `measureAnchorRow` still maps DOM children to rows one-for-one. The panel shows the
  campaign on the left and the scenario on the right (stacked in that order on a phone),
  and `rowMatchesFocus` answers for either half, so a deep link to either lands on the
  shared panel. Only that combination pairs; two campaigns or two scenarios on one day
  stay separate. The data stays separate too, as with `BannerWindowGroup` — the fold is
  render-side only.
- **Marker rows are built before they are filtered, and a pair passes a filter if EITHER
  half does** (`rowMarkers`, `markerRowMatchesKind`, `markerRowMatchesSearch`). The
  Scenarios filter, the Campaigns filter and a search that names one half all show the
  same pair as "All events" does. Filtering the markers first would strip the other half,
  so the same launch would be a pair under All and a lone marker under Scenarios — a
  different row with a different key, and the key is what `anchorRowKey` holds the
  reader's place with when a filter is lifted. The past/future toggle judges a pair by
  its scenario's instant (`timelineRowStart`), so halves a few hours apart can't split.
- **The marker cards share the banner card's boxes class for class**: the outer `my-3
  w-full px-2` wrapper carries the ref and scroll margin, the `card-panel` inside it is
  padded `p-2 sm:p-3` and carries the ring. That is what lines the panel edges up down
  the list. Art is centred in a lone card (nothing beside it) and hard left in a pair
  (a column edge beside it), the same rule as the banner art's `data-place="alone"`.
- **A scenario has no end date and never will** — it stays playable after release. The card
  branches on the *presence* of an end date rather than on the kind, showing
  "Releases &lt;date&gt;" instead of a range. The past/future toggle classifies a scenario by
  its start instant, since it can never be "over".
- **Markers are suppressed under a category filter.** They are cross-cutting context rather
  than banners, so a scenario card stranded in a list of reruns answers a question nobody
  asked — the same reasoning that drops race events there.
- **A missing image is the expected state**, not a degraded one: scenarios get entered
  before the art exists. A marker card with no image **collapses** to its chip, name and
  dates rather than reserving a 16:9 `BannerArtPlaceholder`: a marker card has nothing
  beside its art, so the placeholder was a card-wide empty box between two banners. The
  banner card keeps its placeholder because there it is a third of a row beside real
  content. Build and review the card with no image first.

---

### Deep links from the Timeline to the Selectors page

`/app/selectors?campaign=<AnniversaryEvent id>`, built by `selectorsCampaignHref` and read
by `parseCampaignFocus` in `utils/selectorsFocus.ts`. A timeline banner belonging to a paid
campaign wears an `AnniversaryEventStrip`, whose "Plan purchases" link is the only route
from seeing a campaign to planning what you'd spend at it.

- **The link must NAME its campaign.** It used to be a bare `/app/selectors`, which drops
  the reader at the top of a page listing every upcoming campaign, to find the one they
  just clicked among a stack of near-identical cards.
- **No `kind` prefix, unlike `timelineFocus`.** That module prefixes because the Timeline
  holds three sorts of target and a bare id would be ambiguous between them; this page
  holds exactly one, so a kind would never discriminate anything.
- **A plain `#hash` would not do**, even though this page renders every campaign at once
  with no windowing: the browser acts on a hash only for a document it is loading, not for
  a client-side route change, so the element it names does not exist when it would look.
- **The target legitimately may not be here.** `useSelectorPlanner` drops campaigns whose
  last banner has closed, so a link followed from the Timeline's *past* view resolves to
  nothing. It degrades to the ordinary page, like a malformed timeline focus.
- **Keyed on the resolved INDEX, not the raw id** — campaigns arrive after mount, so the
  id is known one commit before the card it names exists.
- Both pages share `hooks/useFocusScroll` (the instant scroll plus settle loop) and its
  `FOCUS_SCROLL_MARGIN` / `FOCUS_TAILROOM` classes. A second copy would be a second place
  for the two to drift apart.
