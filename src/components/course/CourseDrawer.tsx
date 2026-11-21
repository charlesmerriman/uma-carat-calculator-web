/**
 * The Timeline race card's course drawer (owner, 2026-10-29: "a toggleable
 * slide-out from the bottom of the card, animated, showing the course").
 *
 * Closed by default, like every layer (new layers are opt-in), and the card's
 * right column is already full, so the course gets a drawer under the art and
 * the panels instead of a third panel. Inside: the course's name, its real
 * shape as a track (owner, 2026-11-03: the actual course map, never the strip
 * or the schematic), the headline, and the way to the full map in the event's
 * guide. The shape is fetched when the drawer opens, and earlier when a
 * pointer or focus reaches the button. The open and close are a height
 * animation, so they check useReducedMotion themselves (MotionConfig only
 * stops transforms).
 */
import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronDown, Loader2, Map as MapIcon } from "lucide-react"
import type { RaceCourse } from "../../types"
import { useCourseShape, usePrefetchCourseShape } from "../../services/courseQueries"
import { useTrackColours } from "../../services/courseShapeStore"
import CourseHeadline from "./CourseHeadline"
import CourseFactsList from "./CourseFactsList"
import CourseTrack from "./CourseTrack"
import { courseName } from "./courseName"

// The drawer's desktop track is the guide's own (CourseTrack's default box,
// 1000px), so it lays its chips out exactly as the guide's map does. The chips
// are HTML at a fixed px size, placed by a guess at their size in the box
// (nothing is measured), so a different box width gives a different layout:
// at 720px every fix tuned on the guide's map (chip clearance, Corner 4,
// laps) came out differently here. Scaling the 1000px layout down instead
// would shrink the chips' 11px text to about 8px. The card sits in the same
// 96rem column as the guide, so it has the room; the open drawer is taller.
// A phone's card, less its padding (below Tailwind's sm, 640px).
const PHONE_TRACK_PX = 340

function DrawerTrack({ course }: { course: RaceCourse }) {
	const shape = useCourseShape(course.id)
	// The guide's Phase | Course choice, remembered on this device; the drawer has no switch of its own.
	const colours = useTrackColours()
	if (shape.isPending) {
		return (
			<div className="mx-auto flex aspect-[2/1] w-full max-w-250 items-center justify-center">
				<Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-label="Loading the course map" />
			</div>
		)
	}
	if (!shape.data) {
		// No path file, or the fetch failed: the chips and the guide's map remain.
		return <p className="text-sm text-gray-400">The course map didn't load.</p>
	}
	// Two tracks, one shown, CSS picking (CourseSection's strips do the same):
	// callouts are sized for the box without measuring it, so a phone gets its
	// own box size and only the callouts that fit it.
	return (
		<>
			<CourseTrack course={course} shape={shape.data} colours={colours} className="hidden sm:block" />
			<CourseTrack course={course} shape={shape.data} widthPx={PHONE_TRACK_PX} compact colours={colours} className="sm:hidden" />
		</>
	)
}

export default function CourseDrawer({ course, guideHref }: { course: RaceCourse; guideHref: string }) {
	const [open, setOpen] = useState(false)
	const reduceMotion = useReducedMotion()
	const prefetch = usePrefetchCourseShape()
	const panelId = useId()

	return (
		<div className="mt-3 border-t border-gray-700/70 pt-2">
			<button
				type="button"
				onClick={() => setOpen((was) => !was)}
				onPointerEnter={() => prefetch(course.id)}
				onFocus={() => prefetch(course.id)}
				aria-expanded={open}
				aria-controls={panelId}
				className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-200 transition hover:bg-gray-700/50"
			>
				<MapIcon className="h-4 w-4 text-brand" aria-hidden="true" />
				Course map
				<ChevronDown
					className={`ml-auto h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
					aria-hidden="true"
				/>
			</button>
			<AnimatePresence initial={false}>
				{open && (
					<motion.div
						id={panelId}
						key="course-drawer"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
						className="overflow-hidden"
					>
						<div className="px-2 pb-1 pt-2">
							<p className="mb-2 text-sm text-gray-300">{courseName(course)}</p>
							<DrawerTrack course={course} />
							<CourseHeadline course={course} className="mt-2" />
							<CourseFactsList course={course} />
							<Link to={guideHref} className="mt-2 inline-block text-sm text-brand transition hover:text-brand/75">
								See the full course map in the guide
							</Link>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
