/**
 * Which of an uma's aptitudes an event's course asks for, so the picker can
 * badge each uma with the three letters that matter: surface, distance and
 * the running style it would run.
 *
 * The course fields are free text an editor types ("Turf", "Dirt", "Medium",
 * "Mile", "Sprint", sometimes a length like "2200"), so this maps the words
 * it recognises and returns nothing for "TBD" or anything else. A missing
 * badge is better than a wrong one.
 */

import type { AptitudeKey, MemberStyle } from "../types/pvpTeam"
import type { RaceEvent } from "../types"

/** Which aptitude column a style reads. A runaway is a front runner. */
export const APTITUDE_FOR_STYLE: Record<MemberStyle, AptitudeKey> = {
	runaway: "front",
	front: "front",
	pace: "pace",
	late: "late",
	end: "end",
}

/** 1..8 as the game prints it. */
const LETTERS = ["G", "F", "E", "D", "C", "B", "A", "S"]

export function aptitudeLetter(value: number | null | undefined): string | null {
	return value != null && value >= 1 && value <= 8 ? LETTERS[value - 1] : null
}

function surfaceKey(text: string): AptitudeKey | null {
	const word = text.trim().toLowerCase()
	if (word.includes("dirt")) return "dirt"
	if (word.includes("turf")) return "turf"
	return null
}

/** The game's distance bands, in metres: short to 1400, mile to 1800, medium to 2400. */
function distanceForMetres(metres: number): AptitudeKey {
	if (metres <= 1400) return "short"
	if (metres <= 1800) return "mile"
	if (metres <= 2400) return "medium"
	return "long"
}

function distanceKey(text: string): AptitudeKey | null {
	const word = text.trim().toLowerCase()
	if (!word) return null
	if (word.includes("sprint") || word.includes("short")) return "short"
	if (word.includes("mile")) return "mile"
	if (word.includes("medium") || word.includes("middle")) return "medium"
	if (word.includes("long")) return "long"
	const metres = /(\d{3,4})/.exec(word)
	return metres ? distanceForMetres(Number(metres[1])) : null
}

export interface CourseAptitude {
	/** "Turf", "Mile", "Front": what the badge's title says. */
	label: string
	key: AptitudeKey
}

const LABELS: Record<AptitudeKey, string> = {
	turf: "Turf",
	dirt: "Dirt",
	short: "Sprint",
	mile: "Mile",
	medium: "Medium",
	long: "Long",
	front: "Front",
	pace: "Pace",
	late: "Late",
	end: "End",
}

/**
 * The aptitudes this event and style call for, in badge order: surface,
 * distance, style. The distance word wins over the length; a length alone
 * ("2200m") still places the race in a band.
 */
export function aptitudeKeysForEvent(event: Pick<RaceEvent, "surface_type" | "distance" | "length">, style: MemberStyle | null): CourseAptitude[] {
	const keys: Array<AptitudeKey | null> = [
		surfaceKey(event.surface_type ?? ""),
		distanceKey(event.distance ?? "") ?? distanceKey(event.length ?? ""),
		style ? APTITUDE_FOR_STYLE[style] : null,
	]
	return keys
		.filter((key): key is AptitudeKey => key !== null)
		.map((key) => ({ key, label: LABELS[key] }))
}
