/**
 * The course map in words, for screen readers (owner, 2026-11-02): the
 * straights and corners, the hills, the ground, the phases and the markers, in
 * metres. Visually hidden, and built from the same courseGeometry functions
 * as the strip, so the words and the drawing can never disagree. The strip
 * itself is aria-hidden.
 */
import type { RaceCourse } from "../../types"
import {
	courseFacts,
	formatMetres,
	slopeParts,
	surfaceParts,
	trackParts,
} from "../../utils/courseGeometry"
import { courseName } from "./courseName"

function stretch(start: number, end: number, distance: number): string {
	return end >= distance ? `from ${formatMetres(start)} to the finish` : `from ${formatMetres(start)} to ${formatMetres(end)}`
}

export default function CourseFactsList({ course }: { course: RaceCourse }) {
	const { distance } = course
	const facts = courseFacts(course)
	const track = trackParts(course).filter((part) => part.kind !== "gap")
	const hills = slopeParts(course)
	const ground = surfaceParts(course)

	return (
		<div className="sr-only">
			<h4>The course map in words: {courseName(course)}</h4>
			<ul>
				{track.map((part) => (
					<li key={`${part.kind}-${part.start}`}>{part.label} {stretch(part.start, part.end, distance)}</li>
				))}
				{hills.length === 0
					? <li>No hills</li>
					: hills.map((hill) => <li key={hill.start}>{hill.label} {stretch(hill.start, hill.end, distance)}</li>)}
				{ground.map((part) => (
					<li key={`ground-${part.start}`}>{part.surface === "turf" ? "Turf" : "Dirt"} {stretch(part.start, part.end, distance)}</li>
				))}
				{facts.spans.map((phase) => (
					<li key={`phase-${phase.start}`}>{phase.label} {stretch(phase.start, phase.end, distance)}</li>
				))}
				{facts.markers.filter((marker) => marker.label).map((marker) => (
					<li key={`marker-${marker.kind}`}>{marker.label}: {formatMetres(marker.at)}</li>
				))}
			</ul>
		</div>
	)
}
