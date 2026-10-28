/**
 * The pinned Rankings window (notes/rankings-page-plan.md, owner
 * 2026-10-27; redrawn in notes/rankings-redesign-plan.md step 3, mocks 12
 * to 16 and 23): one Rankings list kept on screen while browsing the
 * Calculator, Timeline, PvP and every other /app page. Pinned from the
 * Rankings page's "Pin to the side"; state in services/rankingsPinStore.ts
 * (the device).
 *
 * A WINDOW OVER THE PAGE, NEVER BESIDE IT: floating on the LEFT, the team
 * window's mirror (pvp/TeamDrawer.tsx), 23rem wide and never taller than its
 * ten rows. The page keeps its full width behind it (owner, 2026-10-27: a
 * first version docked as a column and pushed the site aside). Not a dialog:
 * no backdrop, no focus trap, the page behind stays usable.
 *
 * ITS OWN DESIGN, NOT THE TAB: four icon tabs in the header (one per section
 * the reader may open), a context line ("Guides · Overall · all 51 guides")
 * with "Change" for the one or two settings that change the list, a search
 * (Guides and PvP), the top ten as compact rows, "Full page" in the footer.
 * The list comes from WindowSources.tsx; the settings are the page's
 * remembered choices, so the full page opens on what the window showed.
 *
 * THREE STATES
 *   unpinned            nothing
 *   pinned + open       the window
 *   pinned + retracted  the edge tab in the BOTTOM-LEFT corner on every width
 *                       (owner decision 6: the one place no page puts text):
 *                       the section's icon, a count of how many of the top
 *                       ten moved since the window last showed them (a device
 *                       memory, rankingsPinStore `seen`), and from desktop-nav
 *                       up the list's short name. Clicking it opens the window.
 * The open state is remembered from desktop-nav (1024px) up. Below that the
 * window would cover the screen, so it starts retracted every load and opens
 * from the edge tab as a drawer. CSS picks between the two (`desktop-nav:`),
 * so nothing measures the screen. Retract and Escape close it.
 *
 * Mounted in AppShell after the scroller, behind the loading gate (the lists
 * read the calculator's events), like the team window; never in Navbar. Not
 * drawn on the Rankings page itself, or without early access (a pin outlives
 * a lapsed pledge on the device and comes back with it).
 */

import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ExternalLink, Loader2, PinOff, Search, X } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { dockRankings, markRankingsSeen, pinRankings, useRankingsPin, useRankingsSeen } from "../../services/rankingsPinStore"
import { movedCount } from "../../utils/rankingsWindow"
import { Lens } from "./kit/Lens"
import { RankRow } from "./kit/RankRow"
import { parseSection, sectionHref, useVisibleSections, type SectionEntry } from "./sections"
import { WindowSource, type WindowList } from "./WindowSources"

/** Rows the window shows, and the edge tab watches. */
const TOP = 10

export function RankingsDock() {
	const { account } = useAccount()
	const pin = useRankingsPin()
	const shown = useVisibleSections()
	const { pathname } = useLocation()

	const onRankings = pathname.replace(/\/+$/, "") === "/app/rankings"
	if (!account?.early_access || pin.section === null || onRankings) return null
	// A pin on a tab this reader can no longer open (Pull plans after the gate) shows the first tab.
	const section = parseSection(pin.section, shown)
	const entry = shown.find((candidate) => candidate.id === section) ?? shown[0]
	return <WindowSource section={section}>{(list) => <Dock entry={entry} shown={shown} docked={pin.docked} list={list} />}</WindowSource>
}

function Dock({ entry, shown, docked, list }: { entry: SectionEntry; shown: SectionEntry[]; docked: boolean; list: WindowList }) {
	const reduceMotion = useReducedMotion()
	const windowRef = useRef<HTMLElement>(null)
	// Below desktop-nav only: whether the drawer is open. Starts closed each load.
	const [phoneOpen, setPhoneOpen] = useState(false)
	const seen = useRankingsSeen()
	const section = entry.id
	const top = list.rows.slice(0, TOP).map((row) => row.id)
	const topKey = top.join()
	const moved = list.status === "ready" && seen?.section === section ? movedCount(seen.ids, top) : 0

	// The window on screen (not just mounted: CSS hides it on a phone) has been seen.
	useEffect(() => {
		if (list.status !== "ready" || topKey === "") return
		if ((windowRef.current?.getClientRects().length ?? 0) > 0) markRankingsSeen(section, topKey.split(","))
	}, [list.status, topKey, section, phoneOpen, docked])

	const open = () => {
		setPhoneOpen(true)
		dockRankings(true)
	}
	const close = () => {
		setPhoneOpen(false)
		dockRankings(false)
	}
	// Literal class names per state, so Tailwind sees every one.
	const windowShown = `${phoneOpen ? "flex" : "hidden"} ${docked ? "desktop-nav:flex" : "desktop-nav:hidden"}`
	const tabShown = `${phoneOpen ? "hidden" : "flex"} ${docked ? "desktop-nav:hidden" : "desktop-nav:flex"}`
	const Icon = entry.icon

	return (
		<>
			<button
				type="button"
				onClick={open}
				aria-label={`Open the pinned rankings: ${list.tabName}${moved > 0 ? `, ${moved} moved` : ""}`}
				className={`fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 z-40 items-center gap-1.5 rounded-r-[10px] border border-l-0 border-brand/50 bg-gray-800 py-2 pl-2 pr-2.5 text-xs font-semibold text-brand shadow-lg transition hover:bg-gray-700 ${tabShown}`}
			>
				<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
				{moved > 0 && (
					<span className="rounded-full bg-brand px-[5px] py-0.5 text-[10px] font-semibold leading-none tabular-nums text-gray-900">{moved}</span>
				)}
				<span className="hidden whitespace-nowrap desktop-nav:inline">{list.tabName}</span>
			</button>
			<AnimatePresence initial={false}>
				{(phoneOpen || docked) && (
					<motion.aside
						key="rankings-window"
						ref={windowRef}
						aria-label={`Rankings: ${entry.label}`}
						initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
						animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
						exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
						transition={{ duration: 0.16, ease: "easeOut" }}
						onKeyDown={(keydown) => {
							// Only Escapes from inside the window itself, and not one a menu inside it used.
							if (keydown.key === "Escape" && !keydown.defaultPrevented && windowRef.current?.contains(keydown.target as Node)) close()
						}}
						className={`fixed inset-x-2 top-2 z-50 max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-[14px] border border-gray-600 bg-gray-800 shadow-2xl desktop-nav:inset-auto desktop-nav:left-4 desktop-nav:top-[calc(50%+2rem)] desktop-nav:z-40 desktop-nav:max-h-[calc(100dvh-7rem)] desktop-nav:w-[23rem] desktop-nav:-translate-y-1/2 ${windowShown}`}
					>
						<header className="flex items-center gap-1 border-b border-edge py-2 pl-2.5 pr-2">
							<div className="flex gap-0.5" role="group" aria-label="Rankings section">
								{shown.map((option) => {
									const OptionIcon = option.icon
									const on = option.id === section
									return (
										<button
											key={option.id}
											type="button"
											aria-pressed={on}
											aria-label={option.label}
											title={option.label}
											onClick={() => pinRankings(option.id)}
											className={`flex h-[30px] w-8 items-center justify-center rounded-lg transition ${on ? "bg-brand/15 text-brand" : "text-gray-400 hover:bg-gray-700 hover:text-gray-100"}`}
										>
											<OptionIcon className="h-4 w-4" aria-hidden="true" />
										</button>
									)
								})}
							</div>
							<div className="ml-auto flex gap-0.5">
								<Link to={sectionHref(section)} onClick={() => setPhoneOpen(false)} aria-label="Open the full page" title="Full page" className={HEADER_BUTTON}>
									<ExternalLink className="h-4 w-4" aria-hidden="true" />
								</Link>
								<button type="button" onClick={() => pinRankings(null)} aria-label="Unpin" title="Unpin" className={HEADER_BUTTON}>
									<PinOff className="h-4 w-4" aria-hidden="true" />
								</button>
								<button type="button" onClick={close} aria-label="Hide rankings" title="Hide rankings" className={HEADER_BUTTON}>
									<X className="h-4 w-4" aria-hidden="true" />
								</button>
							</div>
						</header>
						{/* Keyed by section, so a new one starts with its search empty and its menu shut. */}
						<WindowBody key={section} entry={entry} list={list} onNavigate={() => setPhoneOpen(false)} />
					</motion.aside>
				)}
			</AnimatePresence>
		</>
	)
}

const HEADER_BUTTON = "flex h-[30px] w-[30px] items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"

function WindowBody({ entry, list, onNavigate }: { entry: SectionEntry; list: WindowList; onNavigate: () => void }) {
	const [changing, setChanging] = useState(false)
	const [query, setQuery] = useState("")
	const needle = query.trim().toLowerCase()
	// Search reaches the whole list, not just the ten, and keeps each row's place.
	const placed = list.rows.map((row, index) => ({ row, place: index + 1 }))
	const rows = (needle ? placed.filter(({ row }) => row.name.toLowerCase().includes(needle)) : placed).slice(0, TOP)

	return (
		<div className="flex min-h-0 flex-col gap-2 p-2.5">
			<div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
				<b className="font-semibold text-gray-100">{entry.label}</b>
				<span className="min-w-0">· {list.context}</span>
				{list.settings.length > 0 && (
					<button
						type="button"
						aria-expanded={changing}
						onClick={() => setChanging(!changing)}
						className="ml-auto text-[11px] text-brand underline underline-offset-2 transition hover:text-brand/75"
					>
						{changing ? "Done" : "Change"}
					</button>
				)}
			</div>
			{changing && (
				<div className="flex flex-col gap-1.5 rounded-[10px] border border-edge bg-gray-900/70 p-2">
					{list.settings.map((setting) => (
						<div key={setting.label} className="flex flex-col gap-1">
							<span className="text-[10px] uppercase tracking-wider text-gray-400">{setting.label}</span>
							<Lens label={setting.label} options={setting.options} value={setting.value} onChange={setting.onChange} />
						</div>
					))}
				</div>
			)}
			{list.search && list.status === "ready" && (
				<label className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
					<input
						type="search"
						aria-label={list.search}
						placeholder={list.search}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						className="w-full rounded-full border border-gray-600 bg-gray-900/70 py-[5px] pl-8 pr-3 text-xs text-gray-100 placeholder-gray-400 focus:border-brand focus:outline-none"
					/>
				</label>
			)}
			<div className="min-h-0 overflow-y-auto">
				{list.status === "loading" ? (
					<p className="flex items-center gap-2 px-1 py-2 text-xs text-gray-400" role="status">
						<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
						Counting...
					</p>
				) : list.status !== "ready" ? (
					<p className="px-1 py-2 text-xs text-gray-400">
						{list.status === "refused" ? "This list isn't open to you yet." : "The rankings didn't load. Reload the page to try again."}
					</p>
				) : rows.length === 0 ? (
					<p className="px-1 py-2 text-xs text-gray-400">{needle ? "Nothing by that name." : "Nothing to rank yet."}</p>
				) : (
					<ol className="flex flex-col divide-y divide-edge">
						{rows.map(({ row, place }) => (
							<li key={row.id}>
								<RankRow compact place={place} art={row.art} name={row.name} fill={row.fill} count={row.count} share={row.share} />
							</li>
						))}
					</ol>
				)}
			</div>
			<div className="flex items-center justify-between border-t border-edge pt-1.5 text-[11px] text-gray-400">
				<span>{list.status === "ready" ? `Top ${Math.min(TOP, list.rows.length)} of ${list.rows.length.toLocaleString()}` : ""}</span>
				<Link to={sectionHref(entry.id)} onClick={onNavigate} className="inline-flex items-center gap-1 text-brand transition hover:text-brand/75">
					<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
					Full page
				</Link>
			</div>
		</div>
	)
}
