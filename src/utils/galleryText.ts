/** Words the gallery builds from a post or comment's poster block. */

import type { GalleryPoster, VoteSplit } from "../types/gallery"

/** The name a post or comment shows. A blanked name reads as below. */
export function posterName(poster: GalleryPoster): string {
	return poster.display_name || "Unnamed trainer"
}

/** What a post is called where it needs a title: "NightRacer's team". */
export function teamTitle(poster: GalleryPoster): string {
	return `${posterName(poster)}'s team`
}

/** "14 up, 20 down": the staff-only vote split, for a title or a line under the score. */
export function splitText(split: VoteSplit | undefined): string | undefined {
	return split ? `${split.up} up, ${split.down} down` : undefined
}
