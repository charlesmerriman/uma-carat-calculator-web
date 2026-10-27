/**
 * The pinned Rankings panel (notes/rankings-page-plan.md, owner
 * 2026-10-27): one Rankings tab kept beside the Calculator, Timeline, PvP
 * and every other /app page while browsing. Pinned from the Rankings page's
 * "Pin to the side"; state in services/rankingsPinStore.ts (the device).
 *
 * THREE STATES, AND THE SCREEN DECIDES THE REST
 *   unpinned            nothing
 *   pinned + docked     from xl (1280px): a 24rem column on the left, the
 *                       page beside it (narrower: the planner's banner table
 *                       turns to cards by its container query, which is the
 *                       point of it; never raise --container-banner-table)
 *   pinned + retracted  a slim "Rankings" tab on the left edge, the page at
 *                       full width; clicking it docks the panel again
 * Below xl the panel never docks: the edge tab opens a drawer over the page
 * (Escape, the backdrop or the close button put it away), starting closed.
 * CSS alone picks between them (`xl:`), so nothing measures the screen.
 *
 * Mounted in AppShell beside the scroller, behind the loading gate (the tabs
 * read the calculator's events), like the team window; never in Navbar. Not
 * drawn on the Rankings page itself, or without early access (a pin outlives
 * a lapsed pledge on the device and comes back with it).
 */

import { useCallback, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { ExternalLink, ListOrdered, PanelLeftClose, PinOff } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { dockRankings, pinRankings, useRankingsPin, type RankingsSection as Section } from "../../services/rankingsPinStore"
import { SideDrawer } from "../pvp/SidePanel"
import { RankingsSection } from "./RankingsSection"
import { parseSection, sectionHref, useVisibleSections } from "./sections"

const ICON_BUTTON =
	"flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
// The edge tab: a slim strip on the left, its label running up the side.
const EDGE_TAB =
	"fixed left-0 top-1/2 z-40 -translate-y-1/2 items-center gap-1.5 rounded-r-lg border border-l-0 border-brand/50 bg-gray-800 px-1.5 py-3 text-xs font-semibold text-brand shadow-lg transition hover:bg-gray-700 [writing-mode:vertical-rl]"

export function RankingsDock() {
	const { account } = useAccount()
	const pin = useRankingsPin()
	const shown = useVisibleSections()
	const { pathname } = useLocation()
	const [drawer, setDrawer] = useState(false)
	const closeDrawer = useCallback(() => setDrawer(false), [])

	const onRankings = pathname.replace(/\/+$/, "") === "/app/rankings"
	if (!account?.early_access || pin.section === null || onRankings) return null
	// A pin on a tab this reader can no longer open (Pull plans after the gate) shows the first tab.
	const section = parseSection(pin.section, shown)
	const label = shown.find((entry) => entry.id === section)?.label ?? "Rankings"
	const icon = <ListOrdered className="h-4 w-4 text-brand" />

	const controls = <PanelControls section={section} onNavigate={closeDrawer} />

	// The column stretches to the row's height: the shell's height on a desktop
	// (app-shell), where the page scrolls inside its own scroller. On a short
	// window the document scrolls instead, and sticky + max-h-dvh keep the
	// column in view, scrolling on its own.
	return (
		<>
			{pin.docked && (
				<aside
					aria-label={`Rankings: ${label}`}
					className="hidden w-96 shrink-0 flex-col border-r border-gray-700 bg-gray-900 xl:sticky xl:top-0 xl:flex xl:max-h-dvh"
				>
					<header className="flex items-center gap-1 border-b border-gray-700 py-1.5 pl-3 pr-1.5">
						<h2 className="mr-auto flex items-center gap-1.5 text-sm font-semibold text-gray-100">
							{icon}
							Rankings
						</h2>
						<button type="button" aria-label="Hide rankings" title="Hide rankings" onClick={() => dockRankings(false)} className={ICON_BUTTON}>
							<PanelLeftClose className="h-4 w-4" />
						</button>
					</header>
					<div className="min-h-0 flex-1 overflow-y-auto p-3">
						{controls}
						<RankingsSection section={section} inPanel />
					</div>
				</aside>
			)}
			{/* Below xl, always; from xl, only while retracted. */}
			<button type="button" onClick={() => setDrawer(true)} className={`${EDGE_TAB} flex xl:hidden`}>
				Rankings
			</button>
			{!pin.docked && (
				<button type="button" onClick={() => dockRankings(true)} className={`${EDGE_TAB} hidden xl:flex`}>
					Rankings
				</button>
			)}
			<SideDrawer side="left" title="Rankings" icon={icon} open={drawer} onClose={closeDrawer} width="w-[min(26rem,92vw)]">
				{controls}
				<RankingsSection section={section} inPanel />
			</SideDrawer>
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
