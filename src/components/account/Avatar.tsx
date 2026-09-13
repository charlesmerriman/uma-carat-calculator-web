import { useState } from "react"
import type React from "react"
import { UserRound } from "lucide-react"

/**
 * The account's picture, or a generated stand-in when there is none.
 *
 * `src` is the provider avatar the server chose (types/account.ts) and may be
 * null. The fallback is derived from the account HANDLE, not from anything the
 * provider sent: a hue hashed from the handle and its first two characters, so
 * it is stable across sessions and themes and identifies nobody. With no handle
 * either (the account is still loading) it is a neutral silhouette.
 *
 * The hue is an inline `hsl()` rather than a theme token on purpose, like the
 * theme swatches in ThemePicker: it is an identity colour and should stay the
 * same under every palette.
 *
 * `onError` swaps a broken image for the fallback. Provider URLs do rot —
 * Google rotates picture URLs, Discord changes the hash when the user does —
 * and the server only refreshes ours on the next sign-in through that provider.
 *
 * `referrerPolicy="no-referrer"` matters twice: Google's image CDN refuses some
 * referrers outright, and there is no reason to tell a provider which page of
 * this site the person is looking at.
 *
 * No browser globals: this renders inside the navbar on every prerendered page.
 */

export type AvatarSize = "sm" | "lg"

const SIZE_CLASSES: Record<AvatarSize, string> = {
	sm: "h-8 w-8 text-[11px]",
	lg: "h-16 w-16 text-xl",
}

const ICON_CLASSES: Record<AvatarSize, string> = {
	sm: "h-4 w-4",
	lg: "h-8 w-8",
}

/** A stable 0–359 hue for a handle. Not cryptographic — it only picks a colour. */
function hueFor(name: string): number {
	let hash = 0
	for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
	return hash % 360
}

/** "user_a3f9c1" → "A3"; a staff handle such as "admin" → "AD". */
function initialsFor(name: string): string {
	const tail = name.startsWith("user_") ? name.slice("user_".length) : name
	return tail.slice(0, 2).toUpperCase()
}

interface AvatarProps {
	src: string | null | undefined
	/** The account handle, or "" while the account is still loading. */
	name: string
	size?: AvatarSize
	className?: string
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = "sm", className = "" }) => {
	const [failedSrc, setFailedSrc] = useState<string | null>(null)
	const base = `shrink-0 rounded-full ${SIZE_CLASSES[size]} ${className}`

	if (src && src !== failedSrc) {
		return (
			<img
				src={src}
				alt=""
				referrerPolicy="no-referrer"
				onError={() => setFailedSrc(src)}
				className={`${base} object-cover bg-gray-700`}
			/>
		)
	}

	if (!name) {
		return (
			<span aria-hidden="true" className={`${base} flex items-center justify-center bg-gray-700 text-gray-400`}>
				<UserRound className={ICON_CLASSES[size]} />
			</span>
		)
	}

	return (
		<span
			aria-hidden="true"
			className={`${base} flex items-center justify-center font-bold tracking-wide text-white`}
			style={{ backgroundColor: `hsl(${hueFor(name)} 45% 38%)` }}
		>
			{initialsFor(name)}
		</span>
	)
}
