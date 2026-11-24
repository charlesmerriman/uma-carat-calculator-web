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
import { useId, useState, type ReactNode } from "react"
import PredictedBadge from "../PredictedBadge"
import { bannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { formatDate } from "../../utils/dateFormat"
import { DateTimeRange } from "./DateTimeRange"
import { BannerArtPlaceholder } from "./BannerArtPlaceholder"
import { AnniversaryEventStrip } from "./AnniversaryEventStrip"
import { LegendRaceNote } from "./LegendRaceNote"
import { StoryEventStrip } from "./StoryEventStrip"
import { CopyTimelineLink } from "./CopyTimelineLink"
import type { DatedRelease } from "../../utils/dailyLegendRaces"
import type { StoryEvent } from "../../types"
import {
	CATEGORY_LABELS,
	TIMELINE_FOCUS_HIGHLIGHT,
	buildWindowSections,
	featuredTitle,
	getCountdownLabel,
} from "./timelineShared"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import type {
	BannerWindowGroup,
	BannerWindowSection,
	TimelineFocusProps,
} from "./timelineShared"
import type {
	BannerCategory,
	BannerSupport,
	BannerUma,
	UserPlannedBanner,
} from "../../types"
import { Link } from "react-router-dom"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"
import { cardHref, umaHref } from "../../utils/encyclopediaRoutes"

import { hoverCardProps } from "../../utils/hoverCards"
import type { PortraitLayers } from "../../types/portraitLayers"
import { FramedCard } from "../FramedCard"
import { cardFrameArt } from "../../utils/cardFrame"
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
	/** Defined in timeline.css against the --color-category-* theme tokens. */
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
 * WHERE THE LAYOUT IS: `src/timeline.css`, section 5.
 *
 * This file says WHICH shape a part has, as an attribute; the stylesheet says
 * what that shape is, and holds every width, track and cap in one place:
 *
 *   the section's row   `tl-row` + data-shape="three" | "support-led" | "pair"
 *   its art             `tl-art` + data-place="row" | "alone"
 *   a lone panel        `tl-pair-cell` + data-side, or `tl-lone-panel`
 *   a panel             `tl-panel` + data-kind, data-layout="column" | "band"
 *   its tiles           `tl-grid` / `tl-grid-cell`, or `tl-band` / `tl-band-row`
 *                       / `tl-band-cell`; the tile caps hang off the panel
 *
 * They are plain class names because Tailwind only generates a class it finds
 * spelled out in full: a width built from a shared constant silently produced
 * no CSS, and the grid fell back to one stacked column.
 */

/**
 * The fields a featured tile actually renders. Both Uma and SupportCard
 * satisfy this structurally, which is what lets the two panels share one
 * component instead of duplicating forty lines of near-identical JSX.
 */
type FeaturedCard = {
	id: number
	name: string
	image: string
	/** An uma's borderless art (the API's `portrait`); support cards have none. */
	portrait?: string | null
	/** A support card's FramedCard inputs (utils/cardFrame.ts); umas have none. */
	image_borderless?: string | null
	card_type?: string | null
	rarity?: number | null
	portrait_layers?: PortraitLayers | null
	recommendation: string
	/**
	 * The card's public one-liner, shown over its art on hover, focus or tap.
	 * Optional HERE only because a frontend deployed ahead of the backend can
	 * briefly receive cards without it; the API always sends a string.
	 */
	purpose?: string
	/**
	 * The key of its Encyclopedia page. Optional for the same reason as
	 * `purpose`; null for a card the game hasn't numbered (or a placeholder),
	 * and then the tile is not a link.
	 */
	game_id?: number | null
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
 *
 * A LINKED tile (its Encyclopedia page, FeaturedTile) hands all three to the
 * link around it: the link is the one tab stop and carries the `group` the
 * overlay's hover and focus classes answer to, and a tap follows the link
 * instead of toggling the note, the same call hoverPopup.tsx makes with
 * `tap: false`. So the art box here is plain: no tab stop, no handlers.
 */
function FeaturedTileArt({
	item,
	tileAspectClass,
	framed,
	oshi,
	linked,
	overlayId,
}: {
	item: FeaturedCard
	tileAspectClass: string
	/**
	 * An uma: the borderless art in the site's frame (FramedUma), flush with
	 * the tile's top and sides, so the frame IS the tile's edge there.
	 */
	framed: boolean
	/** One of the person's favorite umas: the rainbow frame. */
	oshi: boolean
	/** The tile is a link: it owns focus, hover and taps (see above). */
	linked: boolean
	/** The overlay's id, made by the tile so a link can point at it too. */
	overlayId: string
}) {
	const [tapped, setTapped] = useState(false)
	const purpose = (item.purpose ?? "").trim()

	const recommendationBadge = item.recommendation && (
		<div className="absolute left-2 top-2 z-10 rounded border border-gray-600 bg-gray-700/95 px-2 py-1 text-xs font-semibold text-brand">
			{item.recommendation}
		</div>
	)
	const art = framed ? (
		<FramedUma src={item.portrait ?? item.image} layers={item.portrait_layers} alt={item.name} oshi={oshi} className="w-full" hover={linked ? undefined : hoverCardProps("uma", item.id)} />
	) : (
		// Only the uma panel is framed in FramedUma, so this art is a support
		// card: the game's art in its own frame (FramedCard). A linked tile
		// carries the card on its link instead (FeaturedTile).
		<FramedCard
			card={cardFrameArt(item)}
			alt={item.name}
			className={`w-full ${tileAspectClass}`}
			hover={linked ? undefined : hoverCardProps("card", item.id)}
		/>
	)

	// The art's box is rounded to the art's own corner, so the purpose scrim
	// stops where the art does, and has no fill of its own: the tile's colour
	// would otherwise show past the art's round top corners. An uma's corner is
	// her frame's (App.css "Uma frames"); a support card's is its frame's
	// (FramedCard), about 8.3% of the width by 6.25% of the height. Underneath,
	// the skirt fills the art's lower half with the tile's colour, so its round
	// bottom corners meet the name block without a notch.
	const surface = framed ? "rounded-[10.75%]" : "rounded-[8.3%_/_6.25%]"
	// NEITHER box clips. A framed uma's layered art reaches past her frame, and
	// a support card's type icon sits in the very corner of its frame: clipped
	// to the old picture's rounded corner, the curve cut the icon off (the
	// owner, 2026-11-23, on the live Timeline). Each frame draws its own
	// corners, and the overlay rounds itself instead (rounded-[inherit]).
	const withSkirt = (box: ReactNode) => (
		<div className="relative shrink-0">
			<div aria-hidden="true" className="tl-plate-skirt absolute inset-x-0 bottom-0 h-1/2 bg-gray-700" />
			{box}
		</div>
	)

	if (!purpose) {
		return withSkirt(
			<div className={`relative shrink-0 ${surface}`}>
				{recommendationBadge}
				{art}
			</div>
		)
	}

	// Always in the DOM, faded out rather than unmounted, so a screen reader
	// gets the note through aria-describedby whether or not anyone is hovering.
	// White on a black scrim rather than theme tokens: it sits on arbitrary
	// card art — the same reasoning as mobileBannerSelectStyles.
	const overlay = (
		<div
			id={overlayId}
			role="tooltip"
			className={`pointer-events-none absolute inset-0 z-20 flex items-end rounded-[inherit] bg-gradient-to-t from-black/90 via-black/70 to-black/30 p-2 text-left text-xs font-medium leading-snug text-white transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none ${
				tapped ? "opacity-100" : "opacity-0"
			}`}
		>
			<p className="line-clamp-6 break-words">{purpose}</p>
		</div>
	)

	if (linked) {
		return withSkirt(
			<div className={`relative shrink-0 ${surface}`}>
				{recommendationBadge}
				{art}
				{overlay}
			</div>
		)
	}

	return withSkirt(
		<div
			role="group"
			aria-label={item.name}
			aria-describedby={overlayId}
			tabIndex={0}
			onPointerUp={(event) => {
				if (event.pointerType === "touch") setTapped((open) => !open)
			}}
			onBlur={() => setTapped(false)}
			// ring-inset: the ring sits inside the tile's rounded edge, over the art.
			className={`group relative shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${surface}`}
		>
			{recommendationBadge}
			{art}
			{overlay}
		</div>
	)
}

/**
 * Where a name too long for one line of a tile may break. Two names are one
 * 18-letter word, "Matikanetannhauser" and "Matikanefukukitaru": the longest
 * the game allows, too wide for a support tile at any readable size, so the
 * browser broke them wherever the edge fell ("Matikanetan / nhauser";
 * Daptrius, board "Timeline, Support Card, Longest Name Fix", 2026-11-17).
 * Each is "Matikane" and a name, so a soft hyphen there lets the word break
 * at that seam ("Matikane- / tannhauser") and only when it has to. Checked
 * 2026-11-17: no other uma or card name has a word over 12 letters.
 */
const NAME_SEAMS = ["Matikane"]
function withSeams(name: string): string {
	return NAME_SEAMS.reduce((text, seam) => text.replace(new RegExp(`\\b${seam}(?=\\p{L}{4})`, "gu"), `${seam}\u00AD`), name)
}

/**
 * One featured tile: the art (with its purpose note) over the name block.
 *
 * With `href` the whole tile is a link to the card's Encyclopedia page:
 * every tile whose uma or card has a game id (FeaturePanel decides).
 */
function FeaturedTile({
	item,
	href,
	tileAspectClass,
	nameClass,
	framed,
	oshi,
}: {
	item: FeaturedCard
	href: string | null
	tileAspectClass: string
	nameClass: string
	framed: boolean
	oshi: boolean
}) {
	const overlayId = useId()
	const hasPurpose = Boolean((item.purpose ?? "").trim())

	const body = (
		<>
			{/* The layered art's ears, a sixth of the tile above her frame
			    (FramedUma), land in this strip instead of being cut off. */}
			{framed && item.portrait_layers && <div aria-hidden="true" className="aspect-[6/1] w-full shrink-0" />}
			<FeaturedTileArt
				item={item}
				tileAspectClass={tileAspectClass}
				framed={framed}
				oshi={oshi}
				linked={href !== null}
				overlayId={overlayId}
			/>
			{/* No minimum height: it used to reserve two lines (min-h-16) so
			    neighbours matched, which left a one-line name floating in empty
			    space. The grid's items-stretch keeps neighbours level now. */}
			<div className="tl-plate flex flex-1 items-center justify-center rounded-b-lg bg-gray-700 p-2">
				<div
					className={`overflow-hidden break-words text-center font-semibold leading-tight text-gray-100 ${href ? "transition-colors group-hover:text-brand motion-reduce:transition-none" : ""} ${nameClass}`}
				>
					{withSeams(item.name)}
				</div>
			</div>
		</>
	)

	// No fill or shadow of its own: either would show past the art's round top
	// corners (FeaturedTileArt). The name block carries the tile's colour instead.
	// The tile never clips: a layered uma's side accessories (16/360 of the
	// tile, Daptrius's wide canvas) would be shaved off, and a support card's
	// type icon sits flush in its frame's top right corner, where this tile's
	// 8px curve cut it off (the owner, 2026-11-23, on the live Timeline). Each
	// frame draws its own corners; the name block rounds the bottom ones.
	// How wide it may grow is the panel's to say (timeline.css, "Tile caps").
	const tileClass = "tl-tile flex h-full w-full min-w-0 flex-col rounded-lg text-left"

	if (!href) return <div className={tileClass}>{body}</div>

	// `group` is what the purpose overlay and the name's hover colour answer
	// to. The focus mark is an INSET outline: a band scrolls, so an outset
	// ring would be shaved off at its edges.
	// The name comes from aria-label, so the art's alt, the hidden note and
	// the name block aren't all read as one long link name; the note is read
	// as its description instead.
	return (
		<Link
			to={href}
			// A mouse click anywhere on the tile opens the uma's or the card's
			// card, whose "Open Encyclopedia" goes on to this link's page.
			{...hoverCardProps(framed ? "uma" : "card", item.id)}
			aria-label={item.name}
			aria-describedby={hasPurpose ? overlayId : undefined}
			className={`group ${tileClass} outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand`}
		>
			{body}
		</Link>
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
	/** Which banner this panel holds: written to `data-kind`, for themes (timeline.css). */
	kind: "uma" | "support"
	/** Uma tiles: drawn in the site's frame (FramedUma). Support art keeps its own. */
	framed?: boolean
	emptyText: string
	/**
	 * The tile art's intrinsic ratio, reserved before the image loads. Uma
	 * portraits are square (360×360) and support cards are 3:4 (450×600),
	 * uniformly, so this is a fact about the assets rather than a guess — see
	 * `.tl-art` in timeline.css for why every image in the timeline declares one.
	 */
	tileAspectClass: string
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
	/**
	 * A tile's Encyclopedia address from its game id: `umaHref` or `cardHref`.
	 * The panel knows which it holds, so no tile has to guess from its shape.
	 */
	pageHref: (gameId: number) => string
}

function FeaturePanel({
	icon: Icon,
	title,
	items,
	pageHref,
	hasBanner,
	kind,
	framed = false,
	emptyText,
	tileAspectClass,
	layout = "column",
	status,
	actionIcon: ActionIcon,
	onAdd,
	recommended = false,
	freePulls = 0,
}: FeaturePanelProps) {
	// Count drives the layout. A narrow column tops out at two tiles across and
	// grows downwards; a band is always exactly one line — see `.tl-band` in
	// timeline.css.
	//
	// There is no row cap and no overflow clip on the cross axis, and that is
	// deliberate: the panel used to carry `grid-rows-1`, `xl:overflow-hidden` and
	// `xl:[contain:size]`, which pinned it to the banner art's height and
	// silently discarded every tile past the first row. On an eleven-uma revival
	// that meant showing two umas and hiding nine, with nothing on screen to say
	// so. A card that grows taller — or a line that scrolls — is the right trade.
	const isBand = layout === "band"
	const oshiIds = useOshiIds()

	// A band tile is narrower than a column tile, so its name gets a smaller
	// size and a third line. Both tiers were measured against real banners: at
	// 15px/two lines "Biwa Hayahide (Christmas)" and "(Mecha)" both truncated to
	// "Biwa Hayahide…" on a revival featuring both. The old third tier — 11px
	// with tighter tracking, for the launch banner's twenty support cards — is
	// gone with the squeeze that forced it; no band tile now renders below its
	// minimum (`--tl-*-band-min`).
	const nameClass = isBand
		? "line-clamp-3 text-[0.8125rem]"
		: "line-clamp-2 text-[0.9375rem]"

	const tiles = items.map((item) => {
		const tile = (
			<FeaturedTile
				item={item}
				href={item.game_id ? pageHref(item.game_id) : null}
				tileAspectClass={tileAspectClass}
				nameClass={nameClass}
				framed={framed}
				oshi={framed && oshiIds.has(item.id)}
			/>
		)

		// In a band the growth sits on a wrapper so the tile keeps its own cap and
		// stays centered in its share of the line; in a column the tile is the
		// grid cell itself.
		return (
			<div key={item.id} className={isBand ? "tl-band-cell" : "tl-grid-cell"}>
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
		: "card-panel"

	// Whether anything shares the title line. Both chips are sized to the
	// title's 20px line box, so the line is exactly as tall with them as without.
	const hasChip = recommended || freePulls > 0

	return (
		<section data-kind={kind} data-layout={layout} className={`tl-panel flex min-w-0 flex-col rounded-xl border px-1.5 py-1.5 ${surfaceClass}`}>
			{/* `@container` so the free-pulls chip can size itself to THIS line's
			    width rather than the viewport's — see its note below. Inline-size
			    containment only stops the line from ever pushing its column wider,
			    which nothing relied on: every column has an explicit minimum. */}
			<div
				className={`tl-panel-title @container mb-1.5 flex shrink-0 items-center gap-2 text-sm font-semibold ${
					recommended ? "text-recommended" : "text-brand"
				}`}
			>
				<Icon className="h-4 w-4 shrink-0" />
				{/* With a chip to make room for, the title holds its width and the chip
				    gives way instead (its label truncates). A title wrapping onto a
				    second line would make the row taller, and nothing here may. */}
				<span className={hasChip ? "shrink-0 whitespace-nowrap" : undefined}>{title}</span>
				{/* Neither chip ever truncates ("Rec…" and "10 fr…" say nothing). They
				    step down instead, keyed to the title line's own width, and the
				    ladder is measured, not guessed: icon + title is 213px for the wider
				    title, the free-pulls chip is about 59 / 99 / 144px for "120",
				    "120 free" and "120 free pulls" at the title's 14px, the gold pill is
				    28px as a star and 104px with its word, and every gap is 8px.

				      free pulls alone          with Recommended
				      from 18rem  "[gift] 50"   from 18rem  "[gift] 50", no gold pill
				      from 20rem  "50 free"     from 20rem  star + "50"
				      from 23rem  "50 free      from 23rem  star + "50 free"
				                   pulls"       from 26rem  star + "50 free pulls"
				                                from 30rem  "Recommended" + "50 free pulls"
				      below 18rem nothing: the ~200px uma column beside a race-prep
				                  batch, where the title alone fills the line

				    When something has to give, the gold pill goes before the number
				    does: the foil panel and the gold title already say "recommended",
				    and nothing else says how many pulls are free. Both words stay in
				    the accessibility tree at every width. Recommended with no free
				    pulls keeps its word and truncates as it always has. */}
				{recommended && (
					<span
						className={`recommended-chip ${freePulls > 0 ? "hidden @min-[20rem]:inline-flex" : "inline-flex"}`}
						title="Recommended"
					>
						<Star aria-hidden="true" fill="currentColor" className="h-3 w-3 shrink-0" />
						<span className={freePulls > 0 ? "sr-only @min-[30rem]:not-sr-only" : "truncate"}>
							Recommended
						</span>
					</span>
				)}
				{freePulls > 0 && (
					<span
						// The gold pill carries the `margin-left: auto` that pushes both
						// chips right; wherever it is absent or hidden, this one must.
						className={`free-pulls-chip hidden @min-[18rem]:inline-flex ${
							recommended ? "@max-[20rem]:ml-auto" : "ml-auto"
						}`}
						title={`${freePulls} free pulls on this banner`}
					>
						<Gift aria-hidden="true" className="h-3 w-3 shrink-0 text-brand" />
						<span>
							{freePulls}
							<span
								className={
									recommended
										? "sr-only @min-[23rem]:not-sr-only"
										: "sr-only @min-[20rem]:not-sr-only"
								}
							>
								{" "}
								free
							</span>
							<span
								className={
									recommended
										? "sr-only @min-[26rem]:not-sr-only"
										: "sr-only @min-[23rem]:not-sr-only"
								}
							>
								{" "}
								pulls
							</span>
						</span>
					</span>
				)}
			</div>
			{hasBanner ? (
				<div className="flex flex-1 flex-col gap-1.5">
					{isBand ? (
						// One scrollable line: `.tl-band` in timeline.css.
						<div className="tl-band">
							<div className="tl-band-row">{tiles}</div>
						</div>
					) : (
						// Two across, or one alone: `.tl-grid` in timeline.css.
						<div className="tl-grid" data-columns={items.length === 1 ? 1 : 2}>
							{tiles}
						</div>
					)}
					{/* Single shared action button — every featured card here belongs to the
					    same banner, so one full-width button drives the add for all of them. */}
					<button
						type="button"
						onClick={onAdd}
						disabled={status !== "available"}
						data-status={status}
						className={`tl-stage flex shrink-0 items-center justify-center gap-2 rounded-md border px-2 py-2 text-xs font-medium leading-tight transition ${getBannerStatusClasses(status)} ${
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
	section: BannerWindowSection
	/** True when this card carries more than one banner. */
	isGrouped: boolean
	/** The card header's window, so a section can flag its own if it differs. */
	groupStartDate: string
	groupEndDate: string
	today: Date
	plannedBannerKeys: Set<BannerKey>
	stagedBanners: UserPlannedBanner[]
	onAddBanner: (banner: BannerUma | BannerSupport, type: "Uma" | "Support") => void
}

function BannerSection({
	section,
	isGrouped,
	groupStartDate,
	groupEndDate,
	today,
	plannedBannerKeys,
	stagedBanners,
	onAddBanner,
}: BannerSectionProps) {
	// Each panel reads from its OWN row. They are the same row on every section
	// but a fused one — the two halves of a staggered release, see
	// buildWindowSections — where the dates below genuinely differ per panel.
	const { primary: banner, umaWindow, supportWindow } = section
	const umaBanner = umaWindow.banner_umas[0]
	const supportBanner = supportWindow.banner_supports[0]

	const umaExpired = !umaBanner || new Date(umaWindow.end_date) <= today
	const supportExpired = !supportBanner || new Date(supportWindow.end_date) <= today
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
	//
	// A staggered group adds the other way to differ: a banner that opens later
	// than the card does. Then the line gives the whole range, because "ends"
	// alone would still imply it is open from the header's first day.
	const opensLater = isGrouped && banner.start_date !== groupStartDate
	// A staggered section stays quiet here: one line could only describe one of
	// its two halves, so the card header carries both (see staggerNotes).
	const hasOwnWindow =
		isGrouped &&
		!section.isStaggered &&
		(opensLater || banner.end_date !== groupEndDate)
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
	// empty "No Support Banner" panel. With nothing banded the
	// empty states still render, because then they're the whole section.
	const umaInColumn = !umaBanded && (!!umaBanner || !hasBand)
	const supportInColumn = !supportBanded && (!!supportBanner || !hasBand)
	const columnPanelCount = (umaInColumn ? 1 : 0) + (supportInColumn ? 1 : 0)

	const umaPanel = (
		<FeaturePanel
			icon={Sparkles}
			kind="uma"
			title="Featured Umamusume"
			items={umaBanner?.umas ?? []}
			pageHref={umaHref}
			hasBanner={!!umaBanner}
			framed
			emptyText="No Umamusume banner"
			tileAspectClass="aspect-square"
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
			kind="support"
			title="Featured Support Cards"
			items={supportBanner?.support_cards ?? []}
			pageHref={cardHref}
			hasBanner={!!supportBanner}
			emptyText="No Support Banner"
			tileAspectClass="aspect-[3/4]"
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
					{opensLater
						? `This banner runs ${formatDate(banner.start_date)} through ${formatDate(banner.end_date)}`
						: `This banner ends ${formatDate(banner.end_date)}`}
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
	const showArt = !hasBand || !!section.image

	// `columnPanelCount === 2` implies nothing banded (a banded panel is by
	// definition not in a column), so the three-column template is only ever
	// reached by the ordinary case and stays exactly as it was.
	const rowShape = columnPanelCount === 2 ? (chrome?.supportLed ? "support-led" : "three") : "pair"

	return (
		<div className={`flex flex-col ${hasBand ? "gap-3" : "gap-2"}`}>
			{header}

			{columnPanelCount > 0 &&
				(showArt ? (
					// art | panels. What each shape is, and what it does below xl:
					// `.tl-row` in timeline.css.
					<div className="tl-row" data-shape={rowShape}>
						<div className="tl-row-art">
							{section.image ? (
								<img
									src={section.image}
									alt={banner.name}
									loading="lazy"
									decoding="async"
									className="tl-art"
									data-place="row"
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
							<div className="tl-pair-cell" data-side={umaInColumn ? "left" : "right"}>
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
					<div className="tl-lone-panel" data-shape="panel-only">
						{umaInColumn && umaPanel}
						{supportInColumn && supportPanel}
					</div>
				))}

			{/* No column panel to sit beside, but art to show anyway: it sits above
			    the bands instead, centered because there is no column edge left to
			    align to. Reached by any row whose only banner is banded — a
			    support-only race-prep batch with art is the live case. */}
			{columnPanelCount === 0 && section.image && (
				<img
					src={section.image}
					alt={banner.name}
					loading="lazy"
					decoding="async"
					className="tl-art"
					data-place="alone"
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
	/** Daily legend race batches arriving with a banner in this window. */
	legendRaces?: DatedRelease[]
	/** Story events running with a banner in this window: the row beneath the card. */
	storyEvents?: StoryEvent[]
} & TimelineFocusProps

export function BannerWindowCard({
	group,
	today,
	plannedBannerKeys,
	stagedBanners,
	onAddBanner,
	legendRaces = [],
	storyEvents = [],
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
	// Usually one section per banner. The two halves of a staggered release
	// fuse into one — see buildWindowSections.
	const sections = buildWindowSections(group.banners)
	// Every section's names, both halves of a fused one included, so a
	// staggered release is titled by the pair.
	const title = featuredTitle(
		sections.flatMap((section) => section.umaWindow.banner_umas.flatMap((b) => b.umas.map((uma) => uma.name))),
		sections.flatMap((section) =>
			section.supportWindow.banner_supports.flatMap((b) => b.support_cards.map((card) => card.name))
		)
	)

	// How each side of a staggered release differs from the window in the
	// header, e.g. "Support banner starts 2026/10/27". A side that matches the
	// header says nothing.
	//
	// These live in the HEADER, and nowhere inside a section, on purpose. A line
	// inside a feature panel makes the panel taller, the art row stretches to
	// match, and the banner art grows with it. The header is outside that row, so
	// nothing here can change the size of the art or the panels.
	//
	// Drawn as a QUIET alert pill beside the countdown: an amber outline and an
	// amber icon around ordinary text. Enough to say "the header's range is not
	// the whole truth for this side" without outshouting the countdown. A filled
	// amber pill with a warning triangle was tried and was too loud. The icon is
	// the panel's own, so the pill points at the side it is about. The amber is
	// the staging token, already tuned per theme (see --color-staging in
	// index.css), so it never blends into a gold brand.
	const staggerNotes = sections.flatMap((section) => {
		if (!section.isStaggered) return []
		const sides = [
			{ label: "Umamusume banner", icon: Sparkles, row: section.umaWindow },
			{ label: "Support banner", icon: Ticket, row: section.supportWindow },
		]
		return sides.flatMap(({ label, icon, row }) => {
			const opensLater = row.start_date !== group.start_date
			const endsEarlier = row.end_date !== group.end_date
			const text =
				opensLater && endsEarlier
					? `${label} runs ${formatDate(row.start_date)} through ${formatDate(row.end_date)}`
					: opensLater ? `${label} starts ${formatDate(row.start_date)}`
						: endsEarlier ? `${label} ends ${formatDate(row.end_date)}`
							: null
			return text ? [{ text, icon }] : []
		})
	})

	return (
		// The ref goes on the outer wrapper so scrolling accounts for the campaign
		// strip above the panel; the ring goes on the panel, which is the box a
		// reader recognises as "the card" and the only one with the right rounding.
		<div ref={focusRef} className={`my-3 w-full px-2 ${FOCUS_SCROLL_MARGIN}`}>
			{attachedEvent && (
				<AnniversaryEventStrip event={attachedEvent} stepUps={stepUps} />
			)}
			<div
				className={`tl-card card-panel @container w-full overflow-hidden p-2 sm:p-3 ${
					attachedEvent ? "rounded-t-none" : ""
				} ${storyEvents.length > 0 ? "rounded-b-none" : ""} ${isFocused ? TIMELINE_FOCUS_HIGHLIGHT : ""}`}
			>
				<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-center gap-3">
						<div className="tl-icon-box flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 text-brand">
							<CalendarDays className="h-5 w-5" />
						</div>
						{title ? (
							// Names lead, dates follow (design polish item 20). The date
							// range stays one element with the same text, which is what
							// the Timeline tests find a card by.
							<div className="min-w-0">
								<h3 className="tl-title text-lg leading-snug font-semibold text-balance text-gray-100 sm:text-xl">{title}</h3>
								<div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-gray-400">
									<span>
										<DateTimeRange start={group.start_date} end={group.end_date} />
									</span>
									{group.is_predicted && <PredictedBadge />}
								</div>
							</div>
						) : (
							<div className="tl-title min-w-0 text-xl font-semibold text-gray-100 sm:text-2xl">
								<div className="flex flex-wrap items-center gap-2">
									<span>
										<DateTimeRange start={group.start_date} end={group.end_date} />
									</span>
									{group.is_predicted && <PredictedBadge />}
								</div>
							</div>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{legendRaces.map((release) => (
							<LegendRaceNote
								key={release.id}
								release={release}
								windowStartDate={group.start_date}
								now={today}
							/>
						))}
						{staggerNotes.map(({ text, icon: NoteIcon }) => (
							<div
								key={text}
								role="note"
								className="tl-pill flex w-fit items-center gap-2 rounded-full border border-staging/40 px-3 py-1 text-sm font-medium text-gray-200"
							>
								<NoteIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-staging" />
								<span>{text}</span>
							</div>
						))}
						{/* By the first banner: a window is found by ANY of its banners
						    (rowMatchesFocus), so any one of them names the card. */}
						<CopyTimelineLink
							focus={{ kind: "banner", id: group.banners[0].id }}
							name={title || `the banners from ${formatDate(group.start_date)}`}
						/>
						<div className="tl-pill tl-countdown flex w-fit items-center gap-2 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-sm font-semibold text-gray-100">
							<span>{countdownLabel}</span>
							<Clock3 className="h-4 w-4 text-brand" />
						</div>
					</div>
				</div>

				{/* Sections are separated by a rule rather than nested panels: two
				    banners in one window are peers, and boxing each would add a
				    frame inside a frame. */}
				<div className="flex flex-col gap-4">
					{sections.map((section, index) => (
						<div
							key={section.primary.id}
							className={index > 0 ? "border-t border-gray-700/70 pt-4" : undefined}
						>
							<BannerSection
								section={section}
								isGrouped={isGrouped}
								groupStartDate={group.start_date}
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
			{/* Flush beneath the panel, outside it, so the art row above can't grow. */}
			{storyEvents.length > 0 && <StoryEventStrip events={storyEvents} />}
		</div>
	)
}
