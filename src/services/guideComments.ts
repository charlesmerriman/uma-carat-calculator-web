/**
 * The comment threads on a PvP guide: one per section, "" for the whole guide
 * (the side column) and one per running style (Henry, 2026-10-21;
 * guide-comments-plan.md). They are gallery comments with the guide as their
 * parent, so GalleryComments draws them and galleryQueries caches them; this
 * only says where a section's thread lives and who else counts it.
 */

import { galleryKeys, type CommentThreadSource } from "./galleryQueries"
import { guideCommentCreate, guideCommentsFetch } from "./galleryFetchCalls"
import { patchPvpGuide } from "../hooks/usePvpGuide"
import type { PvpEventRef } from "../utils/pvpEvent"
import type { PvpGuide } from "../types/pvpGuide"

/** The guide's event as a ref, from its own `event_type` and `event`. */
export function guideRef(guide: Pick<PvpGuide, "event_type" | "event">): PvpEventRef {
	return { kind: guide.event_type === "champions_meeting" ? "cm" : "loh", id: guide.event }
}

/** A section's visible comments, from the guide (0 when it has none, or an older API sent none). */
export function guideCommentCount(guide: Pick<PvpGuide, "comment_counts">, section: string): number {
	return guide.comment_counts?.[section] ?? 0
}

/** One section's thread. The guide's `comment_counts` follow every comment added or deleted. */
export function guideThread(ref: PvpEventRef, section: string): CommentThreadSource {
	return {
		key: [...galleryKeys.all, "guide-comments", ref.kind, ref.id, section],
		fetchPage: (page) => guideCommentsFetch(ref, section, page),
		create: (body, parent) => guideCommentCreate(ref, section, body, parent),
		countChanged: (_client, delta) =>
			patchPvpGuide(ref, (guide) => {
				const counts = { ...guide.comment_counts }
				counts[section] = Math.max((counts[section] ?? 0) + delta, 0)
				return { ...guide, comment_counts: counts }
			}),
	}
}
