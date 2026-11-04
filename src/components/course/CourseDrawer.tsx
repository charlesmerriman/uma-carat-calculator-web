/**
 * The Timeline race card's course drawer (owner, 2026-10-29: "a toggleable
 * slide-out from the bottom of the card, animated, showing the course").
 *
 * Closed by default, like every layer (new layers are opt-in), and the card's
 * right column is already full, so the course gets a drawer under the art and
 * the panels instead of a third panel. Inside: the mini strip (the track and
 * the phases), the course's name, the chips, and the way to the full map in
 * the event's guide. The open and close are a height animation, so they check
 * useReducedMotion themselves (MotionConfig only stops transforms).
 */
import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronDown, Map as MapIcon } from "lucide-react"
import type { RaceCourse } from "../../types"
import CourseChips from "./CourseChips"
import CourseStrip from "./CourseStrip"
import { courseName } from "./courseName"

export default function CourseDrawer({ course, guideHref }: { course: RaceCourse; guideHref: string }) {
	const [open, setOpen] = useState(false)
	const reduceMotion = useReducedMotion()
	const panelId = useId()

	return (
		<div className="mt-3 border-t border-gray-700/70 pt-2">
			<button
				type="button"
				onClick={() => setOpen((was) => !was)}
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
							<CourseStrip course={course} variant="mini" />
							<CourseChips course={course} className="mt-2" />
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
