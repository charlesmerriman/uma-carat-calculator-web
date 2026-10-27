/**
 * How a veteran is drawn on the Collection page, as data: the tier her grade's
 * hexagon is filled by, and the flags that say where she came from. The
 * pieces that draw them are components/collection/veteranBadges.tsx.
 */

import type { TrainedUma } from "../types/trainedUma"

export type GradeTier = "u" | "ss" | "s" | "a" | "b" | "other" | "none"

/** Which fill a grade's hexagon takes (App.css, .grade-badge): by its letters, the way the game tints them. */
export function gradeTier(grade: string | null): GradeTier {
	if (!grade) return "none"
	if (grade.startsWith("U")) return "u"
	if (grade.startsWith("SS")) return "ss"
	if (grade.startsWith("S")) return "s"
	if (grade.startsWith("A")) return "a"
	if (grade.startsWith("B")) return "b"
	return "other"
}

export type FlagTone = "plain" | "borrowed" | "missing"

export interface VeteranFlag {
	tone: FlagTone
	text: string
	title?: string
}

const BORROWED_TITLE = "Another player's veteran you had on loan in the game."
const MISSING_TITLE = "Kept because a CM run you logged used her."

/** The one flag a tile has room for, the most telling first; none for an ordinary game veteran. */
export function tileFlag(veteran: TrainedUma): VeteranFlag | null {
	if (veteran.is_borrowed) return { tone: "borrowed", text: "Borrowed", title: BORROWED_TITLE }
	if (veteran.missing_from_import) return { tone: "missing", text: "Not in your latest import", title: MISSING_TITLE }
	if (veteran.source === "manual") return { tone: "plain", text: "By hand" }
	return null
}

/** Every flag her card shows, in words. */
export function cardFlags(veteran: TrainedUma): VeteranFlag[] {
	const flags: VeteranFlag[] = [{ tone: "plain", text: veteran.source === "import" ? "From the game" : "Entered by hand" }]
	if (veteran.is_borrowed) flags.push({ tone: "borrowed", text: "Borrowed: another player's veteran", title: BORROWED_TITLE })
	if (veteran.missing_from_import) {
		flags.push({ tone: "missing", text: "Not in your latest import, kept for a CM run you logged", title: MISSING_TITLE })
	}
	return flags
}
