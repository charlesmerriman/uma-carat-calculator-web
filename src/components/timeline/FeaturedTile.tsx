import { useId, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { FramedUma } from "../FramedUma"
import { FramedCard } from "../FramedCard"
import { cardFrameArt } from "../../utils/cardFrame"
import { hoverCardProps } from "../../utils/hoverCards"
import type { PortraitLayers } from "../../types/portraitLayers"

/**
 * One featured uma or support card on a banner card: the art over its name.
 *
 * The geometry (how wide a tile may grow) is the panel's to say, in
 * `src/timeline.css`. Three things here are load-bearing and easy to break:
 *
 *   - The art and the name are ONE plane. The skirt behind the art's lower
 *     half and the name block share one fill (`tl-plate-skirt`, `tl-plate`),
 *     so the picture's round bottom corners run into the name with no notch.
 *   - Nothing clips. A layered uma's ears and hat reach past her frame and
 *     past the tile; a support card's type icon sits in its frame's corner.
 *   - A linked tile owns focus, hover and taps for everything inside it.
 */

/**
 * The fields a featured tile actually renders. Both Uma and SupportCard
 * satisfy this structurally, which is what lets the two panels share one
 * component instead of duplicating forty lines of near-identical JSX.
 */
export type FeaturedCard = {
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
export function FeaturedTile({
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
