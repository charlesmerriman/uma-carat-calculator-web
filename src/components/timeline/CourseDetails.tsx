/**
 * A race event's course, as four pairs (utils/courseDetails.ts `coursePairs`):
 * Racecourse over its direction, Distance over its band, Surface over the
 * ground, Weather over the season.
 *
 * Shared by the Timeline's RaceEventCard and the PvP page's event header, so
 * course data is entered once (on the event, in the admin) and the two
 * surfaces cannot drift apart in what they show or how. The team picture
 * (pvp/share/TeamPicture.tsx) pairs it the same way.
 */

import { MapPinned } from "lucide-react"
import type { RaceEvent } from "../../types"
import { announcedCoursePairs } from "../../utils/courseDetails"

/**
 * The four pairs, each column's title over its two lines (owner, 2026-10-29:
 * four in a row like the team picture's tiles). The line under the headline is
 * the same size, a step lighter: it is as much a fact about the race as the
 * headline, so it must not read as a footnote. A half not announced yet reads
 * "TBD"; a column with neither half is left out. `boxed` puts each column in
 * its own box (the Timeline card); the PvP header keeps them unboxed, light
 * (owner, 2026-10-13).
 */
export function CoursePairs({ event, boxed = false }: { event: RaceEvent; boxed?: boolean }) {
	const pairs = announcedCoursePairs(event)
	if (pairs.length === 0) return null
	return (
		<dl className={`grid grid-cols-2 sm:grid-cols-4 ${boxed ? "gap-2" : "gap-x-4 gap-y-3"}`} aria-label="Course">
			{pairs.map((pair) => (
				<div key={pair.label} className={`min-w-0 ${boxed ? "rounded-lg border border-gray-600/80 bg-gray-700/70 px-2.5 py-2" : ""}`}>
					<dt className="text-xs font-semibold tracking-wider text-gray-400 uppercase">{pair.label}</dt>
					<dd className={`mt-1 truncate text-[15px] leading-snug font-semibold ${pair.value ? "text-gray-50" : "text-gray-400"}`} title={pair.value ?? undefined}>
						{pair.value ?? "TBD"}
					</dd>
					{/* Always drawn, so the second line of all four sits on one row. */}
					<dd className="min-h-[1.3rem] truncate text-[15px] leading-snug font-medium text-gray-300" title={pair.detail ?? undefined}>
						{pair.detail}
					</dd>
				</div>
			))}
		</dl>
	)
}

/** The Timeline card's "Course details" panel. Renders nothing when no slot is announced. */
export function CourseDetails({ event }: { event: RaceEvent }) {
	if (announcedCoursePairs(event).length === 0) return null
	return (
		<section className="card-panel p-3">
			<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand">
				<MapPinned className="h-4 w-4" />
				<span>Course details</span>
			</div>
			<CoursePairs event={event} boxed />
		</section>
	)
}
