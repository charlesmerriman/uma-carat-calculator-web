import type React from "react"

/**
 * The site's one loading indicator: a derpy Oguri Cap head, spinning.
 *
 * Every "something is in flight" state used to draw its own CSS ring
 * (`animate-spin rounded-full border-4 border-t-brand`) inline — five copies
 * across the page loaders, plus a lucide `Loader2` in the timeline and the
 * static `Save` icon in the navbar's pending-save button. One component means
 * the image, the sizes and the motion rule only ever change here.
 *
 * Served from `public/` by root-absolute path, the same convention the game
 * resource icons follow (see ui-conventions.md, "Column labels may be icons").
 * The PNG is a 256px square with a transparent background, cropped tight to the
 * head (the ear tips lose ~6% a side) so it fills its box instead of floating
 * in transparent bands, and centred so it rotates about its own middle.
 *
 * Two sizes because the slots are shaped very differently:
 *  - "sm" — 32px, for inside a 36px control: the navbar save button and the
 *           timeline's "Loading more events" row. The flat-cut bottom of the
 *           hair puts the farthest opaque pixel ~0.6 of the side from centre
 *           (measured), so while spinning the head sweeps a ~38px circle —
 *           1px past the 36px button on the worst frames. Fine because the
 *           save button has no border to cross and nothing clips it.
 *  - "lg" — 80px, the page-level loader (calculator gate, changelog, account,
 *           OAuth callback).
 *
 * Always decorative: `alt=""` + `aria-hidden` so screen readers skip the image
 * itself. The CALLER owns the accessible loading state — a `role="status"`
 * wrapper with visible or `sr-only` text — because the wording differs per slot.
 *
 * `animate-spin-slow` is our own `@theme` token in index.css (one turn per 2s on
 * Tailwind's stock `spin` keyframes) — the 1s default turned the face into a
 * blur. `motion-reduce:animate-none` honours the OS "reduce motion" setting; a
 * perpetually spinning face is exactly the kind of animation it exists for.
 */

type OguriSpinnerProps = {
	size?: "sm" | "lg"
	/** Extra utilities for the slot (margins, colour of nothing — the image is opaque). */
	className?: string
}

const SIZE_CLASS: Record<NonNullable<OguriSpinnerProps["size"]>, string> = {
	sm: "h-8 w-8",
	lg: "h-20 w-20",
}

export const OguriSpinner: React.FC<OguriSpinnerProps> = ({ size = "lg", className = "" }) => (
	<img
		src="/oguri-spinner.png"
		alt=""
		aria-hidden="true"
		draggable={false}
		className={`${SIZE_CLASS[size]} shrink-0 select-none animate-spin-slow motion-reduce:animate-none ${className}`.trim()}
	/>
)
