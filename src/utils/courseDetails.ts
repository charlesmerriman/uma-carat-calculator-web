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

/**
 * The course as four pairs, each a headline with what belongs under it:
 * Racecourse (its direction), Distance (the band under the metres), Surface
 * (the ground) and Weather (the season). The Timeline card, the PvP guide's
 * header and the team picture all lay the course out this way (owner,
 * 2026-10-29), so the pairing lives here once.
 *
 * Every field is typed by an editor and may still read "TBD", so an unknown
 * half is null, and a value that doesn't read as expected ("Straight O" for a
 * direction) is shown as typed rather than guessed at. Always four, in order.
 */
export interface CoursePair {
	label: "Racecourse" | "Distance" | "Surface" | "Weather"
	/** "Chukyo", "1,200m", "Turf", "Sunny"; null until it is announced. */
	value: string | null
	/** "Left-handed", "Sprint", "Firm ground", "Winter"; null when unknown. */
	detail: string | null
}

/** "1200" or "1200m" as metres, else null. Editors type both. */
function metres(text: string | undefined): number | null {
	const match = text ? /^(\d{3,4})\s*m?$/i.exec(text.trim()) : null
	return match ? Number(match[1]) : null
}

const GROUNDS = new Set(["firm", "good", "soft", "heavy"])

export function coursePairs(event: RaceEvent): CoursePair[] {
	const known = new Map(availableCourseDetails(event).map((detail) => [detail.label, detail.value.trim()]))
	const direction = known.get("Direction")
	const condition = known.get("Track condition")

	// The metres can sit in either field ("Distance: 2200", "Length: Medium"),
	// and the band word in the other.
	const length = known.get("Length")
	const distance = known.get("Distance")
	const meters = metres(length) ?? metres(distance)
	const band = [distance, length].find((text) => text !== undefined && metres(text) === null) ?? null

	return [
		{
			label: "Racecourse",
			value: known.get("Racecourse") ?? null,
			detail: direction === undefined ? null : /^(left|right)$/i.test(direction) ? `${direction}-handed` : direction,
		},
		meters !== null
			? { label: "Distance", value: `${meters.toLocaleString("en-US")}m`, detail: band }
			: { label: "Distance", value: band, detail: null },
		{
			label: "Surface",
			value: known.get("Surface") ?? null,
			detail: condition === undefined ? null : GROUNDS.has(condition.toLowerCase()) ? `${condition} ground` : condition,
		},
		{ label: "Weather", value: known.get("Weather") ?? null, detail: known.get("Season") ?? null },
	]
}

/** The pairs with anything announced in them: what the course blocks draw. */
export function announcedCoursePairs(event: RaceEvent): CoursePair[] {
	return coursePairs(event).filter((pair) => pair.value !== null || pair.detail !== null)
}
