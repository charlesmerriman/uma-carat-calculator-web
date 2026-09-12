import { Link } from "react-router-dom"

/**
 * Compact, reusable site footer shown on every page.
 *
 * One line on desktop, wrapping to two or three on a phone (shrink-0 + small
 * padding/text) in every layout. Each layout gives
 * the region ABOVE this a `flex-1` so leftover viewport height collects there: on a
 * short page the footer sits at the bottom of the screen, and on a long one it is
 * pushed past the fold and scrolls away with the content. Slack must never land below
 * the footer — it shares bg-gray-900 with the page, so an empty strip underneath reads
 * as one enormous footer rather than as background.
 *
 * On the fixed-height app shell (`app-shell:h-dvh app-shell:overflow-hidden`) the footer therefore
 * lives inside the scroll container, not beside it — see ApplicationViews.
 *
 * Added per-layout rather than via a global wrapper: each route group sets its own
 * full height, so a single wrapper would double those heights and break the app's
 * no-scroll design. See the plan/CLAUDE.md for the rationale.
 */
export const Footer = () => {
	// Computed at render so the copyright year never goes stale.
	const year = new Date().getFullYear()

	return (
		<footer className="shrink-0 border-t border-gray-700 bg-gray-900 px-4 py-2 text-center text-xs text-gray-500">
			<div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
				<span>© {year} Uma Musume Carat Calculator</span>
				<span aria-hidden="true">·</span>
				<Link to="/about" className="text-gray-400 transition hover:text-brand">
					About
				</Link>
				<span aria-hidden="true">·</span>
				<Link to="/faq" className="text-gray-400 transition hover:text-brand">
					FAQ
				</Link>
				<span aria-hidden="true">·</span>
				<Link to="/guides/carat-income" className="text-gray-400 transition hover:text-brand">
					Carat Guide
				</Link>
				<span aria-hidden="true">·</span>
				<Link to="/changelog" className="text-gray-400 transition hover:text-brand">
					Changelog
				</Link>
				<span aria-hidden="true">·</span>
				<Link to="/feedback" className="text-gray-400 transition hover:text-brand">
					Feedback
				</Link>
				<span aria-hidden="true">·</span>
				<Link to="/privacy-policy" className="text-gray-400 transition hover:text-brand">
					Privacy Policy
				</Link>
				<span aria-hidden="true">·</span>
				<Link to="/terms" className="text-gray-400 transition hover:text-brand">
					Terms
				</Link>
				<span aria-hidden="true">·</span>
				{/* Plain anchor, not <Link>: react-router does not scroll to a hash on
				    navigation, whereas the browser does. From the home page this is a
				    same-document jump; from anywhere else it is a normal navigation
				    that lands on the anchor. */}
				<a href="/#supporters" className="text-gray-400 transition hover:text-brand">
					Supporters
				</a>
				<span aria-hidden="true">·</span>
				<a
					href="mailto:Henryhandsomederby@gmail.com"
					className="text-gray-400 transition hover:text-brand"
				>
					Contact
				</a>
			</div>
			<p className="mt-1 text-gray-600">
				Not affiliated with Cygames or Uma Musume Pretty Derby.
			</p>
		</footer>
	)
}
