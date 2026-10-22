/**
 * A race event's course slots, and which of them are announced. The data
 * half of components/timeline/CourseDetails.tsx, kept apart so that file
 * exports only components (React fast refresh needs that).
 */

import type { RaceEvent } from "../types"

// Course details are entered by hand in the admin and are unknown until the
// event is announced. The models' columns are non-null, so "unknown" is encoded
// as a sentinel rather than an absent value: text fields are seeded with "TBD".
// Keep each slot visible and translate the sentinel into a useful, consistent
// pending state.
function isTrackDetailAvailable(value: string | null | undefined): boolean {
	if (value == null) return false
	const trimmed = value.trim()
	return trimmed !== "" && trimmed.toUpperCase() !== "TBD"
}

export interface CourseDetail {
	label: string
	value: string
}

/** Every course slot, announced or not, in display order. */
export function courseDetails(event: RaceEvent): CourseDetail[] {
	return [
		{ label: "Racecourse", value: event.track },
		{ label: "Surface", value: event.surface_type },
		{ label: "Distance", value: event.distance },
		{ label: "Length", value: event.length },
		{ label: "Direction", value: event.direction },
		{ label: "Track condition", value: event.track_condition },
		{ label: "Season", value: event.season },
		{ label: "Weather", value: event.weather },
	]
}

/** The announced slots only. */
export function availableCourseDetails(event: RaceEvent): CourseDetail[] {
	return courseDetails(event).filter((detail) => isTrackDetailAvailable(detail.value))
}
