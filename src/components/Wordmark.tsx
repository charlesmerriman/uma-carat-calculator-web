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
 *  - "nav"  — sits in a 56px-tall bar next to other controls, so it stacks onto
 *             two lines and only unfolds to a single line from `lg` up. Wrapped
 *             in a link to the homepage, matching the old logo's behaviour.
 *
 *             The breakpoint is `lg`, not `md` where the desktop nav begins:
 *             in app mode that nav carries three centre links plus save/theme/
 *             settings/auth controls, and the single-line wordmark (~208px vs
 *             the old logo's ~74px) overflows the `grid-cols-[1fr_auto_1fr]`
 *             row between 768px and ~900px — the centre links collide and the
 *             auth button wraps to three lines. Stacked it is ~85px, narrower
 *             than the image it replaced, so it fits everywhere the logo did.
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
			className="font-display flex flex-col leading-none font-semibold tracking-tight text-gray-100 transition hover:text-white lg:flex-row lg:gap-[0.28em]"
		>
			<span className="text-base lg:text-xl">
				<span className="text-brand">Uma</span> Carat
			</span>
			<span className="text-base lg:text-xl">Calculator</span>
		</Link>
	)
}
