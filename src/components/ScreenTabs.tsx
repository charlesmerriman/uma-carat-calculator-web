/**
 * A screen's own bar: the pages that share one place in the navbar, as tabs
 * under it. The Calculator screen got the first one (Calculator, Selectors,
 * the Pull Plan Library; owner, 2026-11-24, after Henry's board post "Sub tab
 * for Community Pull Plans" asked for it to look and work like the PvP page's
 * tabs and stay on top while scrolling). The Timeline screen got the second
 * (Timeline, Legend Races; notes/navigation-plan.md, PR 3), which is when the
 * markup moved here: two screens drawing the same bar from two copies would
 * have drifted within a week.
 *
 * A screen brings its list (carat-calculator/calculatorTabs.ts,
 * timeline/timelineTabs.ts) and a one-line wrapper that picks who sees what.
 * A third screen is a list and a wrapper, never a third copy of this.
 *
 * WHY LINKS, NOT A TABLIST. These are pages with their own addresses (the
 * Encyclopedia's tabs are the same), so they are NavLinks in a <nav> with
 * aria-current. The PvP row is buttons on one page's `?view=`; only its look
 * is borrowed here.
 *
 * WHERE IT MOUNTS. AppShell draws a screen's bar above the loading gate, so it
 * is in the build-time render of the screen's pages and never jumps in after
 * the payload lands. So a wrapper may read only what is safe there: the
 * pathname and the account (unknown at build time and while it loads, so a
 * gated tab joins after load, and the bar's height never changes).
 *
 * STICKY. Two scrolling set-ups (ApplicationViews, the scroller's comment):
 * on a phone the document scrolls under the sticky navbar, so the bar sticks
 * at the navbar's measured height (--navbar-h, hooks/useNavbarHeight.ts; the
 * written-down figure only for the first paint), plus the phone's wordmark
 * row while it is shown (--navbar-reveal, hooks/useNavbarReveal.ts); in the
 * desktop shell the
 * page scrolls inside its own box with the navbar outside it, so the bar
 * sticks at that box's top. Opaque, or the page shows through.
 *
 * ITS HEIGHT IS --screen-tabs-h (index.css), and three things read it besides
 * the bar: the scroll padding that lands a deep link below the bar instead of
 * under it (keyed off `data-screen-tabs`), and any band a page pins beneath
 * it (the Timeline's controls). Change the bar's height there, never here.
 */

import { NavLink } from "react-router-dom"
import type { LucideIcon } from "lucide-react"

export interface ScreenTab {
	/** The route, which is also how the bar knows which page is open. */
	to: string
	label: string
	/** What a phone shows when the full label won't fit; the full one stays its name. */
	short?: string
	icon: LucideIcon
}

// Literal strings so Tailwind sees them. One equal column per tab at EVERY
// width, so the tabs share the bar's whole width the way the Rankings and PvP
// rows do (owner, 2026-11-24: not bunched at the left on a desktop).
const GRID_COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }

export function ScreenTabs({ label, tabs }: {
	/** The screen's name, which is the <nav>'s accessible name. */
	label: string
	tabs: readonly ScreenTab[]
}) {
	return (
		<div data-screen-tabs="" className="sticky top-[calc(var(--navbar-h,4.125rem)_+_var(--navbar-reveal,0px))] z-30 bg-gray-900 app-shell:top-0">
			<nav
				aria-label={label}
				className={`mx-auto grid h-(--screen-tabs-h) w-[calc(100%-1rem)] max-w-[96rem] gap-1 border-b border-gray-700 sm:w-[calc(100%-2rem)] ${GRID_COLUMNS[tabs.length] ?? "grid-cols-3"}`}
			>
				{tabs.map((tab) => (
					<NavLink
						key={tab.to}
						to={tab.to}
						// A screen's first page is often a prefix of the others ("/app"),
						// and would otherwise light up on every page under it.
						end
						className={({ isActive }) =>
							`-mb-px flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-sm font-semibold transition sm:px-4 ${
								isActive
									? "border-brand text-brand"
									: "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-100"
							}`
						}
					>
						<tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
						{tab.short ? (
							<>
								<span className="sm:hidden" aria-hidden="true">
									{tab.short}
								</span>
								<span className="sr-only sm:not-sr-only">{tab.label}</span>
							</>
						) : (
							<span className="truncate">{tab.label}</span>
						)}
					</NavLink>
				))}
			</nav>
		</div>
	)
}
