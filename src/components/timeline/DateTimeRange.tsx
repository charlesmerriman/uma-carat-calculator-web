import { formatDate, formatTime, localZoneName } from "../../utils/dateFormat"

/**
 * A Timeline card's dates with the viewer's own times, the zone named once:
 * "2026/10/31 3:00 PM through 2026/11/6 2:59 PM (PT)". Daptrius asked for
 * banner times (2026-10-14); always shown, one zone label per card (owner,
 * 2026-10-28).
 *
 * Renders a fragment into the caller's element, and the dates stay that
 * element's OWN text while the times and the zone sit in child spans. So the
 * element still reads "2026/10/31 through 2026/11/6" to anything that matches
 * on a node's own text, which is how the Timeline tests find a card, and a
 * screen reader still hears the whole line. `end` is optional for an event
 * that only starts (a scenario's release).
 */
export function DateTimeRange({ start, end = null }: { start: string; end?: string | null }) {
	const zone = localZoneName(start)
	return (
		<>
			{formatDate(start)}
			<Time value={start} />
			{end && (
				<>
					{" through "}
					{formatDate(end)}
					<Time value={end} />
				</>
			)}
			{zone && <span className="whitespace-nowrap font-normal"> ({zone})</span>}
		</>
	)
}

// The leading space lives inside the span so the parent's own text has no
// doubled space where a time was cut out of it.
function Time({ value }: { value: string }) {
	const time = formatTime(value)
	return time ? <span className="whitespace-nowrap font-normal"> {time}</span> : null
}
