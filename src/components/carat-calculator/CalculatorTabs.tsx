/**
 * The Calculator screen's own bar: Calculator, Selectors and the Pull Plan
 * Library (owner, 2026-11-24; Henry's board post "Sub tab for Community Pull
 * Plans" asked for it to look and work like the PvP page's tabs and to stay
 * on top while scrolling). It replaces the Library button that sat in the
 * Plans bar and the navbar's Selectors tab.
 *
 * WHY LINKS, NOT A TABLIST. These are three pages with their own addresses
 * (the Encyclopedia's tabs are the same), so they are NavLinks in a <nav>
 * with aria-current. The PvP row is buttons on one page's `?view=`; only its
 * look is borrowed here.
 *
 * WHERE IT MOUNTS. AppShell draws it above the loading gate, so it is in the
 * build-time render of /app and /app/selectors and never jumps in after the
 * payload lands. It reads only the pathname and the account, both safe there:
 * the account is unknown at build time and while it loads, so the Library tab
 * (early access) joins after load, and the bar's height never changes.
 *
 * STICKY. Two scrolling set-ups (ApplicationViews, the scroller's comment):
 * on a phone the document scrolls under the sticky navbar, so the bar sticks
 * at the navbar's measured height (--navbar-h, hooks/useNavbarHeight.ts; the
 * written-down figure only for the first paint); in the desktop shell the
 * page scrolls inside its own box with the navbar outside it, so the bar
 * sticks at that box's top. Opaque, or the page shows through.
 */

import { NavLink } from "react-router-dom"
import { Calculator as CalculatorIcon, Sparkles, Users, type LucideIcon } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { calculatorTabsFor, type CalculatorTab } from "./calculatorTabs"

const ICONS: Record<CalculatorTab["to"], LucideIcon> = {
	"/app": CalculatorIcon,
	"/app/selectors": Sparkles,
	"/app/plans": Users,
}

// Literal strings so Tailwind sees them. One equal column per tab at EVERY
// width, so the tabs share the bar's whole width the way the Rankings and PvP
// rows do (owner, 2026-11-24: not bunched at the left on a desktop).
const GRID_COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3" }

export function CalculatorTabs() {
	const { account } = useAccount()
	const tabs = calculatorTabsFor({ earlyAccess: Boolean(account?.early_access) })
	return (
		<div className="sticky top-(--navbar-h,7.75rem) z-30 bg-gray-900 app-shell:top-0">
			<nav
				aria-label="Calculator"
				className={`mx-auto grid w-[calc(100%-1rem)] max-w-[96rem] gap-1 border-b border-gray-700 sm:w-[calc(100%-2rem)] ${GRID_COLUMNS[tabs.length] ?? "grid-cols-3"}`}
			>
				{tabs.map((tab) => {
					const Icon = ICONS[tab.to]
					return (
						<NavLink
							key={tab.to}
							to={tab.to}
							// "/app" would otherwise light up on every page under it.
							end
							className={({ isActive }) =>
								`-mb-px flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-sm font-semibold transition sm:px-4 ${
									isActive
										? "border-brand text-brand"
										: "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-100"
								}`
							}
						>
							<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
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
					)
				})}
			</nav>
		</div>
	)
}
