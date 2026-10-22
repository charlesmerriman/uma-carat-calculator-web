/**
 * One section's comments on a PvP guide (Henry, 2026-10-21: "each section
 * (styles) should have different comment section", for questions and
 * feedback). A section is "" for the whole guide, or a running style.
 *
 * Folded until opened, showing its count from the guide (`comment_counts`), so
 * a long thread never pushes the decks down and nothing is fetched for a
 * section nobody opens. Open, it is the gallery's own thread
 * (GalleryComments with a guideThread source): the same replies, edits,
 * reports and thumbs-up as a team's comments, and the same rule for what of
 * the commenter is public (their display name and picture, beside it).
 */

import { useState } from "react"
import { ChevronDown, MessageSquare } from "lucide-react"
import { GalleryComments } from "./gallery/GalleryComments"
import { guideCommentCount, guideRef, guideThread } from "../../services/guideComments"
import type { PvpGuide } from "../../types/pvpGuide"

/** `className` sets the frame: a rule above it by default, under a style's pane. */
export function GuideComments({ guide, section, placeholder, className = "border-t border-gray-700/70 pt-3" }: {
	guide: PvpGuide
	section: string
	placeholder: string
	className?: string
}) {
	const [open, setOpen] = useState(false)
	const count = guideCommentCount(guide, section)
	return (
		<section aria-label="Comments" className={className}>
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className="flex items-center gap-1.5 text-sm font-semibold text-gray-300 transition hover:text-gray-100"
			>
				<MessageSquare className="h-4 w-4" aria-hidden="true" />
				Comments ({count})
				<ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			</button>
			{open && (
				<div className="mt-3">
					<GalleryComments source={guideThread(guideRef(guide), section)} heading={false} placeholder={placeholder} />
				</div>
			)}
		</section>
	)
}
