/**
 * "Accels on this course" (notes/course-map-plan-2.md, section 8; owner,
 * 2026-11-03: "Uniques and accels together, not just gold accels"): every
 * skill with an acceleration effect that can fire on this course for a style,
 * nearest the last spurt's start first, each with its verdict; a tap lights it
 * on the map.
 *
 * Opt-in like every layer: closed, it fetches nothing. Open, it reads the
 * course's skill zones (the map the layers share) and the PvP catalogue for
 * names and whose unique a skill is (the team builder's, shared). It shows
 * wherever the guide's course map shows (owner, 2026-11-03), and is game data
 * plus our verdicts, so it doesn't depend on reading the guide.
 */
import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import type { RaceCourse } from "../../types"
import type { MemberStyle } from "../../types/pvpTeam"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useCourseZones } from "../../services/courseQueries"
import { setCourseFocus, useCourseFocus } from "../../services/courseMapStore"
import { accelRows, verdictLines } from "../../utils/courseLayers"

const STYLES: { value: MemberStyle; label: string }[] = [
	{ value: "front", label: "Front" },
	{ value: "pace", label: "Pace" },
	{ value: "late", label: "Late" },
	{ value: "end", label: "End" },
]
// Enough to see the best of a style; the rest behind "Show all".
const FIRST_ROWS = 12

function AccelList({ course, style }: { course: RaceCourse; style: MemberStyle }) {
	const zones = useCourseZones(course.id)
	const catalogue = usePvpCatalogue()
	const focus = useCourseFocus()
	const [all, setAll] = useState(false)

	const ready = catalogue.status === "ready" ? catalogue : null
	// Whose unique a skill is, from the umas' skill lists.
	const uniqueOf = useMemo(() => {
		const owners = new Map<number, string>()
		for (const uma of ready?.catalogue.umas ?? []) {
			for (const link of uma.skills ?? []) if (link.source === "unique") owners.set(link.skill, uma.name)
		}
		return owners
	}, [ready])
	const rows = useMemo(
		() => (zones.data ? accelRows(zones.data, style, (skillId) => (uniqueOf.has(skillId) ? 0 : 1)) : []),
		[zones.data, style, uniqueOf],
	)

	if (zones.isError || catalogue.status === "error") return <p className="text-xs text-gray-400">The list didn't load.</p>
	if (!zones.data || !ready) return <p className="text-xs text-gray-400" role="status">Loading the accels…</p>
	if (rows.length === 0) return <p className="text-xs text-gray-400">No acceleration skill fires here for this style.</p>

	const shown = all ? rows : rows.slice(0, FIRST_ROWS)
	return (
		<>
			<ul className="flex flex-col gap-1" aria-label="Accels on this course">
				{shown.map(({ skillId, entry }) => {
					const skill = ready.skillsById.get(skillId)
					const name = skill?.name ?? `Skill ${skillId}`
					const owner = uniqueOf.get(skillId)
					const [first, ...rest] = verdictLines(entry, course.distance)
					const lit = focus?.skillId === skillId
					return (
						<li key={skillId}>
							<button
								type="button"
								aria-pressed={lit}
								onClick={() => setCourseFocus(lit ? null : { skillId, name })}
								className={`flex w-full items-start gap-2 rounded-md border px-2 py-1 text-left text-xs transition ${
									lit ? "border-brand bg-brand/10" : "border-gray-700 hover:border-gray-500"
								}`}
							>
								{skill?.image ? (
									<img src={skill.image} alt="" className="mt-0.5 h-5 w-5 shrink-0" loading="lazy" decoding="async" />
								) : (
									<span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
								)}
								<span className="min-w-0 flex-1">
									<span className="block font-medium text-gray-100">
										{name}
										{owner && <span className="font-normal text-gray-400"> · unique of {owner}</span>}
									</span>
									{first && <span className="block text-gray-300">{first}</span>}
									{rest.map((line) => (
										<span key={line} className="block text-gray-500">{line}</span>
									))}
								</span>
							</button>
						</li>
					)
				})}
			</ul>
			{rows.length > FIRST_ROWS && (
				<button type="button" onClick={() => setAll((was) => !was)} className="mt-1 text-xs font-medium text-brand hover:text-brand/75">
					{all ? "Show fewer" : `Show all ${rows.length}`}
				</button>
			)}
		</>
	)
}

export default function CourseAccelList({ course }: { course: RaceCourse }) {
	const [open, setOpen] = useState(false)
	const [style, setStyle] = useState<MemberStyle>("front")
	return (
		<div className="mt-3">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((was) => !was)}
				className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 transition hover:text-gray-100"
			>
				<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
				Accels on this course
			</button>
			{open && (
				<div className="mt-2">
					<div role="group" aria-label="Running style" className="mb-2 flex gap-1">
						{STYLES.map((option) => (
							<button
								key={option.value}
								type="button"
								aria-pressed={style === option.value}
								onClick={() => setStyle(option.value)}
								className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
									style === option.value ? "border-brand bg-brand/15 text-gray-100" : "border-gray-600 text-gray-400 hover:text-gray-200"
								}`}
							>
								{option.label}
							</button>
						))}
					</div>
					<AccelList course={course} style={style} />
				</div>
			)}
		</div>
	)
}
