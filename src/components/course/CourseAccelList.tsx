/**
 * "Accels that land at the spurt" (notes/course-map-plan-2.md, section 8;
 * notes/course-map-visual-plan.md, "The accels column"): the accels that can
 * land at the last spurt's start here, most useful first (owner, 2026-11-03:
 * "the ones that are actually useful on the track ... ranked by usefulness",
 * by position with an "all"), each with its grade, its first verdict line
 * and its zone as one bar; a tap lights it on the map and opens the verdict
 * card. Usefulness is the API's ranking score, never shown as a number.
 *
 * A column beside the map (CourseSection), closed until the reader opens it
 * (owner, 2026-11-03: the names come from the PvP catalogue, 690 KB, which a
 * guide visit doesn't otherwise fetch), so closed it fetches nothing. Open,
 * it reads the course's skill zones (the map the layers share) and the
 * catalogue for names, and for whose unique a skill is, drawn with her avatar
 * (FramedUma). The pills open on the guide tab's style. Beside the map it
 * scrolls within itself past the screen's height, so "Show all" never
 * strands the map at the top of a long page.
 *
 * A search box above the pills (Henry, 2026-11-04: "We need search function
 * for accel") narrows the rows by the skill's name or its owner uma's,
 * client-side, inside the picked style.
 */
import { useMemo, useState } from "react"
import { FramedUma } from "../FramedUma"
import type { RaceCourse } from "../../types"
import type { CatalogueUma } from "../../types/pvpTeam"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useCourseZones } from "../../services/courseQueries"
import { setCourseFocus, useCourseFocus, useStyleTab, type StyleChoice } from "../../services/courseMapStore"
import { accelRows, grade, verdictLines, type AccelRow } from "../../utils/courseLayers"
import { GradePill, ZoneBar } from "./CourseVerdictCard"

const STYLES: { value: StyleChoice; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "front", label: "Front" },
	{ value: "pace", label: "Pace" },
	{ value: "late", label: "Late" },
	{ value: "end", label: "End" },
]
const STYLE_NAMES: Record<string, string> = { front: "Front", pace: "Pace", late: "Late", end: "End" }
// Enough to see the best of a style; the rest behind "Show all".
const FIRST_ROWS = 8

/** Lower case with the accents dropped, so "condor" finds "Cóndor" too. */
function folded(text: string): string {
	return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

interface Owner {
	uma: CatalogueUma
	/** The inherited version (a white with the unique's name), not her own. */
	inherited: boolean
}

/**
 * Why a row ranks where it does (owner, 2026-11-04): the rank's two parts
 * as chips, Accel (the share landing well times the speed its acceleration
 * adds) and Carry (the share carrying speed into the late race times that
 * speed), and the carry in the game's terms. A part of zero is left out.
 */
function RankParts({ entry }: { entry: AccelRow["entry"] }) {
	const accel = entry.spurt?.accel ?? 0
	const carry = entry.spurt?.carry ?? 0
	const carries = carry > 0 && entry.carry_speed !== undefined
	if (accel <= 0 && !carries) return null
	return (
		<span className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-semibold tabular-nums">
			{accel > 0 && <span className="rounded-full bg-gray-700 px-1.5 py-px text-gray-200">Accel {accel.toFixed(2)}</span>}
			{carries && <span className="rounded-full bg-brand/20 px-1.5 py-px text-brand">Carry {carry.toFixed(2)}</span>}
			{carries && (
				<span className="font-normal text-gray-400">
					+{entry.carry_speed?.toFixed(2)} m/s into the late race{entry.carry_seconds ? ` for ${entry.carry_seconds} s` : ""}
				</span>
			)}
		</span>
	)
}

function AccelRows({ course, rows, style, searching, owners, skillsById }: {
	course: RaceCourse
	rows: AccelRow[]
	style: StyleChoice
	/** A search is narrowing the rows: an empty list says so. */
	searching: boolean
	owners: Map<number, Owner>
	skillsById: Map<number, { name: string; image: string | null }>
}) {
	const oshiIds = useOshiIds()
	const focus = useCourseFocus()
	const [all, setAll] = useState(false)
	if (rows.length === 0) {
		return <p className="text-xs text-gray-400">{searching ? "No skill here matches that." : "No accel lands at the late-race start here for this style."}</p>
	}
	const shown = all ? rows : rows.slice(0, FIRST_ROWS)
	return (
		<>
			<ul className="flex flex-col gap-1" aria-label="Accels on this course">
				{shown.map(({ skillId, entry }) => {
					const skill = skillsById.get(skillId)
					const name = skill?.name ?? `Skill ${skillId}`
					const owner = owners.get(skillId)
					const given = grade(entry)
					const [first] = verdictLines(entry, course.distance)
					const lit = focus?.skillId === skillId
					return (
						<li key={skillId}>
							<button
								type="button"
								aria-pressed={lit}
								onClick={() => setCourseFocus(lit ? null : {
									skillId,
									name,
									image: skill?.image ?? null,
									owner: owner ? { name: owner.uma.name, portrait: owner.uma.portrait, inherited: owner.inherited } : undefined,
								})}
								className={`flex w-full items-start gap-2 rounded-[9px] border px-2 py-1.5 text-left text-xs transition ${
									lit ? "border-brand bg-brand/10" : "border-transparent bg-gray-800/70 hover:border-gray-500"
								}`}
							>
								{owner ? (
									<FramedUma src={owner.uma.portrait} oshi={oshiIds.has(owner.uma.id)} alt="" title={owner.uma.name} className="h-7 w-7 shrink-0" />
								) : skill?.image ? (
									<img src={skill.image} alt="" className="mt-0.5 h-6 w-6 shrink-0" loading="lazy" decoding="async" />
								) : (
									<span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
								)}
								<span className="min-w-0 flex-1">
									<span className="block text-[12.5px] font-bold leading-tight text-gray-100">
										{name}
										{style === "all" && entry.styles && (
											<span className="font-normal text-gray-500"> · {entry.styles.map((key) => STYLE_NAMES[key] ?? key).join(", ")}</span>
										)}
									</span>
									{/* Whose unique it is, on its own quieter line. */}
									{owner && (
										<span className="block text-[10.5px] leading-tight text-gray-400">
											{owner.inherited ? `inherited from ${owner.uma.name}` : `unique of ${owner.uma.name}`}
										</span>
									)}
									{first && <span className="mt-0.5 block text-[11px] leading-snug text-gray-300">{first}</span>}
									<RankParts entry={entry} />
									<ZoneBar entry={entry} distance={course.distance} className="mt-1.5" />
								</span>
								{given && <GradePill grade={given} className="mt-px shrink-0" />}
							</button>
						</li>
					)
				})}
			</ul>
			{rows.length > FIRST_ROWS && (
				<button type="button" onClick={() => setAll((was) => !was)} className="mt-2 text-xs font-semibold text-brand transition hover:text-brand/75">
					{all ? "Show fewer" : `Show all ${rows.length}`}
				</button>
			)}
		</>
	)
}

/** The column: its title with the count, the style pills and the rows. Mounted only while open. */
export default function CourseAccelList({
	course,
	fieldSize,
	className = "",
}: {
	course: RaceCourse
	/** Runners in the event's race, for the style pills' placing check (FIELD_SIZE). */
	fieldSize?: number
	className?: string
}) {
	// The guide tab's style until the reader picks a pill.
	const tab = useStyleTab()
	const [picked, setPicked] = useState<StyleChoice | null>(null)
	const style = picked ?? tab
	const [query, setQuery] = useState("")
	const zones = useCourseZones(course.id)
	const catalogue = usePvpCatalogue()
	const ready = catalogue.status === "ready" ? catalogue : null
	// Whose unique a skill is: her own (the umas' "unique" links), or its
	// inherited white, which carries the same name.
	const owners = useMemo(() => {
		const found = new Map<number, Owner>()
		const byName = new Map<string, CatalogueUma>()
		for (const uma of ready?.catalogue.umas ?? []) {
			for (const link of uma.skills ?? []) {
				if (link.source !== "unique") continue
				found.set(link.skill, { uma, inherited: false })
				const name = ready?.skillsById.get(link.skill)?.name
				if (name && !byName.has(name)) byName.set(name, uma)
			}
		}
		for (const skill of ready?.catalogue.skills ?? []) {
			const uma = byName.get(skill.name)
			if (uma && !found.has(skill.id)) found.set(skill.id, { uma, inherited: true })
		}
		return found
	}, [ready])
	const rows = useMemo(
		() => (zones.data ? accelRows(zones.data, style, (skillId) => (owners.has(skillId) ? 0 : 1), fieldSize) : []),
		[zones.data, style, owners, fieldSize],
	)
	// The search: a row stays when its skill's name, or its owner uma's,
	// holds the words typed (one substring, case and accents ignored).
	const needle = folded(query.trim())
	const found = useMemo(() => {
		if (!needle) return rows
		return rows.filter(({ skillId }) => {
			const name = ready?.skillsById.get(skillId)?.name ?? `Skill ${skillId}`
			const owner = owners.get(skillId)?.uma.name ?? ""
			return folded(name).includes(needle) || folded(owner).includes(needle)
		})
	}, [rows, needle, ready, owners])
	const loaded = zones.data !== undefined && ready !== null

	return (
		<aside
			className={`rounded-xl border border-gray-700 bg-gray-900/40 p-3 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto ${className}`}
			aria-label="Accels that land at the spurt"
		>
			<div className="flex items-baseline justify-between gap-2">
				<h4 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-300">Accels that land at the spurt</h4>
				{loaded && <span className="shrink-0 text-[11px] text-gray-500">{found.length} here</span>}
			</div>
			<input
				type="search"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				placeholder="Search a skill or uma"
				aria-label="Search the accels"
				className="mt-2 w-full rounded-lg border border-gray-600 bg-gray-800/70 px-2.5 py-1 text-xs text-gray-100 placeholder:text-gray-500 focus:border-brand focus:outline-none"
			/>
			<div role="group" aria-label="Running style" className="my-2 flex flex-wrap gap-1">
				{STYLES.map((option) => (
					<button
						key={option.value}
						type="button"
						aria-pressed={style === option.value}
						onClick={() => setPicked(option.value)}
						className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
							style === option.value ? "border-brand bg-brand/15 text-gray-100" : "border-gray-600 text-gray-400 hover:text-gray-200"
						}`}
					>
						{option.label}
					</button>
				))}
			</div>
			{zones.isError || catalogue.status === "error" ? (
				<p className="text-xs text-gray-400">The list didn't load.</p>
			) : !loaded ? (
				<p className="text-xs text-gray-400" role="status">Loading the accels…</p>
			) : (
				<AccelRows course={course} rows={found} style={style} searching={needle !== ""} owners={owners} skillsById={ready.skillsById} />
			)}
		</aside>
	)
}
