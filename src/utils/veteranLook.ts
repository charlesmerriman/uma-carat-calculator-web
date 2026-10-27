/**
 * How a veteran is drawn on the Collection page, as data: a tile's two lines,
 * the tier her grade's hexagon is filled by, her stats' hues, and the flags
 * that say where she came from. The pieces that draw them are
 * components/collection/veteranBadges.tsx, VeteranList.tsx and VeteranCard.tsx.
 */

import { formatDate } from "./dateFormat"
import type { StatKey, TrainedUma } from "../types/trainedUma"

/** Each stat's hue (index.css :root): a bar or an edge, never text. */
export const STAT_COLORS: Record<StatKey, string> = {
	speed: "var(--color-stat-speed)",
	stamina: "var(--color-stat-stamina)",
	power: "var(--color-stat-power)",
	guts: "var(--color-stat-guts)",
	wit: "var(--color-stat-wit)",
}

/**
 * "TM Opera O (New Year)" as its name and its outfit, so a narrow tile can
 * show both instead of cutting the outfit off. The catalogue writes an alt
 * outfit in brackets after the name; a name without one stays whole.
 */
export function splitOutfit(umaName: string): { name: string; outfit: string | null } {
	const match = /^(.+?)\s*\(([^()]+)\)$/.exec(umaName)
	return match ? { name: match[1], outfit: match[2] } : { name: umaName, outfit: null }
}

/**
 * A veteran tile's two lines. Her label, else her memo from the game, is the
 * name the player gave her, so it leads, with the uma under it. Without
 * either: the uma's name, then her outfit and when she was trained.
 */
export function tileLines(veteran: Pick<TrainedUma, "label" | "memo" | "trained_at">, umaName: string): { title: string; sub: string } {
	const own = veteran.label || veteran.memo
	if (own) return { title: own, sub: umaName }
	const { name, outfit } = splitOutfit(umaName)
	const when = veteran.trained_at ? formatDate(veteran.trained_at) : null
	if (outfit) return { title: name, sub: when ? `${outfit} · ${when}` : outfit }
	return { title: name, sub: when ? `Trained ${when}` : "Entered by hand" }
}

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
