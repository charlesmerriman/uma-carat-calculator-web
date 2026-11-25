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

import { useContext, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { ListOrdered, Pin, PinOff } from "lucide-react"
import { AuthContext } from "../../services/AuthContext"
import { pinRankings, useRankingsPin, type RankingsSection as Section } from "../../services/rankingsPinStore"
import { formatDate } from "../../utils/dateFormat"
import { formatTimeAgo } from "../../utils/relativeDate"
import { SupportersFirstNote } from "../SupportersFirstNote"
import { ScreenHeader } from "../ScreenHeader"
import { FloatingBackToTop } from "../BackToTop"
import { useBackToTop } from "../../hooks/useBackToTop"
import { RankingsSection } from "./RankingsSection"
import { RankingsUpdatedContext } from "./rankingsUpdated"
import { parseSection, useSectionBadges, useVisibleSections } from "./sections"

const VIEW_PARAM = "view"

/**
 * The column, and the colour variables the kit reads (`rk-vars`, rankings.css).
 * 76rem, a little narrower than the other /app pages, as the canvas drew it
 * (notes/rankings-polish-plan.md, "What changes beyond style").
 */
const CONTAINER = "rk-vars mx-auto mb-3 mt-5 flex w-[calc(100%-1rem)] max-w-[76rem] flex-col gap-[1.125rem] sm:w-[calc(100%-2rem)]"

export const RankingsPage = () => {
	const auth = useContext(AuthContext)
	if (!auth?.account?.early_access) {
		return (
			<div className={CONTAINER}>
				<SupportersFirstNote feature="Rankings are" />
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
	// The floating arrow, as on the Encyclopedia (Daptrius, 2026-11-13: the long tabs need one on a phone).
	const { topRef, isAwayFromTop, scrollToTop } = useBackToTop()
	const open = (next: Section) => {
		const params = new URLSearchParams(searchParams)
		// The PvP tab's event belongs to that tab.
		if (next !== "pvp") params.delete("event")
		if (next === "guides") params.delete(VIEW_PARAM)
		else params.set(VIEW_PARAM, next)
		setSearchParams(params)
	}

	return (
		<>
		{/* Outside the column, so the anchor adds no gap to its flex stack. */}
		<div ref={topRef} aria-hidden="true" />
		<FloatingBackToTop onClick={scrollToTop} visible={isAwayFromTop} column="76rem" />
		{/* The shared screen header (components/ScreenHeader.tsx): one pinned row of the
		    tabs on a phone; on a computer the masthead, then a slim pinned row once it
		    scrolls away. Outside the column: what pins has to be a child of the whole
		    page area to stick through it. */}
		<ScreenHeader
			kind="buttons"
			title="Rankings"
			icon={ListOrdered}
			label="Rankings"
			column="max-w-[76rem]"
			tabs={shown.map((entry) => ({ id: entry.id, label: entry.label, icon: entry.icon, badge: badges[entry.id] }))}
			active={view}
			onSelect={open}
		/>
		<div className={CONTAINER}>
			<div className="-my-1.5 flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2 sm:justify-end">
				{updated && (
					<time dateTime={updated} title={formatDate(updated)} className="text-[13px] text-gray-400">
						Updated {formatTimeAgo(updated, now)}
					</time>
				)}
				{/* Pins THIS tab beside the Calculator, Timeline and PvP; one at a time. A quiet
				    button: the page's answer, not its pin, is the strongest thing on it. */}
				<button
					type="button"
					aria-pressed={pinned}
					onClick={() => pinRankings(pinned ? null : view)}
					className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition ${
						pinned ? "border-brand bg-brand/15 text-brand" : "border-gray-600 text-gray-200 hover:border-gray-500 hover:text-gray-50"
					}`}
				>
					{pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
					{pinned ? "Unpin" : "Pin to the side"}
				</button>
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
		</>
	)
}
