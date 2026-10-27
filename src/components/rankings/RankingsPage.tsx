/**
 * The Rankings page (/app/rankings, notes/rankings-page-plan.md): what the
 * guides recommend, what players plan to pull, what they build for PvP, and
 * how they play. One tab on screen at a time, `?view=`:
 *
 *   guides       Guide rankings, the source sheet's card table (GuideRankings)
 *   pull-plans   the banners players plan to pull on (Raptive gate, later)
 *   pvp          the teams players save, and what wins (later)
 *   players      favourite umas, Team Trials, income options (later)
 *
 * PATREON ONLY FOR NOW (owner, 2026-10-27): early access (`account.early_access`,
 * backend benefits.early_access) sees the page and its navbar item, and
 * every /rankings/* route checks the same on the server. Anyone else who
 * lands here gets a short note. Not prerendered and noindex, like the Skills
 * page: the content is behind an account.
 */

import { useContext, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { BookOpen, ListOrdered, Swords, Users, type LucideIcon } from "lucide-react"
import { AuthContext } from "../../services/AuthContext"
import { GuideRankings } from "./GuideRankings"

type RankingsView = "guides" | "pvp" | "players"
const VIEW_PARAM = "view"

/** The tabs, in order. A `soon` tab is drawn but can't be opened yet. */
const VIEWS: Array<{ id: RankingsView; label: string; icon: LucideIcon; soon: boolean }> = [
	{ id: "guides", label: "Guide rankings", icon: BookOpen, soon: false },
	{ id: "pvp", label: "PvP", icon: Swords, soon: true },
	{ id: "players", label: "Players", icon: Users, soon: true },
]

/** The view a `?view=` value names; anything unknown or not open yet is the first tab. */
function parseRankingsView(value: string | null): RankingsView {
	const view = VIEWS.find((entry) => entry.id === value && !entry.soon)
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
	const view = parseRankingsView(searchParams.get(VIEW_PARAM))
	const open = (next: RankingsView) => {
		const params = new URLSearchParams(searchParams)
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
					What the guides recommend most, counted across every guide or the next few events. For our Patreon
					supporters for now.
				</p>
			</header>
			<div role="tablist" aria-label="Rankings" className="flex flex-wrap gap-1 border-b border-gray-700">
				{VIEWS.map((entry) => (
					<Tab key={entry.id} active={entry.id === view} soon={entry.soon} icon={entry.icon} onClick={() => open(entry.id)}>
						{entry.label}
					</Tab>
				))}
			</div>
			<div role="tabpanel" aria-label={VIEWS.find((entry) => entry.id === view)?.label}>
				{view === "guides" && <GuideRankings />}
			</div>
		</div>
	)
}

function Tab({ active, soon, icon: Icon, onClick, children }: {
	active: boolean
	soon: boolean
	icon: LucideIcon
	onClick: () => void
	children: ReactNode
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			disabled={soon}
			onClick={onClick}
			className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition ${
				active
					? "border-brand text-brand"
					: soon
						? "cursor-default border-transparent text-gray-500"
						: "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-100"
			}`}
		>
			<Icon className="h-4 w-4 shrink-0" />
			{children}
			{soon && <span className="rounded bg-gray-700/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">Soon</span>}
		</button>
	)
}
