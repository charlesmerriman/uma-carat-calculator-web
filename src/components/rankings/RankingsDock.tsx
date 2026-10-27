/**
 * The pinned Rankings panel (notes/rankings-page-plan.md, owner
 * 2026-10-27): one Rankings tab kept on screen while browsing the
 * Calculator, Timeline, PvP and every other /app page. Pinned from the
 * Rankings page's "Pin to the side"; state in services/rankingsPinStore.ts
 * (the device).
 *
 * A WINDOW OVER THE PAGE, NEVER BESIDE IT: the team window's mirror
 * (pvp/TeamDrawer.tsx), floating on the LEFT, centred on the space below the
 * navbar, sized to its contents up to the screen. The page keeps its full
 * width behind it (owner, 2026-10-27: a first version docked as a column and
 * pushed the site aside, as the team window once did). Not a dialog: no
 * backdrop, no focus trap, the page behind stays usable.
 *
 * THREE STATES
 *   unpinned            nothing
 *   pinned + open       the window
 *   pinned + retracted  a slim "Rankings" tab on the left edge; clicking it
 *                       opens the window again
 * The open state is remembered from desktop-nav (1024px) up. Below that the
 * window covers the top of the screen, so it always starts retracted and
 * opens only from the edge tab. CSS picks between the two (`desktop-nav:`),
 * so nothing measures the screen. The close button and Escape retract it.
 *
 * Mounted in AppShell after the scroller, behind the loading gate (the tabs
 * read the calculator's events), like the team window; never in Navbar. Not
 * drawn on the Rankings page itself, or without early access (a pin outlives
 * a lapsed pledge on the device and comes back with it).
 */

import { useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ExternalLink, ListOrdered, PinOff, X } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { dockRankings, pinRankings, useRankingsPin, type RankingsSection as Section } from "../../services/rankingsPinStore"
import { RankingsSection } from "./RankingsSection"
import { parseSection, sectionHref, useVisibleSections } from "./sections"

// The edge tab: a slim strip on the left, its label running up the side.
const EDGE_TAB =
	"fixed left-0 top-1/2 z-40 -translate-y-1/2 items-center rounded-r-lg border border-l-0 border-brand/50 bg-gray-800 px-1.5 py-3 text-xs font-semibold text-brand shadow-lg transition hover:bg-gray-700 [writing-mode:vertical-rl]"

export function RankingsDock() {
	const { account } = useAccount()
	const pin = useRankingsPin()
	const shown = useVisibleSections()
	const { pathname } = useLocation()
	const reduceMotion = useReducedMotion()
	const windowRef = useRef<HTMLElement>(null)
	// Below desktop-nav only: whether the window is open. Starts closed each load.
	const [phoneOpen, setPhoneOpen] = useState(false)

	const onRankings = pathname.replace(/\/+$/, "") === "/app/rankings"
	if (!account?.early_access || pin.section === null || onRankings) return null
	// A pin on a tab this reader can no longer open (Pull plans after the gate) shows the first tab.
	const section = parseSection(pin.section, shown)
	const label = shown.find((entry) => entry.id === section)?.label ?? "Rankings"

	const open = () => {
		setPhoneOpen(true)
		dockRankings(true)
	}
	const close = () => {
		setPhoneOpen(false)
		dockRankings(false)
	}
	// Literal class names per state, so Tailwind sees every one.
	const windowShown = `${phoneOpen ? "flex" : "hidden"} ${pin.docked ? "desktop-nav:flex" : "desktop-nav:hidden"}`
	const tabShown = `${phoneOpen ? "hidden" : "flex"} ${pin.docked ? "desktop-nav:hidden" : "desktop-nav:flex"}`

	return (
		<>
			<button type="button" onClick={open} className={`${EDGE_TAB} ${tabShown}`}>
				Rankings
			</button>
			<AnimatePresence initial={false}>
				{(phoneOpen || pin.docked) && (
					<motion.aside
						key="rankings-window"
						ref={windowRef}
						aria-label={`Rankings: ${label}`}
						initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
						animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
						exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
						transition={{ duration: 0.16, ease: "easeOut" }}
						onKeyDown={(keydown) => {
							// Only Escapes from inside the window itself.
							if (keydown.key === "Escape" && windowRef.current?.contains(keydown.target as Node)) close()
						}}
						// The team window's classes, mirrored to the left and a little
						// wider (the guide tables need it).
						className={`fixed inset-x-2 top-2 z-50 max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-xl border border-edge bg-gray-900 shadow-2xl desktop-nav:inset-auto desktop-nav:left-4 desktop-nav:top-[calc(50%+2rem)] desktop-nav:z-40 desktop-nav:max-h-[calc(100dvh-7rem)] desktop-nav:w-[26rem] desktop-nav:-translate-y-1/2 ${windowShown}`}
					>
						<header className="flex items-center gap-2 border-b border-gray-700 px-3 py-2">
							<h2 className="flex flex-1 items-center gap-1.5 text-sm font-semibold text-gray-100">
								<ListOrdered className="h-4 w-4 text-brand" aria-hidden="true" />
								Rankings
							</h2>
							<button
								type="button"
								aria-label="Hide rankings"
								title="Hide rankings"
								onClick={close}
								className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
							>
								<X className="h-4 w-4" />
							</button>
						</header>
						<div className="min-h-0 flex-1 overflow-y-auto p-3">
							<PanelControls section={section} onNavigate={() => setPhoneOpen(false)} />
							<RankingsSection section={section} inPanel />
						</div>
					</motion.aside>
				)}
			</AnimatePresence>
		</>
	)
}

/** The section menu, "Full page" and "Unpin", above the pinned tab. */
function PanelControls({ section, onNavigate }: { section: Section; onNavigate: () => void }) {
	const shown = useVisibleSections()
	return (
		<div className="mb-3 flex flex-wrap items-center gap-2">
			<select
				aria-label="Rankings section"
				value={section}
				onChange={(change) => pinRankings(change.target.value as Section)}
				className="min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 focus:border-brand focus:outline-none"
			>
				{shown.map((entry) => (
					<option key={entry.id} value={entry.id}>
						{entry.label}
					</option>
				))}
			</select>
			<Link to={sectionHref(section)} onClick={onNavigate} className="flex items-center gap-1 text-xs text-brand transition hover:text-brand/75">
				<ExternalLink className="h-3.5 w-3.5" />
				Full page
			</Link>
			<button type="button" onClick={() => pinRankings(null)} className="flex items-center gap-1 text-xs text-gray-400 transition hover:text-gray-100">
				<PinOff className="h-3.5 w-3.5" />
				Unpin
			</button>
		</div>
	)
}
