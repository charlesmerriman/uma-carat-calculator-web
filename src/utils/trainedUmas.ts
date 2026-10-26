/**
 * The veteran form's pure helpers: the draft a form edits, turning it into
 * what the API takes, and the checks the form shows before saving. No React,
 * so each rule has a plain test (src/__tests__/trainedUmas.test.ts).
 *
 * The API checks everything again (views/trained_uma.py); these exist so the
 * player hears about a typo next to the field, not in a toast after Save.
 */

import { aptitudeLetter } from "./courseAptitude"
import type { AptitudeKey, CatalogueSkill, CatalogueUma } from "../types/pvpTeam"
import type { StatKey, TrainedUma, VeteranInput, VeteranSkill } from "../types/trainedUma"

export const STAT_KEYS: StatKey[] = ["speed", "stamina", "power", "guts", "wit"]
export const STAT_LABELS: Record<StatKey, string> = {
	speed: "Speed",
	stamina: "Stamina",
	power: "Power",
	guts: "Guts",
	wit: "Wit",
}
/** The API's ceiling (TRAINED_UMA_STAT_MAX): it only stops typos like 12000. */
export const STAT_MAX = 2000
export const LABEL_MAX_LENGTH = 40

/** The ten aptitudes in the game's own order: surface, distance, style. */
export const APTITUDE_GROUPS: Array<{ label: string; keys: Array<{ key: AptitudeKey; label: string }> }> = [
	{ label: "Surface", keys: [{ key: "turf", label: "Turf" }, { key: "dirt", label: "Dirt" }] },
	{
		label: "Distance",
		keys: [
			{ key: "short", label: "Sprint" },
			{ key: "mile", label: "Mile" },
			{ key: "medium", label: "Medium" },
			{ key: "long", label: "Long" },
		],
	},
	{
		label: "Style",
		keys: [
			{ key: "front", label: "Front" },
			{ key: "pace", label: "Pace" },
			{ key: "late", label: "Late" },
			{ key: "end", label: "End" },
		],
	},
]
const APTITUDE_KEYS = APTITUDE_GROUPS.flatMap((group) => group.keys.map((entry) => entry.key))

/** A unique skill (game rarity 3 to 5) levels up with the uma's stars; others are level 1. */
export function isUniqueSkill(skill: Pick<CatalogueSkill, "rarity">): boolean {
	return skill.rarity >= 3 && skill.rarity <= 5
}

/**
 * What the form edits. Stats are strings while typed, so an emptied box is
 * "" (not 0) until it is filled again.
 */
export interface VeteranDraft {
	uma: number | null
	label: string
	stats: Record<StatKey, string>
	apt: Record<AptitudeKey, number | null>
	skills: VeteranSkill[]
}

function blankAptitudes(): Record<AptitudeKey, number | null> {
	return Object.fromEntries(APTITUDE_KEYS.map((key) => [key, null])) as Record<AptitudeKey, number | null>
}

export function emptyDraft(): VeteranDraft {
	return {
		uma: null,
		label: "",
		stats: { speed: "", stamina: "", power: "", guts: "", wit: "" },
		apt: blankAptitudes(),
		skills: [],
	}
}

/**
 * The draft with `uma` picked. Her aptitudes start at the uma's own (most
 * trained umas keep them; inheritance only raises some), so the player only
 * changes what training changed. Stats and skills are kept.
 */
export function withUma(draft: VeteranDraft, uma: Pick<CatalogueUma, "id" | "apt">): VeteranDraft {
	const apt = blankAptitudes()
	for (const key of APTITUDE_KEYS) apt[key] = uma.apt[key] ?? null
	return { ...draft, uma: uma.id, apt }
}

export function draftFromVeteran(veteran: TrainedUma): VeteranDraft {
	return {
		uma: veteran.uma,
		label: veteran.label,
		stats: Object.fromEntries(STAT_KEYS.map((key) => [key, String(veteran[key])])) as Record<StatKey, string>,
		apt: { ...blankAptitudes(), ...veteran.apt },
		skills: veteran.skills.map((entry) => ({ ...entry })),
	}
}

/** One sentence per field that would be refused, by field; empty when the draft can be saved. */
export function draftProblems(draft: VeteranDraft): Partial<Record<StatKey | "uma" | "label", string>> {
	const problems: Partial<Record<StatKey | "uma" | "label", string>> = {}
	if (draft.uma === null) problems.uma = "Pick the uma first."
	for (const key of STAT_KEYS) {
		const text = draft.stats[key].trim()
		const value = Number(text)
		if (!text) problems[key] = "Required."
		else if (!Number.isInteger(value) || value < 0 || value > STAT_MAX) problems[key] = `0 to ${STAT_MAX}.`
	}
	if (draft.label.length > LABEL_MAX_LENGTH) problems.label = `At most ${LABEL_MAX_LENGTH} characters.`
	return problems
}

/** The draft as the API takes it. Only call once draftProblems is empty. */
export function draftToInput(draft: VeteranDraft): VeteranInput {
	return {
		uma: draft.uma ?? 0,
		label: draft.label.trim(),
		...(Object.fromEntries(STAT_KEYS.map((key) => [key, Number(draft.stats[key])])) as Record<StatKey, number>),
		apt: draft.apt,
		skills: draft.skills,
	}
}

/** The draft with `skill` added at level 1, or taken off if it is there. */
export function toggleSkill(draft: VeteranDraft, skill: number): VeteranDraft {
	const has = draft.skills.some((entry) => entry.skill === skill)
	return {
		...draft,
		skills: has ? draft.skills.filter((entry) => entry.skill !== skill) : [...draft.skills, { skill, level: 1 }],
	}
}

/**
 * Skills whose name contains every word of `query`, ignoring case and the
 * ○/◎ marks, at most `limit`, skipping the ones already picked. Empty for a
 * query under two characters, so the list never shows the whole catalogue.
 */
export function searchSkills(skills: CatalogueSkill[], query: string, picked: Set<number>, limit = 12): CatalogueSkill[] {
	const words = query.toLowerCase().replace(/[○◎]/g, " ").split(/\s+/).filter(Boolean)
	if (words.join("").length < 2) return []
	const found: CatalogueSkill[] = []
	for (const skill of skills) {
		if (picked.has(skill.id)) continue
		const name = skill.name.toLowerCase()
		if (words.every((word) => name.includes(word))) found.push(skill)
		if (found.length >= limit) break
	}
	return found
}

/** "Turf S · Mile A · Pace A": the letters worth a glance on a list row, known ones only. */
export function aptitudeSummary(apt: Record<AptitudeKey, number | null>): string {
	return APTITUDE_GROUPS.flatMap((group) => group.keys)
		.filter(({ key }) => (apt[key] ?? 0) >= 7)
		.map(({ key, label }) => `${label} ${aptitudeLetter(apt[key])}`)
		.join(" · ")
}

/** The player's veterans of one outfit, the only ones that may stand in for her. */
export function veteransOf(veterans: TrainedUma[], umaId: number): TrainedUma[] {
	return veterans.filter((veteran) => veteran.uma === umaId)
}

/** "1200 / 800 / 1000 / 400 / 900": her stats in the game's order, for a tight spot. */
export function statLine(veteran: Pick<TrainedUma, StatKey>): string {
	return STAT_KEYS.map((key) => veteran[key]).join(" / ")
}

/** A veteran in a dropdown: "Main Oguri · 1200 / 800 / ...", or the stats alone without a label. */
export function veteranOptionLabel(veteran: TrainedUma): string {
	return veteran.label ? `${veteran.label} · ${statLine(veteran)}` : statLine(veteran)
}
