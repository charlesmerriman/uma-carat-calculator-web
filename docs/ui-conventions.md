# UI Conventions

Dates, styling, theming, the brand mark, and the Timeline list. These are the
frontend rules that are easy to break accidentally.

---

## Dates

**All user-facing dates go through `formatDate` in `utils/dateFormat.ts`**, which renders
`YYYY/M/D` (e.g. `2026/7/5`) — unpadded and locale-independent.

Do not hand-roll `toLocaleDateString` or date-fns `format` at a call site. Four such
copies previously drifted into two different locales and two different timezone bases.

**A feed read top to bottom may say how long ago instead**: `formatTimeAgo` in
`utils/relativeDate.ts` ("just now", "5 minutes ago", "2 days ago", then `formatDate` past
30 days), with the `formatDate` string in a `title`. It reads the clock, so only behind the
`/app` loading gate or on a page that is never prerendered. The gallery and the account
page's posts use it. (`formatRelativeDate` in the same file is the changelog's, by whole
days.)

### `parseApiDate` — the two shapes, and why the distinction is load-bearing

DRF sends two different date shapes, and they must be parsed differently:

| Shape | Example | Handling |
|---|---|---|
| Date-only | `"2026-07-16"` (e.g. `ChangelogEntry.date`) | Split by hand into a **local**-midnight `Date` |
| Full instant | `"2025-06-26T22:00:00Z"` (every banner/event date) | `new Date()`, formatted as a local calendar day |

The date-only case matters because `new Date("2026-07-16")` is **UTC** midnight, which
renders as the *previous day* anywhere west of Greenwich.

> Banner instants encode JST service-day boundaries (`22:00:00Z` start, `21:59:59Z` end),
> so the local calendar day can differ by one from the day the game shows in far-eastern
> timezones. This predates the helper and is unchanged by it — the helper preserves the
> interpretation the Timeline and banner rows already used.

---

## Styling and themes

Tailwind CSS 4. Custom react-select styles live in `utils/reactSelectStyles.ts` (dark
theme). The primary accent is `brand` (`#E6D28A`), defined as a custom Tailwind theme
color in `src/index.css`.

**Themes work by overriding the `@theme` CSS variables under `[data-theme="x"]` in
`src/index.css`.** The light theme *inverts* the gray ramp, so existing utilities keep
working unchanged. Read the comments there before adding a theme.

The compact picker puts **Dark** and **Light** first as the primary choices, with
small swatches for alternative **Dark themes** and **Light themes** underneath,
grouped by the `mode` in `themeStore.ts`. Each swatch is two-tone: the theme's
`canvas` (its card colour on a dark theme, its page colour on a light one) with
its accent `swatch` as a dot, so themes sharing a gold accent still differ. Dark retains the saved `gold` id and
remains the initial default. Light (`light`) restores the original warm palette;
Blue (`light-blue`), Green, Red, Purple and Pearl remain alternatives, giving
each mode six themes. Purple keeps its saved `light-lilac` id.

`data-theme-mode="light"` supplies the shared light ramp, status colors, button
labels and surface tokens. Individual `data-theme` selectors override the palette,
including the original Light theme's glows and card shadow. Every light theme puts
white labels on its solid brand buttons (Light had black ones until 2026-10-18).
Pearl uses softer paper-white surfaces and a near-black charcoal accent. Red
and Green each move the pull status colour that matches their brand (over-budget
orange on Red, on-pity blue on Green). Gilded is the amber, brown-gray dark theme. Toasts use the same
mode metadata, and the pre-paint script in `index.html` sets both attributes.
When adding a theme, update that script's ids and light-mode list together with
the registry; `themeScript.test.ts` checks their agreement.

**A theme's page glow is a `--page-glow` value, never a page background.** One
`position: fixed` layer (`body::before`) paints it, and the page shells
(`#root > .bg-gray-900`) are transparent so it shows through. Both rules list the
glow themes explicitly. Dark (gold) and Pearl have no glow, so they get no layer:
any layer under the page costs text on the page background its subpixel
antialiasing on 1x screens in Chrome, a price only a theme with a glow should pay.
Never use
`background-attachment: fixed`: until 2026-10 every theme except the default painted
its glow that way, on `body` and on the shell, and scrolling repainted the viewport
twice per frame on the main thread (153 repaints in a 2,500px scroll on `/faq` at
phone size, against 2 for the default). That was the "other themes are laggy"
reports. The PAGE GLOW comment in `src/index.css` has the details.

**Surfaces are three tokens and one class (2026-10-18, the fill 2026-10-19).** A theme says
everything about its surfaces through `--color-edge` (a colour token, so it is the
`border-edge` utility), `--card-shadow` (a plain variable, because Tailwind writes shadow
utilities out literally and a theme could never override a `--shadow-*` token) and
`--card-fill` (a step above gray-800 on the dark themes, gray-800 itself on the light ones).
Use them by role:

| Surface | Classes |
|---|---|
| A card: any raised box on a page | `card-panel` (fill, edge, shadow, 12px radius) |
| Anything painted to look like a card (a link tile, the gallery's SR/SSR edges) | `bg-(--card-fill)`, or `var(--card-fill)` in CSS |
| A card-shaped box that can't wear the class (the calculator's sheet frame paints gray-900) | `border border-edge shadow-(--card-shadow)` |
| A popover, dialog or drawer | `border border-edge` plus Tailwind's own `shadow-lg` / `shadow-2xl` |
| A quieter inset panel (a translucent `bg-gray-800/60`) | `border border-edge`, no shadow |

On a dark theme the edge is low-alpha light with 5% of the brand, so one value serves all
six dark themes at about 1.5:1 against a card. A light theme redraws it as solid tinted
gray. `.card-panel` lives in `@layer components`, so a utility at the call site beats it
(`rounded-t-none` on a card welded to the strip above it, the scenario card's
`border-brand/40`, the delete-account card's red edge). Never re-skin surfaces by matching
utility classes in a theme block. Until 2026-10-18 every theme matched `.shadow-sm`,
`.shadow-md`, `.shadow-lg` and `.shadow-2xl` literally. So every toggle knob, segmented tab
and dialog wore the card shadow, a card without one of those utilities wore none, and the
class sat unlayered, beating every utility a caller put on it. The SURFACES comment in
`src/index.css` has the values.

**One radius scale (2026-10-19): controls 6px, cards 12px.** Every button, input, select,
textarea and button-shaped link is `rounded-md` (6px), the shared class strings included
(`NAV_BUTTON`, `controlButtonClass`, the `BUTTON_*` sets, `.input-currency`, `.pull-input`).
Cards are `card-panel`'s 12px. Three things keep their own on purpose: tiles (picker and team
slots, link tiles) stay `rounded-lg`, a pill stays `rounded-full`, and the navbar's profile
trigger stays 8px so its edge is an even width around the 6px avatar inside it.

**A page's root never paints the page colour.** The shell already does, so a
`bg-gray-900` on a page's outer wrapper changes nothing on Dark and hides the glow on
every other theme. The calculator, Timeline and PvP roots carried one from 2026-08-06
until 2026-10, which is why those tabs showed no glow. Sticky bands and panels keep
their own backgrounds.

### Semantic status colors must be theme tokens, not palette classes

Tailwind's stock `green-400` / `red-500` are **not** theme-aware and measure ~1.35:1
contrast on the light theme. Any semantic status color that must survive a theme flip
belongs in `@theme` as its own token.

The `--color-pull-*` tokens (pull-count status, consumed by `.pull-input--*` in
`App.css`) are the worked example to copy. `--color-category-revival[-border]`
(`.category-chip--revival`, the Golden Week marker on a timeline section) follows the same
pattern: dark values in `@theme`, deepened counterparts under `[data-theme-mode="light"]`.
So do `--color-type-*` (the banner-row kinds), `--color-step-up` (every step-up marker,
including the Timeline strip's chip) and `--color-new-year` / `--color-campaign` (the
strip's text).

On light themes the pull-status fills are stronger than on dark (22% / 18% against 12%) and
the ok/over states get an inset ring, because a faint wash on a near-white field could not
be told apart from the neutral state.

A brand-derived tint would have been the obvious shortcut and is wrong here — the chip has
to read as "not the usual banner" against seven different brand hues, and would vanish into
the card's existing brand-colored labels on every one of them. Only the headline category
gets a hue; reruns and race-prep batches use the gray ramp so the one signal stays
meaningful.

### Gotcha: `@apply` in `App.css` cannot see custom `@theme` tokens

`App.css` opens with `@reference "tailwindcss"`, which loads only Tailwind's **stock**
theme. `@apply` there cannot resolve custom `@theme` tokens from `index.css`, and the
build fails with *"Cannot apply unknown utility class"*.

Reference such tokens as plain `var(--color-…)` instead.

(Stock names like `bg-gray-700` still work because the name exists upstream — the custom
value is substituted at runtime via the variable.)

The same limitation applies to the custom **variants** below: `@apply desktop-nav:…` in
`App.css` fails for exactly the same reason. Put those utilities in the JSX.

### Responsive: `desktop-nav:` / `app-shell:` for the chrome, `md:` only for cosmetics

Two custom variants are declared at the top of `index.css`. They exist because a
width-only breakpoint cannot tell a small laptop from **a phone in landscape
(~844×390) or a tablet in portrait (~820×1180)** — both clear `md:` (768px) while
being unable to hold either desktop layout.

| Variant | Condition | Governs |
|---|---|---|
| `desktop-nav:` | `min-width: 64rem` | mobile ⇄ desktop navbar, and the `SettingsMenu` panel's anchoring, which must track the navbar |
| `app-shell:` | `min-width: 64rem` **and** `min-height: 32rem` | the fixed-height, internally-scrolling app shell in `ApplicationViews` |

The height half of `app-shell:` is the load-bearing part. Applied to a landscape phone,
the shell gives a ~330px scroll viewport *and* stops the document body from scrolling,
so the mobile browser's URL bar never auto-collapses — the cause of the "the calculator
won't scroll" reports. 32rem clears every phone in landscape (tallest ≈430px) while
staying below any real desktop or tablet window.

Plain `md:` is still fine for cosmetic tweaks (padding, font size, a 1-col → 2-col grid).
Use a named variant for anything that switches a whole layout.

The banner table is **not** on this list — see below.

### Three banner-row kinds, and where each is drawn

The planner has three kinds of row — Uma, Support and **Step Up** — and a row's kind is
carried on the `BannerRowType` tag, never inferred from which FK is set (see
`plannedBannerRowType`). Each kind's presentation lives in exactly one place:

| What | Where |
|---|---|
| Type badge + glyph (desktop) | `BannerTypeBadge` |
| Type glyph alone (mobile card) | `BannerTypeIcon`, same module |
| Fill + ink per kind (badge AND mobile tile) | `--color-type-*` tokens in `index.css`, applied by `.banner-type-tab--*` / `.banner-type-tile--*` in `App.css` |
| Mobile tile classes + thumb radius | `TYPE_STYLES` in `MobileBannerCard` |
| Which catalogue the row's select offers | `bannersForRowType` in `bannerHelpers` |

Each kind has a fill and an ink token. The dark themes use the stock blue / green /
purple-900 values with white ink; light themes swap in pastel fills with deep same-hue ink,
and colorblind mode redraws them blue / red in both modes. Everything drawn on the mobile
strip (the banner select, the note and delete buttons) reads `--tile-*` variables that
`.banner-type-tile` declares per mode, because white-on-dark alphas vanish on a pastel.

Adding a fourth kind means touching each row of that table once. It used to mean finding
six hand-copied ternaries, any of which failed silently by rendering another kind's
treatment.

#### The derived-stats strip relabels per row

Two of the four stat boxes say something different on a step-up row:

| Box | Uma / Support | Step Up |
|---|---|---|
| 1 | Free/Tickets/Paid | **Step #** (`5x2-3`) |
| 4 | Max Pulls | **Max Steps** |

The source spreadsheet does this by swapping its column *headers*. Ours are global to the
table, so the swap lives in the per-row strip instead — where the meaning actually
changes. **Same four boxes at the same widths**: `--container-banner-table` does not move
for it, and must not.

The `# Pulls` input likewise keeps its column and changes what it counts, down to its
`aria-label` ("Number of steps") and its green threshold — every 5 rather than every 200,
because a step-up's unit of completion is a five-step round, not a pity counter.

A step-up has no featured cards to thumbnail, so its images cell falls back to a
typographic `★3` / `SSR` chip carrying the campaign's JP cutoff. Phone cards spell the
cutoff out in the dates block, which has vertical room the `h-16` desktop track does not.

#### The Income & Resources panel on a phone

This panel is the first thing on the calculator page and it is a form, not a summary, so
on a phone it starts **collapsed** — the banner sheet below it is what most visits are
for. Two consequences follow, and both are load-bearing:

- **The header is the only thing a phone user sees**, so it has to look openable. A title
  with a chevron beside it reads as a title; the boxed chevron plus a `Show` / `Hide` word
  reads as a control. The word is phone-only — a desktop load has the panel already open,
  where a chevron beside a visible body is unambiguous.
- **The panel is square-cornered below `sm:`.** The calculator's container carries the
  radius, and with only an 8px gutter either side on a phone the panel is all but
  full-bleed; a 12px radius across a band that wide reads as a stray curve rather than a
  card, most visibly on this header because it is the top edge.

Open, it used to run ~1690px on a 390px viewport — over four screens for four selects,
two toggles, eight fields and five figures. It is now ~1070px, and the savings came from
the same idea applied four times: **a phone gets a denser arrangement of the same content,
never less of it.**

| Block | Phone | From `sm:` |
|---|---|---|
| Competitive Progress | 2 lines per rank — icon, label, income badge; select below | one 4-column grid row |
| Purchases / Bonuses | badge shares the toggle's line | unchanged |
| Current Resources | 2 columns, 24px icons, 11px labels, `w-14` fields | 1–2 columns, full size |
| Average Monthly Income | a row list, label left / figure right | tiles, label over figure |

The rank rows are the subtle one. All four ranks live in **one** grid so their columns line
up on desktop, which means `order` (container-wide) cannot move a single rank's badge onto
its label's line. Each rank therefore owns a wrapper that is a `flex` row on a phone and
`sm:contents` above it — `display: contents` dissolves the wrapper so its children join the
parent grid exactly as they did before. Reach for that pairing whenever a phone needs
per-item grouping that desktop needs flattened.

#### The banner select must read as a control, not a title

On the card, the banner select sits in the coloured header where the row's name belongs,
and it used to be styled to disappear into it — transparent fill, transparent border, a
lone chevron. A chosen banner then read as the card's title, which was the intent; an
**unchosen** one read as a title too, which was not. The empty state is exactly where the
control has to look clickable, and it was the least obvious of the two.

Two things fix it together, and neither works alone:

- **The control is a field.** Translucent black fill, a white-alpha border, and a real
  focus state. Alphas rather than theme tokens because this control has three different
  backgrounds to read against — the row's type colour, blue / green / purple (or blue /
  red in colorblind mode) from
  `TYPE_STYLES` — and no single token suits all three. The old style also set
  `boxShadow: "none"` unconditionally, which took the keyboard focus ring with it.
- **The placeholder is an action.** `Target Support Banner` is a noun phrase and reads as a
  heading; `Select a support banner…` reads as an empty field. Same string on the desktop
  select, which shares the call site.

The field's border and padding come out of the banner name, which is the first thing in
this header to ellipsis. That is why the gutters around it are as tight as they are
(`px-1`/`gap-0.5` on the thumbnail rail, `mr-1` on the delete button, 3px on the chevron):
they were retuned to hand the name back the ~14px the border cost it. Widen any of them
and the name starts truncating a word earlier.

#### Recommended banners in the select

A banner an editor has ticked as Recommended gets a filled gold star before its name, in
the open menu and on the chosen value alike (`RecommendedMark`), and its menu row gets a
gold wash with a gold bar down the left (`withRecommendedOption` in
`utils/reactSelectStyles.ts` — one helper for both rows, so the two selects can't drift).
The list stays in date order: the star is how a pick stands out, not its position.

- The wash is a background *image* over the option's existing gray, and the bar an inset
  box-shadow. The gray keeps following the theme and the hover state, and the bar takes
  no width, so a starred label never sits a few pixels right of its neighbours.
- The "(in calculator)" / "(staged)" greying wins: such an option keeps a muted star and
  gets no wash, because a banner already in the plan is no longer a suggestion.
- Read the flag through `isRecommendedBanner(banner, rowType)`, never
  `banner.is_recommended`. It narrows on the row kind (a step-up has no flag), and reads a
  missing field as `false` for the deploy window where the frontend runs ahead of the API.

#### The phone card is four bands, and each one owns its own padding

`MobileBannerCard` stacks four full-bleed bands: the coloured identity header, a
dates/pulls/reserved row, the derived-stats strip, and the odds. Nothing is inset inside
anything else, and the `summary` / `chanceDisplay` slots are handed to the caller
**edge to edge** — the card adds no gutter of its own. `BannerRow` fills them with a strip
that wants to read as another band; `StagedBannerRow` fills them with a confirm button
that wants a gutter and adds its own `p-3`. A shared `p-3` in the card charged 24px of
height to every row to satisfy only one of them.

**A staged card is three bands, not four**: `chanceDisplay` is optional and
`StagedBannerRow` passes none, so the phone loses the odds strip on a row that isn't in
the calculator yet. Because the confirm button is then the card's last band, it carries a
full `p-3` rather than the `p-3 pb-0` it used while the odds strip supplied the bottom
gutter.

**The desktop table shows no stats or odds on staged rows either**, via
`.banner-grid--staged` (App.css): eight tracks where `.banner-grid` has nine. The
derived-stats width goes to the banner select, and the confirm button sits in the MLB
track. Every track from # Pulls rightward matches the calculator table's, so the staged
pulls and copies fields sit directly above the calculator's, and Add to calculator sits
above the odds. Both templates have the same fixed sum and the same one flexible track
(`minmax(14rem, 1fr)`) in the same place, so this holds at every width. Only the dates
column is offset, by the wider select. `min-width` is inherited unchanged, so the staged
table stays exactly as wide as the calculator table below it and the `@banner-table:`
switch point still governs both. The staging header row in `CaratCalculator` carries the
same modifier — both, or the header drifts out of alignment with the rows it labels.

The staged select track must stay a fixed size, never a `1fr`. A bare `1fr` is
`minmax(auto, 1fr)`, and the auto floor grows the track to the cell's min-content — which,
for react-select's `nowrap` label, is the whole banner name. When the select was the
flexible track, the 242-character Golden Week revival ran the staged row 2450px wide
inside a 1470px container and clipped the pulls field, the reserved field, the confirm
button and the discard button off the right edge. A definite size clamps that minimum
away, as it always has on the calculator table's `10.5rem` select. (If a select track ever
has to flex again, spell it `minmax(0, 1fr)`.)

The staged surfaces are tinted with `.staged-surface` / `.staged-surface-header`, a
`color-mix` of `--color-staging` into the live gray ramp. The tint is a **background**
rather than the more obvious border or inset: the staging `@container` element's width is
what the container query measures, so anything with horizontal cost would move the
card/table switch point.

Four rules keep the phone card short, and each replaced something that measurably didn't
fit at 390px:

- **The dates always stack**, at every card width. `Start:` / `End:` side by side want
  ~234px and the date column can only spare ~150 of a 390px viewport, so "End: …" used to
  slide underneath the pulls field and read as clipped. A range that runs down at one
  width and across at the next is also harder to scan than one that always runs down, and
  the desktop table stacks them too — it renders its own pair, not `dateDisplay`. There is
  no "Dates" caps label for the same width reason; `Start:` and `End:` label the column
  well enough alone.
- **The pull ceiling sits beside the pulls field, not in the strip.** "Max Pulls" (or
  "Max Steps") is the bound the field is judged against, and reading it three bands down
  meant looking away from the number you were editing. It is `MobileBannerCard`'s
  `maxCount` slot, built from `derivedStats[3]` so the step-up relabel keeps happening in
  one place, and it is **phone only** — above `sm:` the cell hides and the stat returns to
  the strip, which has room for four boxes. The band's `sm:` template therefore has three
  tracks against the phone's four; a `display:none` cell isn't placed, so the remaining
  three line up on their own. A **staged** row passes no `maxCount` at all: it has no
  projection yet (`useBannerResources` hasn't run for it), so there is no ceiling to name.
- **The stats strip is three across in one row.** With the fourth box moved up beside the
  pulls field, the remaining three fit a single row instead of two. Their labels wrap
  rather than truncate — a ~320px card gives each box about 93px, which is exactly what
  "Free/Tickets/Paid" wants — so never put `truncate` on a stat label or value.
- **The odds strip is six across at every width** — on a sheet row, which is the only kind
  of card that shows it. Wrapping to 3x2 below `sm:` doubled its height for cells needing
  ~30px each; a 320px card still gives every one ~53px, which is more than the desktop
  table's own 14rem track manages.

Together those took a phone row from ~370px to ~225px — roughly four rows per screen
instead of two. The `sm:` layout (a card between 640px and the table switch) keeps its
inset three-across panel and its four-box strip; only the stacked dates reach it.

The one width the phone card cannot simply absorb is ~320px, where the date line wants 3px
more than its column has. That is handled with a container-query variant on the date text
(`@max-[18rem]:text-[11px]`), not a media query: the question is how wide *this card* is,
and the card is already inside the `@container` that decides card-vs-table.

**The images cell is a link to the row's banner window on the Timeline** — on every row
kind including step-ups and staged rows, and inert only on a row with no banner picked
yet. See "Deep links from the sheet to the Timeline". The `<Link>` carries the cell's own
flex box so it adds no width (`--container-banner-table` does not move for it), and it is
*inside* the `relative` cell, which is what keeps `ExtraCardsBadge`'s absolute positioning
resolving against the cell as before. On phone cards the href is passed to
`MobileBannerCard` rather than the caller wrapping `imagesSlot`, because the ordinary rows
render their thumbnails inside that component and never go through the slot.

### The banner table: one width token, and it must never scroll

`.banner-grid` in `App.css` owns every column width in the desktop banner table. Both
header rows (`CaratCalculator`) and both row bodies (`BannerRow`, `StagedBannerRow`)
apply it. **Never re-declare a width on a cell** — that is what this class replaced, and
four hand-copied sets of `w-*` utilities are how headers drift out of alignment with the
rows they label.

**The table is never horizontally scrollable.** The moment it doesn't fit, every row
falls back to `MobileBannerCard`. A row whose `# Pulls` input and delete button sit past
a scroll fold is the bug this design exists to prevent — those are the two controls the
page exists for.

That guarantee is enforced by a single token in `index.css`:

```css
--container-banner-table: 76.625rem;  /* 1002px of fixed tracks + the MLB column's 14rem floor */
```

Both sides of the switch read it, so they cannot disagree:

- `.banner-grid` sets `min-width: var(--container-banner-table)`
- Tailwind generates the `@banner-table:` **container-query** variant from it, because
  `--container-*` is the namespace container-query variants come from

A container query, not a media query, because the question is *"does the table's own box
fit the table"* — measured after the page's `max-width`, margins, borders and any
scrollbar have taken their cut. Deriving the equivalent viewport width by hand is easy to
get wrong (it lands near 1213px, not the ~1198px the arithmetic suggests, because a
classic scrollbar moves it). The wrapper carrying `@container` is in `CaratCalculator`,
one per section, around the header **and** its rows.

**Adding a column:** add the track to `.banner-grid`, add its width to
`--container-banner-table`, add one `<div>` to each header and one cell to each row body.
The switch point then moves on its own — the table simply starts yielding to cards a
little sooner.

**There is a hard ceiling on that token**, and overshooting it does not degrade
gracefully — it makes the table *disappear*. Set it above what the shell can hand the
table and the container query never matches at any viewport width, so every row silently
falls back to `MobileBannerCard`.

The ceiling was **1214px (75.875rem)** while the calculator sat in `.page-container`'s
`lg:max-w-7xl` (1280px, minus `mx-4` = 32, the panel border = 2, and `mx-4` again = 32);
a 76rem value did exactly this, missing by 2px. The calculator has since moved to its own
`max-w-[96rem]` canvas (`CaratCalculator.tsx`), which is why the current 76.625rem fits.
The **Timeline still uses `.page-container`**, so don't reuse this number for anything
outside the calculator.

Raising the token is still the wrong lever even below the ceiling: it is the minimum
width at which cards become the spreadsheet, so every increase makes the table yield to
cards on more screens. The Reserved column stayed at `5rem` for exactly this reason when
it gained a funding hint beneath its input — the hint was abbreviated (`2s 1c`, full text
in its `title`) instead of the track being widened.

So prefer **reclaiming measured slack from existing tracks** over raising the token. When
the derived-stats strip grew to four boxes, most of its space came from the images track
(144px holding two `h-14` thumbnails that need 126) and the select track. Measure before
you trim — the type badge needs 72px for "SUPPORT" and the date cell needs 108px with its
compact gutter for `Start: 2026/12/31`.

**Don't fund a track from the MLB column's `14rem` floor.** Six cells of `100.0%` want
~305px, so 14rem is already a deliberate squeeze, and it is also the only track that
absorbs surplus width above the switch point.

A track can also run out of room **vertically**. `BannerRow`'s Reserved cell is the one
exception to the row's `py-2`: its `h-11` input, a 2px gap and the 12.5px funding hint need
58.5px and `py-2` leaves only 48px inside the `h-16` row, so it uses `py-0.5` for 60px.
Don't normalise it back to match its neighbours — the hint clips. `StagedBannerRow`'s copy
renders no hint and correctly keeps `py-2`.

**The four bordered boxes across a planner row are the same height, and that is
deliberate.** `.pull-input` is `h-11` because 44px is what the derived-stats box measures
(12px of `py-1.5`, a 12.5px label, a 17.5px value, 2px of border), and the MLB strip is
within a pixel of it at 45px. It is the row's one horizontal rhythm, and it is easy to
break by eye: the field was `h-9` for a long time and read as sitting in a dip between its
neighbours. Re-measure the stats box before you move it.

### The bulk-adjust pad (`CountStepper`)

The `# Pulls` field (and the copies field) opens a pad of bulk-adjust buttons — the planner's answer to "set this
to 600 without pressing ↑ sixty times". It is deliberately **not** a set of `+100/-100`
buttons in the column: that column is `5rem`, the table's width is capped
(`--container-banner-table`, above), and four buttons plus a field want ~11.5rem. A pad
that opens costs the grid nothing.

Three things about it are load-bearing:

- **It portals to `<body>` and positions itself from the anchor's rect.** The in-flow
  `relative`/`absolute` idiom `SettingsMenu` uses cannot work here: the sheet sits inside
  an `overflow-hidden` panel (`CaratCalculator`), which clips the pad on the last row, and
  its rows are `motion.div`s carrying `layout` transforms, against which a `position:
  fixed` fallback would resolve instead of the viewport. The cost of the portal is having
  to re-place on `scroll` (capture phase) and `resize`.
- **Focus is the only trigger, and the pad adds no chrome to the row.** It opens when the
  field takes focus — which is what you were doing anyway to type in it, on touch as much
  as with a mouse — and closes on focus-out, Escape, or an outside pointerdown. It carried
  a chevron button under the field at first; that bought discoverability at the price of
  pushing the input out of line with the row's other bordered boxes on **every** row,
  permanently, to advertise something learned once. Don't reintroduce one.
- **Chips suppress `mousedown` at the panel, not per chip,** so focus never leaves the
  input. That is what lets you click four in a row and keep the arrow keys live
  afterwards — and the panel-level handler is what stops a press on the pad's own dead
  space blurring the field and closing it mid-use.
- **The quantities are per row kind.** `buildCountChips` in `utils/countChips.ts` is the
  one place this is decided:

  | Row | Pad | Why |
  |---|---|---|
  | Uma | `−100 −10 +10 +100 \| Next pity` | one copy is the whole goal, so nobody plans past the first pity; half a pity is the useful coarse step |
  | Support | `−200 +200 \| Next pity` | plans move in whole pities (`PULLS_PER_PITY_COPY`) |
  | Step Up | `−5 +5 \| Limit N \| Next round` | counts *steps*, bought a round at a time |
  | Copies field | `−1 +1` | the range is 0-5 (`buildCopyChips`) |

  Pull rows have **no Max chip**: the Max Pulls tile beside the field already shows the
  number. A step-up's **Limit** is what the banner *sells* (`max_steps`, i.e.
  `banner_count * 5`), never what is affordable, and is named differently from the
  affordable "Max Steps" tile on purpose. `NumberField`'s `mediumStep` / `largeStep` are
  the keyboard mirror (`coarsePullDelta` feeds both), advertised in the pad's title; a
  step-up gets no Ctrl shortcut at all.

**It needs no phone-specific wiring, but it does need two phone-specific
allowances.** The card and the desktop cell render the *same* `pullsInput` node, so the
pad, its chips and its per-kind quantities come to both for free — but:

- **`place()` re-runs on `visualViewport` `resize` and `scroll`, not just `window`'s.**
  Focus is what opens the pad, and on a phone that same focus raises the OS keypad — which
  animates in *after* the first placement, and which iOS does not report through
  `window.resize`. Without those listeners the pad is placed against the full-height
  viewport, decides it fits below, and is then covered by the keypad.
- **Chips are `h-9`, not the `h-7` a pointer would need.** That is the size this app
  already gives its icon buttons (the card's delete, the navbar's gear), so the pad matches
  rather than inventing a target size.

There is no hover affordance to lose on touch, because there is no hover affordance at
all — tapping the field focuses it, and focus is the trigger.

Only the `Max` preset reads the affordable ceiling. **The deltas step straight past it** —
over-planning is surfaced as a red field, never rewritten, which is the same contract
`handlePullCountChange` keeps. `StagedBannerRow` has no pad: it has no projection yet, so
it has no ceiling to name, and it drops the odds strip for the same reason.

**Column labels may be icons instead of text.** Reserved is the first one: it shows the
selector ticket (`/item_icon_00131.png`) and the SSR crystal (`/item_icon_00144.png`), the
two resources `allocateReservedCopies` can spend. Game-resource icons are served from
`public/` by root-absolute path with no import — the same convention `IncomeForm` uses for
its Current Resources rows — and each carries a meaningful `alt`.

An icon label must also keep a `sr-only` text label: a `title` on a `div` is not reliably
announced, so without the span the column has no accessible name at all.

Both come from `components/carat-calculator/ReservedColumnIcons.tsx`, which returns a
fragment so each call site owns its wrapper, and exports `RESERVED_COLUMN_TITLE` so the
tooltip wording stays one string. **A column label appears in three places** — the staging
header, the calculator header (both in `CaratCalculator`) and the mobile card's cell label
in `MobileBannerCard`. Changing only the headers leaves the phone showing the old text. Sizes
differ deliberately: `w-5` in the headers against `text-xs`, `w-4` on the card where the
neighbouring "Pulls" label is 10px caps.

### Staging is a scratch space, and has to look like one

The planner has two stacked sections: **Staging** (rows being filled in) and **Calculator**
(rows that actually count). Users repeatedly read the first as the second, planned a banner,
and never pressed the button that counted it. Five things carry the distinction, and they
are load-bearing together rather than individually:

- **Vocabulary.** The confirm button says **"Add to calculator"**, the section it lands in
  is labelled **CALCULATOR**, and the top buttons say **"New … Banner"**, not "Add". The
  old pairing — "Add Uma Banner" followed by a second "Add to sheet" — made the first click
  read as a completed action. "Sheet" is avoided in UI copy entirely now, because it also
  means the source Google Sheet everywhere else in this codebase; in *code comments* it
  still means the spreadsheet, and should.
- **Both headings are gated separately** (`showStagingLabel` / `showCalculatorLabel`). They
  used to share one flag requiring both sections to be populated, which hid the STAGING
  heading from the only people who needed it — a first-time user has an empty calculator,
  so their first staged banner rendered an unlabelled table. Never re-merge these.
- **The calculator section renders while empty** whenever something is staged, showing a
  placeholder that names the button. "This is staging, not the calculator" is unlearnable
  when the calculator isn't on screen to be compared against. With nothing staged *and*
  nothing planned, neither section draws.
- **The amber wash** (`--color-staging`, `.staged-surface`) — the pre-attentive half. See
  the banner-table section above for why it is a background and not a border.
- **The hint line states the consequence**, not just the name: staged rows aren't counted,
  and are lost on reload. That sentence is what actually corrects the misunderstanding;
  everything else just gets it read.

**Staged rows are deliberately not persisted** — no localStorage, no sessionStorage, never
PATCHed. A guest's *confirmed* plan is in-memory only and a refresh discards it by design
(see `state-and-guest-mode.md`), so persisting staging would make scratch rows outlive the
real plan. The impermanence is stated in the UI instead. `CalculatorProvider` carries this
reasoning at the `stagedBanners` declaration.

### Section bands: scenarios and anniversaries between planner rows

`PlannerSectionBand` draws a full-width centred band between rows of the sheet, marking the
scenarios and anniversaries occurring between the first and last planned banner.
`utils/plannerSections.ts` builds the render list.

- **Scenario bands only — `SCENARIO_BANDS_ONLY`, a constant, not a setting.** There is no
  UI to turn anniversary bands on. A scenario launch changes how the game is played, which
  is the landmark a planner navigates by; anniversaries recur on a schedule the user
  already knows, and banding them doubles the number of interruptions in the sheet.
- **`buildPlannerRows` filters by kind BEFORE placement**, via its optional fourth argument
  (`PlannerBandVisibility`, a `Record` keyed on marker kind so a new kind can't be added
  without a decision). Filtering after placement would leave a scenario rendering as the
  second line of a band whose anniversary first line had been hidden. Told nothing, the
  builder builds everything; the call site states which kinds ship. That parameter and its
  tests are what make a future settings surface a matter of passing a different record
  rather than reworking placement.

- **The band is not `.banner-grid` and adds no track.** It spans the row stack as a plain
  `w-full` block, which is what keeps `--container-banner-table` (and its hard ceiling)
  out of it. That also means one component serves both display modes — the stack renders
  mobile cards below the container width and table rows above it.
- **`buildPlannerRows` carries each row's ORIGINAL index.** `bannerResources` is positional
  against `userPlannedBannerData`, so reading it by position in the *banded* list
  mis-attributes every row's resources the moment a band appears. There is a test on this.
- **Placement**: a scenario pins immediately above its own launch banner (its start date IS
  that banner's), whatever else shares that instant; everything else places before the
  first row starting on or after it. Markers landing at one point collapse into a single
  band, **scenarios above anniversaries** — they routinely launch together, and the
  scenario is the larger statement.
- **An anniversary bands at its `main_start_date`, not its `start_date`.** The campaign
  opens with a Part 1 of login rewards announcing the anniversary; the anniversary itself
  is Part 2, roughly ten days later, and the band marks the event rather than the run-up.
  The Timeline's campaign card (`EventMarkerCard`) places on the same date for the same
  reason, so the two surfaces agree — it just also states the campaign's full window,
  reading "<the anniversary opens> through <the campaign closes>". Read it as
  `main_start_date ?? start_date`; the two are the same instant for New Year campaigns and
  one-off promotions.
- **Each line links to the same landmark's card on the Timeline** (see "Deep links from the
  sheet to the Timeline" below). The whole strip is the anchor, not the label — the row is
  otherwise empty, so a text-width target in a full-width band is needlessly hard to hit —
  and the affordance is a hover underline plus a faint wash, with **no arrow glyph**: the
  one thing distinguishing a scenario line from an anniversary one is having no icon.
- Bands are calculator-only; the staging area is a scratch space and gets none. A
  calculator of fewer than two rows gets none either — there is no "between".
- Colour is the `--color-brand` token (`text-brand` / `bg-brand/10`), never a literal gold,
  so it survives the light-theme flip. The two kinds differ by **weight, hue and the
  anniversary's sparkle** — a scenario line carries no icon at all — see the note above on
  only the headline signal getting a colour.
- **Strip fills alternate per DATE, not per line.** A band collapses markers by insertion
  point, so it can hold two moments *or* two lines that are the same moment (a scenario
  launching the day an anniversary lands — the common case, since scenarios usually debut
  alongside one, and reachable again the moment anniversary bands are turned back on). One
  fill therefore means "one date" and a change of fill means "a different one". Grouped on
  the **UTC** calendar day, like everything else in the
  projection, so the striping can't vary by the viewer's timezone.

This is deliberately not `AnniversaryEventStrip`, whose `rounded-t-xl border-b-0` geometry
exists to weld onto the top of a timeline card and which is left-aligned.

### Uma frames (`components/FramedUma.tsx`)

**Every uma the site draws is its borderless art inside the site's own frame. This is a
site-wide rule (owner, 2026-10-14): an exception exists only when the owner names one.**
Today that covers the calculator rows (desktop, staged, mobile, a step-up's step 5 pick),
the Timeline's featured tiles, the Daily Legend Races tab, the Selectors page and both its
pickers, the PvP guide's uma tiles, the guide picks panel, the team builder and the team window, the PvP card
picker, the PvP gallery (its posters' avatars included), a shared plan's landing page, and
the favourites card and picker on the account page.

**The owner's exceptions** (2026-10-14) draw the same borderless art with NO frame
(`FramedUma frame={false}`, `Avatar framed={false}`, `UmaPortrait frame={false}`;
`.uma-frame--bare` in App.css):

- the navbar's profile menu (the trigger and the menu's own avatar);
- the account page, except the "Your favourite uma musume" card and the favourites picker
  it opens: the header avatar and the "Your gallery posts" list are bare.

(The Selectors page was an exception for a moment on 2026-10-14 and was taken back the same
day: it is framed.) The art is the API's `portrait` (borderless,
else bordered); never the bordered `image`, whose baked-in rarity border would sit inside
ours. A route that sends an uma sends `portrait` with it (`/calculator-data`, the PvP guide,
the PvP catalogue; `GET /umas` and the account's oshis send the portrait as `image`).

- **Two frames**, SVGs in `src/assets/`: `uma-frame.svg` (silver) for everyone and
  `uma-frame-oshi.svg` (the rainbow) for EVERY OUTFIT of each favourite their tier covers
  (`useOshiIds`, owner 2026-10-16: a favourite Oguri Cap frames Oguri Cap (Christmas) too,
  on every page). The server resolves the outfits (`account.oshi_uma_ids`, by
  `game_id // 100`); the client only tests membership. App.css ("Uma frames") lays the
  frame over the art and clips the art to the frame's corner (82/762 of the side), so nothing
  pokes out past it. `className` only sizes the square (`w-14`, `h-full`).
- **Support cards keep their own art**: there is no borderless set for them. A list that can
  hold either pool decides per item from data, never from shape: a catalogue option's
  `portrait` is set only for umas (`EligibleCard`, `PvpCardPicker`'s items), a step 5 pick
  carries `uma` (`SelectedCardArt`), a planner row narrows on `target.type`.
- **`useOshiIds` reads `AuthContext` directly**, so a row or picker rendered on its own (in
  a test) draws silver frames instead of throwing for want of an AuthProvider.
- **Whose favourite.** The rainbow frame means "one of YOUR favourites": `useOshiIds`
  everywhere, the team builder included (it adds its heart). The ONE exact-match place is
  the favourites picker (`useOshiPickIds`), where the rainbow says "you picked THIS card";
  an avatar is rainbow when it is yours (your own
  avatar, your own gallery posts and comments, your covered favourites on the account page)
  and silver on someone else's.
- **A state rings the frame, never replaces it.** The guide picks panel's open and
  on-the-team rings follow the frame's corner (`rounded-[10.75%]`); the old turning
  `.oshi-frame` and the gold rings are gone.
- **Not framed:** support cards, and banner, campaign and event art. The `/post/<id>` link
  preview picture is drawn by the API (`gallery_preview.py`) and does not use the frames.

### Portaled `react-select` menus need `menuPosition="fixed"`

Every select using `menuPortalTarget={document.body}` also sets `menuPosition="fixed"`.
The portal attaches to `<body>`, but the control can live inside the app shell's vertical
scroller; with the default absolute positioning the menu is placed against the body and
visibly detaches from its control as soon as that container scrolls.

### Animation

Framer Motion handles UI animations: the collapsible income section at the top of the
calculator page uses a `motion.div` height transition (no `AnimatePresence` — it never
unmounts while the page is up), the staging area uses `AnimatePresence` for enter/exit,
and `layout` props on banner list items animate reordering.

---

### Loading indicator (`components/OguriSpinner.tsx`)

Every in-flight state spins the same image: a derpy Oguri Cap head, served from `public/`
by root-absolute path like the game-resource icons. Two sizes — `sm` (32px) inside a 36px
control such as the navbar's pending-save button and the Timeline's "loading more" row,
`lg` (80px) for page-level loaders — spinning on the `animate-spin-slow` token declared in
`index.css` (one turn per 2s on Tailwind's stock `spin` keyframes; the 1s default was a
blur), with `motion-reduce:animate-none` so the OS reduce-motion setting stills it. Don't hand-roll a CSS ring (`animate-spin rounded-full
border-t-brand`) or reach for lucide's `Loader2` for a new loading state; render
`<OguriSpinner />` inside your own `role="status"` wrapper with visible or `sr-only` text,
because the image is `aria-hidden` and the caller owns the accessible name.

## The profile menu and the account page

Signed in, the navbar's auth slot is `components/navbar/ProfileMenu.tsx`: a
pill (`NAV_PROFILE_TRIGGER` in `navStyles.ts`) with the account's avatar as its
left cap and, from `desktop-nav:` up, the person's name and a chevron beside it,
opening a menu with **Account** and **Sign out** (since 2026-09-12; sign-out used
to be a bare button in the bar; the pill and the name arrived 2026-09-13). Below
`desktop-nav:` the pill is the avatar ring alone — at 390px the app-mode cluster
is already save + settings + theme + this. A guest still sees the Login link. The
menu is the same popover idiom as ThemePicker and SettingsMenu and is always the
LAST control, so right-anchoring never runs it off a narrow screen.

**The name is the one they chose, else the handle.** `account.display_name`
(set on `/account`) or `account.username`. The menu header shows the handle in
mono under a chosen name, because the handle is the account's identity and what
an admin would ask for. The name span is omitted while `/account` is in flight,
so the pill widens once rather than jumping from a placeholder.

**The avatar is the person's first favourite uma, and it is square.**
`Avatar.tsx` shows `account.avatar_url` — the server sends the first oshi's art,
`null` until they pick one — and on `null` or a broken image draws the quiet
default: a muted `UserRound` silhouette on a `bg-gray-700` rounded square,
styled like the settings and theme icon buttons beside it so it reads as one
more control. The same default for everyone and for the loading state, on
purpose: the avatar is only ever shown to its owner, so two empty accounts have
no reason to look different, and the initials-on-a-hue circle it replaced
(2026-09-13) was loud in an otherwise grey bar. **Square since 2026-10-07**
(`rounded-md` for `sm`/`md`, `rounded-lg` for `lg`): the art is a square
portrait and the circle cropped every corner; the navbar trigger
(`NAV_PROFILE_TRIGGER`) is `rounded-lg` around it so the frame stays even. No
provider picture is ever held or shown. Three sizes: `sm` (menu rows), `md`
(the navbar trigger, 36px inside the 40px frame), `lg` (the account header and
the favourite tiles). Avatars never appear anywhere public today; the
supporters list on the home page is names only. (Oshis will be shown publicly
by a future feature.)

`/account` (`components/account/AccountPage.tsx`) is noindex and **not
prerendered** — a build-time render is a guest card, which is not the page.
The sign-in methods list draws each provider with the marks in
`components/auth/ProviderMarks.tsx` and the labels in
`constants/providers.ts`; the page is the only UI that calls the link endpoints,
and the only one that calls `DELETE /account` — behind a typed confirmation
phrase, because there is no email on file to send a recovery link to.
Supporter-gated UI goes through one component, `<SupporterOnly benefit="…">`
(`components/account/SupporterOnly.tsx`), which keys on a benefit from
`account.supporter.benefits` and fails closed while the account is unknown.

The page also owns the two **preferences**, both written through one
`PATCH /account` (`accountPatch` in `services/accountFetchCalls.ts`) followed
by `refresh()`, so the navbar picks the change up: a display-name form (32
characters, the server's cap, mirrored as `maxLength`; blank clears it) and the
**favourites card** ("Your favourite uma musume" on screen; `oshi` in the code,
the wire and the test names).

**The favourites card draws what the server says.** `account.oshi_slots` (1 for
everyone, 3 / 5 / 7 by tier, already resolved by the server; the page does no
tier arithmetic) is how many tiles are offered, and `account.oshis` (every
stored pick, covered or not) fills them. Slot 0 is tagged "Your picture". Tiles
past the slot count render greyed with "Not covered" — a lapse or downgrade
keeps the rows — and offer only Remove, never Change or "Make picture", because
a swap-in past the count is an ADD the server would refuse; the page avoids
offering the refused button, the rule itself lives in the serializer. Anyone
who is not a supporter sees a Patreon link under the tiles ("More slots", or
"Renew" when they hold more than they cover). Every write sends the **whole
ordered list** (`oshis: number[]`): picking fills or appends a slot, "Make
picture" moves an id to the front, Remove filters it out, so the client never
has to know the server's renumbering.

`components/account/OshiPicker.tsx` is a search-and-grid modal in the same
shape as the Selectors page's card pickers, fed by `GET /umas`
(`services/umasFetchCalls.ts`) and fetched on first open, not on mount — most
visits never open it. It is opened for **one slot**: `currentId` marks the uma
already there, `takenIds` disables the umas in the other slots ("Already
picked") rather than hiding them. Tiles are square with the avatar's corners,
so the person sees what they will get. The catalogue is what `GET /umas` lists
(pictured umas minus the `(All)` placeholder), the same for everyone; costume
variants (`is_variant`) are shown locked ("Supporters only") while
`account.oshi_variants` is false, so a free account sees what a pledge
unlocks. The client filters nothing and decides nothing; the server refuses a
variant a free account somehow sends. The parent owns the write; the dialog
closes only once the PATCH succeeds, so a refused pick leaves the grid open
with the server's reason toasted ("Your tier covers 3 favourites.").

## Brand mark and display font

The site's brand mark is **text, not an image**. `components/Wordmark.tsx` renders
"Uma Carat Calculator" everywhere the old logo PNG appeared — navbar, sign-in card, OAuth
callback card. Change the brand text or its styling there and all three update together.

It is set in **Outfit**, installed as `@fontsource-variable/outfit` and imported in
`main.tsx` so the woff2 is **bundled** rather than fetched from Google's CDN. That means
no third-party request on page load, and the app keeps working under a strict CSP — the
same constraint that already forces the inline Google/Discord SVGs in `Login.tsx`.

**Prefer `@fontsource` over a `<link>` to fonts.googleapis.com for any future font.**

The family is exposed as the `--font-display` `@theme` token (→ `font-display` utility)
and is used **only** by the wordmark; body text stays on the system stack.

### Why the nav wordmark stacks onto two lines until `lg`

The nav variant stacks onto two lines and only goes single-line at `lg`, not at `md`
where the desktop nav begins. This is deliberate: the nav carries its centre links plus
save/theme/settings/auth controls, and a single-line wordmark (~208px, vs the old logo's
~74px) overflows the `grid-cols-[1fr_auto_1fr]` row between 768px and ~900px. Stacked it
is ~85px, so it fits everywhere the image did.

Independently of the wordmark, that nav was **already** over-full at ≤900px — the
"Sign in to save" button wraps. That predates the wordmark. Moving the Income panel out
of the nav and into the calculator page bought back one centre link's worth of room, but
the wrap point has not been re-measured since.

### The wordmark sits on the bar's gutter, capped at the page column

Since 2026-09-13 the desktop navbar is a plain `px-5` bar on every page, and the branding
cell has no indent of its own. Since 2026-10-09 the bar's three columns stop at `96rem`,
the same cap as `.page-container`. The border and background still span the window. On a
wide screen the wordmark and the account controls used to sit at the window's edges, and
cropping a recording to 16:9 cut both off (Henry's request, made while filming). Below
1576px (`96rem` plus the two `px-5` gutters) the cap never engages. It is one cap for the
whole bar and depends on no page, so the rule below still holds.

Until 2026-09-13 the wordmark was indented per page by a calc
(`--nav-inset` from `.app-canvas-shell` / `.home-canvas-shell`, a `--shell-scrollbar`
measured by a `ResizeObserver` in `ApplicationViews`, and a `@container` on the `<nav>`
so `cqw` could see the content box) to sit the wordmark's "U" over the calculator's
INCOME & RESOURCES heading or the home hero's "P". The owner asked for it flush left
instead, and the whole mechanism went with it. Don't reintroduce a page-specific inset:
the navbar is a shared frame, and the pages under it change independently of it.

---

## Timeline list (`components/timeline/Timeline.tsx`)

Renders `organizedTimelineData` — banner timelines, Champions Meetings and League of
Heroes events merged into one date-sorted list (~250 rows) — filtered by past/future and
a search box.

**Two card shapes, three event types.** Champions Meetings and League of Heroes events
share one course-details card, `components/timeline/RaceEventCard.tsx`; banner
windows use the wider card in `components/timeline/BannerWindowCard.tsx`. `RaceEventCard`
never branches on which of the two it has — if it ever needs to, they've stopped being the
same card and should be split again. `RaceEventCard.test.tsx` renders one of each from the
same data and diffs the markup, so a change applied to only one type fails there.

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
`banner_category` picks the chip and the column weighting (`CATEGORY_CHROME` in
`BannerWindowCard.tsx`), and can still *force* a band.

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
  dropping it leaves a single panel, the panel keeps its column width (`max-w-md`) rather
  than stretching across a row it is the only occupant of.
- Two column panels implies nothing banded — a banded panel is by definition not in a column
  — so `SECTION_COLUMNS` is only ever reached by the ordinary case and can be reasoned about
  as such.
- **From `xl` up, every piece of timeline art is ONE width: `--timeline-art-width`.** It is
  the ordinary three-column row's art share, `(row - 2rem) * 1.28/2.94`, declared once in
  `App.css` and used as the first track of every banner template, as the width
  of the art-only branch, and as the width of the marker cards' art, paired or alone. The
  length is in `cqw` against the card panel's `@container`, not `%`, so it resolves to the
  same pixels however deeply the art is nested — the marker pair's art sits in a half-width
  column and a percentage there would be half the size. Before this the one-panel row gave
  the art half the row and the marker cards gave it the whole row, and each hit the 41rem cap
  at a width the ordinary row never reaches: four visibly different banner sizes down one
  list. Below `xl` the templates collapse to one column and the cap below is the rule.
  The track is spelled out in full in each of the three templates, never interpolated from
  a constant: Tailwind generates a class only where it finds the complete string in the
  source, and an interpolated template literal quietly yields a single stacked column.
- **Banner art is capped on its WIDTH (`BANNER_ART`, 41rem), never its height, and it sits
  hard left.** The assets are 16:9, so an uncapped `w-full` makes the height a function of
  whichever column template the section landed in: ~358px on an ordinary three-column row,
  but ~580px under the old weighted `SECTION_COLUMNS_PAIR`, and taller still below `xl`
  where the grid collapses to one column. 41rem sits just above the three-column ceiling, so
  ordinary rows are untouched and only the wider shapes clamp, landing at ~369px.
  Do **not** reach for `max-h` instead: with a percentage width the used width is already
  definite, so a height clamp just squashes the picture (measured 1030×580 → 1030×368,
  aspect 1.78 → 2.80). Capping width leaves `height: auto` free to track the intrinsic
  ratio. The cap only ever eats space to the art's *right*, so its left edge stays on the
  section's left edge in every template — the ordinary three-column row has no slack to
  distribute, and centring the capped shapes was what put them out of line with it.
  `BANNER_ART_ALONE` is the sole exception: the art-only branch (every panel banded, e.g.
  race-prep with no uma) has a full-width row and no column edge to align to, so it centres.
- **`SECTION_COLUMNS_PAIR` is the art track then the rest, and both occupants are pinned to
  an outer edge** — art hard left at the shared width, panel hard right (`PAIR_PANEL_CELL`)
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
sets `display` in App.css: they show and hide through container-query utilities, which an
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

### Other Timeline rules

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
  breakpoint and covers the top of the scrollport. A row is the one being read if any part
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
  (a column edge beside it), the same rule as `BANNER_ART_ALONE`.
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

## Legend Races page (`components/legend-races/`)

`/app/legend-races` is the fourth nav destination ("Legends" in the mobile bar). It
shows when each batch of umas joins the daily legend races and how long grinding one
takes. Plan and decisions: workspace-root `legend-races-plan.md`.

- **Everything editable comes from the API.** Batches and umas from
  `daily_legend_race_data`; the title and the text under it from the
  `daily-legend-races` site page. That text IS the grind guidance (the source sheet's
  three lines: 1 Star Piece a day, ~80 from the original event, 70 or 140 days), so an
  editor changes the numbers in the words. The page computes no grind dates (owner's
  call, 2026-10-05: computed "150 pieces by …" lines read as noise). The provider defaults the
  collection to `[]`, so an API without it shows the empty state.
- **A batch with no date is TENTATIVE, and shown** (owner's call, 2026-10-05; it was
  hidden before). An editor enters a future batch before the timeline has a banner for
  it, so `start_date` and `banner_timeline` are null. The page lists these under "No
  date yet", between "Coming up" and the batches already out, in the order entered
  (`tentativeReleases`, by id: by name "6.5th" sorts before "6th"). The card says "No
  date yet", wears a Tentative badge and a dashed border, and has no countdown and no
  Timeline link. It says so on the card as well as in the section heading because a
  search or a `?release=` link can show the card alone. The oshi strip and the search
  cover them. **The Timeline does not**: a pill needs a banner card to sit on
  (`legendRacesByBanner` reads `datedReleases`). A tentative batch with no umas is a
  draft: the API holds it back and `tentativeReleases` drops it too.
- **The rules are pure functions in `utils/dailyLegendRaces.ts`** (dated and tentative
  lists, split around now, ★ groups, by-banner grouping, the countdown wording, the outfit
  split, the `?release=` deep link), tested on their own.
- **A tile gives an alternate outfit its own line** (`splitOutfit`: "Mejiro McQueen
  (Anime)" is "Mejiro McQueen" over a smaller "Anime"). The outfit is what tells two
  versions of an uma apart and it sits at the end of the name, so one clamp over the
  whole name cut off exactly that part. The full name is the tile's `title`.
- **Star groups sit side by side from `sm` up** when a whole group fits beside the
  last, so "five ★3 and one ★2" is one row. That needs each group to be as wide as its
  tiles, so from `sm` the tiles are fixed-width in a wrapping flex row; an auto-fill
  grid has no width of its own. A phone keeps the fluid grid, one group per row.
- **A far-off countdown is rounded** (`arrivalCountdown`): days up to 90, then "in
  about 6 months", then years to the nearest half. Nearly every far date is an
  estimate, and "in 720 days" claimed a precision it does not have.
- **The arrival highlight is the Timeline's** (`TIMELINE_FOCUS_HIGHLIGHT`), an outline.
  It was a `ring-*` until 2026-10-05, which the gold and gilded themes' own
  `box-shadow` on `.card-panel` overrode, so it never drew in the default theme.
- **Short on purpose (owner's call, 2026-10-05).** The admin text, then cards with the
  name, date and badges on one line and the uma tiles. Nothing else per card.
- **On the Timeline a batch is a pill, not a card.** `LegendRaceNote` sits in the header of
  the card of the banner it arrives with (`banner_timeline` id, grouped by
  `legendRacesByBanner`), beside the countdown, like the staggered-release notes, so it
  cannot resize the art. It reads "join" until the batch is out and "joined" after. It
  links to `?release=<id>`; the page card links back with a `banner` focus. A full-width marker card was tried first and floated between unrelated
  cards. The pill uses the `--color-legend-race` token.
- **The oshi strip reads the covered oshis only** (`oshis.slice(0, oshi_slots)`), the
  same cut as the account picture.
- **Head tags come from `AppRouteMeta`**, which reads the site page as an OPTIONAL read
  (`page(slug, { optional: true })`): the one deployment that ships this page builds
  the site against the old API, which has no row yet. Every other page read stays strict.
- **Four mobile tabs stack icon above label** at 11px; side by side they truncated at
  375px. The profile pill's name waits for `xl` for the same reason on desktop: with a
  fourth link it pushed the signed-in bar past 1024px.

## PvP page (`components/pvp/`)

`/app/pvp`: one Champions Meeting or League of Heroes event at a time, with its guide
(`GET /pvp-guides/<kind>/<id>`, `backend/docs/api-reference.md`, "PvP guides").

- **Early access (owner, 2026-10-14, for about a week): supporters and staff only.**
  `PvpGuidePage` is a wrapper: `usePvpAccess()` (`hooks/usePvpAccess.ts`) gives `open`,
  `pending` (the account is still loading, so a supporter never sees the gate flash) or
  `locked`, and anything but `open` draws `PvpEarlyAccess` (sign in, Patreon, or "link your
  Patreon on your account page") and none of the page's own hooks. The server says WHO
  (`account.early_access`, `benefits.early_access_for`: any paid tier, or staff); the
  `PVP_EARLY_ACCESS` constant says the page is still early. The team window and the
  navbar's Team button follow the same answer (`TeamDrawerProvider`'s `available`). A
  client gate only: the PvP API stays open. Opening to everyone is that one constant set
  to `false`.

- **The event lives in the URL**: `?event=cm-12` / `loh-7`, the event's database id
  (`utils/pvpEvent.ts`). `refForRaceEvent` is the ONE place that maps `event_type` to the
  kind, so the Timeline card links to a guide without branching on the tag. No parameter
  opens on the running event, else the next, else the newest (`defaultPvpEvent`).
- **So does the guide's running style**: `?style=front` / `pace` / ... (`PVP_STYLE_PARAM`,
  `parsePvpStyle`; never `everyone`, which is not a tab). The page owns it and
  `PvpGuideView`'s tabs are controlled; a tab click `replace`s, so Back never steps through
  tabs. Changing the event keeps it. A guide with nothing for the asked-for style shows its
  first (`pickStyle`) and leaves the parameter alone, so the pick returns on the next event
  that has it.
- **The tab remembers where it left the page** (`services/pvpPageMemory.ts`, sessionStorage,
  so a new tab opens on the current event). A bare `/app/pvp`, the navbar link, `<Navigate
  replace>`s to the last address; an address that names no style (a Timeline card's link)
  opens on the last style shown. Two keys on purpose: the page key is rewritten on every
  visit and would drop the style. Tests must `sessionStorage.clear()` in `beforeEach`.
  **Every address the page writes names its event** (`setParam` pins the one on screen,
  then writes event, view, style in that order, the same as "Copy link"). Without it,
  Recommendations (which deletes `?view=`) turned a page opened from the navbar back into
  the bare `/app/pvp`, the restore sent it to the remembered `?view=team`, and the tab was
  unreachable until the event changed.
- **"Copy link" in the header** copies the event (always, even on the default landing),
  the style on screen, and `view=gallery`. Never `view=team` (the builder is the reader's
  own, so the link opens the guide) and never `post` (a post's link is `/post/<id>`).
- **The header renders from the calculator payload**, guide or not, and stays COMPACT
  and LIGHT (owner, 2026-10-13: boxed grids, then pills, both read as congested): art
  thumbnail, "Champions Meeting 20" kicker over the cup name, countdown; then the course
  as small labels over values (`availableCourseDetails`, length folded into distance) beside
  a step-line schedule: the start date plus the eight `*_hours` calculation constants
  (`milestones`), passed steps filled, the next one ringed. A null LoH offset hides that step.
- **The view tab row must not set `overflow-x-auto`**: overflow on one axis makes the other
  `auto`, and the tabs' `-mb-px` underline then drew a vertical scrollbar. It wraps instead.
- **Three views under the header, `?view=`**: Recommendations (the guide, default, no
  parameter), My team (`team`, the builder) and Gallery (`gallery`, the posted teams; see
  "Gallery view" below). The guide is fetched only on Recommendations.
- **Only the guide is fetched**, by `hooks/usePvpGuide.ts`, with a module-level cache for
  the tab's life (errors are not cached). A 404 is "No guide for this event yet"; staff get
  drafts with a "Draft, visible to staff only" bar.
- **Every guide section is optional** and steps aside when empty. From `xl` the guide is two
  columns: a side column for the whole team (overview, general skills, team comps, stats)
  and ONE style pane.
- **General skills (`style: "everyone"`) are a side-column section, "General skills",
  directly under the Overview** (owner, 2026-10-17). They are team-wide, like the stats;
  merged into every position's tab (as the page first shipped) they read as that
  position's own picks. A position's "Recommended skills" shows its OWN rows only.
  `skillsForPosition` feeds both (one style's rows, tier then order), and `SkillCategories`
  splits each into subcategories (Acceleration, Core skills, Speed, Recovery, Green,
  Debuffs). **The My team skills panel still merges them** (`guideSkillsByCategory(guide,
  position)`): it is a checklist for one position's team, and says it includes the general
  skills. Style tabs list only styles with content (`stylesWithContent`).
  Never add a second "compare" pane: it was tried and read as every card listed twice.
  "New since <previous event>" is collapsed by default for the same reason.
- **`==words==` is red and `[[Skill name]]` is a skill** in any guide text:
  `utils/remarkHighlight.ts` is a remark plugin in `MarkdownContent` (emits `<mark>`, styled
  `text-highlight`, and `<span data-skill>`, which the caller's `renderSkill` turns into a
  `SkillMention` chip; raw HTML stays off) and `splitNoteText` feeds `InlineNote` for
  one-line notes. Mentions resolve through the guide's `skill_mentions`, provided by
  `SkillMentionsContext` in `PvpGuideView`; an unresolved one is its plain name.
  `MarkdownContent` escapes `[[`/`]]` before parsing, because `[[Updrafters]](FF)` is
  otherwise a markdown link. Token `--color-highlight`.
- **A skill's other versions ride along.** The API sends each embedded skill with its own
  `version` label (`○ white`, `◎ white`, `◎ gold`, `evolved`) and `versions`, its other
  forms, derived server side from the game data (same group plus the evolution link), never
  stored. `SkillVersions` (PvpTiles) lists them under the chip's and the mention's hover
  detail (a chip carries no badge for its other versions: the game prints ○/◎ in the name,
  and a ◎ badge beside it read as a version that doesn't exist; removed 2026-10-18), and the team
  builder's skills panel counts a source that teaches the pick or a version that covers it
  (`familySources` in `utils/pvpGuide.ts`): a card that teaches the gold teaches the white
  too (owner, 2026-10-14), so a gold on the team covers a white pick and a white never
  covers a gold; an evolved pick is covered by a base, "(evolve it)". **Colour is
  `rarity`, never `tier`**: most green skills (and the Straightaways / Corners whites) come
  as a ○ and a ◎, BOTH white at tiers 1 and 2, some with a gold at tier 3. A ○ and its ◎
  are one skill to a team (owner, 2026-10-16), since nothing teaches a ◎ and a guide may
  name either (the admin's track-greens button and sheet import add the ○ since 2026-10-18;
  older guides still name the ◎): they cover each other in the panel, and the picker's skill search and
  pinned chips treat them as one (`whiteSkillPairs` in `utils/pvpTeams.ts`). The gold
  above them stays a separate skill to search. A guide may
  list the white and the gold as two rows when their usefulness differs (owner,
  2026-10-14); they show as two chips.
- **Stats are text** (`"1100+"`, `"578*"`), shown as written in a plain table headed by the
  game's stat icons (`public/0N_CM*.png`). `splitStat` puts `+` / `*` beside the number as a
  superscript and anything longer ("+1 Gold") on a second line, and every cell is top-aligned,
  so a row's numbers always share one line. A blank cell is an en dash.
- **"New since <previous event>"** is computed client-side (`newCardsBetween`): a card's
  first global banner start, between the nearest earlier event of either kind and this one.
- **The mobile bar has five tabs**: labels are 10px and hide (sr-only) below 360px, where
  the icons carry the bar. Checked at 375px and 320px on 2026-10-13.
- **Local test content**: `python manage.py load_sheet_pvp_guides` in `backend/` fills the
  local SQLite with the community sheet's guides (local only).

### Gallery view (`components/pvp/gallery/`)

Teams players posted for the selected event (`GalleryView`), from `GET /pvp-gallery/<kind>/<id>`
(`backend/docs/api-reference.md`, "Gallery").

- **One full-width feed until a post opens, then two panes from `lg` up.** With nothing
  open the feed spans the page and each row is one short band. Open a post and the feed
  moves to the left with the post (`GalleryPostPanel`) beside it, inline and sticky under the
  PvP page's own sticky event bar (`top-[4.5rem]`; change it if that bar's height changes).
  Below `lg` the post takes the feed's place (the feed stays mounted, hidden) with an "All
  teams" button.
- **Rows take their shape from the feed's width, not the screen's**: the feed is
  `@container/feed`, and `GalleryRow` stacks below `@4xl/feed` (56rem) and lays out as a band
  above it; the toolbar does the same at `@2xl/feed`. So the narrow left pane and a phone get
  the stacked row with no extra rules.
- **Opening and closing morph (two panes only).** Framer Motion layout animations: the row
  card animates its size and the pieces inside only their position (`Glide`,
  `layout="position"`, so text is never stretched), measured only when `split` flips
  (`layoutDependency`); the post slides in and out (`AnimatePresence mode="popLayout"`, which
  lifts a closing post out of the grid so the feed widens under it). Below two panes the
  feed is `hidden` while a post is open, and a hidden element measures as an empty box, so
  the rows don't animate there. `MotionConfig reducedMotion="user"` turns it all off for
  reduced motion.
- **`KeepRowInPlace` holds the opened (or closed) row still on screen** through the morph:
  rows roughly double in height, so without it the row you clicked lands a screen lower. It
  scrolls the app scroller on the same curve and timing as the morph (`MORPH`), which
  cancels the row's own slide. That only works if nothing else moves the scroller before
  Framer measures (a microtask after the commit), so the grid opts out of browser scroll
  anchoring (`[overflow-anchor:none]`) and the navigation is claimed from `useScrollReset`
  (`claimScrollRestore`), whose Back restore would otherwise jump it. A row that was out of
  sight leaves the scroll where it is. **It is not a dialog**: the page stays usable, toasts
  show above it, and Escape closes it while focus is inside. The layout uses `lg:` rather
  than `desktop-nav:` (both 64rem) because Tailwind emits custom variants after its
  breakpoints, so a `desktop-nav:` column would beat the `xl:` one that widens it.
- **Sort, filter and open post are URL parameters**: `?sort=top|new` (Hot has no
  parameter), `?uma=<id>` and `?post=<public_id>`. Every row is a real link (an empty
  `<Link>` stretched over the row, the upvote above it; never a button or link wrapped around
  the row's lists). Opening from the list PUSHES an entry marked `galleryFromFeed`, and
  closing it then goes Back, so Back and Close agree and the list's scroll comes back
  (`useScrollReset` below two panes, `KeepRowInPlace` from two panes up); moving between posts (the arrows, or another row), sorting and
  filtering REPLACE. A post's permanent link is `/post/<public_id>`, which the API serves
  (link-preview tags) and which moves people on to `?view=gallery&post=<id>`. Copy link
  copies the `/post` URL, never the `/app/pvp` address. Locally `/post` is only on :8000
  (Vite does not route it), so a copied local link 404s in the SPA.
- **Data lives in the query cache** (`services/galleryQueries.ts`, TanStack Query; the why is
  in `services/queryClient.ts`). One post can be drawn as feed rows in several cached sorts,
  in the panel, and on the account page; `patchPost` writes a vote or a comment count to
  every copy. Never thread a change back through props, and never fetch gallery data outside
  that module. **"Load more" grows `limit`**, never a page number: Hot and Top are re-ranked on
  every request, so an offset page repeats or skips posts that moved. Rows on screen stay
  (dimmed) while a new sort, filter or longer list loads, within one event only. A sign-in or
  sign-out resets the whole cache (`QueryProvider`), because `my_vote` and `is_mine` describe
  whoever asked.
- **Rows** (`GalleryRow`): vertical upvote, picture, name, tier chip, "You" on your own, how
  long ago, caption (two lines), the three umas with names and styles, views and comments.
  The poster's longer **strategy** (`GalleryPost.strategy`, 2,000 characters, plain text with
  its line breaks) is never on a row: the open post shows it under the team, and
  `PublishDialog` has a box for it under the caption's. Re-posting the team that is up starts
  the dialog from its current words, so updating cards can't wipe a strategy.
  Decks are left to the panel on purpose: they made each row half again as tall, and from `lg`
  up the full team is one click away beside the list. Above the list sit the sort buttons, a
  line saying what the sort means (Hot and Top add that supporters count a bit extra, since
  the counts are people and the order is points), the uma filter (`GalleryUmaFilter`: a field
  showing the framed uma, opening a search-and-grid picker over the API's `umas` tally, so it
  only offers umas that find something), and `YourPostBar`: your post's numbers, a "Post a
  team" button to My team, or Sign in for a guest.
- **Looks by key only** (`poster.gallery_style`). In the list, `ssr` is
  `.ssr-panel.ssr-panel--quiet`: the foil edge on the ordinary surface, still glints, one pass
  of the shine on hover or focus. The open post's poster block is quiet too (since
  2026-10-14): the owner turned off the coloured fill behind the text as hard to read. The
  fill (`.ssr-panel--rainbow`, App.css) is kept but applied nowhere; its comment says how to
  bring it back.
  `sr` and `rose` are `[data-gallery-style]` edges in App.css ("Gallery looks") from the
  `--color-gallery-*` tokens, light overrides included. The tier NAME is always text in
  `TierChip`, so the signal never rests on colour. Never derive a look from a tier name.
- **Votes are optimistic** (`useGalleryVote`, one per button so each has its own pending
  state) and roll back with the server's sentence on a refusal. Your own post shows its count
  without a button. The number is people, never weighted points.
- **A guest is asked to sign in and brought back.** `useSignInPrompt` puts the current
  address on `/login` links as router state (`returnTo`); `Login` passes it to
  `startSocialLogin`, which keeps it in the pending login only if `safeReturnPath` accepts it
  (a page under `/app`, so CalculatorProvider still takes in a guest plan on that load), and
  `OAuthCallback` lands there instead of `/app`.
- **Copy to My team** asks `POST /gallery/posts/<id>/copy` for the team, runs it through
  `withinRelease` (utils/pvpTeams.ts: the release rule, because the server does not check
  it) and adds it through `usePvpTeams().createTeam`, so guests and accounts take the same
  path and the per-event cap applies.
- **Comments** (`GalleryComments`): one level of replies, plain text (no links drawn),
  states `visible` / `deleted` ("[deleted]") / `removed` ("[removed]") / `under_review`
  (your own hidden comment). Reply shows only to someone who can write (signed in with a
  display name); the box says which is missing otherwise. A refusal shows under the box.
  Report opens `ReportDialog`.
- **Dialogs** (`GalleryModal`: posting, reporting) are the native `<dialog>` with
  `showModal()`: top layer, inert page behind, Escape to the top dialog only, focus back to
  the opener. Toasts render BELOW the top layer, so a dialog shows its errors inline and
  toasts only once it has closed. jsdom lacks `showModal`; `src/test/setup.ts` stubs it.
- **Posting** lives on My team (`GalleryPostBar` in TeamBuilder.tsx, signed in only): it
  waits for a pending save, needs a complete team, and opens `PublishDialog`, whose box must
  be ticked (the API refuses without `confirm_public_identity: true`). `setTeamPost` keeps
  "Posted" on the right team, and `rememberPublished` refreshes the gallery's cache. The
  account page lists posts (`MyGalleryPosts`, uma pictures from the small `GET /umas`, not
  the PvP catalogue) and holds the supporter's "Show my tier" switch.
- **Counts read as words** through `countLabel` (utils/plural.ts): "1 comment", "3 copies".
- **Local data**: `python manage.py seed_gallery_demo` in `backend/` (12 fake players).

### My team view: the builder (`components/pvp/TeamBuilder.tsx`)

- **One editor, two layouts.** `TeamEditor` owns the pickers and the rules and draws either
  `TeamGrid` (My team: a panel per uma, portrait beside five cards and the borrow slot) or
  `CompactTeamGrid` (the team window: umas on top, cards below). Both take the same props.
  Support art is 3:4 (450x600), portraits square.
- **Side panels** (`SidePanel.tsx`): Guide picks docks on the left from `xl`, Recommended skills
  on the right from `2xl`; narrower, each is a drawer from its own edge behind a toolbar button.
  Both collapse, remembered per browser.
- **What can be picked** is `utils/cardRelease.ts`: a card counts if its first global banner
  starts by the event's last day. Mid-event releases are pickable and tagged with the date; later
  ones are greyed out and sorted last. A card on no banner is decided by the catalogue's
  `on_global`. Every way into a team applies it: the pickers, the skill search, Guide picks.
- **Notes** (`TeamNotes.tsx`): ten per team, read-only until the pen, `==red==` and line breaks
  kept, the eraser's Undo in a toast. Colours are the `--color-note-*` tokens.

## Selectors page (`components/selectors/`)

`/app/selectors` is the third nav destination, alongside Calculator and Timeline. It
holds everything about anniversary campaigns: discounted carat packs, selector tickets,
USD budgeting, and the two toggles that govern whether any of it reaches the projection.

- **`Selectors.tsx`** — page root. Zero props, reads `useCalculatorData()`, owns the
  purchase upsert handlers. Follows `UncapCrystalsPanel`'s conventions.
- **`CampaignCard.tsx`** — one campaign: packs with quantity steppers, the selector
  ticket column with its strip of card tiles, and the per-campaign / cumulative footer.
- **`SelectorTargetPicker.tsx`** — the single-card picker for a selector ticket,
  filtered by that ticket's JP cutoff. **The tile is the whole control**; see below.
  The pick is load-bearing, not decoration: a purchased selector pays for a reserved
  copy only on a banner featuring the picked card, and with no pick it pays for nothing
  (`resource-projection-logic.md`, "A purchased selector pays only for the card picked").
- **`StepUpSelectionStrip.tsx`** — the band below a campaign card's three columns, one
  disclosure row per step-up the campaign sells. It filters `stepUpBannerData` on
  `anniversary_event` and renders nothing when a campaign sells none, so almost every
  card is untouched by it. **Two step-ups share a row** (`md:grid-cols-2`) — an
  anniversary sells at most a ★3 one and an SSR one, and the band already spans the
  whole card. The columns are conditional on there being two: a half-anniversary sells
  one, and a lone row across half the band is the dead space this page keeps shedding.
  Each row's thumbnail resolves
  **guaranteed pick → `BannerStepUp.image` → `★3`/`SSR` chip** — the same order the
  planner row uses, so a step-up looks the same in both places.
- **`StepUpSelectionPicker.tsx`** — the ten-slot dialog, laid out like the source
  sheet's own block: the Selection 1–10 columns across the top, the eligible pool as a
  searchable grid beneath. A dialog rather than an inline grid because the campaign card
  is already a dense three-column layout and the 3rd Anniversary cutoff admits hundreds
  of candidates. A pick the cutoff no longer covers is **flagged, never dropped** —
  deleting someone's choice because shared reference data moved is worse than showing
  them it needs revisiting.

An untouched step-up renders a **default selection** — the ten most recently available
cards, most recent starred — labelled `default` on the row and `(default)` in the dialog
so it never passes as a choice the user made. It is virtual until they edit something.
Because that leaves all ten slots full from the outset, a candidate tile that cannot be
picked carries a `title` saying why; "full" is now the state a first-time user meets.
→ `frontend/docs/resource-projection-logic.md` ("The default selection")

### The selector block is the source sheet's shape

One narrow column of tickets, and everything to the right of it is the cards they take —
mirroring the sheet's own block, which the users of this page already read. Ticking a
ticket is what makes its tile appear; the tiles render in the column's order, so a tile
and its checkbox always line up left to right.

- **The tile *is* the control — there is no name dropdown beside it.** A button repeating
  the chosen card's name cost a row of width per ticket to say what the art already says,
  and on a phone that row was most of the screen. The price chip says which ticket the
  tile belongs to, the caption says which card, the pencil says it can be changed.
- **The affordance is drawn, never hovered**: a dashed frame with a plus while empty, a
  persistent pencil badge once filled. A hover-only cue leaves a touch user unable to tell
  a picture from a button — and this page is used on a phone.
- **Tiles are a fixed size and `shrink-0`** (`w-32` uma / `w-24` support, on an `h-32`
  frame). Five claimed tickets in one strip must look exactly like one, so a strip too
  narrow for them **wraps** — it never squeezes the art. Sizing them to fit was the
  vertical-space problem this layout replaced.
- **The strip's grid track is the constant `minmax(20rem, 49rem)`, sized to the widest
  strip any campaign can have** — the 10rem ticket column, the cell's padding and gap,
  and the fullest ticket set sold (2 uma at `w-32` + 3 support at `w-24`). It is a
  constant and not `max-content` on purpose: a campaign never fills a 96rem card, so
  ~200px of slack has to land somewhere, and both of the obvious answers are worse.
  As an `fr` share it collected between the last tile and the card's border and read as
  a torn edge; as an intrinsic track it sized **each card to its own contents**, and
  since campaigns sell anywhere from five tickets to none, the column boundaries then
  fell in a different place on every card and the stack lost its rhythm. Pinned to the
  maximum, a full campaign's tiles end flush and every other card keeps that geometry.
  **Change a tile width and 49rem moves with it.** Nothing here is an `@container`
  either — with a constant track there is no question left that `lg:` doesn't answer,
  and `lg` is the same breakpoint that puts the card in three columns.
- **The ticket's JP cutoff is not printed on the tile.** It governs which cards the dialog
  offers, which is where it is legible (`N eligible cards`); beside a card already chosen
  it was a date with nothing to act on.

**Both pickers share `useEligibleCardCatalogue`** (`hooks/`), which owns the catalogue
rules: candidates come from the calculator's past and upcoming gacha-banner catalogue
rather than a new endpoint, spreadsheet catch-all rows such as `(All)` are excluded,
cards are deduplicated across reruns, filtered inclusively against the cutoff, and sorted
newest-JP-first with a name tiebreak. It was extracted rather than copied — this repo has
twice paid for hand-copied duplicates of exactly that kind.
- **`timeline/AnniversaryEventStrip.tsx`** — the band that sits flush on top of a banner
  card when that banner is part of a campaign. It keeps only its **top** corners rounded
  and the caller squares the card's top corners (`rounded-b-xl rounded-t-none`) so the
  two read as one unit. Nothing inside the card moves; an unattached banner is unchanged.

Campaign chrome is keyed off the backend's `event_type` tag (`anniversary` / `new_year` /
`campaign`) in both the card and the strip — never off the name.

**Money goes through `formatUsd`** (`utils/formatCurrency.ts`), never a hand-rolled
`toLocaleString` at a call site — the same rule as `formatDate`. It is pinned to en-US /
USD deliberately: the sheet's prices are US store prices, and rendering them as €70 would
present a converted figure nobody computed.

## Testing note

`Timeline.test.tsx` installs a fake `IntersectionObserver` via `vi.hoisted` — it has to
exist before the module is imported, since `Timeline` reads `typeof IntersectionObserver`
at module scope.

**Keep its fire-once-per-instance behaviour.** It models the real API (an observer reports
a *transition* into view, then stays silent) and is what makes the infinite-scroll stall
regression detectable.

### Every public route is prerendered, and sets its own `<head>` tags

`npm run build` does three things: the client build (`dist/`), a server build of
`src/entry-server.ts` (`dist-ssr/`, deleted afterwards), and `scripts/prerender.mjs`,
which renders every route in `src/prerenderRoutes.ts` to `dist/<route>/index.html` **and**
`dist/<route>.html` (static hosts disagree about which one a bare `/about` means; both
guarantees the prerendered document is what gets served — see `outputPathsFor`) with
that route's own `<title>`, description, canonical, `og:` and `twitter:` tags baked in.
The untouched template is kept as `dist/spa.html`, the App Platform catch-all for any
path without a document. A crawler or a link unfurler fetching `/faq` therefore gets the
FAQ's words and tags without running JavaScript — which is what the AdSense "low value
content" rejection of 2026-09-12 was about: the words existed, but every URL served the
same empty `#root`.

**Adding a public route** means four things, and the build or a test fails on each one
you forget: the `<Route>` in `App.tsx`; `useDocumentMeta(title, description)` as the
page's first statement (the prerender throws "No page reported document meta"); the
path in `PRERENDER_ROUTES`; and the URL in `public/sitemap.xml` (`sitemapRoutes.test.ts`
holds the two lists equal). Pass `null` as the title only for the homepage, which reads
as the site name rather than "Home | …".

**Render-time code must not touch the browser.** Everything outside the `/app` loading
gate renders in Node at build time: no `window`, `document`, `localStorage` or
`matchMedia` in a `useState` initialiser, a `useMemo`, or the render body. Read them in
an effect, or through `useSyncExternalStore` with a server snapshot, which is how
`ThemeProvider` (`services/themeStore.ts`) and `AuthProvider` do it. Inside the gate
(`ApplicationViews`) the planner components never render on the server, so their
`document.body` portals are fine. `entryServer.test.tsx` runs the render in the node
environment and is what catches a regression; `hydration.test.tsx` then hydrates that
markup with the client tree and fails on any recoverable hydration error.

`useDocumentMeta` serves both sides: during a server render it reports its values
through `HeadMetaContext` (which nothing provides in the browser), and in the browser
its effect writes the same values onto the live `<head>`, which is what keeps them right
across client-side navigation. `main.tsx` hydrates only when the document's
`data-prerendered` marker matches the current path (`hydrationTarget.ts`); the empty
shell, or a prerendered document served for a path it was not built for, is rendered
from scratch.

The third argument, `noindex`, is for pages that are plumbing rather than content —
`/login`, `/auth/callback`, `/account` and `NotFound`. Those are not prerendered, and the tag is
the ONLY thing keeping them out of the index: `public/robots.txt` deliberately disallows
nothing, because a Disallow stops the crawl before the crawler can read the tag (that
is what earned the "Indexed, though blocked by robots.txt" warning on 2026-09-08). A
static host answers every unmatched path with the catch-all and a **200**, so for
`NotFound` the tag is load-bearing rather than tidiness.

**One public route cannot be prerendered: a shared plan's link, `/app/<public_id>`.** The
id is per plan, so no build can list it. It rides the `spa.html` shell, reports
`noindex` through `AppRouteMeta` ("Shared plan"), stays out of `PRERENDER_ROUTES` and the
sitemap, and is counted in analytics as one bucket (`visits.SHARED_PLAN_ROUTE`) instead
of a `KNOWN_ROUTES` entry. `entryServer.test.tsx` pins the frame and the tag.

The canonical URL is built from `SITE_ORIGIN`, a **constant** in the hook, not from
`window.location.origin`. App Platform keeps serving the same bundle on its generated
`*.ondigitalocean.app` hostname and that cannot be switched off, so a runtime origin
made every page served there declare *itself* canonical — two complete, equally
authoritative copies of the site competing. The constant points the DigitalOcean host
at the real domain, which is what consolidates them.

The theme is applied before first paint by an inline script in `index.html`, not by
React: a prerendered page paints before the bundle arrives, and without the script a
saved theme would flash the default palette on every load. The script duplicates the
ids and storage keys from `themeStore.ts` by necessity; `themeScript.test.ts` fails when
they disagree.

`public/robots.txt`, `public/sitemap.xml`, `SITE_ORIGIN` and the `og:`/`twitter:` URLs
in `index.html` all carry the absolute domain and **do not survive a domain move** —
update them together.

### Site content: the pages the admin edits, and how they reach the prerender

The About page and the FAQ are rows in the API's admin
(**Site content → Pages / FAQ**), served by `GET /site-content` as markdown. Nothing
about them lives in this repo except the plumbing, and the words are still in the
prerendered HTML: the prerender fetches the endpoint first and renders every route with
it. Terms and the Privacy Policy stay as components on purpose; they make claims the
code has to keep true.

Three sources feed one context, in this order:

1. **Build time.** `scripts/prerender.mjs` loads the content (from the API the bundle
   was built against, or `src/content/snapshot.json` under `PRERENDER_CONTENT=snapshot`)
   and passes it to `render(url, content)`. The render is **strict**: a page reading a
   row the content lacks throws, and the build fails rather than baking a loading state.
   As pages read, `buildSiteContentValue`'s reporter records which keys they touched
   (`page:about`, `faq`), the same trick `HeadMetaContext` uses for the head tags, and
   `selectEmbedded` cuts the response down to those. The About document carries the About
   row, the homepage and `/faq` carry the FAQ, `/terms` carries `{}`.
2. **The embedded block.** `injectContent` writes that subset into each document as
   `<script id="site-content" type="application/json">`, with every `<` as `\u003c` so
   an answer containing `</script>` cannot end it. `main.tsx` reads it back and hands it
   to `SiteContentProvider` as `initial`, so the first client render reads the same rows
   the build did and hydration is byte-identical. `hydration.test.tsx` hydrates from
   `rendered.content`, not the whole snapshot, which is what proves the subset is enough.
3. **The runtime fetch.** From an effect, never during render, the provider fetches
   `/site-content` once. It fills in what the document did not embed (a client-side
   navigation to `/about` from the homepage) and revalidates what it did, so an admin
   edit shows on the next page load rather than the next rebuild. Unchanged content is
   dropped before it reaches state (`sameContent`), so nothing re-renders for nothing.

Pages read `useSiteContent().page(slug)` / `.faq()`, and `null` is the loading state:
`ContentLoading` shows until the fetch lands. A page must still call `useDocumentMeta`
first and unconditionally, with a fallback title for that state; the fallback is never
what a prerendered load sees, because the row is always present there. `MarkdownContent`
is the one renderer for all of it, and it turns a site-relative href into a router
`<Link>` so `[FAQ](/faq#anchor)` typed in the admin navigates client-side. It relies on
react-markdown's default of not rendering raw HTML; do not add `rehype-raw`.

The "Last updated" line formats `updated_at.slice(0, 10)`, the date half only. The build
renders in UTC and the browser in local time, and an instant near midnight would
otherwise format to different days on the two sides of hydration.

## Shared plans: the share face and the landing card

A plan's owner shares it from the plan menu; anyone with the link takes a copy. Nobody
opens somebody else's plan, so there is no read-only calculator: the two pieces of UI are
the owner's settings and a card with one button. Provider side: `state-and-guest-mode.md`
("Copying a shared plan").

**The share face** (`PlanSwitcher`, face `share`): the switch ("Share with a link"), the
link in a read-only box with Copy, the two options ("Include my resources", "Include my
notes"), the copy count, and Reset link, which asks first like Delete does because it breaks
a link that may already be out. The options are off by default and greyed while sharing is
off, so the owner can read what each would hand out before anything is on. The link is
built from `window.location.origin` at click time (a dev server's link points at the dev
server), never `SITE_ORIGIN`. Its path is `/plan/<id>` (`sharedPlanLinkPath`), not
`/app/<id>`: the API serves `/plan` with a link preview of the plan (backend
`views/plan_share.py`) and redirects to the card. The dev server has no ingress, so
`vite.config.ts` redirects `/plan/<id>` to `/app/<id>` itself. "Include my notes" says the
notes show in link previews too, because Discord keeps a preview after the owner turns
notes off. The item is hidden on an API older than sharing (no
`public_id` on the plan).

**The landing card** (`components/shared-plan/SharedPlanLanding.tsx`, at `/app/<id>`):

- Routing. `ApplicationViews` has a `:publicId` route beside the tabs' layout route. The
  tabs' static paths outrank it, so `/app/timeline` (eight letters, the shape of an id)
  never reaches it. `isPublicId()` (`utils/appRoutes.ts`) is the only place that decides
  what an id looks like: an id gets the card inside `AppShell` (navbar, loading gate,
  footer); anything else gets `NotFound`, like any other `/app/*` typo. The card is keyed
  on the id, so a different link is a fresh card.
- Inside the loading gate on purpose. The summary is catalogue ids; the card resolves them
  against the catalogue the app already holds and narrows with `plannedBannerTarget()`,
  then draws each banner the way a planner row does (two thumbnails, the name, the kind).
  The thumbnails sit in a fixed slot sized for two 48px tiles (the phone card's height):
  `.thumb-banner` is 56px at natural width, and two square uma icons overflowed a narrower
  slot into the names (2026-10-12).
  A banner that has left the catalogue is left off the list; the count still says how many
  rows the plan holds.
- KEEP IT SHORT (owner, 2026-10-12: the first draft explained too much). A heading, ONE
  info line ("5 banners · 230 pulls · Updated <formatDate> · Copied N times · Includes their
  notes"), the banners, the controls. The totals are the plan's only numbers (owner,
  2026-10-16, with the link preview): pulls, plus steps when it has step-ups. Nothing per row.
- Signed in: a name field prefilled "Copied plan", "Copy to my plans", greyed at the plan
  cap with one line why. The owner opening their own link sees "This is your plan. Open
  it". "Includes their resources" is stated, since an account copy takes them.
- Guest: "Copy to this device", and a confirm step first when the device plan holds
  something the copy would replace. When the owner shared their resources, a box "Use
  their resources instead of mine" (carats, tickets, ranks and planned purchases) is
  offered, OFF until the guest ticks it: their device holds one set, so the owner's replace
  theirs only by their choice.
- On success it navigates to `/app`; the provider toasts. A wrong link or a plan whose
  sharing is off reads "This plan isn't shared, or the link is wrong." with a way back.

## The update notice: stale tabs are told a newer build is live

The site is a single-page app, so an open tab never reloads itself. A deploy changes
nothing for a tab opened before it, and that tab keeps running the old bundle against the
new API for as long as it stays open. The update notice is how such a tab finds out.

**The mechanism.** `vite.config.ts` stamps every build with an id (`BUILD_ID` env var,
else the git commit, else a timestamp; it only has to differ between deploys). The id is
compiled into the bundle as `__BUILD_ID__` (declared in `src/buildId.d.ts`) and the client
build emits the same value as `dist/version.json`. `services/updateWatch.ts` polls that
file every ten minutes while the tab is visible, and again the moment a hidden tab comes
back to the foreground. A different id means a newer build is live, and
`hooks/useUpdateNotifier.ts`, mounted once in `App.tsx`, shows a persistent Sonner toast
with a Refresh action.

Rules that follow from it:

- **It never reloads on its own.** The planner auto-saves, and a reload forced mid-save
  could drop a row. The toast is the whole intervention; the refresh is the person's.
- **A bad answer is never an update.** The App Platform catch-all serves a missing
  `/version.json` as `spa.html` with a 200, so a response that is not JSON, or has no
  non-empty `build` string, is ignored. `updateWatch.test.ts` pins this.
- **The request cache-busts with a query string.** The static site sits behind a CDN that
  keys its cache on the full URL, so `?t=<now>` reaches origin. The HTML itself carries
  `s-maxage=86400`; App Platform purges the edge on deploy, which is what makes the
  Refresh button land on the new build rather than the cached old one.
- **The dev server answers `/version.json` itself**, with the same id the dev bundle
  carries, so `npm run dev` and `npm run dev:live` never show the toast. To see it locally,
  change the `build` value the middleware returns, or test through `startUpdateWatch` with
  an injected fetch as the test file does.

## Team window (PvP)

`components/pvp/TeamDrawer.tsx`, opened by the navbar's Team button
(`components/navbar/TeamDrawerButton.tsx`), shows the player's PvP team over every planner page.
It stands aside on the PvP page's My team view (`?view=team`), where the builder already shows
the team.

- **A window over the page, never beside it** (owner, 2026-10-13; a first version docked as a
  column and pushed the site aside). Fixed on the right, centred on the space below the navbar, 24rem wide, sized to its
  contents; below `desktop-nav` it covers the screen with its own close button.
- **Editable, in a compact layout.** `CompactTeamGrid` draws the three umas on top and each uma's
  six cards below, in the builder's order (1 to 5, a divider, the borrow slot). It takes
  `TeamGrid`'s props, so `TeamEditor` draws either layout with the same pickers and rules; with no
  team for the event, the first pick creates one. "Go to PvP" opens the PvP page on the event.
- **The selector is the pin**: "Next event (auto)" lets `utils/pvpTeams.ts` `drawerTeam()`
  choose; a team pins it until its event ends.
- **Mounted in `AppShell`, never in `Navbar`.** Info pages render their own navbar, and a route
  change inside `/app` swaps only the `<Outlet/>`, so the window stays open from page to page. It
  renders behind the loading gate, so a prerendered `/app` page carries none of it. Open state:
  `services/TeamDrawerProvider.tsx` (`localStorage` `uma-planner-team-drawer`, read in an
  effect); the button renders nothing without its context.
- **Not a dialog**: no backdrop or focus trap, so the page behind stays usable. Escape inside it
  closes it and refocuses the Team button (an Escape inside an open note closes the note only).
- **Notes** show under the team and are written here too (`TeamNotes`); the save state sits in
  the header (`SaveStatus`).
- **Stacking**: page < window (`z-40` from `desktop-nav`, `z-50` below, where it covers the
  screen) < navbar popovers (`z-50`) < pickers (`z-[10000]`) < sonner.

## Carat forecast chart (`carat-calculator/CaratForecastChart.tsx`)

The chart below the planner rows, or above them if the viewer moves it (the button in
its header; `hooks/useForecastPosition.ts`, remembered per device as
`uma-planner-forecast-position`). Bottom is the default (owner, 2026-10-19): the rows
are what a visitor came to edit. Moving it remounts the chart in the other slot, which
then scrolls itself into view. Its numbers are explained in
`resource-projection-logic.md` ("The carat forecast"); this is how it is drawn.

- **Drawn with Recharts, loaded lazily** (owner, 2026-10-19). The plot lives in
  `ForecastPlot.tsx`, reached only through `loadForecastPlot()` (a dynamic `import()`), so
  Vite puts it and Recharts in a chunk of their own (~109 kB gzipped). The app otherwise
  ships as ONE bundle that every page downloads: a static import of `recharts` anywhere
  else would put it on the home page and the FAQ. Keep every Recharts import inside the
  lazy chunk. `AppShell` starts the chunk while `/calculator-data` loads (calculator route
  only); `CaratForecastChart` holds the plot's height in a `Suspense` fallback meanwhile.
  A hand-drawn SVG version was built first and dropped (web #135's first commit).
- **Colours are CSS variables**, passed to Recharts as `var(--color-brand)` and friends,
  never hex, so every theme and colorblind mode re-skin it by redefining tokens.
- **Below zero is the over-budget colour** (`--color-pull-over`, the pull field's token):
  one vertical gradient with two stops at the same offset, where zero falls in the
  shape's bounding box. The headline says "Short by" beside an icon, so the state never
  rides on colour alone.
- **Dots wear a 2px ring in `--card-fill`**, the card's own fill, so they stay legible
  on the line. A row left out of the projection is a hollow dot.
- **One direct label** (where the line ends, a zero-size `ReferenceDot`). Everything else
  is the tooltip, pinned near the top of the plot, and a screen-reader list of every
  banner under the chart. Recharts' accessibility layer steps the tooltip with the arrow
  keys.
- **Folded or open is remembered per device** (`uma-planner-forecast-open`), read in an
  effect because `/app` is prerendered.
- The line draws itself in on mount (Recharts' own animation), skipped under
  `prefers-reduced-motion`.
