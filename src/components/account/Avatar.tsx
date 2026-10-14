import { useState } from "react"
import type React from "react"
import { UserRound } from "lucide-react"
import { FramedUma } from "../FramedUma"

/**
 * The account's picture, or the quiet default when there is none.
 *
 * `src` is the picture the server chose (types/account.ts: the first of the
 * favourite umas the person picked) and is null until they pick one. The
 * default is a muted silhouette on a dark rounded square, styled like the
 * settings and theme icon buttons beside it in the navbar so it reads as one
 * more control rather than as something missing. It is the same for everyone
 * and for the loading state, deliberately: the avatar is only ever shown to
 * its owner, so nothing is gained by making two empty accounts look
 * different, and the initials-on-a-hue circle this replaced (2026-09-13) was
 * loud in a bar that is otherwise grey.
 *
 * SQUARE, NOT ROUND (2026-10-07). The art is a square card portrait, and a
 * circle cropped the corners off every uma. The radius scales with the size
 * so the navbar pill (navStyles.NAV_PROFILE_TRIGGER, `rounded-lg`) wraps the
 * `md` one with an even border.
 *
 * `onError` swaps a broken image for the default, in case an editor removes a
 * uma's art between the account loading and the image request.
 *
 * FRAMED (2026-10-14). The picture is an uma, and every uma on the site is
 * drawn in the site's frame (FramedUma): `oshi` asks for the rainbow one,
 * which the caller sets when the picture is the viewer's own favourite (their
 * own avatar, their own gallery posts). `framed={false}` is for the owner's
 * named exceptions only: the navbar's profile menu and the account page's
 * header show the borderless art with no frame. The silhouette has no frame:
 * it is not an uma.
 *
 * No browser globals: this renders inside the navbar on every prerendered page.
 */

/** sm: menu rows and inline use. md: the navbar trigger. lg: the account page header. */
export type AvatarSize = "sm" | "md" | "lg"

const SIZE_CLASSES: Record<AvatarSize, string> = {
	sm: "h-8 w-8 rounded-md text-[11px]",
	md: "h-9 w-9 rounded-md text-xs",
	lg: "h-16 w-16 rounded-lg text-xl",
}

const ICON_CLASSES: Record<AvatarSize, string> = {
	sm: "h-4 w-4",
	md: "h-4.5 w-4.5",
	lg: "h-8 w-8",
}

/** The framed picture's width per size; the frame keeps it square. */
const FRAME_WIDTHS: Record<AvatarSize, string> = {
	sm: "w-8",
	md: "w-9",
	lg: "w-16",
}

interface AvatarProps {
	src: string | null | undefined
	size?: AvatarSize
	/** The picture is the viewer's own favourite: the rainbow frame. */
	oshi?: boolean
	/** False only for the owner's named exceptions (navbar profile, account header). */
	framed?: boolean
	className?: string
}

export const Avatar: React.FC<AvatarProps> = ({ src, size = "sm", oshi = false, framed = true, className = "" }) => {
	const [failedSrc, setFailedSrc] = useState<string | null>(null)
	const base = `shrink-0 ${SIZE_CLASSES[size]} ${className}`

	if (src && src !== failedSrc) {
		return (
			<FramedUma
				src={src}
				oshi={oshi}
				frame={framed}
				onError={() => setFailedSrc(src)}
				className={`${FRAME_WIDTHS[size]} ${className}`}
			/>
		)
	}

	return (
		<span aria-hidden="true" className={`${base} flex items-center justify-center bg-gray-700 text-gray-400`}>
			<UserRound className={ICON_CLASSES[size]} />
		</span>
	)
}
