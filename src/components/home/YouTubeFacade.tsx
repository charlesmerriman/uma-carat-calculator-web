import type React from "react"
import { useState } from "react"
import { Play } from "lucide-react"

/**
 * A click-to-play stand-in for a YouTube embed.
 *
 * A plain <iframe src="youtube.com/embed/..."> loads YouTube's player, its
 * scripts and its cookies for every visitor the moment the homepage paints,
 * whether or not they ever press play. That is a third-party cookie set without
 * consent, and it is the heaviest thing on the page. This renders a local
 * thumbnail with a play button instead, and only swaps in the real player when
 * the visitor asks for it. Until that click nothing on this page talks to
 * Google at all.
 *
 * The player that loads is youtube-nocookie.com, YouTube's privacy-enhanced
 * mode: it does not set advertising cookies on the visitor's device before
 * playback starts. Autoplay is on because the visitor has just clicked play; a
 * second click would be a defect.
 *
 * `thumbnailSrc` is a file in public/, NOT i.ytimg.com, so the thumbnail request
 * never reaches Google either. Changing the featured video means replacing that
 * file (640x360 JPEG from https://i.ytimg.com/vi/<id>/maxresdefault.jpg).
 *
 * Safe to prerender: the initial render is a static <button> and <img>, and
 * `useState` is the only browser-side state. The iframe exists only after a
 * click, so it never appears in the prerendered HTML.
 */
type Props = {
	videoId: string
	title: string
	thumbnailSrc: string
}

export const YouTubeFacade: React.FC<Props> = ({ videoId, title, thumbnailSrc }) => {
	const [isPlaying, setIsPlaying] = useState(false)

	if (isPlaying) {
		return (
			<iframe
				className="h-full w-full"
				src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
				title={title}
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				allowFullScreen
			/>
		)
	}

	return (
		<button
			type="button"
			onClick={() => setIsPlaying(true)}
			aria-label={`Play: ${title}`}
			className="group relative block h-full w-full cursor-pointer"
		>
			<img
				src={thumbnailSrc}
				alt=""
				width={640}
				height={360}
				loading="lazy"
				className="h-full w-full object-cover"
			/>
			{/* YouTube's red, same as the channel chip above it: this button hands
			    the visitor to YouTube, and the colour says so. */}
			<span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/15">
				<span className="flex h-14 w-20 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg transition group-hover:brightness-110">
					<Play className="h-7 w-7 fill-current" aria-hidden="true" />
				</span>
			</span>
			<span className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-1.5 text-left text-xs text-gray-300">
				Plays on YouTube. Nothing loads from YouTube until you press play.
			</span>
		</button>
	)
}
