/**
 * The track view's legend (Daptrius's render, owner 2026-11-03): what its
 * colours and marks mean. The strip writes its words on the segments, so this
 * shows only while a track is drawn (Track or Both). The colours are the same
 * tokens CourseTrack draws with.
 */
const PHASES = [
	{ label: "Early-race", colour: "var(--color-course-early)" },
	{ label: "Mid-race", colour: "var(--color-course-mid)" },
	{ label: "Late-race", colour: "var(--color-course-late)" },
	{ label: "Last spurt", colour: "var(--color-course-final)" },
]
const HILLS = [
	{ label: "Uphill", colour: "var(--color-course-uphill)" },
	{ label: "Downhill", colour: "var(--color-course-downhill)" },
]

export default function CourseLegend() {
	return (
		<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400" aria-label="Track legend">
			{PHASES.map((phase) => (
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
				<span className="inline-block h-3 w-0.5 bg-gray-100" />
				Last spurt can start
			</li>
			<li className="flex items-center gap-1.5">
				<span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-50" />
				Start
			</li>
			<li className="flex items-center gap-1.5">
				<span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
				Goal
			</li>
		</ul>
	)
}
