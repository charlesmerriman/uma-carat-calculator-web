/**
 * A lit skill's verdict as a card beside the course map's headline
 * (notes/course-map-visual-plan.md, "The verdict card"): its icon, or her
 * portrait for a unique; a grade (courseLayers.grade); the verdict lines the
 * engine already words (verdictLines); and the zone as one bar against the
 * race with the last-spurt line on it (ZoneBar, which the accels column and
 * the skill chips' cards reuse). A close button clears the focus.
 *
 * Everything shown comes with the focus (courseMapStore.CourseFocus: the
 * name, the skill's picture, whose unique it is), set by whoever lit the
 * skill, so the card never fetches the catalogue.
 */
import { X } from "lucide-react"
import { FramedUma } from "../FramedUma"
import type { RaceCourse } from "../../types"
import type { CourseFocus } from "../../services/courseMapStore"
import { grade, verdictLines, type Grade, type SkillZoneEntry } from "../../utils/courseLayers"
import { metreToFraction, phaseStarts } from "../../utils/courseGeometry"

const TONES: Record<Grade["tone"], string> = {
	great: "bg-brand text-black",
	good: "bg-[color-mix(in_srgb,var(--color-course-mid)_28%,transparent)] text-[color-mix(in_srgb,var(--color-course-mid)_60%,var(--color-gray-100))]",
	ok: "bg-[color-mix(in_srgb,var(--color-course-late)_22%,transparent)] text-[color-mix(in_srgb,var(--color-course-late)_60%,var(--color-gray-100))]",
	poor: "bg-gray-700 text-gray-400",
}

/** The grade as a pill: the word, the odds small beside it. */
export function GradePill({ grade: given, className = "" }: { grade: Grade; className?: string }) {
	return (
		<span className={`inline-flex items-baseline gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[10.5px] font-bold ${TONES[given.tone]} ${className}`}>
			{given.word}
			{given.odds !== undefined && <em className="not-italic font-semibold opacity-80 tabular-nums">{Math.round(given.odds * 100)}%</em>}
		</span>
	)
}

/**
 * A skill's zone against the race in one bar: the four phases underneath,
 * quietly, the zone over them, the last-spurt line at 2/3. The one-lane strip
 * a popup far from the map shows (owner, 2026-11-04).
 */
export function ZoneBar({ entry, distance, className = "" }: { entry: SkillZoneEntry; distance: number; className?: string }) {
	const { mid, late, finalSixth } = phaseStarts(distance)
	const at = (metre: number) => `${metreToFraction(metre, distance) * 100}%`
	const phases = [[0, mid, "early"], [mid, late, "mid"], [late, finalSixth, "late"], [finalSixth, distance, "spurt"]] as const
	return (
		<span className={`relative block h-1.5 w-full overflow-hidden rounded-full bg-gray-700 ${className}`} aria-hidden="true">
			{phases.map(([from, to, name]) => (
				<span key={name} className="absolute inset-y-0 opacity-40" style={{ left: at(from), width: `${(metreToFraction(to, distance) - metreToFraction(from, distance)) * 100}%`, background: `var(--color-course-${name})` }} />
			))}
			{(entry.zones ?? []).map((zone, index) => {
				const from = metreToFraction(zone.start, distance) * 100
				const width = Math.max(0.8, metreToFraction(zone.end, distance) * 100 - from)
				return (
					<span
						key={index}
						className="absolute inset-y-0 rounded-full"
						style={{
							left: `${from}%`,
							width: `${width}%`,
							background: zone.kind === "random"
								? "repeating-linear-gradient(135deg, var(--color-course-lit) 0 3px, color-mix(in srgb, var(--color-course-lit) 35%, transparent) 3px 6px)"
								: "var(--color-course-lit)",
						}}
					/>
				)
			})}
			{entry.fires_at !== undefined && entry.zones.length > 0 && (
				<span className="absolute -inset-y-0.5 w-[3px] -translate-x-px rounded-sm" style={{ left: at(entry.fires_at), background: "var(--color-course-lit)" }} />
			)}
			<span className="absolute -inset-y-[3px] w-0.5" style={{ left: at(late), background: "var(--color-course-beacon)" }} />
		</span>
	)
}

export default function CourseVerdictCard({ course, focus, entry, onClear, className = "" }: {
	course: RaceCourse
	focus: CourseFocus
	entry: SkillZoneEntry | undefined
	onClear: () => void
	className?: string
}) {
	const lines = verdictLines(entry, course.distance)
	const given = grade(entry)
	const owner = focus.owner
	return (
		<div className={`w-full max-w-[380px] rounded-[10px] border border-gray-600 bg-gray-900/70 px-3 py-2.5 ${className}`} aria-label={`${focus.name} on this course`}>
			<div className="flex items-center gap-2.5">
				{owner ? (
					<FramedUma src={owner.portrait} alt="" title={owner.name} className="h-9 w-9 shrink-0" />
				) : focus.image ? (
					<img src={focus.image} alt="" className="h-7 w-7 shrink-0" loading="lazy" decoding="async" />
				) : (
					<span className="h-7 w-7 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
				)}
				<div className="min-w-0 flex-1 leading-tight">
					<p className="truncate text-[13px] font-bold text-gray-100">{focus.name}</p>
					<p className="truncate text-[11px] text-gray-400">
						{owner ? (owner.inherited ? `inherited from ${owner.name}` : `${owner.name}'s unique`) : "On this course"}
					</p>
				</div>
				{given && <GradePill grade={given} />}
				<button type="button" onClick={onClear} aria-label="Unlight this skill" className="-mr-1 rounded p-1 text-gray-400 transition hover:text-gray-100">
					<X className="h-4 w-4" aria-hidden="true" />
				</button>
			</div>
			{lines.length > 0 && (
				<div className="mt-2 text-xs leading-snug text-gray-200">
					{lines.map((line, index) => (
						// By index: two ways of firing can word the same.
						<p key={index} className={line.startsWith("Also needs") || line.startsWith("Plus") ? "text-gray-400" : ""}>{line}</p>
					))}
				</div>
			)}
			{entry && entry.kind === "place" && <ZoneBar entry={entry} distance={course.distance} className="mt-2" />}
		</div>
	)
}
