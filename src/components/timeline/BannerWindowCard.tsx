import {
	CalendarDays,
	ChevronRight,
	Clock3,
	Dumbbell,
	Flower2,
	Gift,
	Repeat,
	Sparkles,
	Star,
	Ticket,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useId, useState } from "react"
import PredictedBadge from "../PredictedBadge"
import { bannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { formatDate } from "../../utils/dateFormat"
import { BannerArtPlaceholder } from "./BannerArtPlaceholder"
import { AnniversaryEventStrip } from "./AnniversaryEventStrip"
import { CATEGORY_LABELS, TIMELINE_FOCUS_HIGHLIGHT, getCountdownLabel } from "./timelineShared"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import type { BannerWindowGroup, TimelineFocusProps } from "./timelineShared"
import type {
	BannerCategory,
	BannerSupport,
	BannerTimelineForViewing,
	BannerUma,
	UserPlannedBanner,
} from "../../types"

/**
 * One timeline card: a date header, then one section per banner opening in that
 * window.
 *
 * Split out of Timeline.tsx when windows became groups. A card that renders N
 * banners instead of exactly one is too much JSX to keep inline in a component
 * that also owns paging, infinite scroll and search.
 *
 * See BannerWindowGroup for why concurrent banners are merged here rather than
 * in the database.
 */

type BannerCardStatus = "available" | "planned" | "staged" | "expired"

/**
 * The governing rule for everything below: CATEGORY DRIVES THE CHROME, COUNT
 * DRIVES THE GRID.
 *
 * Which chip appears and whether the section opens into a full-width band is a
 * function of banner_category. How many tiles fit on a row is a function of how
 * many cards the banner actually has. Keeping those separate means a
 * miscategorised row — an editor forgetting to mark next year's revival —
 * renders plainly but completely, rather than clipping nine umas.
 *
 * `standard` deliberately has no entry: most banners are standard, and a chip
 * on every card is noise rather than signal.
 */
type CategoryChrome = {
	label: string
	icon: LucideIcon
	/** Defined in App.css against the --color-category-* theme tokens. */
	chipClass: string
	/**
	 * Full-width horizontal band instead of the usual image/uma/support
	 * columns. Only the revivals: they carry up to eleven umas and no support
	 * cards at all, so a 260px column would either clip them or stack them into
	 * a tower beside two empty panels.
	 */
	band?: true
	/**
	 * Weights the section's columns towards the support grid. A race-prep batch
	 * is one uma and ten support cards — the reverse of an ordinary banner.
	 */
	supportLed?: true
}

const CATEGORY_CHROME: Partial<Record<BannerCategory, CategoryChrome>> = {
	golden_week_revival: {
		label: CATEGORY_LABELS.golden_week_revival,
		icon: Flower2,
		chipClass: "category-chip--revival",
		band: true,
	},
	race_prep_support: {
		label: CATEGORY_LABELS.race_prep_support,
		icon: Dumbbell,
		chipClass: "category-chip--quiet",
		supportLed: true,
	},
	rerun: {
		label: CATEGORY_LABELS.rerun,
		icon: Repeat,
		chipClass: "category-chip--quiet",
	},
}

/**
 * How many tiles a narrow feature column holds across. The column is about
 * 260px and a tile caps at 160px, so two is the honest answer — past that the
 * section is better off as a full-width band.
 */
const COLUMN_TILE_CAPACITY = 2

/**
 * A BAND IS ONE LINE AT EVERY WIDTH. Nothing about it is breakpoint-driven.
 *
 * The first attempt built the line out of `xl:grid-cols-${n}` classes, which
 * meant the line only existed above 1280px — below that the band fell back to
 * two columns and a ten-card race-prep batch rendered as a 2×5 tower with a
 * gutter of dead space down the middle. It also divided the width by the card
 * count with no floor, so the launch banner's twenty support cards were squeezed
 * to 74px each and their names broke mid-syllable.
 *
 * So the line is a flex row instead, and the card count sets a MINIMUM tile
 * width rather than an exact one:
 *
 *   - each tile grows to an equal share of the row (`flex-1`), so four revival
 *     umas spread across the full width exactly as they do today;
 *   - each tile refuses to shrink past `bandMinWidthClass`, so twenty support
 *     cards stay readable;
 *   - when the minimums don't fit, the row overflows its own `overflow-x-auto`
 *     scroller. Still exactly one line, just one you scroll — and the page body
 *     never scrolls sideways, per the container rule in ui-conventions.
 *
 * The cap lives on the tile and the growth on a wrapper around it, which is what
 * reproduces the grid's `justify-items-center` spread: the wrapper takes its
 * share of the row, the tile sits centered inside it at its natural size.
 */
const BAND_TILE = "flex flex-1 justify-center"

/** Image | umas | supports. Support-led inverts the last two weights. */
const SECTION_COLUMNS =
	"xl:grid-cols-[minmax(360px,1.28fr)_minmax(260px,0.88fr)_minmax(260px,0.78fr)]"
const SECTION_COLUMNS_SUPPORT_LED =
	"xl:grid-cols-[minmax(300px,1fr)_minmax(200px,0.5fr)_minmax(420px,1.7fr)]"
/**
 * Image | one panel, for when the other panel has banded away below.
 *
 * TWO EQUAL HALVES: art hard left in the first, panel hard right in the second.
 * Not the weighted split this used to be — that handed the art 1.6 of 2.3fr
 * (~1030px) against the panel's 0.7 (~450px), which worked only while the art
 * filled whatever column it was given. Once BANNER_ART capped the width the two
 * stopped agreeing, leaving the art adrift in an oversized column and the lone
 * uma tile flush against the section's right edge.
 */
const SECTION_COLUMNS_PAIR = "xl:grid-cols-2"

/**
 * The lone panel's cell in the PAIR shape. It sits hard right rather than
 * filling its half, so the cap is what holds it to the width it has in an
 * ordinary three-column row (~438px) instead of ballooning into a 740px box
 * around a single tile.
 *
 * `grid` so the panel inside still stretches to the row height, as it does when
 * it is the grid item itself. xl-only throughout: below that breakpoint every
 * template collapses to one stacked column, where the panel should still fill
 * the width.
 */
const PAIR_PANEL_CELL = "grid min-w-0 xl:ml-auto xl:w-full xl:max-w-[28rem]"

/**
 * BANNER ART IS BOUNDED BY ITS WIDTH, AND THE HEIGHT FOLLOWS.
 *
 * Every banner asset is 16:9, so with only `w-full` the art's height is
 * whatever column template the section happened to land in. That reads fine on
 * the ordinary three-column row — the art gets ~637px, so ~358px tall at the
 * widest the page container goes — but SECTION_COLUMNS_PAIR hands it 1.6 of
 * 2.3fr, i.e. ~1030px, and the same picture renders ~580px tall: one card
 * towering over its neighbours for no reason other than which panel banded
 * away. Below `xl` the grid collapses to one column and it is worse still, the
 * art spanning the full card.
 *
 * THE CAP IS ON THE WIDTH, NOT THE HEIGHT, AND THAT IS NOT INTERCHANGEABLE.
 * `max-h` with `w-full` SQUASHES the art: a percentage width is already
 * definite, so clamping the height just shortens the box and the picture
 * distorts with it (measured: 1030×580 became 1030×368, aspect 1.78 → 2.80).
 * The auto-width rule that would have rescaled the width to match never
 * applies here. Capping the width instead leaves `height: auto` free to track
 * the intrinsic ratio, so the art is always undistorted at any aspect.
 *
 * 41rem/656px is just above the three-column ceiling, so ordinary rows render
 * exactly as they did and only the over-wide shapes clamp — landing them at
 * ~369px tall, i.e. matching the ordinary row instead of dwarfing it.
 *
 * The art sits HARD LEFT in whatever cell it lands in, so the cap only ever
 * eats into the space on its right. That keeps its left edge on the section's
 * left edge in every template — the ordinary three-column row has no slack to
 * distribute, so centring the capped shapes was the only thing that moved, and
 * it moved them out of line with every other card in the timeline.
 * BANNER_ART_ALONE is the one exception; see its own note.
 *
 * THE 16:9 IS DECLARED, NOT DISCOVERED, AND THAT IS THE POINT.
 * Every banner asset is 16:9 — checked across the live CDN, 1024×576 and
 * 680×383 with no exceptions — so stating the ratio reserves the art's full
 * height before a single byte arrives. Without it a lazy image is 0px tall
 * until it decodes and then snaps to ~369px, so seventy rendered cards grow the
 * document by some 26,000px as you read. That is what used to defeat the
 * planner's deep links: `scrollIntoView` fixes its destination when it is
 * called, and a smooth scroll towards it dragged the viewport past exactly the
 * images whose loading pushed the target further down. See the settle effect
 * in Timeline.tsx for the other half of that fix.
 *
 * `object-contain` is what makes declaring the ratio safe. An asset that is
 * ever NOT 16:9 letterboxes inside the reserved box instead of stretching to
 * fill it — the same distortion the width-cap note above is about, arrived at
 * from the other direction.
 *
 * NO border AND NO shadow, deliberately — both draw the BOX, not the picture.
 * The reserved 16:9 is only a layout device, so any chrome on it outlines
 * whatever `object-contain` didn't fill: letterbox bars, or the transparent
 * margins of a cut-out asset like the scenario art, which is square and fills
 * barely half the width. The shadow is the subtler of the two and outlasted the
 * border — it darkens the card around the box rather than drawing on it, which
 * reads as a raised panel floating behind the art. Chrome belongs to
 * BannerArtPlaceholder, where the box IS the content and its edge is what says
 * "something goes here".
 */
const BANNER_ART =
	"block aspect-[16/9] h-auto w-full max-w-[41rem] object-contain rounded-xl"

/**
 * The art-only branch: every panel banded, so the art has a full-width row to
 * itself and nothing beside it. Here there is no column edge to align to, so
 * hard left just reads as a layout bug and the art is centred instead.
 */
const BANNER_ART_ALONE = `${BANNER_ART} mx-auto`

/**
 * The fields a featured tile actually renders. Both Uma and SupportCard
 * satisfy this structurally, which is what lets the two panels share one
 * component instead of duplicating forty lines of near-identical JSX.
 */
type FeaturedCard = {
	id: number
	name: string
	image: string
	recommendation: string
	/**
	 * The card's public one-liner, shown over its art on hover, focus or tap.
	 * Optional HERE only because a frontend deployed ahead of the backend can
	 * briefly receive cards without it; the API always sends a string.
	 */
	purpose?: string
}

/**
 * A featured tile's art, with the card's purpose note overlaid on it.
 *
 * THE OVERLAY LIVES INSIDE THE TILE'S OWN ART BOX, on purpose. A tooltip
 * floating outside it would be cut off by any of three clipping ancestors — the
 * band's scroller, a recommended panel's `overflow: hidden`, and the card
 * itself — and would need portalling plus a positioning library to escape them.
 * Inside the box nothing can clip it and it takes no layout: the tile is the
 * same size with or without a note. The field's 100-character cap is what keeps
 * the text inside the narrowest tile.
 *
 * A card with no purpose renders exactly what the tile always rendered — no
 * overlay, not focusable, no handlers.
 *
 * Three ways to reveal it, each for a reason:
 * - hover, the ordinary desktop case (`group-hover`);
 * - keyboard focus: the tile becomes a tab stop, and the overlay follows
 *   `:focus-visible`, so a mouse click doesn't pin it open;
 * - touch: a tap toggles it. Mobile Safari applies neither :hover nor :focus
 *   reliably to a tapped non-button, so this one is state rather than CSS.
 *   pointerup rather than click, because a touch that becomes a scroll cancels
 *   the pointer and never fires it — scrolling past a tile can't open it.
 */
function FeaturedTileArt({
	item,
	tileAspectClass,
}: {
	item: FeaturedCard
	tileAspectClass: string
}) {
	const overlayId = useId()
	const [tapped, setTapped] = useState(false)
	const purpose = (item.purpose ?? "").trim()

	const recommendationBadge = item.recommendation && (
		<div className="absolute left-2 top-2 z-10 rounded border border-gray-600 bg-gray-700/95 px-2 py-1 text-xs font-semibold text-brand">
			{item.recommendation}
		</div>
	)
	const art = (
		<img
			src={item.image}
			alt={item.name}
			loading="lazy"
			decoding="async"
			className={`block h-auto w-full object-contain ${tileAspectClass}`}
		/>
	)

	if (!purpose) {
		return (
			<div className="relative shrink-0 overflow-hidden bg-gray-700">
				{recommendationBadge}
				{art}
			</div>
		)
	}

	return (
		<div
			role="group"
			aria-label={item.name}
			aria-describedby={overlayId}
			tabIndex={0}
			onPointerUp={(event) => {
				if (event.pointerType === "touch") setTapped((open) => !open)
			}}
			onBlur={() => setTapped(false)}
			// ring-inset: the tile clips its overflow, so an outset ring would be
			// shaved off at the rounded corners.
			className="group relative shrink-0 overflow-hidden bg-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
		>
			{recommendationBadge}
			{art}
			{/* Always in the DOM, faded out rather than unmounted, so a screen
			    reader gets the note through aria-describedby whether or not anyone
			    is hovering. White on a black scrim rather than theme tokens: it
			    sits on arbitrary card art — the same reasoning as
			    mobileBannerSelectStyles. */}
			<div
				id={overlayId}
				role="tooltip"
				className={`pointer-events-none absolute inset-0 z-20 flex items-end bg-gradient-to-t from-black/90 via-black/70 to-black/30 p-2 text-left text-xs font-medium leading-snug text-white transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none ${
					tapped ? "opacity-100" : "opacity-0"
				}`}
			>
				<p className="line-clamp-6 break-words">{purpose}</p>
			</div>
		</div>
	)
}

function getBannerCardStatus(
	hasBanner: boolean,
	expired: boolean,
	planned: boolean,
	staged: boolean
): BannerCardStatus {
	if (!hasBanner || expired) return "expired"
	if (planned) return "planned"
	if (staged) return "staged"
	return "available"
}

function getBannerStatusLabel(status: BannerCardStatus): string {
	if (status === "planned") return "Already in calculator"
	if (status === "staged") return "Already staged"
	if (status === "expired") return "Banner ended"
	return "Stage banner"
}

function getBannerStatusClasses(status: BannerCardStatus): string {
	if (status === "available") return "border-brand text-brand hover:bg-brand/10"
	if (status === "planned" || status === "staged") return "border-gray-600 text-gray-300"
	return "border-gray-600 text-gray-500"
}

type FeaturePanelProps = {
	icon: LucideIcon
	title: string
	/** Empty when the banner exists but has no cards linked yet. */
	items: FeaturedCard[]
	/** False when this window has no banner of this kind at all. */
	hasBanner: boolean
	emptyText: string
	/** Widest a tile grows to. Uma art is portrait and wider; support art is smaller. */
	tileWidthClass: string
	/**
	 * The tile art's intrinsic ratio, reserved before the image loads. Uma
	 * portraits are square (360×360) and support cards are 3:4 (450×600),
	 * uniformly, so this is a fact about the assets rather than a guess — see
	 * BANNER_ART for why every image in the timeline has to declare one.
	 */
	tileAspectClass: string
	/**
	 * Narrowest a tile shrinks to in a band before the line starts scrolling.
	 * Unused in column layout, where the two-across grid sets the width.
	 */
	bandMinWidthClass: string
	/** Band is one scrollable line at every width; column stays two-wide. */
	layout?: "column" | "band"
	status: BannerCardStatus
	actionIcon: LucideIcon
	onAdd: () => void
	/**
	 * The banner is editorially Recommended: the panel gets the SSR treatment
	 * (.ssr-panel in App.css) and a "Recommended" chip in its title line. Every
	 * part of that is zero-layout — see the note on .ssr-panel.
	 */
	recommended?: boolean
	/**
	 * Pulls the game hands out free on this banner (`free_pulls` on the
	 * BannerUma / BannerSupport, which the planner already subtracts from a
	 * row's pull count). Zero, the common case, renders nothing. Shown as a
	 * chip in the title line under the same zero-layout rule as `recommended`.
	 */
	freePulls?: number
}

function FeaturePanel({
	icon: Icon,
	title,
	items,
	hasBanner,
	emptyText,
	tileWidthClass,
	tileAspectClass,
	bandMinWidthClass,
	layout = "column",
	status,
	actionIcon: ActionIcon,
	onAdd,
	recommended = false,
	freePulls = 0,
}: FeaturePanelProps) {
	// Count drives the layout. A narrow column tops out at two tiles across and
	// grows downwards; a band is always exactly one line — see BAND_TILE.
	//
	// There is no row cap and no overflow clip on the cross axis, and that is
	// deliberate: the panel used to carry `grid-rows-1`, `xl:overflow-hidden` and
	// `xl:[contain:size]`, which pinned it to the banner art's height and
	// silently discarded every tile past the first row. On an eleven-uma revival
	// that meant showing two umas and hiding nine, with nothing on screen to say
	// so. A card that grows taller — or a line that scrolls — is the right trade.
	const isBand = layout === "band"

	// A band tile is narrower than a column tile, so its name gets a smaller
	// size and a third line. Both tiers were measured against real banners: at
	// 15px/two lines "Biwa Hayahide (Christmas)" and "(Mecha)" both truncated to
	// "Biwa Hayahide…" on a revival featuring both. The old third tier — 11px
	// with tighter tracking, for the launch banner's twenty support cards — is
	// gone with the squeeze that forced it; no band tile now renders below
	// `bandMinWidthClass`.
	const nameClass = isBand
		? "line-clamp-3 text-[0.8125rem]"
		: "line-clamp-2 text-[0.9375rem]"

	const tiles = items.map((item) => {
		const tile = (
			<div
				className={`flex h-full w-full min-w-0 flex-col overflow-hidden rounded-lg bg-gray-700 text-left shadow-sm ${tileWidthClass}`}
			>
				<FeaturedTileArt item={item} tileAspectClass={tileAspectClass} />
				<div className="flex min-h-16 flex-1 items-center justify-center p-2">
					<div
						className={`overflow-hidden break-words text-center font-semibold leading-tight text-gray-100 ${nameClass}`}
					>
						{item.name}
					</div>
				</div>
			</div>
		)

		// In a band the growth sits on a wrapper so the tile keeps its own cap and
		// stays centered in its share of the line; in a column the tile is the
		// grid cell itself.
		return isBand ? (
			<div key={item.id} className={`${BAND_TILE} ${bandMinWidthClass}`}>
				{tile}
			</div>
		) : (
			<div key={item.id} className="flex w-full min-w-0 justify-center">
				{tile}
			</div>
		)
	})

	// A recommended panel SWAPS its ordinary surface for the SSR one rather than
	// layering over it — see .ssr-panel in App.css. An ended banner keeps the foil
	// and loses the motion: still a record of a good pull, no longer something
	// to draw the eye to.
	const surfaceClass = recommended
		? `ssr-panel ${status === "expired" ? "ssr-panel--still" : ""}`
		: "border-gray-600 bg-gray-800 shadow-sm"

	// Whether anything shares the title line. Both chips are sized to the
	// title's 20px line box, so the line is exactly as tall with them as without.
	const hasChip = recommended || freePulls > 0

	return (
		<section className={`flex min-w-0 flex-col rounded-xl border px-1.5 py-1.5 ${surfaceClass}`}>
			{/* `@container` so the free-pulls chip can size itself to THIS line's
			    width rather than the viewport's — see its note below. Inline-size
			    containment only stops the line from ever pushing its column wider,
			    which nothing relied on: every column has an explicit minimum. */}
			<div
				className={`@container mb-1.5 flex shrink-0 items-center gap-2 text-sm font-semibold ${
					recommended ? "text-recommended" : "text-brand"
				}`}
			>
				<Icon className="h-4 w-4" />
				{/* With a chip to make room for, the title holds its width and the chip
				    gives way instead (its label truncates). A title wrapping onto a
				    second line would make the row taller, and nothing here may. */}
				<span className={hasChip ? "shrink-0 whitespace-nowrap" : undefined}>{title}</span>
				{recommended && (
					<span className="recommended-chip">
						<Star aria-hidden="true" fill="currentColor" className="h-3 w-3 shrink-0" />
						<span className="truncate">Recommended</span>
					</span>
				)}
				{/* The free-pulls chip never truncates ("10 fr…" says nothing); it
				    steps down instead, keyed to the title line's own width:
				      from 23rem   "[gift] 10 free pulls" — every band, every phone, an
				                   ordinary column from about 1440px up
				      from 16rem   "[gift] 10 free"       — an ordinary column at 1280px
				      below that   nothing                — the ~200px uma column beside
				                   a race-prep batch, where the title alone fills the line
				    The floor is deliberate: in that narrowest column even the
				    Recommended star has nowhere to go, and a chip poking out past the
				    panel's border is worse than one that steps aside. The word "pulls"
				    stays in the accessibility tree at every width. Trailing the
				    Recommended chip, which already carries the `margin-left: auto`
				    that pushes both to the right edge. */}
				{freePulls > 0 && (
					<span
						className={`free-pulls-chip hidden @min-[16rem]:inline-flex ${
							recommended ? "" : "ml-auto"
						}`}
						title={`${freePulls} free pulls on this banner`}
					>
						<Gift aria-hidden="true" className="h-3 w-3 shrink-0 text-brand" />
						<span>
							{freePulls} free
							<span className="sr-only @min-[23rem]:not-sr-only"> pulls</span>
						</span>
					</span>
				)}
			</div>
			{hasBanner ? (
				<div className="flex flex-1 flex-col gap-1.5">
					{isBand ? (
						// `pb-1` keeps the tiles' shadow out of the scroller's clip: setting
						// overflow-x to auto computes overflow-y to auto too, so a band with
						// no bottom padding shaves the shadow off every tile.
						<div className="flex-1 overflow-x-auto pb-1">
							{/* No `justify-*` on purpose. The tiles are flex-1 with the cap on
							    the inner tile, so the row always fills exactly and there is
							    never free space to distribute — while `justify-center` on a row
							    that DOES overflow strands its first tile off the left edge
							    where no amount of scrolling reaches it. */}
							<div className="flex items-stretch gap-1.5">{tiles}</div>
						</div>
					) : (
						<div
							className={`grid flex-1 content-center items-center gap-1.5 ${
								items.length === 1 ? "grid-cols-1" : "grid-cols-2"
							}`}
						>
							{tiles}
						</div>
					)}
					{/* Single shared action button — every featured card here belongs to the
					    same banner, so one full-width button drives the add for all of them. */}
					<button
						type="button"
						onClick={onAdd}
						disabled={status !== "available"}
						className={`flex shrink-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium leading-tight transition ${getBannerStatusClasses(status)} ${
							status === "available" ? "cursor-pointer" : "cursor-not-allowed"
						} ${
							// A solid backing on the SSR surface: the button's brand text is
							// measured against the card's gray-800, never against gold.
							recommended ? "bg-gray-800" : ""
						}`}
					>
						<ActionIcon className="h-3.5 w-3.5" />
						{getBannerStatusLabel(status)}
						{status === "available" && <ChevronRight className="h-3.5 w-3.5" />}
					</button>
				</div>
			) : (
				<div className="flex min-h-40 w-full flex-1 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 px-4 text-center text-sm text-gray-400">
					{emptyText}
				</div>
			)}
		</section>
	)
}

type BannerSectionProps = {
	banner: BannerTimelineForViewing
	/** True when this card carries more than one banner. */
	isGrouped: boolean
	/** The card header's window, so a section can flag its own if it differs. */
	groupEndDate: string
	today: Date
	plannedBannerKeys: Set<BannerKey>
	stagedBanners: UserPlannedBanner[]
	onAddBanner: (banner: BannerUma | BannerSupport, type: "Uma" | "Support") => void
}

function BannerSection({
	banner,
	isGrouped,
	groupEndDate,
	today,
	plannedBannerKeys,
	stagedBanners,
	onAddBanner,
}: BannerSectionProps) {
	const umaBanner = banner.banner_umas[0]
	const supportBanner = banner.banner_supports[0]

	const umaExpired = !umaBanner || new Date(banner.end_date) <= today
	const supportExpired = !supportBanner || new Date(banner.end_date) <= today
	const umaPlanned = umaBanner ? plannedBannerKeys.has(bannerKey("Uma", umaBanner.id)) : false
	const supportPlanned = supportBanner
		? plannedBannerKeys.has(bannerKey("Support", supportBanner.id))
		: false
	const umaStaged = umaBanner
		? stagedBanners.some((b) => b.banner_uma?.id === umaBanner.id)
		: false
	const supportStaged = supportBanner
		? stagedBanners.some((b) => b.banner_support?.id === supportBanner.id)
		: false

	// A grouped section states its own end date only when it actually differs
	// from the header's — otherwise it would just repeat the header. Real case:
	// the 2025 Golden Week revival runs nine days longer than the standard
	// banner sharing its start.
	const hasOwnWindow = isGrouped && banner.end_date !== groupEndDate
	const chrome = CATEGORY_CHROME[banner.banner_category]
	const ChipIcon = chrome?.icon

	// Whether this section abandons the image/uma/support columns for stacked
	// full-width bands.
	//
	// Driven by the CARD COUNT, not the category. A feature column is about
	// 260px — two tiles across — so a third card already means a second row, and
	// by nine it is a tower beside a mostly-empty card. The JP launch banner is
	// the case that forces this: nine umas AND twenty support cards, on a
	// `standard` row with no art, which no category could have flagged.
	//
	// The category flag still forces it, so a revival stays a band even if a
	// future one features only two umas.
	const umaCount = umaBanner?.umas.length ?? 0
	const supportCount = supportBanner?.support_cards.length ?? 0

	// BANDING IS PER PANEL. A panel bands only when its OWN cards overflow a
	// column — the other panel is unaffected and keeps its place beside the art.
	//
	// This was briefly a section-wide flag, which read plausibly and was wrong on
	// the commonest case we have: 22 of the 29 race-prep rows are one uma and ten
	// support cards WITH banner art, and banding the section threw the art onto
	// its own line and marooned the lone uma in a full-width band. Only the cards
	// that don't fit need the extra width.
	const umaBanded = !!umaBanner && (!!chrome?.band || umaCount > COLUMN_TILE_CAPACITY)
	const supportBanded =
		!!supportBanner && (!!chrome?.band || supportCount > COLUMN_TILE_CAPACITY)
	const hasBand = umaBanded || supportBanded

	// A panel keeps its column if it isn't banded — and, once anything IS banded,
	// only if it has a banner to show. That second clause is what stops a revival
	// (umas banded, no support banner at all) from spending a full-width row on an
	// empty "No support banner in this window." panel. With nothing banded the
	// empty states still render, because then they're the whole section.
	const umaInColumn = !umaBanded && (!!umaBanner || !hasBand)
	const supportInColumn = !supportBanded && (!!supportBanner || !hasBand)
	const columnPanelCount = (umaInColumn ? 1 : 0) + (supportInColumn ? 1 : 0)

	const umaPanel = (
		<FeaturePanel
			icon={Sparkles}
			title="Featured Umamusume"
			items={umaBanner?.umas ?? []}
			hasBanner={!!umaBanner}
			emptyText="No Umamusume banner in this window."
			tileWidthClass="max-w-[10rem] 2xl:max-w-[13.5rem]"
			tileAspectClass="aspect-square"
			// 7rem × 9 + gaps still fits the launch banner's umas on one unscrolled
			// line at 1150px, the narrowest desktop width worth optimising for.
			bandMinWidthClass="min-w-[7rem]"
			layout={umaBanded ? "band" : "column"}
			status={getBannerCardStatus(!!umaBanner, umaExpired, umaPlanned, umaStaged)}
			actionIcon={Star}
			onAdd={() => umaBanner && onAddBanner(umaBanner, "Uma")}
			// Per banner: the uma and support sides of a window are flagged
			// independently. `=== true` so a payload from before the field existed
			// reads as not recommended.
			recommended={umaBanner?.is_recommended === true}
			freePulls={umaBanner?.free_pulls ?? 0}
		/>
	)

	const supportPanel = (
		<FeaturePanel
			icon={Ticket}
			title="Featured Support Cards"
			items={supportBanner?.support_cards ?? []}
			hasBanner={!!supportBanner}
			emptyText="No support banner in this window."
			tileWidthClass="max-w-[7.75rem] 2xl:max-w-[9.5rem]"
			tileAspectClass="aspect-[3/4]"
			// A race-prep batch's ten cards fit unscrolled from about 1050px up.
			// The launch banner's twenty scroll on any realistic screen, which is
			// the intended outcome — 20 across a 1490px card is 68px a tile.
			bandMinWidthClass="min-w-[6rem]"
			layout={supportBanded ? "band" : "column"}
			status={getBannerCardStatus(
				!!supportBanner,
				supportExpired,
				supportPlanned,
				supportStaged
			)}
			actionIcon={Ticket}
			onAdd={() => supportBanner && onAddBanner(supportBanner, "Support")}
			recommended={supportBanner?.is_recommended === true}
			freePulls={supportBanner?.free_pulls ?? 0}
		/>
	)

	const header = (chrome || hasOwnWindow) && (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
			{chrome && ChipIcon && (
				<span className={`category-chip ${chrome.chipClass}`}>
					<ChipIcon className="h-3.5 w-3.5" />
					{chrome.label}
				</span>
			)}
			{hasOwnWindow && (
				<span className="text-sm font-medium text-gray-400">
					This banner ends {formatDate(banner.end_date)}
				</span>
			)}
		</div>
	)

	// Whether the art cell appears at all.
	//
	// A section with no bands always shows it, placeholder included — that is the
	// ordinary three-column banner, where the placeholder is a third of the row
	// and reads as "art pending". Once something has banded, a placeholder is
	// only ever filler: it would be 1030px of empty box beside a single uma tile,
	// with the real content already on the band below. So past that point the
	// cell needs actual art to earn its place.
	const showArt = !hasBand || !!banner.image

	// `columnPanelCount === 2` implies nothing banded (a banded panel is by
	// definition not in a column), so the three-column template is only ever
	// reached by the ordinary case and stays exactly as it was.
	const artRowColumns =
		columnPanelCount === 2
			? chrome?.supportLed
				? SECTION_COLUMNS_SUPPORT_LED
				: SECTION_COLUMNS
			: SECTION_COLUMNS_PAIR

	return (
		<div className={`flex flex-col ${hasBand ? "gap-3" : "gap-2"}`}>
			{header}

			{columnPanelCount > 0 &&
				(showArt ? (
					<div className={`grid gap-4 xl:items-stretch ${artRowColumns}`}>
						<div className="min-w-0">
							{banner.image ? (
								<img
									src={banner.image}
									alt={banner.name}
									loading="lazy"
									decoding="async"
									className={BANNER_ART}
								/>
							) : (
								<BannerArtPlaceholder />
							)}
						</div>

						{/* One panel left: it gets a half to itself and sits centred in
						    it, mirroring the art. Two panels means nothing banded, so
						    the ordinary three-column templates apply and each panel is
						    the grid item directly. */}
						{columnPanelCount === 1 ? (
							<div className={PAIR_PANEL_CELL}>
								{umaInColumn ? umaPanel : supportPanel}
							</div>
						) : (
							<>
								{umaInColumn && umaPanel}
								{supportInColumn && supportPanel}
							</>
						)}
					</div>
				) : (
					// No art and nothing to sit beside: the panel keeps its column
					// width rather than stretching across a row it is the only
					// occupant of. Wide enough for two tiles, which is the most a
					// column ever holds.
					<div className="w-full max-w-md">
						{umaInColumn && umaPanel}
						{supportInColumn && supportPanel}
					</div>
				))}

			{/* No column panel to sit beside, but art to show anyway: it sits above
			    the bands instead, centered because there is no column edge left to
			    align to. Reached by any row whose only banner is banded — a
			    support-only race-prep batch with art is the live case. */}
			{columnPanelCount === 0 && banner.image && (
				<img
					src={banner.image}
					alt={banner.name}
					loading="lazy"
					decoding="async"
					className={BANNER_ART_ALONE}
				/>
			)}

			{/* Bands stack below the art row, umas first — the primary axis of a
			    banner, and the order the panels sit in when both are columns. */}
			{umaBanded && umaPanel}
			{supportBanded && supportPanel}
		</div>
	)
}

type BannerWindowCardProps = {
	group: BannerWindowGroup
	today: Date
	plannedBannerKeys: Set<BannerKey>
	stagedBanners: UserPlannedBanner[]
	onAddBanner: (banner: BannerUma | BannerSupport, type: "Uma" | "Support") => void
} & TimelineFocusProps

export function BannerWindowCard({
	group,
	today,
	plannedBannerKeys,
	stagedBanners,
	onAddBanner,
	focusRef,
	isFocused = false,
}: BannerWindowCardProps) {
	const countdownLabel = getCountdownLabel(group.start_date, group.end_date, today)
	// A campaign strip sits flush above the card, so the card's own top corners
	// have to square off or the two render as separate boxes with a seam between.
	const attachedEvent = group.anniversary_event
	// A step-up attaches to the campaign PART it runs in, so at most one banner
	// in this group carries any — flattening is how the group reaches them
	// without BannerWindowGroup having to hoist a second field.
	const stepUps = group.banners.flatMap((banner) => banner.banner_step_ups ?? [])
	const isGrouped = group.banners.length > 1

	return (
		// The ref goes on the outer wrapper so scrolling accounts for the campaign
		// strip above the panel; the ring goes on the panel, which is the box a
		// reader recognises as "the card" and the only one with the right rounding.
		<div ref={focusRef} className={`my-3 w-full px-2 ${FOCUS_SCROLL_MARGIN}`}>
			{attachedEvent && (
				<AnniversaryEventStrip event={attachedEvent} stepUps={stepUps} />
			)}
			<div
				className={`card-panel w-full overflow-hidden p-2 sm:p-3 ${
					attachedEvent ? "card-panel-joined-top" : ""
				} ${isFocused ? TIMELINE_FOCUS_HIGHLIGHT : ""}`}
			>
				<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 text-brand">
							<CalendarDays className="h-5 w-5" />
						</div>
						<div className="min-w-0 text-xl font-semibold text-gray-100 sm:text-2xl">
							<div className="flex flex-wrap items-center gap-2">
								<span>
									{formatDate(group.start_date)} through {formatDate(group.end_date)}
								</span>
								{group.is_predicted && <PredictedBadge />}
							</div>
						</div>
					</div>
					<div className="flex w-fit items-center gap-2 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-sm font-semibold text-gray-100">
						<span>{countdownLabel}</span>
						<Clock3 className="h-4 w-4 text-brand" />
					</div>
				</div>

				{/* Sections are separated by a rule rather than nested panels: two
				    banners in one window are peers, and boxing each would add a
				    frame inside a frame. */}
				<div className="flex flex-col gap-4">
					{group.banners.map((banner, index) => (
						<div
							key={banner.id}
							className={index > 0 ? "border-t border-gray-700/70 pt-4" : undefined}
						>
							<BannerSection
								banner={banner}
								isGrouped={isGrouped}
								groupEndDate={group.end_date}
								today={today}
								plannedBannerKeys={plannedBannerKeys}
								stagedBanners={stagedBanners}
								onAddBanner={onAddBanner}
							/>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

export default BannerWindowCard
