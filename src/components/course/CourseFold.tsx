/**
 * The PvP page's course map, open or folded to its one-line answer (review
 * item 3, 2026-11-24).
 *
 * The map is drawn above the view tabs, so it sat on top of every tab: My
 * team, CM Runs and the Gallery started under the fold, and a phone scrolled
 * two screens of map before reaching the guide. Folded, the block keeps its
 * title and the spurt sentence ("Last spurt can start in corner 4..."), with
 * a button to open the map; open, it is the whole CourseSection with a button
 * to fold it again.
 *
 * Where it starts: open on Recommendations at sm and wider, folded on the
 * other tabs and on a phone. Once the reader opens or folds it, that choice
 * is kept on the device for that place (courseMapStore, `useMapOpenChoice`).
 * A skill lit from the guide (its chip, the Skills panel) opens it for as
 * long as the skill is lit, so lighting never draws on a map you can't see.
 *
 * PvP only: the Timeline's drawer draws its own map and never folds.
 */
import { ChevronDown } from "lucide-react"
import type { RaceCourse, RaceEvent } from "../../types"
import type { PvpGuide } from "../../types/pvpGuide"
import { COURSE_MAP_ID, setMapOpen, useCourseFocus, useMapOpenChoice, type MapPlace } from "../../services/courseMapStore"
import { useNarrowScreen } from "../../hooks/useNarrowScreen"
import CourseHeadline from "./CourseHeadline"
import CourseSection from "./CourseSection"
import { courseName } from "./courseName"

const FOLD_BUTTON =
	"flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-600 px-2.5 py-1 text-xs font-semibold text-gray-200 transition hover:bg-gray-700/60"

export default function CourseFold({ course, event, guide, place }: {
	course: RaceCourse
	event: RaceEvent
	guide: PvpGuide | null
	/** Which tab the page is on: Recommendations ("guide"), or any other ("tools"). */
	place: MapPlace
}) {
	const narrow = useNarrowScreen()
	const choice = useMapOpenChoice(place)
	const lit = useCourseFocus() !== null
	const open = lit || (choice ?? (place === "guide" && !narrow))

	if (open) return <CourseSection course={course} event={event} guide={guide} onFold={() => setMapOpen(place, false)} />
	return (
		<div id={COURSE_MAP_ID} className="border-t border-gray-700/70 p-3 sm:p-4">
			<div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
				<h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Course map</h3>
				<span className="text-sm text-gray-300">{courseName(course)}</span>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<CourseHeadline course={course} leadOnly className="flex-1 basis-[16rem]" />
				<button type="button" className={FOLD_BUTTON} aria-expanded={false} onClick={() => setMapOpen(place, true)}>
					Show the map
					<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</div>
		</div>
	)
}
