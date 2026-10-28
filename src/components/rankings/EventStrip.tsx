/**
 * The PvP tab's event picker (mock 09-pvp.png): a sideways row of event
 * cards, each its short name and title, a status pill, and for the chosen
 * one its team count. Replaces the native <select>. Shows the events around
 * the one running now or next (three either side), plus the chosen one if
 * it falls outside; the strip scrolls sideways when it doesn't fit, and the
 * chosen card is scrolled into view.
 */

import { useEffect, useRef } from "react"
import type { RaceEvent } from "../../types"
import { hasEnded, isRunning } from "../../utils/pvpGuide"
import { shortEventName, splitEventName } from "../../utils/pvpEvent"
import { StatusPill } from "./kit/StatusPill"

/** Events shown either side of the one running now or next. */
const AROUND = 3

/** The strip's events: those around `anchor`, in date order, with `chosen` added if outside. */
function stripEvents(events: RaceEvent[], anchor: RaceEvent, chosen: RaceEvent): RaceEvent[] {
	const at = events.indexOf(anchor)
	const near = events.slice(Math.max(0, at - AROUND), at + AROUND + 1)
	return near.includes(chosen) ? near : [...near, chosen].sort((a, b) => events.indexOf(a) - events.indexOf(b))
}

export function EventStrip({ events, anchor, chosen, teams, now, onPick }: {
	events: RaceEvent[]
	/** The event running now or next: the strip centres on it. */
	anchor: RaceEvent
	chosen: RaceEvent
	/** The chosen event's saved teams, once its payload has loaded. */
	teams: number | null
	now: Date
	onPick: (event: RaceEvent) => void
}) {
	const chosenRef = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		chosenRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
	}, [chosen])
	return (
		<div role="group" aria-label="Event" className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
			{stripEvents(events, anchor, chosen).map((event) => {
				const on = event === chosen
				const status = isRunning(event, now) ? "running" : hasEnded(event, now) ? "ended" : "upcoming"
				const { title } = splitEventName(event)
				return (
					<button
						key={`${event.event_type}-${event.id}`}
						ref={on ? chosenRef : undefined}
						type="button"
						aria-pressed={on}
						onClick={() => onPick(event)}
						className={`flex min-w-[9.5rem] shrink-0 flex-col gap-0.5 rounded-[10px] border px-[11px] py-[7px] text-left transition ${
							on ? "border-brand bg-brand/15" : "border-gray-600 bg-gray-800 hover:border-gray-500"
						}`}
					>
						<b className={`whitespace-nowrap text-xs font-semibold ${on ? "text-brand" : "text-gray-100"}`}>
							{shortEventName(event)}
							{title !== event.name ? ` ${title}` : ""}
						</b>
						<span className="flex items-center gap-1.5 text-[11px] tabular-nums text-gray-400">
							<StatusPill status={status} />
							{on && teams !== null && `${teams.toLocaleString()} ${teams === 1 ? "team" : "teams"}`}
						</span>
					</button>
				)
			})}
		</div>
	)
}
