/**
 * An uma's borderless art inside the site's own frame: the silver frame for
 * every uma, the rainbow one for the person's favorites (useOshiIds).
 *
 * The game's card art bakes a rarity border into the picture, which left the
 * site no way to mark an uma itself. The borderless cut (the API's
 * `portrait`) plus a frame drawn here makes the frame ours. Used by the
 * calculator's rows, the Timeline's featured tiles, the Daily Legend Races
 * tab and the PvP gallery. Support cards keep their own art: there is no
 * borderless set for them.
 *
 * The frames are SVGs in src/assets, laid over the art by App.css
 * ("Uma frames"); `className` sizes the square. With no picture the frame
 * still draws, round a grey square. The frame is only a look: where being a
 * favorite matters to a screen reader, the caller says so beside the name.
 */

export function FramedUma({ src, oshi = false, frame = true, alt = "", title, className = "", onError }: {
	/** The borderless art (`portrait`), falling back to the bordered `image`. */
	src: string | null | undefined
	oshi?: boolean
	/**
	 * False only where the owner has named an exception to the frame rule
	 * (CLAUDE.md, "Every uma the site draws is FramedUma"): the borderless art
	 * alone, same size and corner. Never false on a judgement of your own.
	 */
	frame?: boolean
	alt?: string
	title?: string
	className?: string
	/** The picture failed to load (Avatar swaps in its silhouette). */
	onError?: () => void
}) {
	return (
		<span className={`uma-frame ${frame ? "" : "uma-frame--bare"} ${className}`} data-oshi={frame && oshi ? "" : undefined} title={title}>
			{src && <img src={src} alt={alt} loading="lazy" decoding="async" onError={onError} />}
		</span>
	)
}
