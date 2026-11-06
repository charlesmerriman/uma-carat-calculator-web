import type { TrackColours } from "../../services/courseShapeStore"

/**
 * The track view's legend: what its colours and marks mean. Shown with the
 * Track view alone (owner, 2026-11-03): under Strip and Both the strip's words
 * already name every colour. The swatches are the same tokens the track and
 * the strip draw with (notes/course-map-visual-plan.md). Its first swatches
 * follow the track's colours: the phases, or the corners and straights.
 */
const PHASES = [
	{ label: "Early-race", colour: "var(--color-course-early)" },
	{ label: "Mid-race", colour: "var(--color-course-mid)" },
	{ label: "Late-race", colour: "var(--color-course-late)" },
	{ label: "Last spurt", colour: "var(--color-course-spurt)" },
]
// By course, the strip's Course row colours: straights, the final straight, and the two corner shades.
const PARTS = [
	{ label: "Straight", colour: "var(--color-course-straight)" },
	{ label: "Final straight", colour: "var(--color-course-straight-final)" },
	{ label: "Corner", colour: "linear-gradient(90deg, var(--color-course-corner) 50%, var(--color-course-corner-alt) 50%)" },
]
const HILLS = [
	{ label: "Uphill", colour: "var(--color-course-up)" },
	{ label: "Downhill", colour: "var(--color-course-down)" },
]

export default function CourseLegend({ colours = "phase" }: { colours?: TrackColours }) {
	return (
		<ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400" aria-label="Track legend">
			{(colours === "course" ? PARTS : PHASES).map((phase) => (
				<li key={phase.label} className="flex items-center gap-1.5">
					<span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: phase.colour }} />
					{phase.label}
				</li>
			))}
			{HILLS.map((hill) => (
				<li key={hill.label} className="flex items-center gap-1.5">
					{/* A bracket beside the track, as drawn. */}
					<span className="inline-block h-1 w-5 rounded-sm" style={{ background: hill.colour }} />
					{hill.label}
				</li>
			))}
			<li className="flex items-center gap-1.5">
				<span className="inline-block h-3 w-0.5 rounded-px bg-brand" />
				Spurt starts
			</li>
			<li className="flex items-center gap-1.5">
				<span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-course-gate)" }} />
				Start, and the arrow the race runs
			</li>
			<li className="flex items-center gap-1.5">
				<span
					className="inline-block h-2.5 w-5 rounded-sm"
					style={{ background: "repeating-conic-gradient(#f8fafc 0 25%, #0b0b0f 0 50%) 0 0 / 5px 5px" }}
				/>
				Goal
			</li>
		</ul>
	)
}
