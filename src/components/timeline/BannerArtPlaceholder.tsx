import { ImageOff } from "lucide-react"

/**
 * Stand-in for a card's missing art.
 *
 * Banner and event art is uploaded per row and is often absent for far-future,
 * still-predicted entries. Render this rather than letting the browser show a
 * broken-image glyph for an empty `image`.
 *
 * It holds the SAME 16:9 box a real image reserves (see BANNER_ART in
 * BannerWindowCard), not a min-height of its own. A stand-in that is a
 * different height from the thing it stands in for still moves the page when
 * the art finally arrives — which is the whole failure this box exists to
 * prevent.
 */
export function BannerArtPlaceholder({ className = "" }: { className?: string }) {
	return (
		<div
			className={`flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border border-gray-600 bg-gray-800 p-4 text-center text-sm text-gray-400 ${className}`}
		>
			<ImageOff className="h-6 w-6" />
			<span>Banner art coming soon</span>
		</div>
	)
}
