/**
 * How the pull plan's picture (PlanPicture) lays out a plan of a given length
 * (notes/v2-10-feedback-plan.md, item 2b).
 *
 * The picture always shows EVERY banner (owner, 2026-10-29: a picture of part
 * of a plan defeats the point). What changes with the length is the shape:
 *
 *   poster   up to 15 banners: the poster as designed, art a size up
 *   compact  16 to 30: one row per banner, about 60px instead of 120px
 *   columns  31 and up: compact rows in two columns side by side
 *
 * Worked example: Daptrius's 26-banner plan was about 960 x 3,470 CSS px as a
 * poster, a strip Discord shows at thumbnail size. Compact it is about
 * 960 x 2,300. A 60-banner plan in columns is about 1,760 x 2,300, close to
 * square. utils/shareImage.ts (pixelRatioFor) still scales any picture that
 * would pass an iPhone's canvas cap, so a very long plan draws softer, never
 * fails.
 */

import type { PlannerRow } from "./plannerSections"

export type PlanPictureLayout = "poster" | "compact" | "columns"

/** The fewest banners drawn as compact rows. */
export const COMPACT_FROM = 16
/** The fewest banners drawn in two columns. */
export const COLUMNS_FROM = 31

export function planPictureLayout(banners: number): PlanPictureLayout {
	if (banners >= COLUMNS_FROM) return "columns"
	if (banners >= COMPACT_FROM) return "compact"
	return "poster"
}

/**
 * The plan's rows in two columns, read left column first: the left gets the
 * first half of the banners (the extra one when the count is odd). A band
 * (a scenario or anniversary milestone) stays with the banner after it, so a
 * column never ends on a milestone that belongs at the top of the next.
 */
export function splitColumns(rows: PlannerRow[]): [PlannerRow[], PlannerRow[]] {
	const banners = rows.filter((row) => row.kind === "banner").length
	const leftCount = Math.ceil(banners / 2)
	let seen = 0
	let cut = rows.length
	for (let at = 0; at < rows.length; at++) {
		if (rows[at].kind !== "banner") continue
		if (seen === leftCount) {
			cut = at
			break
		}
		seen++
	}
	// Bands just above the first right-hand banner go with it.
	while (cut > 0 && cut < rows.length && rows[cut - 1].kind === "band") cut--
	return [rows.slice(0, cut), rows.slice(cut)]
}
