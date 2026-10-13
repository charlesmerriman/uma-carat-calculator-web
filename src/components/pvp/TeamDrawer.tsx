/**
 * The team window: your PvP team, hovering over every planner page, opened
 * from the navbar's Team button. Mounted by AppShell, inside the /app
 * loading gate.
 *
 * A WINDOW OVER THE PAGE, NEVER BESIDE IT. It floats under the navbar on
 * the right, sized to its contents, and the page keeps its full width
 * behind it (owner, 2026-10-13: an earlier version docked as a column and
 * pushed the site aside). Below desktop-nav it covers the screen, with its
 * own close button.
 *
 * READ-ONLY. It shows the team; editing happens on the PvP page's My team
 * view, which "Edit in PvP" opens on the same team (preferredTeam).
 *
 * WHICH TEAM. utils/pvpTeams.ts drawerTeam(): the pinned team while its event
 * is still on, else your team for the event running now or coming next (the
 * one edited last, if there are two), else an offer to build one. The
 * selector at the top IS the pin: "Next event (auto)" clears it.
 *
 * NOT A DIALOG. No backdrop, no focus trap: the page behind stays usable.
 * Opening moves focus to the heading; Escape inside closes it and hands
 * focus back to the Team button.
 */

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import { Clock3, Loader2, Pencil, Users, X } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { usePvpTeams } from "../../services/PvpTeamsContext"
import { focusTeamDrawerButton } from "../../services/TeamDrawerContext"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { formatDate } from "../../utils/dateFormat"
import { hasEnded, raceEventsInOrder } from "../../utils/pvpGuide"
import { formatPvpEvent, pvpEventHref, refForRaceEvent, sameEvent } from "../../utils/pvpEvent"
import { drawerTeam } from "../../utils/pvpTeams"
import { getCountdownLabel } from "../timeline/timelineShared"
import PredictedBadge from "../PredictedBadge"
import { TeamSnapshot } from "./TeamSnapshot"
import type { RaceEvent } from "../../types"
import type { PvpTeam } from "../../types/pvpTeam"

const AUTO = "auto"

/** "/app/pvp?event=cm-19&view=team": the builder, on this event. */
function builderHref(event: RaceEvent): string {
	return `${pvpEventHref(refForRaceEvent(event))}&view=team`
}

export function TeamDrawer({ onClose }: { onClose: () => void }) {
	const { status, teams, ensureLoaded, pinTeam } = usePvpTeams()
	const { championsMeetingData, leagueOfHeroesData } = useCalculatorData()
	const catalogue = usePvpCatalogue()
	const reduceMotion = useReducedMotion()
	const windowRef = useRef<HTMLElement>(null)
	const headingRef = useRef<HTMLHeadingElement>(null)

	useEffect(() => {
		ensureLoaded()
	}, [ensureLoaded])
	useEffect(() => {
		headingRef.current?.focus()
	}, [])

	// One clock reading per opening, so every label measures from the same "now".
	const now = useMemo(() => new Date(), [])
	const events = useMemo(
		() => raceEventsInOrder(championsMeetingData, leagueOfHeroesData),
		[championsMeetingData, leagueOfHeroesData]
	)
	const choice = drawerTeam(teams, events, now)
	// What "auto" would show with no pin, for the selector's first option.
	const autoChoice = drawerTeam(teams.map((team) => ({ ...team, isFocus: false })), events, now)
	const autoEvent = autoChoice.kind === "no-events" ? null : autoChoice.event

	const close = () => {
		onClose()
		focusTeamDrawerButton()
	}

	return (
		<motion.aside
			ref={windowRef}
			id="team-drawer"
			aria-label="Your PvP team"
			initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
			animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
			exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
			transition={{ duration: 0.16, ease: "easeOut" }}
			onKeyDown={(keydown) => {
				// Only Escapes from inside the window itself.
				if (keydown.key === "Escape" && windowRef.current?.contains(keydown.target as Node)) close()
			}}
			className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-xl border border-gray-600 bg-gray-900 shadow-2xl desktop-nav:inset-auto desktop-nav:right-4 desktop-nav:top-19 desktop-nav:z-40 desktop-nav:max-h-[calc(100dvh-6rem)] desktop-nav:w-[24rem]"
		>
			<header className="flex items-center gap-2 border-b border-gray-700 px-3 py-2">
				<h2 ref={headingRef} tabIndex={-1} className="flex flex-1 items-center gap-1.5 text-sm font-semibold text-gray-100 outline-none">
					<Users className="h-4 w-4 text-brand" aria-hidden="true" />
					Your PvP team
				</h2>
				<button
					type="button"
					aria-label="Close your PvP team"
					onClick={close}
					className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
				>
					<X className="h-4 w-4" />
				</button>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto p-3">
				{status === "error" ? (
					<Notice>Your teams didn't load. Reload the page to try again.</Notice>
				) : status !== "ready" || catalogue.status === "loading" ? (
					<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading your team…
					</p>
				) : catalogue.status === "error" ? (
					<Notice>The uma and card list didn't load. Reload the page to try again.</Notice>
				) : choice.kind === "no-events" ? (
					<Notice>No Champions Meeting or League of Heroes coming up yet.</Notice>
				) : (
					<div className="flex flex-col gap-3">
						<div className="flex flex-col gap-1.5">
							<EventSelect teams={teams} events={events} now={now} autoEvent={autoEvent} onPin={pinTeam} />
							<EventDates event={choice.event} now={now} />
						</div>
						{choice.kind === "none" ? (
							<div className="rounded-xl border border-dashed border-gray-600 bg-gray-800/40 p-4 text-center">
								<p className="text-sm text-gray-300">No team for {choice.event.name} yet.</p>
								<Link
									to={builderHref(choice.event)}
									className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 transition hover:border-brand hover:text-brand"
								>
									Build one
								</Link>
							</div>
						) : (
							<>
								<TeamSnapshot members={choice.team.members} umasById={catalogue.umasById} cardsById={catalogue.cardsById} />
								<Link
									to={builderHref(choice.event)}
									className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 transition hover:border-brand hover:text-brand"
								>
									<Pencil className="h-3.5 w-3.5" aria-hidden="true" />
									Edit in PvP
								</Link>
							</>
						)}
					</div>
				)}
			</div>
		</motion.aside>
	)
}

/** The shown event's dates, whether they are estimated, and the countdown. */
function EventDates({ event, now }: { event: RaceEvent; now: Date }) {
	return (
		<p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
			{formatDate(event.start_date)} through {formatDate(event.end_date)}
			{event.is_predicted && <PredictedBadge />}
			<span className="ml-auto flex items-center gap-1 rounded-full border border-gray-600 bg-gray-800 px-2 py-0.5 text-[11px] font-semibold text-gray-100">
				{getCountdownLabel(event.start_date, event.end_date, now)}
				<Clock3 className="h-3 w-3 text-brand" aria-hidden="true" />
			</span>
		</p>
	)
}

/** "Team 2" when the player hasn't named it, numbered within its event. */
function labelFor(team: PvpTeam, teams: PvpTeam[]): string {
	const sameEventTeams = teams.filter((other) => other.kind === team.kind && other.event === team.event)
	return team.name.trim() || `Team ${sameEventTeams.indexOf(team) + 1}`
}

/**
 * The CM / LoH selector, which is also the pin. "Next event (auto)" lets
 * drawerTeam choose and names the event it chose; a team pins it until its
 * event ends. Running and upcoming events with a team are offered.
 */
function EventSelect({ teams, events, now, autoEvent, onPin }: {
	teams: PvpTeam[]
	events: RaceEvent[]
	now: Date
	autoEvent: RaceEvent | null
	onPin: (key: string | null) => void
}) {
	const groups = events
		.filter((event) => !hasEnded(event, now))
		.map((event) => ({
			event,
			teams: teams.filter((team) => sameEvent(refForRaceEvent(event), { kind: team.kind, id: team.event })),
		}))
		.filter((group) => group.teams.length > 0)
	const pinned = teams.find((team) => team.isFocus)
	const offered = groups.some((group) => group.teams.includes(pinned as PvpTeam))
	return (
		<label className="block">
			<span className="sr-only">Which event and team to show</span>
			<select
				value={pinned && offered ? pinned.key : AUTO}
				onChange={(change) => onPin(change.target.value === AUTO ? null : change.target.value)}
				className="w-full rounded-md border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm font-semibold text-gray-100 outline-none focus:border-brand"
			>
				<option value={AUTO}>{autoEvent ? `Next event (auto): ${autoEvent.name}` : "Next event (auto)"}</option>
				{groups.map((group) => (
					<optgroup key={formatPvpEvent(refForRaceEvent(group.event))} label={group.event.name}>
						{group.teams.map((team) => (
							<option key={team.key} value={team.key}>
								{group.event.name}: {labelFor(team, teams)}
							</option>
						))}
					</optgroup>
				))}
			</select>
		</label>
	)
}

function Notice({ children }: { children: ReactNode }) {
	return <p className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 text-sm text-gray-300">{children}</p>
}
