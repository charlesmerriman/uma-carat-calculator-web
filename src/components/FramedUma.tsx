import type { PortraitLayers } from "../types/portraitLayers"

/**
 * An uma's borderless art inside the site's own frame: the silver frame for
 * every uma, the rainbow one for the person's favorites (useOshiIds).
 *
 * The game's card art bakes a rarity border into the picture, which left the
 * site no way to mark an uma itself. The borderless cut (the API's
 * `portrait`) plus a frame drawn here makes the frame ours. Used by the
 * calculator's rows, the Timeline's featured tiles, the Daily Legend Races
 * tab and the PvP gallery. A support card has its own twin, FramedCard, in
 * the guide's decks, the team builder and the Collection.
 *
 * LAYERED ART (notes/layered-uma-art-plan.md). With `layers` (the API's
 * `portrait_layers`) and the frame on, the uma is three layers: Daptrius's
 * base, the frame, then a foreground with whatever sticks out past the frame
 * (ears, hair, hats), drawn over it. The foreground reaches a sixth of the
 * tile above it and 16/360 to each side, outside this element's box, so the
 * layout never grows: the caller leaves the room (or doesn't, where an
 * overlap is fine). With no `layers`, or with the frame off, it draws `src`
 * exactly as before: the frameless places keep the borderless art (owner,
 * 2026-11-18).
 *
 * The frames are SVGs in src/assets, laid over the art by App.css
 * ("Uma frames"); `className` sizes the square. With no picture the frame
 * still draws, round a grey square. The frame is only a look: where being a
 * favorite matters to a screen reader, the caller says so beside the name.
 */

export function FramedUma({ src, layers, oshi = false, frame = true, edge, alt = "", title, className = "", onError, hover }: {
	/** The borderless art (`portrait`), falling back to the bordered `image`. */
	src: string | null | undefined
	/** The layered art (`portrait_layers`), drawn instead of `src` when the frame is on. */
	layers?: PortraitLayers | null
	oshi?: boolean
	/**
	 * False only where the owner has named an exception to the frame rule
	 * (CLAUDE.md, "Every uma the site draws is FramedUma"): the borderless art
	 * alone, same size and corner. Never false on a judgement of your own.
	 */
	frame?: boolean
	/**
	 * An edge in the site's colour round the tile, with this text as its label
	 * (the PvP guide's pick, "Recommended by the guide"). It is drawn INSIDE
	 * the frame's own stacking: over the frame, under the layered foreground,
	 * so her ears and hat stay in front of it. A ring laid over the tile from
	 * outside can only cover the foreground or hide behind the frame.
	 */
	edge?: string
	alt?: string
	title?: string
	className?: string
	/** The picture failed to load (Avatar swaps in its silhouette). */
	onError?: () => void
	/**
	 * Her card's attributes (utils/hoverCards.ts hoverCardProps), for a face
	 * that is plain art with no tile of its own to carry them: a click on it
	 * opens the card.
	 */
	hover?: Record<string, string>
}) {
	const layered = frame && layers ? layers : null
	// z-2 puts the edge over the frame (z-1 on layered art, unstacked
	// otherwise); the foreground is also z-2 but comes later, so it wins.
	// `isolate` keeps that z-index inside the tile on unlayered art too.
	const edgeMark = edge && (
		<span
			role="img"
			aria-label={edge}
			title={edge}
			className="pointer-events-none absolute inset-0 z-[2] rounded-[inherit] ring-[3px] ring-inset ring-brand"
		/>
	)
	return (
		<span
			className={`uma-frame ${frame ? "" : "uma-frame--bare"} ${layered ? "uma-frame--layered" : ""} ${edge ? "isolate" : ""} ${className}`}
			data-oshi={frame && oshi ? "" : undefined}
			title={title}
			{...hover}
		>
			{layered ? (
				<>
					<img src={layered.base} alt={alt} loading="lazy" decoding="async" onError={onError} />
					{edgeMark}
					{/* Decoration over the frame: the base above carries the alt text. */}
					<img className="uma-frame__over" src={layered.foreground} alt="" aria-hidden="true" loading="lazy" decoding="async" />
				</>
			) : (
				<>
					{src && <img src={src} alt={alt} loading="lazy" decoding="async" onError={onError} />}
					{edgeMark}
				</>
			)}
		</span>
	)
}
