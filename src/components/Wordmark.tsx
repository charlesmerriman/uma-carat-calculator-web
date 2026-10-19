import type React from "react"
import { Link } from "react-router-dom"

/**
 * The site's brand mark, as text rather than an image.
 *
 * Defined once and shared by every place the old logo PNG appeared (navbar,
 * sign-in card, OAuth callback card) so the brand text, colour split and
 * typeface only ever have to change in one file.
 *
 * Two variants, because the slots are shaped very differently:
 *  - "nav"  — sits in the navbar next to other controls. Wrapped in a link to
 *             the homepage, matching the old logo's behaviour.
 *
 *             In the phone bar (below `desktop-nav:`) it is "Uma Carat" alone,
 *             one 18px line, about as wide (~85px) as the two stacked 16px
 *             lines it replaced, which read cramped in a 56px bar beside three
 *             controls (design polish item 16). "Calculator" stays in the
 *             link's accessible name there (`sr-only`), so the link still
 *             announces the full brand.
 *
 *             The full single line (~208px vs the old logo's ~74px) waits for
 *             `desktop-nav:`, the navbar's own switch: below it the desktop
 *             row's `grid-cols-[1fr_auto_1fr]` cannot hold it beside the
 *             centre links, which collide while the auth button wraps.
 *  - "card" — the tall centred header strip on the auth cards. Always a
 *             stacked lockup, with "CALCULATOR" letter-spaced underneath.
 *
 * `font-display` resolves to the --font-display theme token (Outfit Variable,
 * bundled via @fontsource in main.tsx). Body text is untouched by this.
 */

type WordmarkProps = {
	size?: "nav" | "card"
}

export const Wordmark: React.FC<WordmarkProps> = ({ size = "nav" }) => {
	if (size === "card") {
		return (
			<div className="flex flex-col items-center gap-1.5 py-1 text-center select-none">
				<span className="font-display text-3xl leading-none font-semibold tracking-tight text-gray-100">
					<span className="text-brand">Uma</span> Carat
				</span>
				<span className="font-display text-xs leading-none font-medium tracking-[0.38em] text-gray-400 uppercase">
					{/* Trailing space offsets the last letter's tracking so the word
					    stays optically centred under "Uma Carat". */}
					Calculator{" "}
				</span>
			</div>
		)
	}

	return (
		<Link
			to="/"
			className="font-display flex items-baseline gap-[0.28em] whitespace-nowrap text-lg leading-none font-semibold tracking-tight text-gray-100 transition hover:text-white desktop-nav:text-xl"
		>
			<span>
				<span className="text-brand">Uma</span> Carat
			</span>
			{/* sr-only is absolutely positioned, so the hidden word takes no
			    gap in the flex row on a phone. */}
			<span className="sr-only desktop-nav:not-sr-only">Calculator</span>
		</Link>
	)
}
