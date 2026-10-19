/**
 * A race event's course: racecourse, surface, distance and the rest.
 *
 * Shared by the Timeline's RaceEventCard and the PvP page's event header, so
 * course data is entered once (on the event, in the admin) and the two
 * surfaces cannot drift apart in what they show or how.
 */

import { MapPinned } from "lucide-react"
import type { RaceEvent } from "../../types"
import { availableCourseDetails } from "../../utils/courseDetails"

/** The "Course details" panel. Renders nothing when no slot is announced. */
export function CourseDetails({ event }: { event: RaceEvent }) {
	const details = availableCourseDetails(event)
	if (details.length === 0) return null
	return (
		<section className="card-panel p-3">
			<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand">
				<MapPinned className="h-4 w-4" />
				<span>Course details</span>
			</div>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{details.map((detail) => (
					<div key={detail.label} className="min-w-0 rounded-lg border border-gray-600/80 bg-gray-700/70 px-2 py-1.5">
						<div className="text-xs font-medium uppercase tracking-wide text-gray-400">{detail.label}</div>
						<div className="mt-0.5 truncate text-sm font-semibold text-gray-100">{detail.value.trim()}</div>
					</div>
				))}
			</div>
		</section>
	)
}
