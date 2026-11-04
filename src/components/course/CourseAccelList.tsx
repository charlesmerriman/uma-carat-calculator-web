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
 * (FramedUma). The pills open on the guide tab's style.
 */
import { useMemo, useState, useSyncExternalStore } from "react"
import { FramedUma } from "../FramedUma"
import type { RaceCourse } from "../../types"
import type { CatalogueUma, MemberStyle } from "../../types/pvpTeam"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useCourseZones } from "../../services/courseQueries"
import { setCourseFocus, useCourseFocus } from "../../services/courseMapStore"
import { accelRows, grade, verdictLines } from "../../utils/courseLayers"
import { GradePill, ZoneBar } from "./CourseVerdictCard"

type StyleChoice = MemberStyle | "all"

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

interface Owner {
	uma: CatalogueUma
	/** The inherited version (a white with the unique's name), not her own. */
	inherited: boolean
}

/** The guide tab the reader is on, as the pills' first choice ("all" for anything else). */
function styleFromTab(tab: string | null): StyleChoice {
	return tab && tab in STYLE_NAMES ? (tab as StyleChoice) : "all"
}

function onNavigation(listener: () => void) {
	window.addEventListener("popstate", listener)
	return () => window.removeEventListener("popstate", listener)
}

/**
 * The `style` in the address (the guide tab): a client snapshot with "all"
 * on the server, since the block is prerendered and can sit outside a router.
 */
function useStyleTab(): StyleChoice {
	return useSyncExternalStore(onNavigation, () => styleFromTab(new URLSearchParams(window.location.search).get("style")), () => "all")
}

function AccelRows({ course, style }: { course: RaceCourse; style: StyleChoice }) {
	const zones = useCourseZones(course.id)
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	const focus = useCourseFocus()
	const [all, setAll] = useState(false)

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
		() => (zones.data ? accelRows(zones.data, style, (skillId) => (owners.has(skillId) ? 0 : 1)) : []),
		[zones.data, style, owners],
	)

	if (zones.isError || catalogue.status === "error") return <p className="text-xs text-gray-400">The list didn't load.</p>
	if (!zones.data || !ready) return <p className="text-xs text-gray-400" role="status">Loading the accels…</p>
	if (rows.length === 0) return <p className="text-xs text-gray-400">No accel lands at the late-race start here for this style.</p>

	const shown = all ? rows : rows.slice(0, FIRST_ROWS)
	return (
		<>
			<ul className="flex flex-col gap-1" aria-label="Accels on this course">
				{shown.map(({ skillId, entry }) => {
					const skill = ready.skillsById.get(skillId)
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
										{owner && (
											<span className="font-normal text-gray-400">
												{owner.inherited ? ` · inherited from ${owner.uma.name}` : ` · unique of ${owner.uma.name}`}
											</span>
										)}
										{style === "all" && entry.styles && (
											<span className="font-normal text-gray-500"> · {entry.styles.map((key) => STYLE_NAMES[key] ?? key).join(", ")}</span>
										)}
									</span>
									{first && <span className="mt-0.5 block text-[11px] leading-snug text-gray-300">{first}</span>}
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

/** The column: its title, the style pills and the rows. Mounted only while open. */
export default function CourseAccelList({ course, className = "" }: { course: RaceCourse; className?: string }) {
	// The guide tab's style until the reader picks a pill.
	const tab = useStyleTab()
	const [picked, setPicked] = useState<StyleChoice | null>(null)
	const style = picked ?? tab
	const setStyle = setPicked
	return (
		<aside className={`rounded-xl border border-gray-700 bg-gray-900/40 p-3 ${className}`} aria-label="Accels that land at the spurt">
			<h4 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-300">Accels that land at the spurt</h4>
			<div role="group" aria-label="Running style" className="my-2 flex flex-wrap gap-1">
				{STYLES.map((option) => (
					<button
						key={option.value}
						type="button"
						aria-pressed={style === option.value}
						onClick={() => setStyle(option.value)}
						className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
							style === option.value ? "border-brand bg-brand/15 text-gray-100" : "border-gray-600 text-gray-400 hover:text-gray-200"
						}`}
					>
						{option.label}
					</button>
				))}
			</div>
			<AccelRows course={course} style={style} />
		</aside>
	)
}
