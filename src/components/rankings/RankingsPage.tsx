/**
 * The Rankings page (/app/rankings, notes/rankings-page-plan.md): what the
 * guides recommend, what players plan to pull, what they build for PvP, and
 * how they play. One tab on screen at a time, `?view=`:
 *
 *   guides       what the guides recommend, the source sheet's card table (GuideRankings)
 *   pull-plans   the banners players plan to pull on (PullPlans), behind
 *                the Raptive gate: guide editors only (useRankingsPullPlans)
 *   pvp          the teams players save, and what wins (PvpTab)
 *   players      favourite umas, ranks, income options, selectors (PlayersTab)
 *
 * PATREON ONLY FOR NOW (owner, 2026-10-27): early access (`account.early_access`,
 * backend benefits.early_access) sees the page and its navbar item, and
 * every /rankings/* route checks the same on the server. Anyone else who
 * lands here gets a short note. Not prerendered and noindex, like the Skills
 * page: the content is behind an account.
 */

import { useContext, useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ListOrdered, Pin, PinOff, type LucideIcon } from "lucide-react"
import { AuthContext } from "../../services/AuthContext"
import { pinRankings, useRankingsPin, type RankingsSection as Section } from "../../services/rankingsPinStore"
import { formatDate } from "../../utils/dateFormat"
import { formatTimeAgo } from "../../utils/relativeDate"
import { RankingsSection } from "./RankingsSection"
import { RankingsUpdatedContext } from "./rankingsUpdated"
import { parseSection, useSectionBadges, useVisibleSections } from "./sections"

const VIEW_PARAM = "view"

const CONTAINER = "mx-auto my-3 flex w-[calc(100%-1rem)] max-w-7xl flex-col gap-4 sm:w-[calc(100%-2rem)]"

export const RankingsPage = () => {
	const auth = useContext(AuthContext)
	if (!auth?.account?.early_access) {
		const waiting = Boolean(auth?.isLoggedIn) && auth?.status === "loading"
		return (
			<div className={CONTAINER}>
				<p className="text-sm text-gray-400" role="status">
					{waiting ? "Loading..." : (
						<>
							Rankings are for our Patreon supporters for now.{" "}
							<Link to="/app" className="text-brand transition hover:text-brand/75">Back to the calculator</Link>
						</>
					)}
				</p>
			</div>
		)
	}
	return <RankingsBody />
}

const RankingsBody = () => {
	const [searchParams, setSearchParams] = useSearchParams()
	const shown = useVisibleSections()
	const view = parseSection(searchParams.get(VIEW_PARAM), shown)
	const pin = useRankingsPin()
	const pinned = pin.section === view
	const badges = useSectionBadges(searchParams.get("event"))
	// The open tab's payload time (rankingsUpdated.ts), read against one clock reading.
	const [updated, setUpdated] = useState<string | null>(null)
	const [now] = useState(() => Date.now())
	const open = (next: Section) => {
		const params = new URLSearchParams(searchParams)
		// The PvP tab's event belongs to that tab.
		if (next !== "pvp") params.delete("event")
		if (next === "guides") params.delete(VIEW_PARAM)
		else params.set(VIEW_PARAM, next)
		setSearchParams(params)
	}

	return (
		<div className={CONTAINER}>
			<header className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
				<h1 className="font-display mr-auto flex items-center gap-2 text-xl font-bold text-brand">
					<ListOrdered className="h-5 w-5 shrink-0" />
					Rankings
				</h1>
				{updated && (
					<time dateTime={updated} title={formatDate(updated)} className="text-xs text-gray-400">
						Updated {formatTimeAgo(updated, now)}
					</time>
				)}
				{/* Pins THIS tab beside the Calculator, Timeline and PvP; one at a time. A quiet
				    button: the page's answer, not its pin, is the strongest thing on it. */}
				<button
					type="button"
					aria-pressed={pinned}
					onClick={() => pinRankings(pinned ? null : view)}
					className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
						pinned ? "border-brand bg-brand/15 text-brand" : "border-gray-600 text-gray-300 hover:border-gray-500 hover:text-gray-100"
					}`}
				>
					{pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
					{pinned ? "Unpin" : "Pin to the side"}
				</button>
			</header>
			<div role="tablist" aria-label="Rankings" className="flex gap-0.5 overflow-x-auto border-b border-gray-600 [scrollbar-width:none]">
				{shown.map((entry) => (
					<Tab key={entry.id} active={entry.id === view} icon={entry.icon} badge={badges[entry.id]} onClick={() => open(entry.id)}>
						{entry.label}
					</Tab>
				))}
			</div>
			<div role="tabpanel" aria-label={shown.find((entry) => entry.id === view)?.label}>
				<RankingsUpdatedContext.Provider value={setUpdated}>
					<RankingsSection section={view} />
				</RankingsUpdatedContext.Provider>
			</div>
			{pin.section !== null && !pinned && (
				<p className="text-xs text-gray-400">
					{shown.find((entry) => entry.id === pin.section)?.label ?? "A tab"} is pinned to the side of the other pages.
				</p>
			)}
		</div>
	)
}

function Tab({ active, icon: Icon, badge, onClick, children }: {
	active: boolean
	icon: LucideIcon
	/** "51", "CM 21": a hint after the name, not part of the tab's name for a screen reader. */
	badge?: string
	onClick: () => void
	children: ReactNode
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onClick}
			className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${
				active
					? "border-brand text-brand"
					: "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-100"
			}`}
		>
			<Icon className="h-4 w-4 shrink-0" />
			{children}
			{badge && (
				<span aria-hidden="true" className="rounded-full bg-gray-700 px-[7px] py-px text-[11px] font-medium tabular-nums text-gray-400">
					{badge}
				</span>
			)}
		</button>
	)
}
