/** Words the gallery builds from a post or comment's poster block. */

import type { GalleryPoster } from "../types/gallery"

/** The name a post or comment shows. A blanked name reads as below. */
export function posterName(poster: GalleryPoster): string {
	return poster.display_name || "Unnamed trainer"
}

/** What a post is called where it needs a title: "NightRacer's team". */
export function teamTitle(poster: GalleryPoster): string {
	return `${posterName(poster)}'s team`
}
