/**
 * The Rankings page (/app/rankings, notes/rankings-page-plan.md): what the
 * guides recommend, what players plan to pull, what they build for PvP, and
 * how they play. One tab on screen at a time, `?view=`:
 *
 *   guides       Guide rankings, the source sheet's card table (GuideRankings)
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

import { useContext, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { BookOpen, CalendarRange, ListOrdered, Swords, Users, type LucideIcon } from "lucide-react"
import { AuthContext } from "../../services/AuthContext"
import { useRankingsPullPlans } from "../../hooks/useRankingsPullPlans"
import { GuideRankings } from "./GuideRankings"
import { PullPlans } from "./PullPlans"
import { PvpTab } from "./PvpTab"
import { PlayersTab } from "./PlayersTab"

type RankingsView = "guides" | "pull-plans" | "pvp" | "players"
const VIEW_PARAM = "view"

/** The tabs, in order. A `gated` one is drawn only for the Raptive gate (useRankingsPullPlans). */
const VIEWS: Array<{ id: RankingsView; label: string; icon: LucideIcon; gated?: boolean }> = [
	{ id: "guides", label: "Guide rankings", icon: BookOpen },
	{ id: "pull-plans", label: "Pull plans", icon: CalendarRange, gated: true },
	{ id: "pvp", label: "PvP", icon: Swords },
	{ id: "players", label: "Players", icon: Users },
]

/** The view a `?view=` value names among the tabs drawn; anything else is the first tab. */
function parseRankingsView(value: string | null, shown: typeof VIEWS): RankingsView {
	const view = shown.find((entry) => entry.id === value)
	return view?.id ?? "guides"
}

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
	const pullPlans = useRankingsPullPlans()
	const shown = VIEWS.filter((entry) => !entry.gated || pullPlans)
	const view = parseRankingsView(searchParams.get(VIEW_PARAM), shown)
	const open = (next: RankingsView) => {
		const params = new URLSearchParams(searchParams)
		// The PvP tab's event belongs to that tab.
		if (next !== "pvp") params.delete("event")
		if (next === "guides") params.delete(VIEW_PARAM)
		else params.set(VIEW_PARAM, next)
		setSearchParams(params)
	}

	return (
		<div className={CONTAINER}>
			<header>
				<h1 className="font-display flex items-center gap-2 text-xl font-bold text-brand">
					<ListOrdered className="h-5 w-5 shrink-0" />
					Rankings
				</h1>
				<p className="mt-1 text-sm leading-relaxed text-gray-300">
					What the guides recommend, what players build and plan, and what wins. For our Patreon supporters for
					now.
				</p>
			</header>
			<div role="tablist" aria-label="Rankings" className="flex flex-wrap gap-1 border-b border-gray-700">
				{shown.map((entry) => (
					<Tab key={entry.id} active={entry.id === view} icon={entry.icon} onClick={() => open(entry.id)}>
						{entry.label}
					</Tab>
				))}
			</div>
			<div role="tabpanel" aria-label={VIEWS.find((entry) => entry.id === view)?.label}>
				{view === "guides" && <GuideRankings />}
				{view === "pull-plans" && <PullPlans />}
				{view === "pvp" && <PvpTab />}
				{view === "players" && <PlayersTab />}
			</div>
		</div>
	)
}

function Tab({ active, icon: Icon, onClick, children }: {
	active: boolean
	icon: LucideIcon
	onClick: () => void
	children: ReactNode
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onClick}
			className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition ${
				active
					? "border-brand text-brand"
					: "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-100"
			}`}
		>
			<Icon className="h-4 w-4 shrink-0" />
			{children}
		</button>
	)
}
