/**
 * The team drawer: your PvP team, beside every planner page, opened from the
 * navbar's Team button. Mounted by AppShell, inside the /app loading gate.
 *
 * WHICH TEAM. utils/pvpTeams.ts drawerTeam(): the pinned team while its event
 * is still on, else your team for the event running now or coming next (the
 * one edited last, if there are two), else an offer to build one. The header's
 * select IS the pin: "Next event (auto)" clears it, a team sets it.
 *
 * NOT A DIALOG. The page behind stays usable (no backdrop, no focus trap), so
 * a player can scroll the Timeline or edit their pull plan with the team in
 * view. Opening moves focus to the heading; Escape inside the drawer closes it
 * and hands focus back to the Team button.
 *
 * WHERE IT SITS (classes on the aside, keyed to the variants in index.css):
 *   below app-shell   fixed over the page, full height, up to 26rem
 *   app-shell         over the right edge of the page area, its own scroll
 *   team-dock         a 26rem column; the page area shrinks beside it
 *
 * The grid is TeamEditor, the same editor as the PvP page's My team view, so
 * an edit in either shows in the other at once (both read PvpTeamsProvider).
 */

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import { Clock3, ExternalLink, Loader2, Users, X } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { usePvpTeams } from "../../services/PvpTeamsContext"
import { focusTeamDrawerButton } from "../../services/TeamDrawerContext"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { usePvpGuide } from "../../hooks/usePvpGuide"
import { formatDate } from "../../utils/dateFormat"
import { hasEnded, raceEventsInOrder } from "../../utils/pvpGuide"
import { formatPvpEvent, pvpEventHref, refForRaceEvent, sameEvent } from "../../utils/pvpEvent"
import { drawerTeam } from "../../utils/pvpTeams"
import { getCountdownLabel } from "../timeline/timelineShared"
import PredictedBadge from "../PredictedBadge"
import { TeamEditor } from "./TeamEditor"
import type { RaceEvent } from "../../types"
import type { PvpTeam } from "../../types/pvpTeam"

const AUTO = "auto"

/** "/app/pvp?event=cm-19&view=team": the builder, on this event. */
function builderHref(event: RaceEvent): string {
	return `${pvpEventHref(refForRaceEvent(event))}&view=team`
}

export function TeamDrawer({ onClose }: { onClose: () => void }) {
	const { status, teams, mode, saveState, ensureLoaded, editTeam, pinTeam } = usePvpTeams()
	const { championsMeetingData, leagueOfHeroesData } = useCalculatorData()
	const catalogue = usePvpCatalogue()
	const reduceMotion = useReducedMotion()
	const asideRef = useRef<HTMLElement>(null)
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
	const shownEvent = choice.kind === "no-events" ? null : choice.event
	const guideState = usePvpGuide(shownEvent ? refForRaceEvent(shownEvent) : null)

	const close = () => {
		onClose()
		focusTeamDrawerButton()
	}

	return (
		<motion.aside
			ref={asideRef}
			id="team-drawer"
			aria-label="Your PvP team"
			initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
			animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
			exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
			transition={{ duration: 0.18, ease: "easeOut" }}
			onKeyDown={(keydown) => {
				// Only Escapes from inside the drawer itself. A picker opened from
				// here is portalled to <body>, and React still bubbles its keys up
				// through this element; the picker closes itself on those.
				if (keydown.key === "Escape" && asideRef.current?.contains(keydown.target as Node)) close()
			}}
			className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[26rem] flex-col border-l border-gray-700 bg-gray-900 shadow-2xl app-shell:absolute app-shell:z-30 app-shell:w-[min(26rem,100vw)] team-dock:static team-dock:z-auto team-dock:w-[26rem] team-dock:shrink-0 team-dock:shadow-none"
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
						<EventSummary event={choice.event} now={now} />
						<PinSelect teams={teams} events={events} now={now} onPin={pinTeam} />
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
								<TeamEditor
									event={choice.event}
									members={choice.team.members}
									index={catalogue}
									guide={guideState.status === "ready" ? guideState.guide : null}
									compact
									onChange={(members) => editTeam(choice.team.key, { members })}
								/>
								<div className="flex items-center justify-between gap-2 text-xs text-gray-400">
									<span role="status" aria-live="polite">
										{saveState === "error"
											? "Your last change didn't save."
											: mode === "guest"
												? "Saved on this device."
												: saveState === "pending" || saveState === "saving"
													? "Saving…"
													: "Saved."}
									</span>
									<Link
										to={builderHref(choice.event)}
										className="inline-flex items-center gap-1 font-medium text-brand transition hover:text-brand/75"
									>
										Open in PvP
										<ExternalLink className="h-3 w-3" aria-hidden="true" />
									</Link>
								</div>
							</>
						)}
					</div>
				)}
			</div>
		</motion.aside>
	)
}

/** The event: kicker, name, dates and the countdown. */
function EventSummary({ event, now }: { event: RaceEvent; now: Date }) {
	return (
		<div className="flex items-start gap-2">
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-semibold text-gray-100" title={event.name}>
					{event.name}
				</p>
				<p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
					{formatDate(event.start_date)} through {formatDate(event.end_date)}
					{event.is_predicted && <PredictedBadge />}
				</p>
			</div>
			<span className="flex shrink-0 items-center gap-1 rounded-full border border-gray-600 bg-gray-800 px-2 py-0.5 text-[11px] font-semibold text-gray-100">
				{getCountdownLabel(event.start_date, event.end_date, now)}
				<Clock3 className="h-3 w-3 text-brand" aria-hidden="true" />
			</span>
		</div>
	)
}

/** "Team 2" when the player hasn't named it, numbered within its event. */
function labelFor(team: PvpTeam, teams: PvpTeam[]): string {
	const sameEventTeams = teams.filter((other) => other.kind === team.kind && other.event === team.event)
	return team.name.trim() || `Team ${sameEventTeams.indexOf(team) + 1}`
}

/**
 * The pin. "Next event (auto)" lets drawerTeam choose; a team pins it, and
 * the drawer shows it until its event ends. Only running and upcoming events
 * are offered, each with its teams.
 */
function PinSelect({ teams, events, now, onPin }: {
	teams: PvpTeam[]
	events: RaceEvent[]
	now: Date
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
		<label className="flex flex-col gap-1">
			<span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Show in this panel</span>
			<select
				value={pinned && offered ? pinned.key : AUTO}
				onChange={(change) => onPin(change.target.value === AUTO ? null : change.target.value)}
				className="w-full rounded-md border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-gray-100 outline-none focus:border-brand"
			>
				<option value={AUTO}>Next event (auto)</option>
				{groups.map((group) => (
					<optgroup key={formatPvpEvent(refForRaceEvent(group.event))} label={group.event.name}>
						{group.teams.map((team) => (
							<option key={team.key} value={team.key}>
								{labelFor(team, teams)}
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
