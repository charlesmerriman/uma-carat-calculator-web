/**
 * "Your team" on the PvP tab (mock 09-pvp.png): where each uma on the
 * reader's own saved team for the event sits in "Umas players build", as
 * "#1 of 38 · Pace". Read from the reader's teams on this device or account
 * (usePvpTeams), which the page already has; nothing about anyone else.
 * The team is the event's focus team, else the one edited last.
 */

import { useEffect } from "react"
import { Link } from "react-router-dom"
import type { RaceEvent } from "../../types"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { usePvpTeams } from "../../services/PvpTeamsContext"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import { pvpEventHref, refForRaceEvent, shortEventName } from "../../utils/pvpEvent"
import { FramedUma } from "../FramedUma"
import { Panel } from "./kit/Panel"

export function YourTeam({ event, ranked, catalogue }: {
	event: RaceEvent
	/** "Umas players build", in rank order: an uma's place is her index + 1. */
	ranked: number[]
	catalogue: PvpCatalogueIndex
}) {
	const { status, teams, ensureLoaded } = usePvpTeams()
	const oshiIds = useOshiIds()
	useEffect(ensureLoaded, [ensureLoaded])
	const ref = refForRaceEvent(event)
	const team = teams
		.filter((candidate) => candidate.kind === ref.kind && candidate.event === ref.id)
		.sort((a, b) => Number(b.isFocus) - Number(a.isFocus) || b.updatedAt - a.updatedAt)[0]
	const members = team ? [...team.members].sort((a, b) => a.position - b.position) : []

	return (
		<Panel title="Your team" hint={`Where the umas on your saved ${shortEventName(event)} team sit in this ranking.`}>
			{status !== "ready" ? (
				<p className="px-1 text-xs text-gray-400">{status === "error" ? "Your teams didn't load." : "Loading your teams..."}</p>
			) : members.length === 0 ? (
				<p className="px-1 text-xs text-gray-400">
					Save a team for this event to see where it sits.{" "}
					<Link to={pvpEventHref(ref)} className="text-brand transition hover:text-brand/75">
						Build one on the PvP page
					</Link>
				</p>
			) : (
				<ul className="flex flex-wrap gap-2">
					{members.map((member) => {
						const uma = catalogue.umasById.get(member.uma)
						const place = ranked.indexOf(member.uma) + 1
						return (
							<li key={member.position} className="flex min-w-0 items-center gap-2 rounded-[10px] border border-edge bg-gray-900/70 py-1.5 pl-1.5 pr-3">
								<FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(member.uma)} className="w-10" />
								<span className="flex min-w-0 flex-col">
									<b className="truncate text-[13px] font-semibold text-gray-100">{uma?.name ?? "Unknown uma"}</b>
									<span className="text-[11px] tabular-nums text-gray-400">
										{place > 0 ? (
											<>
												<b className="font-semibold text-brand">#{place}</b> of {ranked.length}
											</>
										) : (
											"Not on the list"
										)}{" "}
										· {STYLE_LABELS[member.style]}
									</span>
								</span>
							</li>
						)
					})}
				</ul>
			)}
		</Panel>
	)
}
