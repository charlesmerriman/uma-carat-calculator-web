/**
 * How the pull plan's picture (PlanPicture) lays out a plan of a given length
 * (notes/v2-10-feedback-plan.md, item 2b).
 *
 * Every banner, always, at full size (owner, 2026-10-29: a picture of part of
 * a plan has no point, and nothing gets smaller; the picture gets bigger).
 *
 *   poster   up to 30 banners: one column of the poster's cards
 *   columns  31 and up: the same cards in two columns side by side, each
 *            column exactly the poster's width
 *
 * Why 31: one column of about 30 banners is as tall as an iPhone can draw at
 * double size (its canvas cap, utils/shareImage.ts pixelRatioFor). Past that,
 * one ever-taller column would only be drawn at a lower scale, and a 10:1
 * strip is hard to read in Discord's viewer, so the picture grows wider
 * instead. Worked example, 80 banners: one column would be about 960 x 9,950
 * CSS px (10:1, drawn at 1.3x on an iPhone); two columns are about
 * 1,880 x 5,650 (3:1).
 */

import type { PlannerRow } from "./plannerSections"

export type PlanPictureLayout = "poster" | "columns"

/** The fewest banners drawn in two columns. */
export const COLUMNS_FROM = 31

export function planPictureLayout(banners: number): PlanPictureLayout {
	return banners >= COLUMNS_FROM ? "columns" : "poster"
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
