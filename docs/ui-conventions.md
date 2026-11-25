# UI Conventions

Dates, styling, theming and the brand mark (the Timeline list has its own page,
[`timeline.md`](timeline.md)). These are the
frontend rules that are easy to break accidentally.

---

## Dates

**All user-facing dates go through `formatDate` in `utils/dateFormat.ts`**, which renders
`YYYY/M/D` (e.g. `2026/7/5`) — unpadded and locale-independent.

Do not hand-roll `toLocaleDateString` or date-fns `format` at a call site. Four such
copies previously drifted into two different locales and two different timezone bases.

**Times of day go through `formatTime`, and their zone through `localZoneName`**, in the
same file. Unlike dates they follow the viewer's locale ("3:00 PM" or "15:00"; owner,
2026-10-28), in the viewer's zone, seconds dropped (an end at 21:59:59 UTC reads "x:59").
A run of times names its zone ONCE, with the generic name (`PT`, `Japan Time`) so one
label holds across a daylight-saving switch. The Timeline cards draw theirs through
`DateTimeRange`, which keeps the dates as the element's own text and the times in child
spans (the Timeline tests find a card by its dates). The PvP schedule strip puts each time
under its date. Both read the zone where they run, so like `formatDate` they stay behind
the `/app` loading gate.

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

**The defaults (2026-11-18): Dark (`gold`) for dark, Tracen for light.** A first visit,
with no valid theme saved, follows the device's `prefers-color-scheme`: light mode gets
Tracen, anything else Dark. The pick is saved at once (`index.html`'s script, then
`saveFirstVisitTheme` on mount), so a later change of device setting never moves it, and
a saved theme is never replaced. The server render and hydration use Dark
(`getServerTheme`); the pre-paint script is what shows the right one. A returning visitor
who never saved a theme looks like a first visit, so on a light-mode device they moved
from Dark to Tracen once when this shipped.

The picker is two columns split by the `mode` in `themeStore.ts`: every dark theme on the
left, every light one on the right, with a rule between. Each column leads with its
default as a larger button (`DEFAULT_DARK_THEME`, `DEFAULT_LIGHT_THEME`), then **More
themes** lists the rest of that mode, palette themes first. Every theme is a named row
with the same swatch: the theme's `canvas` (its card colour on a dark theme, its page
colour on a light one) as a disc with its accent `swatch` as a dot, so themes sharing a
gold accent still differ. Light (`light`) is the original warm palette; Blue
(`light-blue`), Green, Red, Purple and Pearl remain alternatives. Purple keeps its saved
`light-lilac` id.

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

### The default family: one set of shapes for twelve themes

Every theme that is not Winning Live or Tracen (Dark, Gilded, Midnight, Pace, Violet, Teal,
Light, Blue, Green, Red, Purple, Pearl) shares one set of shapes (2026-11-24; the owner:
"the other themes that aren't tracen or winning live will need these changes too"). They are
the first section of `src/personalityThemes.css`, "The default family":

- **A control is a raised key**: a face one step above the card, a lit top edge, a seat.
- **The navbar's tabs sit in a well**, and the one you are on is solid brand.
- **A planner section's title sits on a quiet bar** (a pseudo-element behind the words).
- **The three add-banner buttons are filled in the theme's kind colours**, and the type
  tiles carry the same band.
- **Numbers sit in wells**, one step below the card. Carats are the one brand-coloured number.
- **The Timeline's "Stage banner" is a solid brand button**, and its controls and countdown
  pill are keys.
- **Radii are a step rounder**: 8 / 10 / 14px for `md` / `lg` / `xl`.

So the brand is spent in four places (the solid primary button, the tab you are on, carats,
links) and is no longer the outline of everything.

**How one set of rules draws twelve palettes: role tokens.** A family rule never names a
colour. It names a role (`--brand-ink`, `--key-face`, `--key-line`, `--key-lit`,
`--key-seat`, `--well-fill`, `--tabs-well`, `--bar-fill`, `--kind-*-band`, `--press-filter`),
and `index.css` ("The default family's roles") gives each role a value for dark themes and
one for light themes. Two blocks and not raw grays, because the light ramp is inverted and
not symmetrical: `gray-950` is LIGHTER than the page there, so "one step below the card"
is a different gray on each side.

- **A theme sets its own value for a role in its ordinary `[data-theme="x"]` block.** That
  works only because both role blocks are wrapped in `:where()`, which weighs nothing.
  Unwrapped, the family's selector would outweigh every theme block and a theme's own value
  would silently lose. Dark sets two roles this way.
- **The rules are scoped by exclusion**, `:root:not([data-theme="tracen"],
  [data-theme="winning-live"])`, written out on every rule. A new one-accent theme gets the
  shapes for free; a new palette theme adds its id to the exclusion (three places: the two
  role blocks and the rules). Never bare rules for the palette themes to override: Winning
  Live has no `.planner-section-title::before`, so a bare bar would leak into it.
- **Every repainted control restates its hover and its focus.** A rule there is unlayered,
  so it beats the element's own `hover:` and `focus:` utilities on any property it sets.
- `timelineCss.test.ts` fails if a family rule drops the scope or names a colour.

A change to these shapes is checked with the geometry check (`docs/timeline.md`): `--boxes`
on the themes it paints (paint may change, no box may move), and plain zero on Tracen and
Winning Live.

### The palette themes: Winning Live and Tracen

Twelve themes keep to one accent. These two (2026-11-17) use several colours, each with a job, and change shapes as well as colours. A theme is one of them when its `THEMES` entry
has a `palette` (the accent, then its Uma, Support and Step-Up colours): the picker lists
it ahead of the one-accent themes in its column (Tracen leads the light column as its
default), its swatch dot split between those colours.

| | Winning Live (dark) | Tracen (light) |
|---|---|---|
| Idea | the concert after the race | the game's own menus |
| Brand | yellow `#ffe45c` | deep green `#367500`; lime is paint only (below) |
| Uma / Support / Step-Up | cyan / lime / violet, bright fills with DARK ink | blue / **orange** / violet, tints with deep ink and a saturated band |
| Over budget | red-orange | hot pink, and pink is used for nothing else |
| A second colour | pink, only on the wordmark's "Carat" and the panel title | none |
| Type | Unbounded for `font-display` | Nunito for `font-display` and `font-sans`, weights a step heavier |
| Radius | `--radius-md` 12px, `-xl` 20px | 10px, 18px |

**Tracen Night, Tracen's dark pair, was removed on 2026-11-18** (the owner's call, after
Daptrius's verdict). A device with it saved moves to Winning Live and
saves that: `RETIRED_THEMES` in `themeStore.ts`, mirrored by `index.html`'s script and held
to it by `themeScript.test.ts`. **Removing any theme works this way**: delete its entry and
CSS, and add its id to that map with a replacement, for good. Without the entry its users
fall to the device default and their dead id stays stored. Tracen's colours that its shapes
read (key face and edge, tab tray and ink, stat-box face and edge, the numerals, the
shortfall pill) are still `--tracen-*` tokens in its `index.css` block, written for the pair.

**Their colours are tokens in `index.css` like any theme's; their shapes are in
`src/personalityThemes.css`**, imported last in `App.tsx`. That file's header carries its
three rules, which hold for any later theme of this kind:

1. **Paint only, never size.** An edge is a `box-shadow`, a strip is a background, and
   added padding is given back as a negative margin. The navbar's height, the pull field's
   44px and the banner table's tracks are all load-bearing.
2. **Hooks, never utilities.** The selectors name classes the components carry for this:
   `site-navbar`, `nav-tabs`, `nav-tab` / `nav-tab--active`, `nav-control`,
   `wordmark-second`, `planner-panel-title`, `planner-section-title`, `income-value` (with
   `data-income` on its tile), `add-banner-button--{uma,support,step-up}`, `hero-cta`,
   `forecast-shortfall`, plus the semantic classes `App.css` already had, and the
   Timeline's `tl-*` hooks (`docs/timeline.md`). The default family uses the same hooks. The one utility selector is the precedent
   `index.css` set, `.bg-brand.text-black` (the solid brand button).
3. **Read tokens for anything colorblind mode redraws**, so that mode keeps winning.

Four things a new palette theme has to get right, each learned on these two:

- **The brand token is text in hundreds of places.** Tracen's lime is 1.9:1 on white, so
  its `--color-brand` is the deep green and lime is painted on the solid brand button and
  the named hooks only, always with dark ink.
- **Kind and pull tokens go in the palette block, above the colorblind block**
  (`[data-colorblind-mode="true"]` has the same specificity, so a later block would beat
  it). What colorblind mode must also change for the theme goes in a two-attribute block
  after it: Winning Live gets its white ink back on the deep colorblind fills.
- **Bright kind fills flip the phone card's strip.** Its controls assume a deep fill under
  pale ink, so Winning Live gives the strip the light themes' `--tile-*` set and a dark
  stretch of the gray ramp, except under colorblind mode.
- **Tailwind's `rounded-*` and `font-*` utilities read `--radius-*` and
  `--font-weight-*`**, so a theme block can move them. Full pills stay on hooks: a pill
  radius on a textarea is a blob.

Tracen moves Support to orange (lime is the brand) and keeps on-pity green, which shares
a hue with its brand; the Green theme moved on-pity to blue for that, and blue is Uma
here. That one is the owner's to settle (`notes/theme-options.md`).

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
(`.category-chip--revival` in `timeline.css`, the Golden Week marker on a timeline section) follows the same
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
| `desktop-nav:` | `min-width: 64rem` | mobile ⇄ desktop navbar |
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
  `relative`/`absolute` idiom the navbar's menus use cannot work here: the sheet sits inside
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
  already gives its icon buttons (the card's delete, the navbar's search), so the pad matches
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
the favorites card and picker on the account page.

**The owner's exceptions** (2026-10-14) draw the same borderless art with NO frame
(`FramedUma frame={false}`, `Avatar framed={false}`, `UmaPortrait frame={false}`;
`.uma-frame--bare` in App.css):

- the navbar's profile menu (the trigger and the menu's own avatar);
- the account page, except the "Your favorite uma musume" card and the favorites picker
  it opens: the header avatar and the "Your gallery posts" list are bare.

(The Selectors page was an exception for a moment on 2026-10-14 and was taken back the same
day: it is framed.) The art is the API's `portrait` (borderless,
else bordered); never the bordered `image`, whose baked-in rarity border would sit inside
ours. A route that sends an uma sends `portrait` with it (`/calculator-data`, the PvP guide,
the PvP catalogue; `GET /umas` and the account's oshis send the portrait as `image`).

- **Two frames**, SVGs in `src/assets/`: `uma-frame.svg` (silver) for everyone and
  `uma-frame-oshi.svg` (the rainbow) for EVERY OUTFIT of each favorite their tier covers
  (`useOshiIds`, owner 2026-10-16: a favorite Oguri Cap frames Oguri Cap (Christmas) too,
  on every page). The server resolves the outfits (`account.oshi_uma_ids`, by
  `game_id // 100`); the client only tests membership. App.css ("Uma frames") lays the
  frame over the art, and **the art fills the frame's box at exactly its size. Never shrink
  or inset it.** The portraits are the game's cut, with rounded bottom corners baked into
  the picture as transparency; at full size the frame's 24-unit band hides them with about
  2 units to spare, and even at 99.5% they show. Web #379 drew the art at 96.85% and every
  uma that reaches her bottom corners got a dark gap in both, on every device (v2.17,
  2026-11-17). Only the grey square behind the art (a missing picture, the art's transparent
  background) sits 12 units inside the frame's outer edge, under the band: a flat colour has
  no corners to expose. A bare frame's square fills the box.
  `className` only sizes the square (`w-14`, `h-full`), and it MUST size it: the art is
  absolutely positioned, so it gives the frame no size of its own.
  **The art's outer 12 units are not painted** (`clip-path` on the `<img>`; the band covers
  that strip anyway). WebKit, so every browser on an iPhone, draws the frame (a CSS
  background) up to one device pixel short of the box on the right and bottom when the box
  isn't a whole number of device pixels wide, while the `<img>` fills it: a line of art
  showed past the frame on the fluid PvP and Encyclopedia tiles at the default zoom (Daptrius,
  board "Issues with Uma SVG Alignment on iOS", 2026-11-17). Reproduced and fixed in a Linux
  WebKit at 402 px and 3x (2026-11-18): 29 tile widths, both frames, sizes down to 16 px and
  the share picture. Web #376 (the art's sizing) was not the cause. A frame change gets the
  same WebKit run before it ships (`npx playwright-core install webkit`; Chrome never shows
  this).
- **Layered art** (`layers`, the API's `portrait_layers`; notes/layered-uma-art-plan.md,
  2026-11-20). An uma with Daptrius's layered art is three layers: his base, the frame, then
  a foreground with whatever sticks out past the frame (ears, hair, hats), drawn OVER it.
  The foreground's canvas is the frame's box plus a sixth above and 16/360 each side
  (`.uma-frame__over`, App.css), and it sits outside the tile's box on purpose: layout never
  grows, so a caller that clips or packs rows tight leaves the room itself. The ones that do:
  the Timeline's featured tiles and the guide's uma tiles (a headroom strip, `aspect-[6/1]`),
  the selector pick tile and the step-up slots (no clip on an uma), My team's spot header,
  Guide picks' row gap, the team window, the share picture's columns, and the phone
  Encyclopedia hero (`:has(.uma-frame--layered)`). Without `layers`, or with the frame off,
  `FramedUma` draws `src` as before: the frameless places keep the borderless art (owner,
  2026-11-18). The base keeps the img clip above: it sits under the opaque band, so it
  hides nothing and keeps the WebKit fix. A route that sends `portrait` sends
  `portrait_layers` beside it; pass it wherever the `src` comes from (`layers={x.portrait_layers}`).
- **Support cards are not `FramedUma`**: in the PvP places they are `FramedCard` ("Card
  frames" below), elsewhere their own bordered picture. A list that can
  hold either pool decides per item from data, never from shape: a catalogue option's
  `portrait` is set only for umas (`EligibleCard`, `PvpCardPicker`'s items carry `card`
  for a support card), a step 5 pick carries `uma` (`SelectedCardArt`), a planner row
  narrows on `target.type`.
- **`useOshiIds` reads `AuthContext` directly**, so a row or picker rendered on its own (in
  a test) draws silver frames instead of throwing for want of an AuthProvider.
- **Whose favorite.** The rainbow frame means "one of YOUR favorites": `useOshiIds`
  everywhere, the team builder included (it adds its heart). The ONE exact-match place is
  the favorites picker (`useOshiPickIds`), where the rainbow says "you picked THIS card";
  an avatar is rainbow when it is yours (your own
  avatar, your own gallery posts and comments, your covered favorites on the account page)
  and silver on someone else's.
- **A state rings the frame, never replaces it.** The guide picks panel's open and
  on-the-team rings follow the frame's corner (`rounded-[10.75%]`); the old turning
  `.oshi-frame` and the gold rings are gone.
- **Not framed:** banner, campaign and event art, and support cards outside the places
  below. The `/post/<id>` link preview picture is drawn by the API (`gallery_preview.py`)
  and does not use the frames.

### Card frames (`components/FramedCard.tsx`)

**A support card in the PvP guide's decks (every deck tile, the All tab, swap-ins, an "or"
card's hover), the team builder (its slots, the card picker, the guide picks panel, the
drag preview) and the Collection (the Support cards tab, a veteran's training deck) is
built from layers the way the game draws it** (owner, 2026-11-02; first places only,
`notes/support-card-art-plan.md`). **Since 2026-11-23 (board, "Pages still using old support
card styles") also the planner (sheet, phone card, staged rows, a step-up's step 5 pick), the
Timeline (banner tiles, story event cards), the Selectors page, the team window, the gallery's
decks, Rankings (`rankings/kit/CardArt`), shared plan rows and Community plans.** Banner and
story event cards reach it through `utils/cardFrame.ts` from `/calculator-data`'s
`image_borderless` and `card_type` (api #311). Still the bordered `image`: search, and **the
share picture** (`BannerArt`'s `large`), which inlines every image, the frame's SVG layers
included, until its iPhone export is settled (board, "Plan Images Export").

- **The layers**: the API's `image_borderless` (the game's own texture, no frame, no type
  icon) under Daptrius's SVG overlays in `src/assets/card-overlays/`: the rarity frame
  (`frame-r|sr|ssr`), the type icon (`type-<card_type>`; his "Pal" is our `friend`) and, on
  an owned card, the limit-break diamonds (`lb-0` to `lb-4`, from `limitBreaks`). Frames and
  diamonds are his files untouched; the icons are his, shrunk to today's size with a darker
  outline (the owner's pick, canvas version 7).
- **The geometry is his pipeline's** (App.css "Card frames"): the art inset by his 50 px
  padding with his 120 px corners, every overlay stretched over the whole 3:4 card
  (`preserveAspectRatio="none"` in the files). Each overlay is its own `<img>`, so the
  files' gradient ids never meet.
- **The diamonds mean two things by place**: on an owned Collection card, the card's own
  limit breaks; on a guide's deck card, the LEAST the guide recommends (`PvpDeckSlot.limit_break`,
  none when it doesn't say), which the editor sets per card ("LB: not said", 0 LB+ to
  MLB, under each slot in `DeckSection`). The sheet's "◆◆◆◇ +" notes became that field.
- **No texture, no frame**: a card whose `image_borderless` is null (a placeholder, or a new
  card before its texture is uploaded) draws its bordered `image` as it is, with the
  diamonds still on top. Never the bordered picture inside the frame.
- **States sit on or round the card**, never replace it: the Link badge, the borrow tab
  (behind the card, down to 12% of its height so it clears the corners at every size), the
  picker's owned badge, the guide picks panel's ring (`rounded-[6%/4.5%]`). The Collection's
  spare copies badge is top LEFT: the icon has the top right.

### Portaled `react-select` menus need `menuPosition="fixed"`

Every select using `menuPortalTarget={document.body}` also sets `menuPosition="fixed"`.
The portal attaches to `<body>`, but the control can live inside the app shell's vertical
scroller; with the default absolute positioning the menu is placed against the body and
visibly detaches from its control as soon as that container scrolls.

### Text fields and selects on iOS

iOS Safari zooms the page into any field under 16px, and nearly all of ours are 12 to 14px.
An inline script in `index.html` adds `maximum-scale=1` to the viewport tag **on iOS only**
(iOS still allows pinch-zoom; Android would lose it). A plain list on a touch screen is the
platform's own `<select>` (`useCoarsePointer`; the income panel's `RankSelect`), never
react-select's portaled menu. Lists that need art, colour or search (the banner pickers)
stay react-select everywhere.

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

**The last control in the bar is one menu, `components/navbar/SiteMenu.tsx`, for everything
that is not a place** (owner, 2026-11-24; `notes/navigation-plan.md`, PR 2; it was
`ProfileMenu`, signed-in only). It holds the account rows, a **Theme** row that names the
current theme and opens the picker in place (`navbar/ThemeOptions.tsx`, the old palette
button's panel; a pick does not close the menu), and **About, FAQ, Changelog, Feedback**,
which only the footer linked before. **A guest gets it too**, behind a plain menu button
("Menu" beside the icon from `desktop-nav:` up) next to the Sign in button: its first row is
"Sign in to sync" with the sentence the bar's button keeps in its tooltip, so a phone can
read it. A new non-place (a setting, a link) goes in this menu, never back in the bar.

Signed in, its trigger is unchanged: a
pill (`NAV_PROFILE_TRIGGER` in `navStyles.ts`) with the account's avatar as its
left cap and, from `desktop-nav:` up, the person's name and a chevron beside it,
opening a menu with **Account**, **Collection** (since 2026-10-26) and **Sign out** (since 2026-09-12; sign-out used
to be a bare button in the bar; the pill and the name arrived 2026-09-13). Below
`desktop-nav:` the pill is the avatar ring alone — at 390px the app-mode cluster
is already save + theme + this. A guest still sees the Login link. The
menu closes on an outside press, Escape (focus returns to the trigger) and a link, and is always the
LAST control, so right-anchoring never runs it off a narrow screen.

**The name is the one they chose, else the handle.** `account.display_name`
(set on `/account`) or `account.username`. The menu header shows the handle in
mono under a chosen name, because the handle is the account's identity and what
an admin would ask for. The name span is omitted while `/account` is in flight,
so the pill widens once rather than jumping from a placeholder.

**The avatar is the person's first favorite uma, and it is square.**
`Avatar.tsx` shows `account.avatar_url` — the server sends the first oshi's art,
`null` until they pick one — and on `null` or a broken image draws the quiet
default: a muted `UserRound` silhouette on a `bg-gray-700` rounded square,
styled like the icon buttons beside it so it reads as one
more control. The same default for everyone and for the loading state, on
purpose: the avatar is only ever shown to its owner, so two empty accounts have
no reason to look different, and the initials-on-a-hue circle it replaced
(2026-09-13) was loud in an otherwise grey bar. **Square since 2026-10-07**
(`rounded-md` for `sm`/`md`, `rounded-lg` for `lg`): the art is a square
portrait and the circle cropped every corner; the navbar trigger
(`NAV_PROFILE_TRIGGER`) is `rounded-lg` around it so the frame stays even. No
provider picture is ever held or shown. Three sizes: `sm` (menu rows), `md`
(the navbar trigger, 36px inside the 40px frame), `lg` (the account header and
the favorite tiles). Avatars never appear anywhere public today; the
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
**favorites card** ("Your favorite uma musume" on screen; `oshi` in the code,
the wire and the test names).

**The favorites card draws what the server says.** `account.oshi_slots` (1 for
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
with the server's reason toasted ("Your tier covers 3 favorites.").

## Collection page (`components/collection/`)

`/app/collection`: everything confirmed about the player's own game account (owner,
2026-10-26; `notes/pvp-planner-plan.md`, R2, "The Collection"). Four tabs, `?tab=`
(`veterans` by default, `umas`, `cards`, `history`): **Veterans** (umas they finished
training), **Umas** and **Support cards** (what they own, `RosterGrids.tsx`), and **CM
history** (`CmHistoryTab.tsx`). Each tab is a card with its count (veterans; owned of the
Global umas or cards, with a bar; events with runs logged). "Import from the game"
sits in the header: one import fills all three. The page is `max-w-7xl` (1280px) since the
redesign (owner, 2026-10-27; `notes/collection-redesign-plan.md`, with the mockup's link).

- **CM history** (`CmHistoryTab.tsx`, `GET /pvp-runs`): read only. One card per event with
  runs logged, newest first (win rate, tickets used, each round's best ticket and the Finals
  on a CM, the umas that raced), linking to its CM Runs tab; beside it, each linked veteran's
  record across every event, best rate first, linking to her card. The counting is CM
  Runs' own (`eventHistory` / `veteranRecords` in `utils/pvpRuns.ts`, over `summarizeRuns`),
  so the numbers match: days make the win rate, the Finals race counts on its own. A save in
  CM Runs marks the history stale (`useSaveRun`).
- **The Umas and Support cards grids** (`RosterGrids.tsx`): every Global uma or card as a
  tile (JP-only ones are not offered), its state ON the art: an uma's stars and potential, a
  card's limit break pips (MLB) and spare copies (`.art-badge`, fixed colours over the art).
  A tap on an unowned (greyed, "+") tile adds it, an uma at her base stars (her rarity); a
  tap on an owned one opens its editor under the tile (a non-modal dialog: Stars and
  Potential, or Limit break and a spare copies stepper; Remove; Done), which Escape or a
  press outside closes. A summary card on top (umas by stars and potential 5; cards at MLB
  and owned per type) carries the save line. Search, **All / Owned / Missing**, rarity and
  type chips on cards, and **Start over** in the ⋯ menu, which empties that list after an
  inline confirmation. An uma tile with veterans links to them (`?uma=`, outside the tile's
  button). **No "mark everything" button** (owner: too easy to fill a collection with things
  you don't have). Edits are optimistic and queued in order (`services/rosterQueries.ts`, the
  CM Runs pattern).
- **Sorts combine** (`utils/rosterSort.ts`): chips in the order added, each flips direction,
  "then by" adds one, Reset goes back to **newest released first** (the default; a release is
  the first Global banner's start, `utils/cardRelease.cardReleases`, else the game's own date for a
  card on no banner, `collectionCardRelease`, and Global's launch for a Global uma on none). A missing value sorts
  last either way; ties end on the name. Umas: release, acquired, rarity, stars, potential,
  name. Cards: release, acquired, rarity, limit break, type, name.
- **My team's pickers** (`PvpCardPicker` `owned`, from `utils/roster.ownedForPicker`): an
  "Owned only" switch, on by default once anything is owned, a tick on an owned uma and a
  card's limit break. Never a rule; the skill search picker is left out on purpose (it looks
  for every source of a skill).
- **Account only, and off the navbar.** A guest gets a sign-in card. It is reached from the
  profile menu's Collection item and the Account page's Collection card
  (`CollectionSummary`, which shares the cached list). Like `/account` it is NOT
  prerendered and not in the sitemap; `AppRouteMeta` marks it noindex. It is in the API's
  `visits.KNOWN_ROUTES`.
- **Manage here, pick elsewhere.** Adding, editing and deleting veterans happens only here;
  My team and CM Runs only choose from the list (`services/trainedUmaQueries.ts`,
  TanStack Query, one cached list for every reader).
- **The form (`VeteranForm`) is an inline panel, never a modal**: it opens the uma picker
  (`PvpCardPicker`, an overlay), which a native `<dialog>` would cover in the top layer.
  Picking the uma fills her aptitudes from her own (`withUma`), so the player changes only
  what training changed. Skills are searched by any name or the id (`searchSkills`, on
  `skillMatches`; see "Skill search" under the Skills page); a unique skill
  (rarity 3 to 5) gets a level. The checks under each field are the API's rules
  (`draftProblems`), shown once Save is tried. A veteran from the game (`source: "import"`)
  keeps the game's numbers: its fields are disabled and an edit sends `label` only.
- **Import from the game** (`ImportPanel`, above the tabs): umadump's three files at once,
  each recognised by SHAPE (`utils/gameImport/umadumpRoster.detectExportFile`):
  `trained_chara_data.json` (veterans), `card_data.json` (owned umas),
  `support_card_data.json` (owned cards). Read IN THE BROWSER; **everything** each file says
  is sent as `game_data` (owner, 2026-10-26), the player's own game account id and memos
  included, minus OTHER players' account ids and trainer names (`stripOtherPlayers`; the
  API strips again). Veterans: the preview ticks each, and saving replaces the last veteran
  import (the API keeps any a logged CM run uses). **Umas and cards: the file is the truth**:
  each file REPLACES its list, hand edits included, and what the file lacks is removed; a
  list with no file is not sent, so it is left alone. The request is gzipped (`gzipBody.ts`).
  umadump is linked as a community tool the site does not make.
- **The Veterans tab** (`VeteransTab.tsx`): tiles (`VeteranList.tsx`) and the open veteran's
  card (`VeteranCard.tsx`). **Which one is open is `?veteran=<id>`** (CM Runs' win rates link
  there). From `lg` up the card sits beside the list, sticky, and with no param the first
  veteran shown is open; below `lg` the list shows until a tile is tapped, then her card with
  "All veterans" to go back. CSS alone decides which shows (`hidden lg:block`); nothing reads
  the screen size at render. `?uma=<id>` starts the list on one uma. The add/edit form takes
  the whole tab's place.
- **A tile** tells same-uma veterans apart: her label or game memo with the uma under it,
  else the uma's name with her outfit and trained date on the second line (`tileLines`: an
  alt outfit's brackets are split off so a narrow tile never cuts it), the grade hexagon and
  score (`veteranGrade.ts`), the five stats as columns over their colours, and ONE flag
  (Borrowed, then "Not in your latest import", then By hand; `utils/veteranLook.tileFlag`). Search (name, label, memo),
  Uma, Sort (newest trained, score, each stat) and "A or better at" (one distance or style)
  are `utils/veteranList.ts`.
- **Her card** is laid out like the game's veteran screen: framed portrait, name, label,
  running style, scenario, trained date, the grade and score; her flags and game memo; five
  stat blocks (number and bar, **no per-stat letter**: the game data has no table for them,
  so they wait for the owner to confirm the ladder); the aptitude grid, with an up-arrow
  where she is above the uma's own letter. Tabs **Skills** (unique, evolved, gold, white,
  in the PvP guide's surfaces), **Sparks** (hers; "As a parent she passes on", her sparks plus
  her two parents' summed by name; the lineage, two parents with their two each) and
  **Training** (the deck with limit breaks, finishing places, scenario, fans, titles). A hand
  entry's Sparks and Training offer the import instead.
- **Her game data is fetched when her card opens** (`useVeteran`, GET /trained-umas/<id>: the
  raw `game_data` and the API's `sparks` names), never with the list, and read only through
  `utils/veteranGameData.ts`, which trusts nothing about the shape. Her lineage and deck name
  outfits and cards by the GAME's id (the catalogue's `game_id`). An edit or delete updates
  that cache; an import drops every one.
- **Colours** (`index.css` `:root`: `--color-stat-*`, `--color-spark-*`; `App.css`:
  `.grade-badge` / `.grade-band` by `data-tier`, `.spark-chip` / `.spark-dot` by
  `data-spark`, `.place-square` by `data-place`) are fills and edges only, never text, so one
  set serves every theme. The grade and podium fills are fixed game colours with dark ink.
- Tests: `CollectionPage.test.tsx` (the flows and her card), `trainedUmas.test.ts` (the form's
  rules), `veteranGameData.test.ts` (reading her game data), `veteranList.test.ts` (the list),
  `veteranLook.test.ts` (a tile's lines).

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

## Timeline list (`components/timeline/`)

**Moved to [`docs/timeline.md`](timeline.md)** (2026-11-24): how the list is built, the
card shapes and what decides them, the hook names a theme may select, recommended panels,
deep links, marker cards, and a table of what changes at which width. The short form of
its rules loads by itself whenever a session opens the folder (the notes repo's
`.claude/rules/timeline.md`).

---

## Legend Races page (`components/legend-races/`)

`/app/legend-races` is the second page of the Timeline screen, reached from that screen's
bar (it had a navbar tab of its own until 2026-11-24; see "Screen bars"). It
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

- **Early access (owner, 2026-10-14): supporters and staff; each guide says what else is
  open (owner, 2026-11-02, `notes/guide-visibility-plan.md`).** `usePvpAccess()`
  (`hooks/usePvpAccess.ts`) says WHO: `open`, `pending` (the account is still loading, so a
  supporter never sees the gate flash; `PvpGuidePage` draws only a "checking" line) or
  `locked` (`account.early_access`, `benefits.early_access_for`: any paid tier, staff, or the
  admin's grant). Each event's guide says WHAT, from `/calculator-data`: `guide_visibility`
  (`"supporters"`, `"public"`, null for none or Private) and `guide_tools_public`. Locked,
  the page still renders and opens a Public guide's Recommendations
  (`guideOpenToEveryone`), and its My team, CM Runs and Gallery only with the switch
  (`toolsOpenToEveryone`); nothing in code opens a guide any more (the rolling free guide
  and `PVP_OPEN_CM_NUMBER` are gone). The event list offers only Public guides' events
  (`lockedPvpEvents`, plus whichever event a link opened) and hides "Show past events" when
  none of them is past; the team window knows only events with My team opened
  (`lockedTeamEvents`) and its Team button shows only while one is on. Everything else
  draws `PvpEarlyAccess` in its panel (a link to the nearest Public guide, sign in,
  Patreon, or "link your Patreon on your account page"), and a locked guide is never
  fetched. A bare `/app/pvp` skips the tab's remembered address while locked and lands on
  `lockedLandingEvent` (the Public guide running now, else the next, else the latest). The
  API refuses a Supporters guide and its comments itself (a 403 `supporters_only`, which
  `usePvpGuide` reads as `locked` and the page draws as the card); My team and the Gallery
  are page-only gates. The team window and the navbar's Team button follow the same
  answer (`TeamDrawerProvider`'s `available`).

- **The event lives in the URL**: `?event=cm-12` / `loh-7`, the event's database id
  (`utils/pvpEvent.ts`). `refForRaceEvent` is the ONE place that maps `event_type` to the
  kind, so the Timeline card links to a guide without branching on the tag. No parameter
  opens on the running event, else the next, else the newest (`defaultPvpEvent`).
- **So does the guide's running style**: `?style=front` / `pace` / ... (`PVP_STYLE_PARAM`,
  `parsePvpStyle`; never `everyone`, which is not a tab). `?style=all` is the "All" tab
  (Henry, 2026-10-21): every style's pane at once, two abreast from `lg`, offered only when
  a guide has two or more styles (`styleTabs`). Its type is `PvpStyleTab`, which only the
  guide's tabs and the page memory take; a team member's style stays a `PvpStyle`. The page owns it and
  `PvpGuideView`'s tabs are controlled; a tab click `replace`s, so Back never steps through
  tabs. **With no style asked for, the guide opens on its first style**, in the usual Front,
  Pace, Late, End order (`pickStyle(styles, wanted)`), **never on its top-ranked one** (owner,
  2026-10-27, reversing 2026-10-23 at the team's request: players keep to one style, and the
  page must not move them because of the meta analysis). The ranking only labels the tabs:
  `parseStyleRanking` reads `style_ranking` ("Pace>>End>Late>Front"; `>>` a clear gap,
  `=` / `>=` level; a word that names no style, CM 20's "Blaze", stays a step with
  `style: null`), and each ranked tab shows its place ("Pace #1", `styleRanks`),
  `aria-hidden` so the tab's name stays the style's. **Changing the event keeps `?style=`**,
  so Next stays on the reader's style. A guide with nothing for the asked-for style shows
  its first and leaves the parameter alone, so the pick returns on the next event that has
  it. On a phone the five tabs are equal columns on one line.
- **Comments on a guide** (Henry, 2026-10-21; `guide-comments-plan.md`): one thread per section,
  `""` for the whole guide (the side column's last box) and one per running style (under the
  style's pane). Each button names its thread ("Comments on Pace", "Comments on the whole
  guide"): on a phone the two sit one after the other. `GuideComments` folds each until opened, showing the guide's `comment_counts`,
  so nothing is fetched for a section nobody opens; the All tab's box header shows each
  style's count beside "Open Pace", the way to its tab. Open, it is the gallery's `GalleryComments` with a `guideThread` source
  (`services/guideComments.ts`), which keeps the guide's counts in step through
  `patchPvpGuide`. Every comment, gallery or guide, has a thumbs-up and a thumbs-down with the score between (`useCommentWrites().vote`; staff see the split in the score's title).
- **Pinned rows** (Daptrius, 2026-10-22): the View tabs stick at the top of the shell's
  scroller (desktop) or under the navbar (phone, document scrolling); the event band
  (Previous, the event, Next) scrolls away in both (review item 4, 2026-11-24: it held 52px
  of the screen for the whole read). The running-style tabs, the guide's side
  column, the gallery's open post and the team builder's docked panels stick under them.
  The offsets are MEASURED by `hooks/usePvpStickyOffsets.ts` into CSS variables on the page
  root (`--pvp-tabs-top`, `--pvp-below-tabs`, `--pvp-viewport-h`); a new pinned row reads
  those, never a rem guess. The side column (`.pvp-side-sticky`, App.css) pins when it fits
  and otherwise scrolls with the page until its end shows. Pinning works on a phone only
  because the /app scroller is `overflow-x-clip` below app-shell, not a scroll container
  (`views/ApplicationViews.tsx`): put overflow-y back on it and every sticky inside /app
  stops engaging there.
- **The tab remembers where it left the page** (`services/pvpPageMemory.ts`, sessionStorage,
  so a new tab opens on the current event). A bare `/app/pvp`, the navbar link, `<Navigate
  replace>`s to the last address, and an address that names no style (a Timeline card's
  link) opens on the last style shown, on any event. Two keys on purpose: the page key is rewritten on every visit and would
  drop the style. Tests must `sessionStorage.clear()` in `beforeEach`.
  **Every address the page writes names its event** (`setParam` pins the one on screen,
  then writes event, view, style in that order, the same as "Copy link"). Without it,
  Recommendations (which deletes `?view=`) turned a page opened from the navbar back into
  the bare `/app/pvp`, the restore sent it to the remembered `?view=team`, and the tab was
  unreachable until the event changed.
- **"Copy link" in the header** copies the guide's preview link, `/guide/cm-21?style=pace`
  (`guideLinkPath`, since 2026-10-24: the API answers it with link-preview tags and a
  picture, backend `views/guide_share.py`, then forwards to `/app/pvp?event=…`), naming
  the event always (even on the default landing) and the style on screen. The Gallery
  view copies `/app/pvp?event=…&view=gallery`. Never `view=team` (the builder is the
  reader's own, so the link opens the guide) and never `post` (a post's link is
  `/post/<id>`). The dev server redirects `/guide/…` itself (`vite.config.ts`), as `/plan/…`.
- **The header renders from the calculator payload**, guide or not, and stays COMPACT
  and LIGHT (owner, 2026-10-13: boxed grids, then pills, both read as congested): art
  thumbnail, "Champions Meeting 20" kicker over the cup name, countdown; then the course
  as four pairs, unboxed (`CoursePairs`, the Timeline card's too: see "Course pairs") beside
  a step-line schedule: the start date plus the eight `*_hours` calculation constants
  (`milestones`), passed steps filled, the next one ringed. A null LoH offset hides that step.
- **Course pairs (owner, 2026-10-29).** Wherever the site shows a race's course (the PvP
  header, the Timeline card, the team picture) it is FOUR pairs from `coursePairs`
  (`utils/courseDetails.ts`): Racecourse over its direction ("Left-handed"), Distance over
  its band, Surface over the ground ("Firm ground"), Weather over the season. The line
  under each headline is the same size, a step lighter, never a small muted footnote: the
  owner wants both treated as equally important. A half not announced reads "TBD"; a pair
  with neither half is left out. Editor values that don't parse show as typed.
- **The view tab row must not set `overflow-x-auto`**: overflow on one axis makes the other
  `auto`, and the tabs' `-mb-px` underline then drew a vertical scrollbar. It wraps instead.
- **Four views under the header, `?view=`**: Recommendations (the guide, default, no
  parameter), My team (`team`, the builder), CM Runs (`runs`, the player's logged tickets;
  see "CM Runs view" below) and Gallery (`gallery`, the posted teams; see "Gallery view"
  below). An editor gets a fifth, Edit guide. On a phone the tabs show their `short` labels
  (Guide, Team, Runs, Edit); the full label stays the accessible name. The guide is fetched
  only on Recommendations.
- **No Rankings view since 2026-11-24.** The PvP page had one (`?view=rankings`,
  early access only, from 2026-10-27): the event's gallery posts counted, each row beside
  what the guide does with it, and the most copied posts. The owner removed it as redundant
  with the Rankings page's PvP tab, which counts every saved team and shows each pick's
  share of the gallery. An old `?view=rankings` link reads as Recommendations. The API's
  `GET /rankings/gallery/<kind>/<id>` stays (that PvP tab reads it); its `copied` list
  (the most copied posts) has no reader now.
- **Only the guide is fetched**, by `hooks/usePvpGuide.ts`, with a module-level cache for
  the tab's life (errors are not cached). A 404 is "No guide for this event yet"; staff get
  drafts with a "Draft, visible to staff only" bar. A guide an editor marked **Under
  construction** (`under_construction`, the Guide tab's checkbox; Henry, 2026-10-24) gets
  a banner in the same place, above the band, with a `staging` hazard-tape strip
  (`.construction-stripes`): it covers nothing, so the guide stays readable under it.
- **Every guide section is optional** and steps aside when empty. On top, the band
  (`GuideBand`); under it, from `xl`, two columns: a side column (general skills, the whole
  guide's thread) and ONE style pane. Below `xl` the side column FOLLOWS the style
  (`order-last`), so a phone reads band, tabs, the style, then the folded general skills.
- **The band** (release 3 of `guide-visuals-plan.md`, 2026-10-23). Its two boxes stretch to
  the taller (owner, 2026-10-24), so their bottoms line up. Left: the style ranking
  as a ladder (Henry: "looks great"), a row of steps once it has 36rem and a list on a
  phone (a container query on a WRAPPER: a query reads an ancestor, so `@xl:` on the list's
  own classes never fired), each step the rank, the name in its colour and three top-star
  faces, a button to the tab ("Pace, rank 1"); `>>` is "≫ gap", `=`/`>=` "level", with
  words for screen readers; a non-style word is a plain step. Then the short description
  and the meta analysis (on a phone cut at the last whole line under 5.25rem, with no fade,
  and "Read more" when longer), then the team comps with three places in the styles' colours
  (`parseTeamComp`; a comp it can't count stays words only). They sat in the right panel
  until review item 5 (2026-11-24) left the ranking's box half empty beside it; with no
  ranking or text they still go right.
  Right, one panel: Recommended stats (one plain row as five tiles, otherwise the table
  with every row's label and footnote: Henry asked for several rows with notes), the
  scenario ("Cards marked Link are linked to it.").
- **Running-style colours are Hakuraku's** (Henry, 2026-10-23), the `--color-style-*`
  variables in `index.css`'s `:root` (NOT `@theme`: Tailwind emits a `@theme` variable only
  when a utility uses it, and these are read through inline `var()`, so all but one went
  missing), with Hakuraku's colorblind set under `[data-colorblind-mode="true"]`. A name
  takes its colour through `.style-ink` (App.css), which the light themes undo (yellow on
  white is about 1.3:1); there a `.style-dot` beside the name carries it instead. Used on
  the ladder, the style tabs' dots, the comp places and the All tab's style titles; always
  beside the word.
- **General skills (`style: "everyone"`) are a side-column section, "General skills",
  directly under the Overview** (owner, 2026-10-17). They are team-wide, like the stats;
  merged into every position's tab (as the page first shipped) they read as that
  position's own picks. A position's "Recommended skills" shows its OWN rows only.
  `skillsForPosition` feeds both (one style's rows, tier then order), and `SkillCategories`
  splits each into subcategories (Acceleration, Core skills, Speed, Recovery, Green,
  Debuffs). **The My team skills panel still merges them** (`guideSkillsByCategory(guide,
  position)`): it is a checklist for one position's team, and says it includes the general
  skills. Style tabs list only styles with content (`stylesWithContent`).
  **Below `xl` General skills start folded** (a `<details>` with "21 skills · Show"; the
  side column stacks above the style there, and CM 21's were 866px of phone before the first
  uma). Read once with `matchMedia("(max-width: 79.98rem)")`, "narrow?" so the test stub's
  no-match is the desktop default.
- **Skills keep their type groups; each tier is a row of same-size cells** (Henry,
  2026-10-23: "I don't want them to be combined", and "having different size box depending
  on letter count look ugly", after Hakuraku's list). Inside a type, a tier row is the badge
  in its own column (`tierLabel`, one list `TIER_LABELS` waiting for Henry's words; T0 in
  brand, fading by T3/T4) beside a grid of `SkillCell`s, so a long tier wraps under its own
  badge. A cell is the icon and the name at one font size, two lines at most, and a
  caption (the unique's owner, else the note as plain words, `plainNoteText`) only while
  the name fits one line: the text is a column that wraps, so a caption with no room moves
  to a clipped second column. No width rule (an 11rem one cut "Shooting Star of
  Dioskouroi" in wide cells and hid short names' owners in narrow ones, 2026-10-24). A
  trailing ○/◎/☆/♡ is held to its word (`keepMarkWithName`). `SkillDetail` on hover; the
  gold, unique and evolved surfaces stay. Cells are 9.5rem at
  least, 13rem once the list has 32rem (a container query: the side column is narrow at
  every width that shows it). `SkillChip` is the editor's.
- **Uma tiles are one size and shape** (Henry, 2026-10-23: "uma part looks ugly"). A
  style's umas group under a stars header (gold, `text-recommended`; red was the warning
  colour), and every `UmaTile` has fixed rows: portrait (a role tag on its corner), the name
  on up to two lines, the outfit on its own line (`splitOutfit`, `utils/umaName.ts`; blank
  when none), and the note's slot (its first `[[skill]]` as a small `SkillFace`, else its
  words) when any uma in the style has a note. Tiles share the row, 6.5rem at least, so a
  phone fits three. The editor shows the same tile, stars on it. **Star groups share rows**
  (owner, 2026-10-24; `packStarRows`, drawn by `UmaStarRows`): a group follows the one
  before it on the same row only if ALL of it fits in what is left; otherwise it starts a
  new row (and wraps, its later rows unheaded), and the next group may join its last row by
  the same rule, the least gap between groups (20px) counted. The FIRST row's room over is
  shared out evenly (as much at each edge as in each gap) and its edges hold for every row
  (`layoutStarRows`): a later row starts at the same left and, with several groups, spreads
  to the same right; the edges move out only where a later row needs more room (packing
  later rows inside a short first row's span made phones one tile wide). Tiles keep the
  1fr-column size. The pane is measured (ResizeObserver, before paint).
  **Aptitude letters** (release 4, 2026-10-23): each guide uma carries `apt` (the API's ten
  columns), and `guideUmaAptitudes(apt, event, style)` picks this course's distance and the
  row's style, plus the surface only below A (the picker's `aptitudeKeysForEvent`). They
  print under the outfit, C amber and D or worse red, on every tile of the style once any
  has letters. Pairs wrap whole (a gap between them, no dot), never truncate: a tile is
  about 90px inside on a phone and on the All tab, too narrow for "Medium A · Front A" or a
  third pair; the tile fills its grid row and pins the note slot to the bottom, so a
  wrapped tile keeps its neighbours level; a role that only restates them ("Sprint F Front E",
  `isAptitudeOnlyRole`) steps aside, a real role ("Normal Front") stays.
  Card names (deck and swap-in) get the same two-line box, balanced, so every card's
  reasons start level; a deck card's rarity rides its last word ("Marvelous / Sunday SR"). A guide answer
  without `apt` (an older API) keeps its roles and draws no row. The editor shows the same.
- **A deck shows six cards a row only when its pane is 42rem wide** (`@2xl`, the pane is
  a container): narrower, three a row, where six were about 55px and their notes ran into
  each other.
- **The All tab is a quick preview** (owner, 2026-10-24; release B of
  `guide-visuals-plan-2.md`), its own component (`AllStylesPreview.tsx`), not `StylePane`
  with a compact switch. A box per style, two abreast from `lg`, in the tabs' fixed order
  (`STYLE_ORDER`; Daptrius, 2026-10-31, it was the ranking's); a header with the rank, the comment count and "Open Pace →"; then
  one line apiece, a label beside it (above it on a phone): the top six faces (`topUmas`,
  `FaceTile`, faces only), the best tier's first two skills (`topTierSkills`; three were
  85px and cut), every ladder deck's six cards as art (`MiniCard`, Link badge and borrow tab
  kept; a note-only slot is `MiniNoteSlot`, the stat icon for "Any Wit"), and each swap-in
  row's first six. A line with more ends in "+N", which opens the style. Every line is the
  same seven-track grid, so faces and cards line up. Names, stars, roles, notes, rarities
  and a slot's reasons and "or"s are in the hover; the letters, the budget control and the
  "In every deck" / "Compared with" lines are on the style's own tab only.
  Never add a second "compare" pane: it was tried and read as every card listed twice.
  "New since <previous event>" is collapsed by default for the same reason.
- **`==words==` is red and `[[Skill name]]` is a skill** in any guide text:
  `utils/remarkHighlight.ts` is a remark plugin in `MarkdownContent` (emits `<mark>`, styled
  `text-highlight`, and `<span data-skill>`, which the caller's `renderSkill` turns into a
  `SkillMention` chip; raw HTML stays off) and `splitNoteText` feeds `InlineNote` for
  one-line notes. Mentions resolve through the guide's `skill_mentions`, provided by
  `SkillMentionsContext` in `PvpGuideView`; an unresolved one is its plain name.
  `MarkdownContent` escapes `[[`/`]]` before parsing, because `[[Updrafters]](FF)` is
  otherwise a markdown link. Token `--color-highlight`. **Except on a card**: a deck slot's note is
  drawn with no red and no bold (Henry, 2026-10-23), whatever it holds.
- **`((Uma name))` is her picture** (Henry, board 1572760259066601513; review items 6 and C,
  2026-11-24): the same plugin emits `<span data-uma>`, a caller's `renderUma` and
  `InlineNote` draw `UmaMention` (her `FramedUma` at 2.4em, opening her card), resolved
  through the guide's `uma_mentions` (`UmaMentionsContext`, beside the skills'). An
  outfit's own brackets sit inside: `((Oguri Cap (Christmas)))`. Exact catalogue names only;
  a nickname stays words. A style-ranking step that is a whole `((Name))` (`umaStepName`)
  shows her picture where a style's faces go. The editor offers names on `((`
  (`MentionField`), and `hydrateGuide` / `validateDocument` resolve and check them.
- **A deck slot's note is read as parts** (`utils/deckNotes.ts`, `parseSlotNote`; release 2
  of `guide-visuals-plan.md`): `[[skills]]` become small same-size `SkillCell`s the card's
  width, the fixed tags ("1SP"/"2SP", "Stats", "Hints", "Initial Friendship", in the
  guide's words) pills, "or any Wit" one line with the stat icon (`AnyTypeLine`), and
  "Scenario Link" (or the sheet-era bare "Link") a gold **Link badge** in the top-left
  corner of the card's art, with "Linked to <scenario>" on hover and for screen readers
  (owner's pick, 2026-10-23; it replaced web #160's red ring on the mention, which stays
  only in prose). Parts are split on "&", "+", "," and "and/or", with mentions masked
  first so "Fast & Furious" stays whole. Anything unread is kept as the author's words;
  a note with nothing read comes back whole. A non-SSR card or alternative shows its
  rarity ("Light Hello R").
- **Decks: one at a time, by budget** (owner, 2026-10-23). A style's decks that are not
  swap-ins form a ladder; with two or more, a "Deck budget" control (their labels, then
  "All") picks one, or All opens every one. ONE pick for the page (every style, the All
  tab), remembered per device (`rememberDeckBudget`, localStorage); a label a style lacks
  shows its first deck. Above the decks, "In every Pace deck: …" (`cardsInEveryDeck`); in
  each deck after the first, "Compared with Beginner: swaps in … for …" (`deckChanges`,
  main rows by card id). No mark on the cards themselves (Henry: "New" marks were
  distracting). **A budget switch trades cards** (owner, 2026-10-24; round 2 of the plan,
  `guide-visuals-plan-2.md`): the deck last shown alone keeps one box (key `"one"`), and
  `DeckGrid` keys each cell by its CARD under `AnimatePresence mode="popLayout"`, so a card
  both decks hold keeps its element and glides to its new slot (`layout="position"`), a
  leaving card fades and shrinks out, a new one grows in a beat later. Keying the box by
  deck made it fold away while the next unfolded, a vertical jump. Every deck's card art
  is preloaded once the decks show, or a new card grew in as words and its picture came
  later. **Only All folds and unfolds boxes** (height, about 280ms), around the box on
  screen. `MotionConfig reducedMotion="user"` stops transforms only, so every duration is
  0 under `useReducedMotion()`. Overflow is hidden only while a deck folds, so hover
  details are not clipped once it settles. A style's pane is keyed `pane-<style>` (another
  style is another pane, drawn at once; the bare style collided with its comments
  thread's key).
- **A swap-in deck is a row, not a deck** (`is_highlighted`, the editor's "Swap-ins"
  switch, formerly "Gold box"; the guide's Honorable Mentions): smaller cards with their
  reasons, no slots, no borrow tab, in a recessed `bg-gray-900` panel (a well on both
  theme families: below the pane on dark, the grey canvas under white cards on light).
  Not gold: Henry found the gold box read as the top pick. The editor draws the same
  panel.
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
- **A skill's hover detail is `SkillDetail`** (`components/pvp/SkillDetail.tsx`, 2026-10-23),
  shared by `SkillChip` and `SkillMention`: name (unique owner, a "JP only" tag when
  `availability === "jp"`), description, the readable text the API builds from the game
  data (`readable`: Only after / When / Does, with timing and the wit check; a `raw`
  phrase is the game's own code in a `<code>` box, never reworded on the client), where a
  player gets it (`sources`: a few outfits and cards, on-global first, "+N more"), the other
  versions, and "English text: UmaTL fan translation." when `uses_translation`. A chip of
  a JP-only skill carries the tag too; an evolved skill is drawn on `.skill-evolved` (a
  stand-in pink until the game's own hexes are known). Absent fields (an editor preview, an
  older API) read as a plain global skill. **The guide editor widens the catalogue** with
  `GET /skills` (`withShownSkills`, `utils/skillList.ts`) so a writer can pick and
  `[[mention]]` a JP-only skill by any of its names; the builder's own catalogue stays
  global-only.
- **A guide's hover popups are drawn on `<body>`** (`useHoverPopup` in
  `components/pvp/PvpTiles.tsx`, Floating UI, 2026-11-02). Drawn inside its tile, a popup rose
  only as high as the tile's stacking context, and the sticky General skills column and the
  deck's `layout` cells each make one, so popups slid under their neighbours. It opens after a
  120 ms hover, on `:focus-visible` or a tap, flips above when there's no room below and stays
  on screen. It is `aria-hidden` and mounted only while open; the screen reader's copy is an
  `sr-only` `role="tooltip"` inside the tile, named by `aria-describedby`. **Nothing inside a
  tile with a popup opens one of its own** (`InsideHoverContext`; Tailwind's `group-hover`
  answers to any hovered ancestor, which once opened three at a time): a `[[mention]]` there is
  a plain pill, and the popup lists the skills its note names at the bottom (`MentionedSkills`,
  under a rule, crediting UmaTL whenever their text is theirs). A skill's other versions sit on
  a bar down the left with a colour tag, so the two lists read apart.
- **EARLY ACCESS ONLY, on a guide (owner, 2026-11-18: "Not the guides"): the skills work
  below.** `useSkillsPreview()` (`hooks/useSkillsPreview.ts`) and the API's
  `pvp_guide_editing.sees_skills_preview` decide it: a guide's JP-only skills, and the skill
  card's readable text, sources, type, cost, "JP only" tag, UmaTL credit and link to the
  skill's page, show to supporters, staff and granted accounts. Everyone else sees guides as
  before the work. The Skills page and the rest of the Encyclopedia are public and read
  neither function; `SkillDetail` takes `full` from the Encyclopedia's own skill rows, which
  draw the same card. Opening the guides is both functions returning true. History:
  workspace-root `notes/skills-plan-4.md`, `notes/encyclopedia-open-plan.md`.
- **The Skills page is `/app/skills`** (`components/skills/SkillsPage.tsx`, 2026-10-23):
  every `GET /skills` row, searched by any name a skill answers to (`filterSkills`,
  `utils/skillSearch.ts`) and filtered by colour and by where it is, 60 rows at a time.
  **Skill search** is one rule everywhere (`skillMatches` in `utils/skillList.ts`): Ctrl+K,
  the veteran form, the course map's list, the guide editor's picker and `[[` suggestions,
  and this page. Every word typed must be in the shown name or `other_names` (UmaTL's,
  aliases including GameTora's names, which are never displayed, and the Japanese one),
  and a query that is one whole number finds the skill with that game id. A new skill
  search box calls it rather than matching `name` itself.
  **A skill with no global or UmaTL name is shown by its Japanese name** (owner and Daptrius,
  2026-11-12), with no marker beside it (owner: being in Japanese says enough). Wherever a
  skill's name is drawn, its element carries `lang={nameLang(name)}` (`utils/skillList.ts`,
  read from the text), so the browser picks Japanese glyphs.
  The open skill is `?skill=<game id>` (`skillHref`), drawn by `SkillDetailCard` from
  `GET /skills/<game_id>`: readable text (the hover card's `ReadableText`), every uma
  (`FramedUma`, rainbow for covered favorites) and card that gives it, evolution and its
  unlock conditions, versions, and the UmaTL credit with its link. It is linked from a
  guide's "General skills" note; it has no navbar tab yet (the phone bar is a fixed five
  columns, owner's call).
- **Stats are text** (`"1100+"`, `"578*"`), shown as written in a plain table headed by the
  game's stat icons (`public/0N_CM*.png`). `splitStat` puts `+` / `*` beside the number as a
  superscript and anything longer ("+1 Gold") on a second line, and every cell is top-aligned,
  so a row's numbers always share one line. A blank cell is an en dash.
- **"New since <previous event>"** is computed client-side (`newCardsBetween`): a card's
  first global banner start, between the nearest earlier event of either kind and this one.
- **The mobile bar has four tabs, five with Rankings** (`navbar/navPlaces.ts`), each with
  its name at every phone width; see "Screen bars".
- **Local test content**: `python manage.py load_sheet_pvp_guides` in `backend/` fills the
  local SQLite with the community sheet's guides (local only).

### The course map (`components/course/`)

The plan is `notes/course-map-plan.md`; the look is `notes/course-map-visual-plan.md` (the
owner's decisions of 2026-11-03, with the mock renders the build is checked against). A CM
or LoH with a `course` (the API's nested record, `types/events.ts` `RaceCourse`) gets a
**Course map** block at the foot of the guide's `EventHeader` (`CourseSection`): the course's
name and the bar, the headline (`CourseHeadline`: the spurt sentence from `derivedFacts` in
bold, the other facts in one line under it; it replaced the chips), the map, and the same in
words for screen readers (`CourseFactsList`, `sr-only`; the strip is `aria-hidden`).

- **The block folds** (`CourseFold`, review item 3, 2026-11-24): it sits above the View tabs,
  so it opens on Recommendations at `sm` and wider, and starts folded on the other tabs and
  on a phone: the title, the spurt sentence (`CourseHeadline leadOnly`) and "Show the map".
  The reader's Show or Hide is kept on the device for each place ("guide" and "tools",
  `courseMapStore`'s `useMapOpenChoice`), and a lit skill opens it while lit. Folded, there
  is no strip to stick. The Timeline's drawer never folds.
- **The strip is the ruler** (`CourseStrip`, both orientations): a label column (Height,
  Phase, Course, Slope, Ground, the layer rows, Section) and a track cell per row (the
  `data-band`), the marks' words above the rows in lanes (`markerLanes`) with their lines
  through every row, the metres under the sections. A segment shows its words, then its
  metres only where they clear the centred words (`utils/courseStripText.ts`, against the
  strip's measured width once painted, the caller's `widthPx` before that). Hills carry Daptrius's triangle (`CourseIcon`). Down the page the rows are
  columns and the marks' words sit in a margin at the right. A layer span is drawn in its
  `colour` (a veteran's `--color-course-vet-N`, else the lit `--color-course-lit`), the
  veteran's avatar at the head of her first row and "Lit" at the head of the open skill's.
- **Icons are `CourseIcon`**, Daptrius's set (corners turning the course's way, the straight,
  the double-arrow final straight, the hills' triangles, the flag).

- **`utils/courseGeometry.ts` is the one place a metre becomes a position**, and where the
  phases, sections, position keep end, hill heights and chips are derived. The game's
  fractions are `GAME_GEOMETRY`, a parameter with defaults. Never compute a position in a
  component.
- **Four phase bands: Early-race, Mid-race, Late-race, and Last spurt (phase 3: 5/6 to the
  finish, sections 21 to 24)**, with the "Spurt starts" marker at 2/3, section 17, where the
  last spurt can start, and a "Halfway" marker at 1/2 (owner and Daptrius, 2026-11-03; the
  marker's name follows gametora's, Henry, 2026-11-03). The headline says "Last spurt can
  start ..."; the hill facts, the verdicts and the accel list measure from the 2/3 point and
  call it "the late race". Corner, straight and final-straight callouts point at their start
  metre, each spot once with every lap's metres; a segment wide enough shows its start and
  end metres. A hill's chip sits where the hill begins. Every leader starts at the kerb's
  edge and nothing is drawn on the track itself (Henry, 2026-11-03); the spurt chip's leader
  runs from its line, a hill's from its bracket, a layer's from its arc. An arrow just inside
  the kerb past the gate points the way the race runs. The Track view alone carries a legend
  (`CourseLegend`); under Strip and Both the strip's words name every colour.
- **The spurt start is the map's first job** (owner, 2026-11-03; `notes/course-map-plan-2.md`):
  `spurtStart(course)` says what 2/3 falls on, how much of it is left and what comes next,
  and the chip says it exactly ("Late race starts in corner 4, 8m before the final
  straight"). Slope chips name the stat a hill near it rewards ("Uphill at the spurt start:
  Power helps"; within 100 m, a presentation choice). Its marker is placed first and kept on
  a phone's compact track; its strip line is solid. A flat course draws no profile or hills.
- **One `CourseStrip`, two orientations.** `CourseSection` renders the desktop block
  (`hidden sm:block`) and the phone block (`sm:hidden`) and lets CSS pick, because the page
  is prerendered. A phone's strip is ACROSS by default, at full size in its own sideways
  scroller (`PHONE_STRIP_PX`), with an Across / Down switch for the vertical one, remembered
  until a reload (Henry, 2026-11-04: squeezed to the screen it was illegible). The strip's
  `widthPx` is what spaces its words, metres, section numbers, ruler and mark rows, so
  every width spaces them alike. The phone's compact track is bare until tapped
  (`showWords`). Down the page the word columns share the width (a `Band` without a
  `size`) and the words wrap; across, they truncate, and a part too narrow for its words
  shows a short form (a hill's percent) or only its colour.
- **Stick to top** (owner, 2026-11-20; Henry, 2026-11-24) is a fixed copy of the map in a
  portal on `<body>` (`data-course-stuck`), shown once the in-place strip (in Track view, the
  block's bottom) passes `--pvp-stick-line`; `usePvpStickyOffsets` adds its height to the
  tabs' offsets. It shows the slim strip; the track alone, up to 360 px tall with the phone's
  shorter callout list (`fewCallouts`) and its words, centred with the lit card (owner,
  2026-11-24: at 240 it was a small drawing in a mostly empty bar); or both, the track bare
  and capped at 240 px with the lit card under the strip so the strip keeps its room. Never
  `compact` (its padding shrinks the drawing); the caps are `CourseTrack`'s `maxHeightPx`. By its OWN remembered switch (`useStuckView`),
  never the in-place Strip | Track | Both: changing that while stuck resizes the block
  above the reader and jumps the page. Desktop only. Every skill in the guide (`SkillCell`,
  `SkillChip`, a mention, an uma's unique) lights the map while its detail is open.
- **The overlay contract**: the strip draws the record, then `courseFacts(course)` plus any
  `overlays` (`{spans, markers}` in metres) and an optional `cursor` (a metre or a motion
  value). A later layer is a pure function to that shape; it never changes the strip.
- **Words sit above the lines**: a segment's label has its band's fill as a background and
  `z-10`, so a marker line through the middle never cuts it.
- **Colours** are `--color-course-*` in `index.css`'s `:root`, with a light-theme set under
  `[data-theme-mode="light"]`: the four phases as a heat ramp (`-early`, `-mid`, `-late`,
  `-spurt`) each with its `-ink-*`, the quiet course row (`-straight`, `-straight-final`,
  `-corner`, `-corner-alt`), the hills (`-up`, `-down`), the ground, the height profile, the
  track's bed and marks, the beacon and its glow, and the layers (`-lit`, `-vet-1/2/3`).
  The owner may retune the shades (2026-11-03): change the tokens, nothing else.
- **The track view** (`CourseTrack`, behind the block's Strip | Track switch from `sm` up,
  and compact over the strip on a phone, where `CourseSection` reads the screen in an effect
  and fetches the shape at once): the course along its real shape (`GET
  /race-courses/<id>/shape` through `services/courseQueries.ts`, fetched the first time
  Track is chosen, the box held while it loads) or the schematic
  (`utils/courseSchematic.ts`, from the record), Real shape | Schematic and Phase | Course
  (the surface in the four phase colours, or in the strip's Course row colours: Daptrius,
  2026-11-06) remembered per device in `services/courseShapeStore.ts`; the Timeline drawer
  follows the same choice. The look (`notes/course-map-visual-plan.md`,
  "The track"): a kerb under the surface in the four phase colours, thin ticks where a
  phase changes, a gate bar at the start and a chequer at the goal, the last-spurt line
  across the track with a glow over the metres just after it (a look, not a number), hills
  as brackets outside the track, and callouts beside it with `CourseIcon` shapes (one per
  spot, a spot being one number on one stretch of ground: Nakayama 2500's chute corner 3
  and the next lap's are two; a corner or hill a course passes twice at one spot lists both
  laps' metres), placed by `placeLabels` from size estimates. **No chip sits on the track,
  within a track and a half of its kerb, or over a hill's bracket, while a clear spot is
  left** (Henry and Daptrius, 2026-11-06): every spot tried is scored (`COST`: out of the
  box, on another chip, on the track, in the margin, over a bracket, a leader across the
  track) and the cheapest wins, so the box's edge never pushes a chip back over the track.
  A chip's first try sits just past the margin; it then swings and slides along the track.
  The spurt chip sits inside the curve, and may lie over the track's inner edge sooner
  than leave it. On a phone a hill's chip is its triangle and percent. Each callout's
  leader is a short line in its own colour with a dot on the track. Later laps are rings
  (`withLapRings`), 2.4 track widths apart (`RING_GAP_TRACKS`; a ringed course's track is
  at most 3.2% of the course, so a phone's rings fit its bends): ring k blends in over the
  half turn before the course has turned k full circles, inside or outside per `later_laps`. A full
  circle has 10 degrees of slack (`TURN_SLACK`): real shapes that finish on the straight they
  started on turn a little under (Nakayama 2000: 357; Nakayama 3600: 717 for two). A ground
  change (Tokyo dirt 1600's turf start) gets no callout and no strip row: the race counts as
  its own surface from the gate, and showing the turf made players doubt the aptitude
  (Daptrius, 2026-11-09). Only the facts list names it.
- **Layers** (`utils/courseLayers.ts`, `services/courseMapStore.ts`): the skill row open
  in the team builder's Guide skills panel lights its zones (the panel sets the store's
  `focus`, and clears it on unmount), and the Layers menu (`CourseLayersMenu`, off by
  default, ticks remembered per device) holds "My veterans' skills": the preferred team's
  linked veterans (`VeteranLayerSource`, mounted only while the layer is on, so the
  catalogue and veterans are fetched only then), their skills that fire at a place for
  their style, all or only the guide's (`heldSkillMeetsPick`), one group of lanes each
  headed by her `FramedUma`. Zones come from `GET /race-courses/<id>/skill-zones`
  (`services/courseQueries.ts`), fetched only once a layer needs them. On the strip a
  layer is a row per lane (labels pop in along the race); on the track, one arc per GROUP
  (`CourseSpan.group`: the lit skill, each veteran) outside the hills in the group's
  colour, solid where it fires, dashed for a random point, dotted for the carry-over
  window, a dot for a spot, with the skill's name chip at the zone's start.
- **A verdict per lit skill** (`verdictLines` in `courseLayers.ts`; the API's
  `skill_verdicts.py` works it out, this only words it): where it fires against the last
  spurt for an accel, a heal against the late-race HP check, carry-over and repeats once the
  API sends them, then "Also needs: ..." in verified words. An open skill row shows it with
  "See it on the map" (`scrollToCourseMap`, to the block's `COURSE_MAP_ID`), a layer label
  as its hover, and `focusLayer` adds a "Heal before here" mark while a heal is lit and a
  carry-over band when one exists. Nothing promises a skill fires: each assumes its Wit check.
- **Lighting from anywhere** (section 8 of the plan): a skill chip's or mention's hover card
  lights its skill while open (`useHoverPopup`'s `onOpenChange`; `clearCourseFocus` unlights
  only if it is still the one lit) and shows its verdict (`CourseVerdict`, reading only the
  cached map through `useCachedCourseZones` and the block's `usePageCourse`, so a page of
  chips costs no request), with its grade and its zone as one bar. **A lit skill gets a
  verdict card** beside the headline (`CourseVerdictCard`: the skill's picture or her
  portrait, a grade, the verdict lines, the zone bar; a close button clears the focus),
  built from what came with the focus (`CourseFocus.image`, `.owner`), never a fetch.
  **The grade** (`grade()` in `courseLayers.ts`, owner 2026-11-03: a word with the odds
  beside it): "At the spurt" (a fixed point the API's `odds` says lands in the window, a
  few metres either side of the start included), "Ready before it" (a fixed zone that opens
  early and waits on a placing), "Early", "Late" (a fixed point outside the window, or a
  random point that can't reach it), or by odds "Usually lands", "Sometimes lands", "Rarely
  lands". A speed skill reads "Ends before the late race" only when its whole trigger is
  before the carry window; one that fires in the late race says nothing about carry. A fixed
  zone that waits on something ("Also needs") gets no odds line, since the needs say it
  depends. A skill with several ways of firing (the API's `paths`) reads one sentence per
  way, the most useful first and the rest as "Or ...", each with its own needs, and is
  graded by its best way; the chain kinds `end_after` and `later_half` count a member's
  first metre against the late-race start and half-way. **"Accels that land at the spurt"** (`CourseAccelList`, a column beside the map
  from `lg` up and under it below, opened by the bar's Accels button and remembered on the
  device through `useAccelsOpen`; closed it fetches nothing, since its names cost the
  catalogue; owner, 2026-11-03) lists only the accels that can land at the spurt start,
  most useful first (`accelRows` on the API's `spurt.useful`, never shown as a number),
  eight then "Show all", by style with the guide tab's style first (`useStyleTab`, a store
  snapshot of the address); a unique, or its inherited white (the same name), shows the
  uma's `FramedUma` and names her on a quieter line; a tap lights one and opens the card.
  Beside the map the column is as tall as the map and no taller (a floor of `20rem`, about a
  row and a half), its rows scrolling under a header that stays put, so an open column never
  leaves the page blank beside a short strip, and Track or Both give it more room (owner,
  2026-11-18). "Show all" (in the column's footer, shown whenever rows are past eight or cut
  off, measured with a `ResizeObserver`) lists every row and lets the column grow to the
  screen's height, still scrolling within itself. The button carries the count only once
  the map is already cached; the column's title carries it once loaded.
- **The veterans' ticks** (owner, 2026-11-03: every skill at once was illegible on the
  track): the Layers menu lists each veteran (her avatar and name) with a tick, and under
  her a tick per skill of hers that can fire at a place here (`veteranSkillChoices`). Only
  the reader's ticks are stored (`useVeteranPicks`, by her trained uma's id, on the device);
  the defaults are every veteran shown and, of her skills, her accels only
  (`veteranShown` / `skillShown`). **Each veteran has a colour by team spot**
  (`--color-course-vet-1/2/3`, assigned in `CourseSection`): her spans on the strip, her arc
  on the track, a ring round her avatar at the head of her rows (`.course-ring`) and a swatch
  beside her name in the menu; the lit skill keeps `--color-course-lit`.
- **The spurt start on the track** has a tick across the track and its label inside the
  curve; with layers on, every other label sits past the outermost layer line.
- **Skills set off by other skills** (section 6): the Layers menu's "Skills set off by other
  skills" (`layers.chains`, off by default, shown with the veterans' layer) draws a chained
  skill where her own skills set it off (`resolveChain`: the N-th of them by earliest and by
  latest point, then her skill's own zone start), and not at all when she has too few. With
  it on, a chained GUIDE pick lights the same way, placed by the guide's other picks for the
  tab's style (every pick under "All"; `useStyleTab`, `focusLayer`'s `chainSet`): the owner's
  yes of 2026-11-04 to the first "Left for later" items.
- **An uma's tile lights her unique** while its hover detail is open (`lightUniqueOnCourseMap`,
  her as the card's owner), from `unique` on the guide's uma ref; a tile with no note shows
  "Unique: <name>" as its detail, so the hover exists.
- **Lighting from below never moves the chip.** A chip or tile under the map that lights a
  skill grows the map (the card, the lit rows); the chip would slide off the pointer, close,
  and the map would shrink back, round and round (seen 2026-11-04; Chrome re-checks hover
  after layout, and the browser's scroll anchoring did not step in, the page scrolling in an
  inner column). `CourseSection` measures the block's bottom the moment the store changes
  (`subscribeCourseMap`) and again after the render, and scrolls the block's scroller by the
  move when the pointer was below the block. Measured, never assumed.
- **The strip and the track preview each other** (owner, 2026-11-04): the layer span under the
  pointer on either (`onPreview`, by span key) draws its arc bolder on the track and quietens
  the others (`preview` on `CourseTrack`, `data-preview` on the lit arc), and its bar on the
  strip ringed in white with the others at 0.45 (`preview` on `CourseStrip`, `data-previewed`).
  The arcs and the icons carry `<title>` with the name and the verdict.
- **A lit skill is marked by its ICON on the track**, at its arc's start, ringed in its layer's
  colour, one per skill per group, sliding forward along its arc when another icon sits there
  (several skills start at the late-race start); a span with no icon keeps a name chip. The
  strip's bars draw the icon before the name. Under the track (Track and Both), a "Lit skills"
  legend names every lit skill by icon and name in its colour, each a hover target for its arc
  and bar; on a phone it is the names alone. Every span carries `image` for this
  (`skillSpans`, `focusLayer`, `veteranLayer`'s `images` from the catalogue).
- **The accels column says why a row ranks where it does**: two chips, Accel (the share landing
  well times the speed its acceleration adds) and Carry (the share carrying speed into the late
  race times that speed), the API's `spurt.accel` and `spurt.carry`, a zero left out; and the
  carry in the game's terms, "+0.35 m/s into the late race for 3.2 s" (`carry_speed`,
  `carry_seconds`). `ZoneBar` draws the four phases under the zone, so a popup far from the map
  (a skill chip's, an uma tile's, which now carries `CourseVerdict` for her unique) reads as a
  one-lane strip.
- **Walk the course is shelved** (owner, 2026-11-03: a runner on the course without the race
  logic was a simulator in name only). The hook, the runner and the strip's cursor line are
  gone; a runner belongs to the run view (`notes/course-map-later.md`), with the race logic.
- **The Timeline race card's drawer** (`CourseDrawer`): a "Course map" button at the card's
  foot, closed by default, opening (a height animation under `useReducedMotion`) to the
  name, the course's REAL shape as a track (owner, 2026-11-03: never the strip or the
  schematic), the headline and a link to the guide. The shape is fetched on open, or earlier
  when a pointer or focus reaches the button. Two tracks, CSS picking: 720 px from `sm`
  up, and a phone's 340 px `compact` one that calls out only the start, the goal, the spurt,
  the corners and the final straight (the headline says the rest). Only for an event with a
  course. The headline is one component (`CourseHeadline`) in both.
- **The draw-in**: the first paint is the finished strip (the motion value starts at 1);
  after mount an `IntersectionObserver` sweeps it in once, on a motion value through a
  `clip-path`, never a React state per frame. Reduced motion, or no observer (the test
  DOM), keeps it still. **Two quiet touches** (the visual plan's "Motion"): the spurt glow
  on the track breathes on a looping motion value (still under reduced motion), and the
  verdict card slides in from the headline's side through `AnimatePresence` (a fade under
  reduced motion). Nothing loops that the reader can see change state, and nothing autoplays.

### Guide editor view (`components/pvp/editor/`)

`?view=editor`, the fourth tab, drawn only when `account.guide_editor` is true (staff
accounts only, owner 2026-10-21; the server checks every write again). For anyone else the
parameter reads as Recommendations and the tab is not drawn. "Copy link" never writes it.
The editor is one lazy chunk (`loadGuideEditor.ts`, like the forecast plot), keyed by the
event, so switching events starts a fresh editor.

- **One document, saved whole.** `hooks/useGuideDocument.ts` holds the guide as the API's
  document (`types/guideDocument.ts`: catalogue ids, `order` never sent, position is order),
  changes it with the pure edits in `utils/guideDocumentEdits.ts` (every edit a new
  document; the old one goes on the undo stack), and PUTs it two seconds after the last
  change (`useAutoSave`). The answer carries the reader's shape, which `primePvpGuide`
  (`hooks/usePvpGuide.ts`) puts in the Recommendations cache, so "View as visitor" shows
  the save at once. If the person typed while the save was out, only the version is taken.
- **The version handshake.** Every save sends the version it started from; a 409 means
  someone else saved first, and `ConflictDialog` offers "Load theirs" or "Keep mine" (save
  over theirs; theirs stays in the history). Undo carries the current version with it.
- **The reader draws the editor.** `utils/guideDocument.hydrateGuide` turns the document
  into a `PvpGuide` from the catalogue in memory (uniques from the umas' skill links,
  versions from the server's last answer), so `UmaTile`, `SkillChip`, `SupportTile`,
  `NoteOnlyTile` and `MarkdownContent` draw it unchanged. The tab strip mirrors the
  reader's (Guide, then Runaway … End), with row counts and red problem counts.
- **The same checks as the server, while typing** (`validateDocument`: duplicates, deck
  rules, `[[mentions]]` against the catalogue, lengths; the server's own sentences). After
  a refused save the server's `errors` (with their `path`) replace the local ones until the
  next save. `useFieldErrors(path)` draws a message beside its field; `errorsByTab` the
  counts. The checklist (`missingSummary`, the admin's sentences) jumps to
  `#editor-<tab>-<section>`.
- **Pickers are the team builder's.** `PvpCardPicker` for umas (aptitude letters for the
  style) and cards (release notes, "Already in this deck"); `PvpSkillPicker` for skills
  (version tag, description, category and tier chosen in the dialog). Text boxes are
  `MentionField`: `[[` offers catalogue names; a markdown box has a toolbar and a Preview.
- **Drag is dnd-kit** (`Sortable.tsx`): umas within a star group, chips within a tier
  group, decks in a list; every row's dialog also has Move earlier / later for the keyboard.
- **Dialogs are `GalleryModal`** (`VisibilityDialog`: Private, Supporters or Public, the My
  team and Gallery switch shown only under Public, the checklist on the way out of Private;
  the three actions with a preview step, the revision history with Restore, delete for
  Private guides only, the conflict). The header's chip names the setting
  (`visibilityLabel`), and its button reads "Publish" on a Private guide, "Visibility" after.
  Actions run on the SAVED guide: the hook flushes the autosave first and takes the
  document the action answers with.
- Tests: `GuideEditor.test.tsx` (the flows), `guideDocument.test.ts` (the pure rules),
  `PvpGuidePage.test.tsx` (the tab).

### CM Runs view (`components/pvp/RunsView.tsx`)

A player's logged Champions Meeting tickets and their win rates (Henry's ask; design in
`notes/pvp-planner-plan.md`, "R3 CM Runs"). API: `/pvp-runs` (`backend/docs/api-reference.md`).

- **Account only** (owner, 2026-10-26): a guest gets a sign-in card; there is no device
  store. A League of Heroes event shows a "coming later" line; the API already takes LoH.
- **The look is the owner's redesign** (2026-10-27; `notes/cm-runs-plan.md`, section 0, and
  its claude.ai mockup): the old look's twenty selects a day are gone.
- **Day tabs grouped by round (Round 1 is days 1-2, Round 2 days 3-4) and Finals**, each
  with a four-segment bar (one per ticket) and a "Today" badge, opening on the day the CM is
  on now (`cmDayAt`: 24-hour days from the start date, the Finals from `cm_finals_hours`).
  Below `sm` the tabs are a five-column grid: the round groups are `display: contents`, so
  their labels lock to row 1 and the tabs to row 2 of one grid (one set of tabs, no copy).
- **A day is a list, one row per ticket**: five squares (the winner's `FramedUma` ringed in
  gold, a red cross for a loss, a dash after a stop, a dashed number for a race not run), a
  score, and from `sm` the three faces. **One ticket is open**: the day's ticket in progress
  (`defaultOpenTicket`), or the one the player opened; the first write pins it, so logging a
  fifth race doesn't fold it. Open, it shows the lineup once, then per race four buttons
  (the three umas and Loss): one tap logs, a tap on the chosen one clears to "not run",
  which is not a loss. A Total row counts each column. Then Skip, and the Note (120
  characters, saved on blur or Enter, shown grey under a closed row).
- **A ticket COPIES its lineup** (uma, style, veteran per spot), so editing a team never
  rewrites a logged ticket. The one-tap button is "Same three as Ticket 2" (or "Day 1, Ticket
  4": `previousRun` returns the ticket so the label can name it), else "Use Team 1"; "Pick a
  team" lists every choice as a card with faces. The Finals copy the event's last ticket.
  With no team and nothing logged, the day is a "Who's running this CM?" card to My team.
- **"Use Team 1 for all of them"** (`FillEveryTicket`, owner's pick 2026-10-29; it took 17
  taps) puts one lineup on every empty slot `slotsWithoutLineup` returns: the tickets of
  today and later days, and the Finals. Past days are left alone, since a lineup with no
  races reads "started" and would hide "Mark the rest skipped". With several lineups to
  offer it opens the picker first; with fewer than two empty slots it isn't shown.
- **The Finals**: radio buttons for the group (A / B) and the placement (1st to 3rd), a tap
  on the chosen one clears it, and the same tap row for the race; a winner fills a blank 1st.
- **Places and Won by** (`notes/cm-runs-plan-2.md`, mocks in `notes/cm-runs-plan-2/mocks/`).
  "Log places" is a per-device switch (an external store over `localStorage`, off on the
  server) in a CM ticket's grid and the Finals; a League of Heroes never draws it (the API
  refuses LoH places). With it on, ONE race is open at a time, with a 1 to 9 strip per uma
  under it (`PlaceStrips`): the places are the input (a 1st is a win, three places with no
  1st a loss), a place another of yours holds is greyed and disabled, and the race to open
  is `nextRaceToPlace` (part-placed or unlogged, never a winner-only race) unless the player
  tapped a race's name or result. The tap that places the third uma opens the next race. A
  cell shows its uma's place whatever the switch says. At 390 px the portrait sits beside
  the strip (`grid-cols-9`, so it can't overflow): a place button is about 30 x 40 px.
  **Every loss gets Won by** (`WonBy`), switch or not: the chips (the four umas that beat the
  player most this event, most recent first on a tie, `beatenBy`) and "Other…" (the uma
  `PvpCardPicker`) open by themselves only on a loss just logged; an older unnamed loss shows
  a quiet "Won by…", a named one "Won by Kitasan Black · Change". Mid-placing, the race is a
  loss in the data (setPlace's rule) but Won by waits for the third place.
- **The totals** sit in a side column from `lg` (win rate, tickets used, each round's best,
  the Finals, per-uma bars with the veteran link, per day); below `lg` they fall under the
  day. On a phone a three-number strip (`WinRateStrip`) goes above the tabs and the side
  column shows only the per-uma bars.
- **Which veteran ran** (`VeteranPicker`, under each runner; a picker, never a dropdown,
  owner 2026-10-26): the account's veterans of that outfit only, each a card with her
  portrait, grade and score, stats, best letters, skills, memo and training date, plus "No
  veteran"; drawn only when there is one. **A veteran is named by `veteranText`**
  (`utils/veteranGrade.ts`): her label, else her game memo, then the game's grade and score
  ("Main Oguri · A+ 13,815"); the stat line only when she has none of those, otherwise in
  the tooltip. On the owner's real file the score alone told every same-uma pair apart. The
  grade letters come from the API's grade NUMBER (1 G ... 18 SS+, 19 UG, 20 UG1 ... UE9), fitted
  to the owner's file; past UE9 only the score shows, never a guessed letter. The win rates split by uma AND veteran (`summarizeRuns`), each
  veteran row linking to her on the Collection page. A ticket copied from a team brings the team's
  links (`lineupFromTeam`), and a different veteran makes a different lineup (`sameLineup`).
- **Every change saves at once through `services/pvpRunQueries.ts`** (TanStack Query). A
  change is a FUNCTION of the ticket as the cache holds it (`save(slot, current => next)`),
  never of the last render: two quick picks otherwise started from the same old ticket and
  the second undid the first. Writes for one event share a mutation `scope`, so they reach
  the server one at a time, in order. A refusal toasts the API's sentence, shows "Not
  saved", and refetches.
- **The counting rules are `utils/pvpRuns.ts`** (worked example in its header): an uma is
  measured over every race she ran in; a round's "best ticket" is the game's own rule.
- **Skips are the player's word, never the clock's** (owner, 2026-10-26; api `skipped`).
  An empty ticket has "Skip" (an open one with a lineup "Skip this ticket"), a part-logged one "Skip the rest" ("Stopped after
  2 races"), and both have Undo: a player may only have been slow to type it in. Logging a
  race a stopped ticket did not list reopens it (`logRace`). A day that is over
  (`isPastDay`) with unlogged tickets offers "Mark the rest skipped"; nothing is skipped for
  the player. Not on the Finals. A skip moves no win rate; "Tickets used" counts it apart.
  Read a ticket through `ticketState()` (unlogged, skipped, stopped, started, done).
- Tests: `RunsView.test.tsx` (the flows), `pvpRuns.test.ts` (the maths).

### Gallery view (`components/pvp/gallery/`)

**The profile card** (`ProfileCard.tsx`, on `GalleryModal`): `PosterLine` takes a `card` target, and
the picture and name then open it. The open post and comments pass one; the feed doesn't, because
its whole row is a link to the post. It's reached through a post or comment, since a person has no
public address, and it shows their favorites, other teams and (if they opted in) shared plans. The
name and tier come from the line it opened on.

Teams players posted for the selected event (`GalleryView`), from `GET /pvp-gallery/<kind>/<id>`
(`backend/docs/api-reference.md`, "Gallery").

- **One full-width feed until a post opens, then two panes from `lg` up.** With nothing
  open the feed spans the page and each row is one short band. Open a post and the feed
  moves to the left with the post (`GalleryPostPanel`) beside it, inline and sticky 1rem under
  the PvP page's pinned View tabs (`--pvp-below-tabs`, see "Pinned rows" under "PvP page").
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
  `<Link>` stretched over the row, the vote control above it; never a button or link wrapped around
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
- **Rows** (`GalleryRow`): the vote control (`GalleryVote`: up, the score, down; the arrow you
  chose takes it back; the score never shows below 0, `notes/thumbs-down-plan.md`), picture,
  name, tier chip, "You" on your own, how long ago it was first posted (", edited" when its
  team changed since), caption (two lines), the three umas with names and styles, views and comments.
  The poster's longer **strategy** (`GalleryPost.strategy`, 2,000 characters, plain text with
  its line breaks) is never on a row: the open post shows it under the team, and
  `PublishDialog` has a box for it under the caption's. Re-posting the team that is up starts
  the dialog from its current words, so updating cards can't wipe a strategy.
  Decks are left to the panel on purpose: they made each row half again as tall, and from `lg`
  up the full team is one click away beside the list. Above the list sit the sort buttons, a
  line saying what the sort means (Top adds that a downvoted team sinks though its score
  shows 0), the uma filter (`GalleryUmaFilter`: a field
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
- **A member's veteran** (signed in only; `VeteranPicker` under her name): one of the
  account's veterans of her outfit, from the Collection. Linked, the member's aptitude letters
  are the VETERAN's, so a D that inheritance fixed reads as fixed. Changing the uma drops the
  link (`setMemberUma`); a guest's team never holds one. The team window does not draw it.
- **What can be picked** is `utils/cardRelease.ts`: a card counts if its first global banner
  starts by the event's last day. Mid-event releases are pickable and tagged with the date; later
  ones are greyed out and sorted last. A story event's free card is dated by the event's
  start, like a banner's. A card on neither is decided by the catalogue's
  `on_global`. Every way into a team applies it: the pickers, the skill search, Guide picks,
  a guide's deck.
- **Placeholder cards** (`placeholder` in the catalogue, owner 2026-10-27): stand-ins for
  "Your best SSR Speed card". `loadPvpCatalogue` renames them once on load (`placeholderName`)
  and lists them first, SSR first (`placeholderOrder`), so every name on screen is right
  without knowing about them. They are always out (`useCardReleases`), skip the deck's uma
  rules and may sit in one deck twice (`cardBlockReason`; the API agrees). In the picker they
  show ONLY under their own Placeholder switch, a separate box right of All/SSR/SR/R, never
  under All or a rarity (owner, 2026-10-27), and Owned only never hides them. Guides don't use them ("Any Wit" slots do that).
- **"Use this deck"** (owner, 2026-10-24; release C of `guide-visuals-plan-2.md`): a button
  under each deck on a style's tab (not the All tab; not offered while My team is locked to
  the reader) switches to My team with `{ useDeck: { deckId } }` in the ROUTER STATE, never
  the URL. `TeamBuilder` reads it once at mount (the switch always mounts it fresh) and
  clears it from the history entry, so a reload or Back never offers it again. `UseDeckBanner`
  offers the selected team's spots: one with cards asks "Replace Oguri Cap's 6 cards with …?",
  one with an uma and no cards takes it at once, an empty one (or New team, disabled at the
  cap) opens the uma picker first. The deck goes on through `deckToMemberCards`
  (`utils/pvpTeams.ts`): main cards only, the borrow card (else slot 6) in Borrow, the rest
  in 1 to 5; what the team rules or the release date refuse is skipped and named in the toast,
  a words-only slot ("Any Wit") left open; her style becomes the deck's. The toast's Undo
  puts the members back. The banner's key is prefixed (`deck-<team>`): `TeamNotes` beside it
  is keyed by the bare team key, and the clash left a dismissed banner on screen.
  **The deck deals in** (owner, 2026-10-24; `DeckDeal` in `TeamGrid.tsx`): each card slot is
  keyed by how many decks its spot has been dealt, so ONLY "Use this deck" re-keys it. Left to
  right, 0.12s apart, the borrow card last, each old card rises and fades out while the
  deck's rises in from below (`AnimatePresence mode="popLayout"`); a panel that appears mid
  deal (an empty spot that just got its uma) deals its cards in too. A pick, a removal, Undo
  and the team window keep the keys and stay instant; `useReducedMotion()` zeroes it.
- **Notes** (`TeamNotes.tsx`): ten per team, read-only until the pen, `==red==` and line breaks
  kept, the eraser's Undo in a toast. Colours are the `--color-note-*` tokens.

## Rankings page (`components/rankings/`)

Plan, decisions and build order: workspace-root `notes/rankings-page-plan.md`; the redesign
(approved 2026-10-28, built step by step) is `notes/rankings-redesign-plan.md`.

- **The kit** (`components/rankings/kit/`, redesign step 1): every list is `RankRow`s in a
  `RankedList` (top ten, then "Show all"). A row's `Bar` is **scaled to the list's leader**
  (`fill = count / first count`), never to 100%; the share stays as text. Under 40rem of
  CONTAINER the bar column goes and a 3 px hairline under the name carries the fill. Also
  `Podium` (the top three), `StatBand` (a lead and three figures), `Lens` (one list, many
  views), `FilterToolbar` / `FilterPill` / `TickOptions` / `Tokens` (pills that state their
  filter, a token per changed one), `Movement`, `Sparkline` (inline SVG), `CardArt`,
  `CardTypeChip` (a dot of the type's hue, never coloured text). The `--color-status-*`
  tokens (running, upcoming, ended, predicted) are `@theme`, redrawn for the light themes.

- **Patreon only for now** (owner, 2026-10-27): `account.early_access` draws the page and its
  navbar item (both bars, named at every width since 2026-11-24). Every `/rankings/*` route checks `benefits.early_access`
  too. Not prerendered, not in the sitemap, `noindex` (`AppRouteMeta`), like the Skills page;
  in the API's `visits.KNOWN_ROUTES` so landings count.
- **Tabs, `?view=`**: Guides (default, no parameter), Pull plans (`pull-plans`, behind
  the Raptive gate), PvP (`pvp`, with `?event=cm-21` like the PvP page) and Players
  (`players`). One tab on screen. A tab the reader can't open is never drawn, and its `?view=`
  falls back to the first tab. Every tab fetches through `useRankingsPayload(path)`. A tab's
  badge (`useSectionBadges`: events with a guide, the PvP event's short name) comes from the
  calculator's events, so no payload is fetched to draw the bar.
- **PvP** (`PvpTab.tsx`), one event, picked on a sideways strip of event cards
  (`EventStrip.tsx`; `?event=` on the page, else the remembered event, else the one running or
  next; the pinned window uses the remembered one alone). "Umas players build" counts **every
  saved team**, posted or not, with
  a bar split by running style; an opened uma reads her strategies, her share of the event's
  gallery posts (`GET /rankings/gallery`) and her CM Runs win rate together. "Cards in their
  decks" the same way. "What wins" is CM Runs' win rate per uma and strategy
  (`utils/runResults.ts`): **shown from `min_races` (20), ranked from `RANKED_RACES` (100)**;
  20 to 99 races sit under the ranked rows, muted, with no place; one to three marks say how
  much to trust a rate (20, 100, 300 races). A row's second small line (`RankRow`'s `note`)
  is its average place and top-3 rate when the server sends them (20 placed races; places
  are optional). "What beats players", at the top of the column beside it, is each uma's
  share of the event's named losses (`beaten_by`, from 20 named losses, a row from 5), drawn
  in the loss red (`Bar`'s `loss` tone); a payload without it reads as empty. "Your team" reads the reader's own saved team
  (`usePvpTeams`) and gives each uma's place. "Trios players build most" is the server's exact
  three-uma teams (`count_teams` `trios`).
- **Players** (`PlayersTab.tsx`): Team Trials class and club rank as stacked bars, highest
  first (`DistBar`, a ramp from the brand down to the grays), favourite umas as a wall of
  portraits (`Wall`), income options as labelled bars by share (`OptionRows`, "starts off"
  from `default_on`), the typical budget by class (the server's medians; a class of one is
  never sent), and the selector on sale (`status`, else the most recent past one) with its
  top picks, the rest behind "Show earlier".
  All from the admin analytics, staff out.
- **Pull plans** (`PullPlans.tsx`) is the admin's Popular banners tables for supporters, as
  one list of `PullPlanRow`s: the date block, the kind badge (`.banner-type-tile--*`), the
  status pill, planners with their share of everyone planning (the payload's `planners`),
  and **typical (the median)** beside the average; a type lens and a sort lens (remembered
  on the device), ended banners behind a switch (`utils/pullPlanRankings.ts`); a step-up's
  figures are STEPS and say so. A row opens to its pull spread (`spread`, labelled by
  `spreadLabel`; steps on a step-up) and "also planning" chips to each banner's Timeline card
  (its BannerTimeline, from the calculator's banners). "When the pulls fall due" is six divs (`monthShares`: this
  month, the next four, Later), no chart library. **Hidden until Raptive approves** (Henry,
  "similar to skills tab"): `useRankingsPullPlans()` (guide editors) and the API's
  `views/rankings.sees_pull_plans`; un-gating is flipping both.
- **Hourly**: each tab's payload is built at most once an hour on the server and never
  invalidated; the page says "Updated 40 minutes ago" from its `generated_at`, in the header
  for the open tab (`useReportUpdated`, `rankingsUpdated.ts`).
- **Guides** (`GuideRankings.tsx`) is the source sheet's card table with its filters one to
  one (Henry), housed as five pills: Events (All guides, or the next 3 / 5 / 10 events with a
  guide from a picked one), Include (CM, LoH, Beginner, Standard, Whale, Honorable Mentions,
  plus "Other decks" for one-off decks the sheet has no column for), Strategy, Scenario ("Not
  set" for a guide without one), Card type ("Friend", as elsewhere on the site, for the
  sheet's "Pal"); every box ticked to start, and a changed one draws a token. Then the band,
  the top three, and ONE list with a lens (Overall, each card type, Umas), the lens
  remembered on the device (`rankingsPinStore` choices, `rankings-choices`), beside a rail:
  search (any card or uma, with its place under the filters), the QC note, the guides with no
  scenario. **Every rule is `utils/guideRankings.ts`**: a card counts once per deck (the
  borrowed card too, "N borrowed"; an alternative never), an uma once per guide and strategy
  (times recommended, never stars), shares out of the decks or guide-strategies counted. A row
  opens to by event (links), by strategy (a stacked bar), by deck tier and a sparkline of the
  last ten counted events (`usageByEvent`), never a list of decks.
- **The pinned window** (`RankingsDock.tsx`, owner 2026-10-27; redrawn in redesign step 3):
  "Pin to the side" on the page pins one section, one at a time, until unpinned
  (`services/rankingsPinStore.ts`, a `useSyncExternalStore` store on `localStorage`, server
  snapshot "nothing pinned"). **A window over the page, never beside it**: the team window's
  mirror on the LEFT, 23rem wide, never taller than its ten rows; the page keeps its full
  width. Mounted in `AppShell` after the scroller, behind the loading gate, never in `Navbar`;
  not drawn on the Rankings page or without early access. **Its own body, not the tab**:
  `WindowSources.tsx` ranks ONE list per section (Guides with every box ticked and the
  remembered lens; Pull plans by the remembered type and sort; PvP for the remembered event,
  umas or cards; Players' favourites) and the window draws four icon tabs, a context line
  with "Change" (the list's one or two settings, which are the page's remembered choices,
  `rankings-choices`), a search (Guides, PvP), ten compact `RankRow`s and "Full page".
  Retract or Escape leaves a tab in the **bottom-left corner on every width** (icon, a count
  of how many of the top ten moved since the window last showed them, `rankings-pin-seen` and
  `utils/rankingsWindow.movedCount`; the list's short name from `desktop-nav` up). The open
  state is remembered from `desktop-nav` up; below that it starts retracted every load and
  opens as a drawer. The source stays mounted while retracted, since the corner tab's count
  needs the list.
- **Rank movement** (redesign step 5): every payload carries `previous`, its lists at the
  start of the week (the API's `RankingsSnapshot`, rotated on the first rebuild after
  Monday 00:00 UTC). `utils/rankingsMovement.movement` turns two orders into each row's
  `Movement` chip ("▲2", "▼1", "new"). Guides send their old ROWS, counted with the filters
  and lens on screen, so a chip never reports a change the filters made; Pull plans draw
  movement in the "By planners" order only (the order the server snapshots); What wins only
  for ranked rows. The window's context line says "N moved this week".
- **Filters on a phone**: below `desktop-nav` the Guides pills give way to a "Filters · N"
  button (bottom right) and a bottom sheet (`kit/FilterSheet.tsx`, a native `<dialog>`). The
  pills and the sheet draw the same `FilterGroup`s, so they can't disagree.

## Encyclopedia pages (`components/encyclopedia/`, `components/skills/`)

A page for every trainee outfit, support card and skill (`notes/encyclopedia-plan.md`, in the
workspace's notes repo). **Open to everyone since 2026-11-18** (supporters and staff had it
first, from 2026-11-12; `notes/encyclopedia-open-plan.md`).

- **Routes**: `/app/umas`, `/app/umas/:gameId`, `/app/cards`, `/app/cards/:gameId`,
  `/app/skills`, `/app/skills/:gameId` (`SkillPage`; an old `?skill=` link redirects there). A
  page is keyed by the GAME's id;
  `utils/encyclopediaRoutes.ts` is the only builder of these links (`umaHref`, `cardHref`), and
  `parseGameId` reads only the leading digits so a readable suffix can come later.
- **No gate**: every list and page is wrapped in `EncyclopediaFrame`, which only adds the
  back-to-top arrow, and the API routes are public. **Search engines:** the three lists are
  in `PRERENDER_ROUTES` and the sitemap like every tab (the app shell and its head tags at
  build time; their titles name the Encyclopedia because the head is all a crawler reads of
  them). Every detail page is a prerendered document in `sitemap-encyclopedia.xml`, built
  from the API's index ("Every public route is prerendered" below); only an address with no
  page behind it is `noindex`.
- **Renders without a browser** (PR 3): a detail page sits OUTSIDE the `/app` loading gate
  (`AppShell`'s `ungated`, from `encyclopediaPageOf`), so it draws from its own payload
  without waiting for `/calculator-data`. Its banners and the hero's dates draw when that
  lands; until then `ReleaseFacts pending` holds the dates' place with blank bars, so the
  page doesn't jump. Its title and description are `AppRouteMeta`'s, built from the same
  cache entry by `utils/encyclopediaMeta.ts` (no UmaTL text in a title or description: a
  search result or link preview can't carry the credit, so a bracket title the API marks
  `title_translated` stays out; a card without a showable title gets its type and "No." so it never shares
  its uma's title; a unique and its inherited copy say which they are). `entry-server.ts`
  `render(url, content, pageData)` primes a fresh query client (`primeEncyclopediaPage`,
  through `PrimedQueryClientContext`), so the build renders the page itself, and `main.tsx`
  primes the browser's from the document's `#page-data`. Render-time code on these pages follows the outside-the-gate
  rule: no `window`, `document`, `localStorage` or clock. `entryServer.test.tsx` and
  `hydration.test.tsx` render and hydrate the committed sample
  (`src/content/encyclopedia-sample.json`, refreshed by `npm run content:pull`).
- **Data**: the lists read `/pvp-catalogue` (`usePvpCatalogue`); a page reads
  `GET /encyclopedia/<kind>/<id>` through TanStack Query (`services/encyclopediaQueries.ts`). The
  API sends no dates: banners and release dates come from `/calculator-data`
  (`utils/encyclopediaBanners.ts`), so date prediction stays in one place.
- **Rules that bite**: every uma is `FramedUma` from its `portrait`; every card is `FramedCard`
  from its `image_borderless` (the visual overhaul settled the owner's first-round answer that
  way, as in the Collection; a card with no frameless art draws its bordered `image`); every
  date goes through `formatDate`; a section with no data is left out, never drawn empty; a
  JP-only outfit's aptitudes and stats carry `JpDataNote`. Plain helpers (filters, words,
  colours, a banner's status) live in `utils/encyclopedia.ts`, so the component files export
  components only.
- **The navbar**: the Encyclopedia is everyone's fourth place since Selectors and Legend
  Races moved into their screens' bars (2026-11-24), and Rankings the fifth for early
  access. Its name shows at every desktop width now; see "Screen bars".
- **The catalogue is 106 KB on the wire** and the links and cards need it
  (`useEncyclopediaHrefs`). `HoverCardLayer` sits on every `/app` page, so it skips the load
  where no tile can open a card (`pageDrawsHoverCards`: the calculator and Selectors), and
  `SelectorTargetPicker` asks only once there is a pick to link.

### The look (the redesign of 2026-11-17, on the 2026-11-12 overhaul)

Drawn first on a canvas, twice: the overhaul (https://claude.ai/artifact/Y3TX7fU71C5ppw7FpGSmm6)
gave the pages order, and the redesign (https://claude.ai/artifact/6zATpMXYXQJzPBCfbisQr1; plan
and mocks in the notes repo, `notes/encyclopedia-redesign-plan.md` and `notes/encyclopedia-redesign/`)
gave them a face. The owner's rules from that second canvas: the hero's coloured background
stays, no picture is slanted, nothing is dimmed to de-emphasise it, aptitudes sit left of the
stats in rows of four, stats are separate boxes with Growth named, and Daptrius's filter bar
(web #369) keeps its rows and wording.

- **A page wears its character's two colours.** The API sends `colours` (`[main, sub]`, the
  game's own pair for her; `character_colours` by character id on `/pvp-catalogue`), `Page`
  (`pieces.tsx`) sets them as `--c1` and `--c2` on `.enc-page`, and `colourStyle`
  (`utils/encyclopedia.ts`) is the only way a pair becomes a style: it refuses anything that is
  not plain hex. **A colour is only ever a fill, or mixed into a theme token** (`--c1-ink`,
  `--c1-line`): some are near-black and some pale. With no pair the page wears the theme's
  accent. A group card and a skill that is nobody's pass an `accent` to the hero instead (the
  card's type, the skill's kind).
- **The hero** (`Hero`): the art standing straight on a slanted field of `--c1` with a stripe
  of `--c2` (clipped shapes, so the slant never lands on the name), the game's own number on a
  dark plate, and the Japanese name large and faint behind (`ghost`, decoration: the readable
  line is `japanese`; it uses the reader's own Japanese font, none is bundled). The ghost is
  sized to fit WHOLE between the art's column and the right edge: the hero is a size container,
  and the font size is that room over the name's character count (`--chars`), never above
  6rem, sitting inside the hero's bottom edge (Daptrius, 2026-11-17: at a fixed 8rem a long
  name lost its first characters under the colour field). An uma's `h1` is the character's
  name, with the outfit in the eyebrow ("Trainee · Christmas").
- **A section is one soft panel, no border** (`Section`), its heading flagged in the page's two
  colours. What is inside sits on `--enc-inset`, the one inset surface, a mix of two theme
  greys that reads on dark and light themes.
- **An uma's page** (`UmaPage.tsx`): her unique skill first as a plate with what it does
  (`UniquePlate`; an outfit below three stars has two), the innate skills in a row, then the
  awakening levels as posts on a track with each evolved skill hanging off the gold it comes
  from (one whose base isn't an awakening skill on the page is listed after). From 64rem the
  track runs across in four columns: levels 2 to 5 are one row, and the 6 and 7 JP added later
  (their skills JP only) a row of their own under an "Added later" rule, in the same columns,
  never squeezed onto the first (owner, 2026-11-17). A name on the track wraps to two balanced
  lines instead of being cut short. Below 64rem it runs down the left. Evolutions come in the
  API's release order, never by name. Career objectives are a list per year
  (`CareerObjectives`), a gold post for a race to win and a chequered flag after the last:
  on a phone the years run as one track, and from 48rem each year is its own column (Daptrius,
  2026-11-17: the single track wrapped to two rows on desktop anyway). One markup; the CSS
  switches, never a media query in render.
  A track's fact that is drawn (the level, what it grows from) is said to a screen reader
  through `SkillRow`'s `hint`.
- **Aptitudes and stats** (`facts.tsx`): every aptitude cell at full strength, A or better
  filled in the page's colour (`isTopAptitude`), the letter a white badge ringed in the game's
  colour (an override inside a cell; `.apt-letter` itself is the PvP guides'). Stats are boxes
  with the game's stat icons (`utils/statIcons.ts`). On a phone (under 40rem) the five sit in
  one row, each only the icon, the number and its growth: the bar goes, and the stat's name
  stays for a screen reader (`.enc-stat__name`, the sr-only pattern; Daptrius, 2026-11-17). The
  star switch opens at the stars the player has her at in their Collection (`useOwned`), else
  her starting stars.
- **Banners** show the banner's own picture and the faces of who else is on it
  (`utils/encyclopediaBanners.ts` adds `image`, `featured`, `kind`); related outfits and cards
  are picture tiles (`.enc-pic`).
- **A card's effects take the card's TYPE colour** (`--fx`, set by `CardEffects`), the level
  is a track that marks each limit break's cap beside the steppers, and each effect is its
  number over its name. **A skill's page** reads its steps left to right (`.enc-step`) and
  draws its family on one line (`Family`: evolves from and other versions, this skill, evolves
  into; the API leaves the from and into rows out of `versions`, so nothing is listed twice),
  with the outfit it belongs to in the hero (`owner_umas`). **Several slots are "Trigger 1, 2"**
  (the game fires the first whose conditions hold) unless the API's `readable.chained` says a
  later one waits on the first, then "Part 1, 2" (`slotLabel` in `utils/skillWords.ts`, the
  hover card too; Daptrius, 2026-11-17). On a ◎ page a giver of its ○ is listed with the ○'s
  name on its second line (`via`): a hint for the ○ counts for the ◎.
- **The lists**: a masthead whose tabs lead with how many each list holds
  (`utils/encyclopediaCounts.ts`: each list reports what it already holds, so no list fetches
  another's data to count it; the uma and card lists report the Skills tab's number too, from
  the catalogue's `skill_count`, so all three show from the first list opened). A tile is its art, no box; an uma's carries her colours as a bar.
  A list gets group headings and a thumb index whatever it is sorted by and filtered by (`groups.tsx`,
  `utils/encyclopediaGroups.ts`, one key function per sort): letters by name, quarters (index
  by year) by release date, a thousand ids (umas) or the rarity (cards) by game ID, the grade
  by an aptitude, the value by an effect (a value one or two cards reach is merged into a
  range). Filters never turn them off (owner, 2026-11-25). A heading is a `role="presentation"` item, so the
  list's items stay the tiles. The Skills list has them too: letters (a name past Z, mostly
  Japanese, under "あ"), the SP by cost (uniques last), the first three digits by game ID (no
  index: skill ids run 5 to 9 digits). It draws a page of rows at a time and grows as "Show
  more" scrolls into view; a jump to a heading not drawn yet draws up to it
  (`GroupedGrid` `limit` / `onReveal`). A unique or evolved skill's row ends with its owner's
  face (`SkillRow` `face`).

- **One stylesheet, `src/encyclopedia.css`**, imported by `App.tsx` beside `App.css`, all of it
  in `@layer components` so a Tailwind utility at the call site still wins. Classes are
  `enc-*` plus four that are used outside these pages: `.skill-card` (the hover card),
  `.kind-pill`, `.apt-letter`, `.grade-pill`. Every colour is a theme token, except the game's
  own (aptitude letters, race grades, rarity, a gold / evolved / unique skill), which are fixed
  fills with dark ink so they read the same on all twelve themes.
- **The filter bar** (`listFilters.tsx`: `Toolbar`,
  `SearchBox`, `Count`, `Chips`, `PickChips`, `SortControl`, `GradeSelect`): one card, each
  filter a small caps label and its chips. The group is named by `aria-label`, and the visible
  label is `aria-hidden`. Its look is Daptrius's (board "Encyclopedia Filter Changes",
  2026-11-17):
  - **One grid** (`.enc-filters`, each row a subgrid), so every row's chips start at one left
    edge; on a phone (under 480px) the label sits above its chips. Chips wrap, never scroll.
  - **Where and Collection are settings every list shares** (`SHARED_WHERE_KEY`,
    `SHARED_OWNED_KEY` in `utils/encyclopedia.ts`), drawn first in the bar above a dashed "Set
    once for every list" rule. They live outside a list's scope, so its Reset leaves them. Only
    skills have "Coming to global"; an uma or card list reads it as JP only (`listWhere`).
  - **Most filters take several picks** (`PickChips`, remembered by `useRememberedPicks` as one
    comma-separated key): its first chip is "All", pressed while nothing is picked, and any pick
    passes. The uma list's aptitudes are the exception: each picked column gets its own "at
    least" grade under the row, and an uma must pass them all ("Turf A and Dirt C").
  - **A card type's chip is its icon** (`utils/cardTypeIcons.ts`, the frame overlay's corner
    cut out), grey until picked; a rarity chip lights up in its metal; the aptitude rows' chips
    share one width so Distance and Style line up, with "Med." / "Dist." on a narrow screen.
  - **Sort is a menu and a reverse button** (`SortControl`) that says which way the list runs
    ("Newest first"). Reversing flips the comparison only: whatever a sort can't place (JP only,
    undated, no effect, no cost, no aptitude) stays last both ways (`sortList`, `sortByValue`,
    `sortByEffect`). Sorted by id, date or an aptitude, a tile says its value (`sortFact`).
  - **A query of digits is an id** (`searchMatches`): the start of a card's or outfit's game id,
    or its character's 4-digit id (`character_id`; an outfit id starts with it).
- **The jump bar sticks**, and where depends on what scrolls: under the navbar when the
  document scrolls (a phone, a short window), at 0 inside the desktop app shell. Under the
  navbar it sticks at the navbar's MEASURED height, `--navbar-h` on `<html>`
  (`hooks/useNavbarHeight.ts`, a ResizeObserver from `Navbar`): a written-down height was
  wrong on a phone under 440px, where the tabs' labels went sr-only and the bar was shorter, and
  left a gap (Daptrius, 2026-11-17). On a phone it is the places row alone since 2026-11-24:
  the wordmark row above it scrolls away. index.css's `scroll-padding-top` numbers are only its
  first-paint fallback. It
  draws only with three or more sections, and its chips are buttons (`scrollIntoView`), not
  `#hash` links, so Back leaves the page.
- **A card's effects** (`CardEffects.tsx`, first on the card page): a Limit break switch, a
  level stepper, the unique effect, then every effect as a value chip with the game's help text.
  The API sends one value per level (`effects[].values`, backend `support_effects.py`, which has
  the growth rule and its check), so the component only looks one up, and `effectValue` writes a
  unit only for a format the API names. It opens at the level the owner's limit break reaches,
  derived on each render because the Collection loads after the page. It never adds the unique
  effect into a row: a unique Friendship Bonus or Specialty Priority multiplies with the card's
  own (Daptrius, 2026-11-13), so the unique effect says so in a line, for the effects the API
  names in `unique_effect.multiplies`.
- **A skill's times are per 1,000 m** (`utils/skillWords.ts`): the API states a timed duration
  and a repeating cooldown against the race's length ("2.4 s per 1,000 m"), because the game
  scales both by it (Daptrius, 2026-11-13). The skill page explains that once, under How it
  works, when a time scales (`hasScaledTime`); the hover card only shows the chips. A value or
  a duration that ALSO scales with something else ends "(varies)": the files give only a code
  per kind of scaling (`value_usage`, `duration_usage`), and nothing is worded until someone
  confirms what a code means (asked of Daptrius, 2026-11-17).
- **The Skills page's Type filter has sub-types** (`utils/skillSearch.ts`, `TYPE_FILTERS`): a
  type is an icon family, and Stat boost and Debuff split further (Daptrius, 2026-11-12). A
  sub-type's key is its parent's plus a suffix (`stat_speed`), so `typeMatches` keeps a whole
  type by prefix. Several types may be picked: a type is picked whole (its own key) or narrowed
  (its sub-types' keys, never both), and each picked type with sub-types gets a row of its own
  under Type (`toggleTypePick`, `toggleSubTypePick`).
  The grouping and its evidence are the API's (`skill_types.py`).
- **Loading is a skeleton** (`PageSkeleton`, `GridSkeleton`, `.enc-skeleton`), and "nothing
  matched" or "didn't load" is `EmptyNote`, a dashed box.

### The skill card (`components/pvp/SkillDetail.tsx`, `.skill-card`)

What hovering a skill shows, on a guide's chips, mentions and deck cells and on every
Encyclopedia skill row: a header in the skill's own colour (icon, name, kind, and for early
access the type and cost), the description, a guide's note, When and Does as a small table,
timing as chips, where it comes from, its other versions, and a footer.

- **Every element is a `<span>`**: a mention sits inside a sentence, where a `<div>` is
  invalid. A label's colon is `sr-only`, for a screen reader and for copied text.
- **The popup is `components/pvp/hoverPopup.tsx`** (`useHoverPopup`), lifted out of
  `PvpTiles.tsx` so both places draw one card. `interactive` lets the pointer travel into the
  popup (Floating UI's `safePolygon`) and click its link; it is on only for early access on a
  skill with a `game_id`, because that is when the card ends in "Open its page". The popup is
  `aria-hidden` (its words are in the caller's `sr-only` copy), so that link is `tabIndex={-1}`
  there (`InsidePopupContext`). `tap: false` is for a row that is itself a link.
- **An Encyclopedia row fetches its card's body on first hover** (`useSkillPage`, one request
  per skill, shared with the skill's page), through `utils/skillCard.ts`
  (`rowToCardSkill`, `detailToCardSkill`). It never fetches for a row nobody hovered.

### Links into the Encyclopedia from the rest of the site

Umas and cards drawn elsewhere link to their page for early access. Since 2026-11-18 a MOUSE
click on most of those links opens the uma's or card's card instead, and the card's "Open its
page" goes on to the page (next section); a tap or the keyboard still follows the link (bar a
guide style tab's deck card, which a tap opens too). **One lookup serves them
all: `useEncyclopediaHrefs()`** (`hooks/useEncyclopediaHrefs.ts`), which maps the SITE's
row id (what every team, guide, ranking, roster and gallery snapshot carries) to the page
through the PvP catalogue's `game_id`. It answers null for everyone else, for a placeholder
card and for anything the catalogue doesn't number, and the caller then draws the old tile.
The Timeline alone reads `game_id` from its own payload, since it has it. How each place
links depends on what a click already does there:

| The tile is... | The link is... | Where |
|---|---|---|
| display only | the tile itself (`<Link>`); a click opens the card | Timeline, Legend Races, the uma wall, a ranking row that doesn't open, the podium (a stretched link), gallery teams, a guide deck's card art |
| a button (add, edit, pick) | the name under it, or `EncyclopediaIconLink` beside it, never inside; a click opens the card | Collection names, My team's names (`PageName`), the picker's book |
| the same, with no card | a plain link to the page | the Selectors pick (bottom-left book), a step-up's chosen slot |
| a guide tile with a hover note | a click pins the note open as the full card; "Open its page" is in both (`OpenPageLink`, `interactive`). A guide uma tile with a card has no hover, only the click | guide uma tiles, All-tab faces and mini cards, "or" alternatives |
| a ranking row that opens | "Open its page" at the top of the breakdown | `RankRow` with `detail` |
| inside the Encyclopedia | the tile itself, straight to the page, no card | the uma and card lists, a page's outfits and cards, a skill's owners |

Left out on purpose: the planner's art cell (already a link to the banner on the Timeline,
and a link can't hold links), pickers where a click chooses, the guide editor's deck
(`pageLink={false}`: a stray click would leave mid-edit), the share pictures, and the account
page.

### Cards for umas and support cards (`components/hovercards/`)

The skill card's two siblings (plan: `notes/uma-card-hover-plan.md`): an uma's card shows her
aptitudes (the race's ringed), stats boxed with Growth and skills; a support card's shows its
effects at 0LB, MLB and the player's own limit break, its unique effect and the skills it
teaches. Both end in "Open its page". Early access only, mouse only (a phone and the keyboard
keep the links above). The code says "hover" because they opened on hover for one release
(v2.17).

- **They open on a click, never on hover** (owner, 2026-11-18, after Daptrius's report that a
  card under every picture the mouse crossed felt laggy and covered the page). They are off the
  calculator, the shared plan page, the Selectors page and the Encyclopedia's own pages.
- **A tile opts in with attributes, built by `hoverCardProps()`** (`utils/hoverCards.ts`), never
  by hand: `data-hover-card` names the row, `data-hover-card-ring` the aptitudes to ring. Put
  them on plain art, or on the link to that uma's or card's Encyclopedia page (and give that
  link `title={CARD_LINK_TITLE}`). **Never on a button or a link with another job**: the layer
  leaves that click alone, so the attribute would do nothing. Where the tile is such a button,
  the name or book beside it carries the card (`PageName`, the Collection's names,
  `EncyclopediaIconLink hover`).
- **One popup serves the whole app: `HoverCardLayer`**, mounted once in `AppShell` beside the
  team window. It listens on the document for a press, a click and Escape, and does nothing
  while the mouse moves. A click opens the card when nothing under the pointer is a link or a
  button, or when the nearest one is a link to the tile's own page (the link then doesn't
  navigate and its `onClick` doesn't run). A click on the tile again, anywhere else, Escape or
  a route change closes it; a keyboard click and a new-tab click are left to the link, and so is
  a tap, except on a tile built with `hoverCardProps(..., { tap: true })` (a guide style tab's
  deck card, `SupportTile`; Henry 2026-11-19, the one place phones get the shared card);
  the tile's `title` is moved aside while its card is open; `[data-hover-card]` gets the pointer
  cursor only while the layer is on. It draws at `z-[10001]`, above the pickers' overlays, and
  inside an open native `<dialog>` when the tile is in one.
- **Where it goes: beside the tile, right else left, top level with the tile's, slid up only as
  far as the window needs** (`cardPopupMiddleware` in `pvp/hoverPopup.tsx`, shared with the
  guide tiles). The side is picked by the room beside the tile alone (`flip` with
  `crossAxis: false`): with the default, a card taller than the room under its tile counted as
  not fitting anywhere and landed above or below, squeezed (in practice only in a narrow
  window; beside a small picture in a wide one the two rules agree). The box is at most the
  window's height and scrolls inside itself. **A tile wider than the card** (a ranking row, a
  podium entry) is placed beside the POINT that was clicked instead (`anchorFor` in the
  layer): beside the row itself there is no room on either side. While its page loads the
  card holds about its final height (`.hover-card__loading`), so it is placed once.
- **Every popup keeps clear of Raptive's sticky footer ad** (`.adthrive-sticky.adthrive-footer`,
  fixed at z-index 1000001, 50px on a phone and 90px on a computer): `popupEdges()` adds the
  ad's height to the bottom padding and the card's max height, and `watchFooterAd` checks the
  ad four times a second while a popup is open, since Raptive slides it in late. Never raise a
  popup over the ad instead: covering an ad breaks the network's rules. Before this (2026-11-19)
  a tall card slid under the ad and "Open its page" opened the ad.
- **The cards only draw** (`UmaHoverCard`, `CardHoverCard`, from `UmaPageData` / `CardPageData`),
  wearing `.skill-card` plus `.hover-card__*` (`encyclopedia.css`). The page's fetch starts on
  the press (`prefetchEncyclopediaPage`) and is read on open (`useUmaPage` / `useCardPage` with
  a 30 minute `staleTime`, the same cache the pages use); the header draws from the catalogue
  meanwhile. `useEncyclopediaLookup()` maps the row id to the game id, beside
  `useEncyclopediaHrefs()` on the same index.
- **A guide tile keeps its own popup** (`WithDetail`): hover shows the guide's note, as for
  everyone, and a click pins it open as the full card with the note on top
  (`useHoverPopup({ pin })`; a tap does the same). The layer ignores anything inside one, so
  nothing opens two cards. **A guide uma tile (`UmaTile`) has no hover** when her card exists
  (`hover={false}`; Daptrius, 2026-11-19): the card already holds the note and the unique's
  verdict, and opening it lights the course map. Keyboard focus still opens the small popup.

## Projection settings (`carat-calculator/ProjectionSettings.tsx`)

The switches that decide what the projection assumes (spend tickets, misc earnings and its
own amount, the paid pulls, the daily pull on banners outside the plan). **The last row of
the Income & Resources panel since 2026-11-24** (owner; `notes/navigation-plan.md`, PR 1).
Until then it was `navbar/SettingsMenu.tsx`, a popover behind a gear drawn on every `/app`
page, although only the calculator reads these settings.

- **The closed row says what is on.** A count pill ("4 of 6 on") at every width, and from
  `@3xl` the short names of the settings that are on. A dropdown hides its contents, and
  the shop ticket counts showed what that costs (3% of players found them behind the gear),
  so the panel has to show what its numbers assume without being opened. A new setting
  needs a `short` name for that line.
- **Closed on every load, open until a reload** (`useRememberedOpen("projection-settings")`),
  like the panel around it.
- **Closed means out of reach**: the body is `inert` and `aria-hidden` on a plain wrapper
  inside the animated box. Height 0 alone would leave six switches in the tab order.
- **Layout is by container query**, like the rest of the panel: one tile per row on a
  phone, two from `@3xl`, three from `@income-wide`. A setting that is on gets the brand
  edge; off is the plain tile, never a dimmed one.
- **The height animation asks `useReducedMotion()` itself**: `MotionConfig` stops
  transforms only.
- A guest's "Clear plan and start over" lives under the tiles, two presses, as it did in
  the popover.

## Screen bars (`components/ScreenTabs.tsx`) and the navbar's places

**The navbar lists places; a place with more than one page gets a screen bar under it**
(owner, 2026-11-24; `notes/navigation-plan.md`). Seven navbar tabs were more than a phone
could name, and two of them were icons without a word below 1536px on a desktop.

- **The places are `navbar/navPlaces.ts`** (`NAV_PLACES`, `navPlacesFor`): Calculator,
  Timeline, PvP, Encyclopedia, and Rankings for early access. One list for the phone bar and
  the desktop bar. Each has an `isOpen(pathname)`, so a place stays lit on every page inside
  it. A new place is one entry there; something that is not a place (a setting, a link, the
  theme) goes in the menu (`SiteMenu`), never in the bar.
- **On desktop every place has its name from 1024px** (five are 567px wide; the wordmark
  wraps to two lines at 1024px with all five, as it did before).
- **On a phone the places keep their names too, and only they pin** (owner, 2026-11-24,
  with a bottom bar deferred so the footer ad is untouched). The bar is two pieces: the
  wordmark row (search, Team, Sign in, the menu, a waiting save) scrolls away with the page,
  because the sticky box's `top` is minus that row's `h-14`; the places row under it is
  what stays, and the only part measured (`data-sticky-navbar`, `--navbar-h`). **Scrolling
  up brings the row back** (`hooks/useNavbarReveal.ts`, web #466): the hook watches the
  scroll direction and sets `--navbar-reveal` (3.5rem shown, 0 tucked away) on `<html>`.
  The navbar's sticky box adds it to its `top`, and everything pinned under the navbar adds
  it too: a screen bar, the Encyclopedia's jump bar, and the PvP rows, which are measured in
  pixels and so re-measure on `NAVBAR_REVEAL_EVENT`. A new row that pins under the navbar
  on a phone takes `calc(var(--navbar-h) + var(--navbar-reveal, 0px))`, or it ends up
  under the returned row. Measured in WebKit: up 60px, the row returns on the calculator,
  PvP, the Timeline and an uma page, and every bar under it moves down with it. The cells are
  sized by their words (`flex-auto`) at 11px, 10px below 360px: five names fit 320px with
  none cut (measured: 34px for PvP, 76px for Encyclopedia). Pinned, the phone bar is 66px
  where it was 104px, and `scroll-padding-top` is one figure, 4.125rem, at every width.
  Change the row's `h-14` and the sticky `top` together.
- **A screen bar is `ScreenTabs`**, fed a list and a one-line wrapper per screen:
  the Calculator's (`carat-calculator/calculatorTabs.ts` + `CalculatorTabs.tsx`: the
  calculator `/app`, Selectors `/app/selectors`, the Pull Plan Library `/app/plans`, early
  access until it opens; web #456) and the Timeline's (`timeline/timelineTabs.ts` +
  `TimelineTabs.tsx`: the Timeline and Legend Races). Drawn like the PvP page's view tabs
  (Henry's ask) but as `NavLink`s, since they are separate addresses. A third screen is a
  list and a wrapper, never a copy of the markup.
- **AppShell draws a screen's bar above the loading gate**, so the build-time render of the
  screen's pages has it. A wrapper reads the path and the account only; a gated tab (the
  Library) joins after the account loads, and the bar's height never changes.
- **Sticky** at `--navbar-h` where the document scrolls (phone), at `0` in the desktop
  shell (`app-shell:top-0`), the same two set-ups as the Encyclopedia's jump bar. `z-30`,
  opaque.
- **Its height is one variable, `--screen-tabs-h` (`index.css`), and whatever sits under the
  bar reads it.** The scroll padding (`html:has([data-screen-tabs])` where the document
  scrolls, `[data-app-scroller]:has(> [data-screen-tabs])` in the desktop shell) is what
  lands a deep link below the bar: without it a planner row's link to its Timeline card, or a
  campaign strip's link to Selectors, parks its target under the bar. A band a page pins
  beneath the bar takes it as its `top` (the Timeline's controls,
  `app-shell:top-(--screen-tabs-h)`); at `top-0` the two stack on one line and the later one
  covers the tabs. Measured 2026-11-24: a Timeline deep link lands where it did before the
  bar existed, relative to the bands, at 1440px and 390px.
- A phone shows "Library"; the full "Pull Plan Library" stays the link's name.
- **The tabs share the bar's whole width at every size**, one equal grid column each, like
  the Rankings and PvP rows (owner, 2026-11-24); never bunched at the left.

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
rather than a new endpoint, spreadsheet catch-all banners named `(All)` are excluded (judged
by the banner's own name, never its timeline's: a support-only week's real SSR banner sits on
an `(All)` timeline),
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

## What survives a page change

Until a reload, on purpose: a reload is the quick way back to the defaults (Daptrius, 2026-10-30).
`hooks/useRememberedOpen.ts` keeps panels open or closed: the Income panel, a row's odds and note
panels (per banner, in both layouts), and a planner band's "Show N more". The team pickers keep
their filters the same way. `hooks/useScrollReset.ts` keeps each page's scroll: a link back to a page
restores its place, unless the link names something else on it (another event, `?focus=`), which
starts fresh. A restore retries for about a second and a half while the page lays out, and any
reader input ends it. The Income panel starts closed on a phone unless no rank is picked yet.

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

**The Encyclopedia's detail pages are prerendered from the API, not from
`PRERENDER_ROUTES`** (`notes/encyclopedia-open-plan.md`, web #408 and PR 4). After the fixed
routes, `prerenderEncyclopedia` in `scripts/prerender.mjs` fetches `GET /encyclopedia/index`
from the API the bundle was built against, then each page's payload (two requests at a
time, three retries, then the build fails and the old site stays up), renders it through
`render(route, content, pageData)`, and writes `dist/<route>/index.html` with the payload
embedded as `#page-data` (`other_names` stripped: GameTora's names never reach page
source). `main.tsx` primes the query cache from that block before hydrating, marked stale so
the page refetches at once. It writes the **`dir` layout only**: on 2026-11-20 the live host
served the `spa.html` shell for `/index` and `/app/index`, whose files exist only as
`index.html`, so App Platform never appends `.html`, and a second copy of 3,000 files would
never be served. Then `dist/sitemap-encyclopedia.xml` lists exactly the documents written,
and `public/robots.txt` names it. `buildDetailPage` refuses a page with no `<h1>`, a title
without the page's name, or `noindex`. Sizes at the first full build (local data, 3,056
pages): 175 MB, 53 to 84 s, umas about 72 KB a document, cards 67 KB, skills 53 KB.
**Every web build therefore asks the live API for about 3,080 pages**: deploy the web
after the API is live and not at the 15:00 UTC peak (`/push-live`). A page added after
the last build has no document and no sitemap entry until the next one; its address
still works through the shell and is not `noindex`. `PRERENDER_CONTENT=snapshot` (CI)
renders the committed sample, `src/content/encyclopedia-sample.json`.

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
  notes"), the banners, the controls. Each banner shows its pulls (or steps) and,
  under `share_notes`, the owner's note (owner, 2026-10-30): the rows a guest copy takes, one
  serializer, so the card gives away nothing the link didn't. "Your max" runs the projection on
  those rows with the VIEWER'S resources, so it's what they'd see after copying.
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

## Community plans (`components/community-plans/`, `/app/plans`)

Pull plans players have posted (`notes/pull-plan-database-plan.md`, Design 6 to 8; the
canvas shots are in `notes/pull-plan-database/`). **Players see it as the Pull Plan
Library** (renamed 2026-11-24, `notes/pull-plan-database-plan-2.md`): every visible string
says that, while the folder, the components, the comments and `/app/plans` keep "Community
plans" as the internal name. Site search still finds it by "community plans". Early access only until PR 5: the route
exists, the page shows `SupportersFirstNote` without `account.early_access` or on the API's
403, and it is noindex and out of `prerenderRoutes.ts` and the sitemap, like Rankings.
Its own chunk (`loadCommunityPlans.ts`). The Calculator tab stays lit on it (`Navbar`).

- **A list whose posts open in place**, never a side panel or a dialog (decision 8). The
  heading with "My plans"; the sort bar (Top for Today / This week / This month / All time,
  and New) with the count; the filter sidebar (`PlanFilters`, a 17rem column from `lg`, a
  sheet on `GalleryModal` below) beside the list.
- **A spending level's option says what it means** ("Minnow - Daily Carat Pack only",
  `spendingOptionLabel` in `utils/planFeedView.ts`), in the filter and the post dialog
  alike; both halves are the API's (`plan_gallery.SPENDING_MEANINGS`). The feed row's chip
  keeps the short label with the meaning as its tooltip. The sidebar is 17rem because the
  longest option has to fit its closed select; the dialog stacks its two pickers for the
  same reason.
- **One grid for every row** (`PLAN_ROW_GRID` in `PlanFeedRow.tsx`), shaped by the LIST's
  width (`@container/plans`), never the window's: wide adds the four lead banners' pictures,
  medium drops them, narrow folds the numbers into one line under the poster. The heading
  line (`PlanFeedHeading`) sits on the same grid.
- **The row's title is a real `<button>` stretched over the row**, with `aria-expanded`; the
  vote control and the poster's name sit above it (`z-[2]`) and keep their own clicks. The
  opened post (`PlanPostBody`) renders inside the same `<li>`. One open at a time.
- **The address holds the view**: `sort`, `window`, `range`, `strategy`, `spending`,
  `sweat` and `post` (`utils/planFeedView.ts`, defaults left out). The view is remembered
  per device in an EFFECT (render never reads `localStorage`, so PR 5 can prerender the
  page). `?post=` opens that post; one the list leaves out is drawn on its own above it.
- **The rows are the share card's** (`shared-plan/PlanRows.tsx`, lifted from
  `SharedPlanLanding`), with an optional per-row `action`: "Add to my plan", through
  `hooks/useStageBanner.ts` (the Timeline's staging path). "Already staged" and "Already
  in calculator" by the Timeline's rules; an ended banner has no button.
- **The posted income** (`PostedIncome.tsx`) runs `useAverageMonthlyIncome` on the posted
  fields over the viewer's block (only to fill the shape: every field the engine reads is
  posted) with the FULL ledger, so it shows what the author's own tiles showed. Ranks and
  settings as chips, then "Their carats, tickets and crystals are never shown."
- **Gallery rules hold**: the supporter look from `gallery_style` alone, `GalleryVote`
  (up and down, decision 9), `GalleryComments` on `postThread`, `ReportDialog` with
  `what="plan"`, the `/post/<id>` share link. Feed data goes through `galleryQueries.ts`
  (`usePlanFeed` under the same `["gallery", "feed"]` prefix, so `patchPost` reaches it).
- Narrow a post with `isPlanPost()` / `isTeamPost()` (`utils/galleryPost.ts`), never by
  its keys: the account page's list and the profile card hold both kinds.
- **The way in is the Calculator screen's bar** (owner, 2026-11-24, replacing decisions 1
  and 11's Plans bar button): see "Screen bars" below. "Post this plan" in the plan
  menu has a "Posted" mark from `post_public_id`; early access only, and hidden on an API
  without the field. The page's heading has "Post a plan" (the open plan) and no "My plans":
  the bar is the way back. The share card links "Browse the Pull Plan Library" under the
  same gate.
- **A plan may have several posts** (owner, 2026-11-24, api `0145`). `post_public_id` is the
  plan's NEWEST post. The dialog asks on a posted plan: "Update my post" (the default; keeps
  the link, comments and votes, and offers "Take it down") or "Post it as a new plan"
  (`as_new: true`, still within the 5-post cap).
- **Posting** (`PostPlanDialog`, the `PublishDialog` pattern on `GalleryModal`): title,
  About, the three optional picks worded by the feed's `filters`, the range shown never
  asked, "Include my notes" and "Include my income" UNTICKED ON EVERY OPEN, the agree box,
  and on a posted plan "Update post" and "Take it down". It sends through the provider's
  `postPlan`, which saves a pending edit first (the post copies the SAVED rows); a refusal
  shows inline beside the field it names (`notes` beside its box).

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
- **Two views, Carats and Pulls** (switch under the heading, remembered per device as
  `uma-planner-forecast-unit`). Pulls is TWO lines, day by day like Carats (owner,
  2026-10-19): "Uma pulls" (carats + uma tickets) and "Support pulls" (carats + support
  tickets), because a banner spends only its own kind. Free pulls never count. A day's
  pulls follow the player's settings (`buildPullSeries`): free carats ÷ pull cost, plus
  paid carats ÷ pull cost when full-price paid pulls are on, plus the line's tickets when
  spending tickets is on. The four balances come from `buildCaratForecast`, each
  re-anchored to the row like free carats. At each banner the dot sits on its own kind's
  line at the row's Max Pulls without free pulls (`buildPullBars`, read off
  `maxPullBreakdown`); that can sit a little above the line's arrival, because the row
  counts the daily discounted pull, which only exists while a banner runs. Step-ups get
  no dot (they count steps), though their paid spend still drops both lines. The lines
  wear `--color-series-uma` / `--color-series-support` (validated pair, see index.css),
  with a legend under the heading and end labels when they don't collide.
- **The pity line** is `PULLS_PER_PITY_COPY` (200): always drawn in Pulls; in Carats at
  200 × `pull_cost_carats`, drawn only when the line comes within 25% of it, so a small
  plan is not squashed under an empty band. Its label sits just above the line.
- **Y ticks are ours** (`niceTicks`: 1, 2, 5 × 10ⁿ), passed to Recharts with the domain,
  because Recharts' own rounding picked 12.5K steps.
- **A banner's dot jumps to its row**: `onSelectBanner(index)` scrolls to
  `[data-planner-index]` in CaratCalculator and flashes it with `.row-arrival`, the same
  flash as a row confirmed from staging (`flashIndex`, by index: a tempId and a saved id
  can collide). On touch the first tap opens the readout and a second tap jumps.
- **Skipped PvP events are red dots on the line** (`buildSkipMarkers`), at the instant
  each skipped Champions Meeting / League of Heroes would have paid, read from
  `fullIncomeLedger` through `upcomingSkippedRaces` (the projection ledger has them
  removed, which is how a skip works). In Pulls the dot sits on both lines.
- **Every layer added after the first release is OPTIONAL** (owner, 2026-10-19: "this and
  future changes to the chart should be optional, checked on and off"). Each is one entry in
  `FORECAST_LAYERS` (CaratForecastChart), starts OFF, and gets a checkbox in the legend row
  of the views it belongs to; the set is remembered per device as JSON under
  `uma-planner-forecast-layers`, read defensively (unknown keys and non-booleans ignored).
  The first is **Paid carats**: a grey band stacked on the free area (grey because the free
  layer wears each theme's brand colour, and any second hue clashes with one of the twelve),
  so the top edge is the total. With it on, a step-up's dot moves to the band's top edge in
  `--color-step-up` and its readout leads with paid carats ("short by" when over-planned);
  with it off, the step-up's dot stays on the free line.
- **Folded or open is remembered per device** (`uma-planner-forecast-open`), read in an
  effect because `/app` is prerendered.
- The line draws itself in on mount (Recharts' own animation), skipped under
  `prefers-reduced-motion`.

## Site search

Ctrl+K / Cmd+K anywhere, or the navbar's search button. `hooks/useSiteSearch.ts` holds the
open state and the key, `components/search/SiteSearch.tsx` the button and the lazy palette (its
own chunk, cmdk and Fuse included, loaded on first opening), `utils/siteSearch.ts` what can be
found and where it goes. An uma, a card or a skill opens its Encyclopedia page and an event its
guide. Two fallbacks: until the catalogue loads, an uma or card opens the Timeline on its banner,
and a skill with no game id (so no page) shows in the palette. A new page goes in `pageEntries`;
Rankings is listed for early access only. Outside `/app` the banners come through `readCalculatorCatalogue`, the
navbar's prefetch, so going on to the calculator costs no second request.

## Share picture (`carat-calculator/share/`, `pvp/share/`)

"Share picture" turns the pull plan, or a PvP team on My team, into a PNG: Copy, Share
(the device's share sheet) and Download, each offered only where the browser can do it.
Plans: `notes/share-plan-image-plan.md`, `notes/team-picture-plan.md`.

- **One panel, two pictures.** `components/share/SharePictureButton.tsx` owns the button,
  the portalled panel, the drawing and the three actions; `SharePlanButton` and
  `ShareTeamButton` each pass their picture, their checkboxes (`ShareOption`), an
  `optionsKey` that changes whenever the picture would, and a file name
  (`utils/shareFileName.ts`: the plan's or team's name, the player's only when shown, and
  the minute, so two pictures never share a name). A third picture
  is a third wrapper, never a copy of the panel.

- **A poster, `PlanPicture`, never a read-only flag on `BannerRow`** (redesigned
  2026-10-29). It is seen at half size or less in a chat feed, so it leads with what reads
  there: the totals as headline tiles (pulls, free and paid carats spent, and the
  forecast's own "Carats short" / "Carats to spare" figure in the status colours), then each
  banner as a card on a dated rail, with its art a size up (`BannerArt large`), a type pill
  (`BannerTypeChip`) and the pull count as the card's biggest number, coloured and metered
  by `countStatus`. The sheet's four stat boxes stay as a small 2x2 grid, with Carat Est. over
  Paid Carat Est. (the sheet's first two swap places on the picture only). The scenario and
  anniversary bands become dated milestones on the rail. "Show my name" (off by default)
  also shows the account's picture, framed as the player's own favorite; "Hide paid
  carats" drops the paid tile and blanks the paid figure.
- **The theme reaches the picture through its tokens and its glow.** It is drawn while
  mounted in the page, so every colour is the player's theme, colorblind mode included.
  `.share-picture` (App.css) paints the theme's `--page-glow` itself, because the page's
  glow layer is fixed to the viewport and never reaches an off-screen node; Dark, which has
  no glow, gets a soft bloom of its own accent. `.share-picture-track` is the racecourse
  in the corner: its straight runs between the wordmark and the tiles, so re-check it
  when a header moves. Both pictures wear the pair.
- **Its numbers come from `utils/bannerRowFigures.ts`**, the same helper `BannerRow` reads
  (the "Passed" gate, the carats floored to tens, the stat boxes), and its art from
  `BannerArt`, which `BannerRow` also draws. Change a row's figures there, never in one
  of the two views.
- **Every banner, always, at full size** (owner, 2026-10-29: a picture of part of a plan has
  no point, and nothing shrinks; the picture gets bigger). From 31 banners the poster's own
  cards run in two columns on a 1,880px picture, each column exactly the poster's width
  (`utils/planPictureLayout.ts`): about 30 banners is as tall as an iPhone draws at 2x, and
  past that the picture grows wider rather than into a 10:1 strip. A milestone moves with
  the banner after it when the columns split. A compact-row layout was tried and dropped
  the same day (web #254): it shrank the text.
- **Fixed at 960px (1,880px in columns), drawn at 2x**, whatever the screen, **unless that
  passes an iPhone's canvas cap** (16,777,216 px): `pixelRatioFor` then scales it down, so a
  very long plan draws a little softer instead of failing. It no longer mirrors the sheet's
  grid tracks, so a column change on the sheet doesn't touch it.
- **Centre with flex, not auto margins.** The rail's nodes drew off the line in the PNG
  with `mx-auto` and on it once `RailNode` centred them with flex. Why the clone lost the
  centring wasn't pinned down, so check a new centred element in a real capture.
- **Where the button sits (owner, 2026-10-29):** at the end of the PLANS bar, after "...",
  for an account (`PlanSwitcher`'s `actions` slot); a guest has no bar, so theirs stays at
  the end of the add-banner row. `hasPlansBar` (`utils/plansBar.ts`) is the one test for which,
  so the two can't both show or both vanish. Its panel is portalled to `<body>` like the
  plans menu: the planner box clips anything placed inside it, and a one-row plan ends
  before the panel does.
- **The picture is made when the panel opens**, not on the click: Safari allows a clipboard
  write or the share sheet only inside the click, and drawing takes a second or two. The
  picture is mounted off screen only while the panel is open.
- **`utils/shareImage.ts` is generic** (render a node to a PNG, then copy, share or
  download) and loads `html-to-image` on first use. html2canvas is not an option: it can't
  read Tailwind 4's `oklch()` colours.
- **The art is inlined before drawing** (`inlineImages`): each `<img>` is fetched afresh
  (`cache: "reload"`), swapped for a data URL and decoded, so html-to-image fetches nothing.
  The image CDN sends `Access-Control-Allow-Origin: *` only to a request carrying an
  Origin, which the page's own `<img>` tags don't send, so a cached copy can fail a CORS
  read. Art that still fails is counted, and the panel says so; it is never left blank
  silently. On Safari's engine the picture is drawn until the PNG stops growing (three to
  four passes): its first pass draws inlined art blank, and two passes left a 26-banner
  plan's art blank on iPhones in v2.10.
- **On an iPhone or iPad the panel leads with "Save or share" and has no Download**:
  Download lands in Files, and the share sheet's "Save Image" is a page's only way into
  Photos (`ShareSupport.preferShare`).
- **The team picture is a lineup, `TeamPicture`** (owner, 2026-10-29; mocks in
  `notes/team-picture/`): the race as four headline tiles (`coursePairs`, a tile dropped
  while its headline still reads "TBD"), the team shape strip
  ("2 Pace + 1 End", each face where her style runs, Runaway on the left to End on the right
  like the game, `STYLE_ON_STRAIGHT`; no goal post, Daptrius 2026-10-29), then
  the three umas side by side: portrait, her letters for THIS race (TeamGrid's tones), her
  veteran's grade and stats, and her deck 3x2 with the borrowed card last. An empty spot
  keeps its column, so the numbers match the strip. Words and numbers live in
  `utils/teamPicture.ts`.
- **Its options (owner, 2026-10-29):** "Show my name" off, "Show my veterans" off (offered
  only when a member has one linked), "Show notes" on. Veterans hidden means her BASE
  letters too: the letters a veteran fixed are the veteran's data.
- **The event's art sits behind the top of the team picture** (owner's pick over none,
  2026-10-29): `.share-picture-art`, full width from the top edge at 16:9, 15% opacity
  (14% on a light theme) and a `mask-image` fade to the south, with the glow on its own
  layer above it (`.share-picture-glow`). The mask draws in a real html-to-image capture
  (checked in headless Chrome, four themes). The tiles and the strip go 78% opaque over it;
  the columns stay solid. An event with no art draws the picture without it.
- **Where the team's button sits:** at the end of the My team bar, after rename, duplicate
  and delete (`TeamToolbar`'s `share` slot), once the team has an uma. Not in the team
  window.
