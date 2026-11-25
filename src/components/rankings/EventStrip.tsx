/**
 * The PvP tab's event picker (mock 09-pvp.png; soft tabs since the
 * 2026-11-25 polish, notes/rankings-polish-plan.md): a sideways row of event
 * cards, each its short name and title and a status pill (no team count:
 * the Rankings page never says how many). Replaces the native <select>. Shows the events around
 * the one running now or next (three either side), plus the chosen one if
 * it falls outside; the strip scrolls sideways when it doesn't fit, and the
 * chosen card is scrolled into view.
 */

import { useEffect, useRef } from "react"
import type { RaceEvent } from "../../types"
import { hasEnded, isRunning } from "../../utils/pvpGuide"
import { shortEventName, splitEventName } from "../../utils/pvpEvent"
import { eventsAround } from "../../utils/rankingsWindow"
import { StatusPill } from "./kit/StatusPill"

export function EventStrip({ events, anchor, chosen, now, onPick }: {
	events: RaceEvent[]
	/** The event running now or next: the strip centres on it. */
	anchor: RaceEvent
	chosen: RaceEvent
	now: Date
	onPick: (event: RaceEvent) => void
}) {
	const chosenRef = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		chosenRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
	}, [chosen])
	return (
		// pb-1: room for the chosen tab's shadow inside the scroller.
		<div role="group" aria-label="Event" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
			{eventsAround(events, anchor, chosen).map((event) => {
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
						// A soft tab (rk-event in rankings.css), the chosen one tinted with the brand's rule under it.
						className="rk-event flex min-w-[10.5rem] shrink-0 flex-col gap-1 rounded-[0.875rem] px-3.5 py-2.5 text-left transition hover:brightness-110"
					>
						<b className={`whitespace-nowrap font-display text-[15px] font-bold ${on ? "text-brand" : "text-gray-100"}`}>
							{shortEventName(event)}
							{title !== event.name ? ` ${title}` : ""}
						</b>
						<span className="flex items-center gap-1.5 text-[11px] tabular-nums text-gray-400">
							<StatusPill status={status} />
						</span>
					</button>
				)
			})}
		</div>
	)
}
