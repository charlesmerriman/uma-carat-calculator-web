/**
 * Reads umadump's veteran export (`trained_chara_data.json`) in the browser,
 * into the rows POST /trained-umas/import takes (notes/pvp-planner-plan.md,
 * R2, "The import").
 *
 * umadump (github.com/Werseter/umadump) is a community tool the site does not
 * make: it reads the Global Steam client's memory and writes one JSON file per
 * kind of data. This file is the game's own veteran shape, one object per
 * trained uma.
 *
 * WHAT IS READ, AND WHAT NEVER LEAVES THE DEVICE
 * ----------------------------------------------
 * Only: `trained_chara_id` (the game's id for the veteran, which a re-import
 * and later a race replay match on), `card_id` (the outfit), the five stats,
 * the ten `proper_*` aptitudes, `skill_array`, `rank_score` and `create_time`
 * (newest first, when the 200 cap cuts). Each row is BUILT from those fields,
 * never copied, so nothing else in the file can ride along: not `viewer_id`
 * (the game account), not `memo` (free text), not the parents' owners.
 *
 * RECOGNISED BY SHAPE, NEVER BY NAME: a player may rename the file.
 *
 * Matching is through the catalogue's `game_id` columns: an outfit or a skill
 * the site does not know is counted and left out, never guessed at.
 */

import type { AptitudeKey } from "../../types/pvpTeam"
import type { StatKey, VeteranSkill } from "../../types/trainedUma"

/** One veteran as the import route takes it, plus when she was made (for the cap). */
export interface ImportedVeteran {
	import_key: number
	uma: number
	rank_score: number | null
	speed: number
	stamina: number
	power: number
	guts: number
	wit: number
	apt: Record<AptitudeKey, number | null>
	skills: VeteranSkill[]
	/** ms since 1970, 0 when the file has no usable time. Never sent. */
	createdAt: number
}

export type VeteranFileResult =
	| { ok: true; veterans: ImportedVeteran[]; unknownUmas: number; unknownSkills: number }
	| { ok: false; error: string }

/** The game's field per aptitude: nige / senko / sashi / oikomi are front / pace / late / end. */
const APTITUDE_FIELDS: Record<AptitudeKey, string> = {
	turf: "proper_ground_turf",
	dirt: "proper_ground_dirt",
	short: "proper_distance_short",
	mile: "proper_distance_mile",
	medium: "proper_distance_middle",
	long: "proper_distance_long",
	front: "proper_running_style_nige",
	pace: "proper_running_style_senko",
	late: "proper_running_style_sashi",
	end: "proper_running_style_oikomi",
}

/** The game's field per stat: `wiz` is wit. */
const STAT_FIELDS: Record<StatKey, string> = {
	speed: "speed",
	stamina: "stamina",
	power: "power",
	guts: "guts",
	wit: "wiz",
}

const NOT_A_VETERAN_FILE =
	"That file isn't a veteran list. Pick trained_chara_data.json from the folder umadump wrote."

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value)
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value)

/** A veteran object, by the fields every one has. */
function looksLikeVeteran(value: unknown): value is Row {
	return isRow(value) && isWhole(value.trained_chara_id) && isWhole(value.card_id) && isWhole(value.speed)
}

/** "2025-07-10 03:21:45" (the game's UTC) -> ms; 0 when unreadable. */
function createdAt(value: unknown): number {
	if (typeof value !== "string") return 0
	const time = Date.parse(`${value.replace(" ", "T")}Z`)
	return Number.isNaN(time) ? 0 : time
}

/**
 * The file's veterans as import rows, newest first. `umaIdByGameId` and
 * `skillIdByGameId` map the game's ids to the site's (from GET /pvp-catalogue).
 */
export function readVeteranFile(
	json: unknown,
	umaIdByGameId: Map<number, number>,
	skillIdByGameId: Map<number, number>
): VeteranFileResult {
	if (!Array.isArray(json) || json.length === 0 || !json.every(looksLikeVeteran)) {
		return { ok: false, error: NOT_A_VETERAN_FILE }
	}
	let unknownUmas = 0
	const unknownSkillIds = new Set<number>()
	const veterans: ImportedVeteran[] = []
	for (const row of json) {
		const uma = umaIdByGameId.get(row.card_id as number)
		if (uma === undefined) {
			unknownUmas += 1
			continue
		}
		const stat = (key: StatKey) => {
			const value = row[STAT_FIELDS[key]]
			return isWhole(value) && value >= 0 ? value : 0
		}
		const apt = {} as Record<AptitudeKey, number | null>
		for (const [key, field] of Object.entries(APTITUDE_FIELDS) as Array<[AptitudeKey, string]>) {
			const value = row[field]
			apt[key] = isWhole(value) && value >= 1 && value <= 8 ? value : null
		}
		const skills: VeteranSkill[] = []
		for (const entry of Array.isArray(row.skill_array) ? row.skill_array : []) {
			if (!isRow(entry) || !isWhole(entry.skill_id)) continue
			const skill = skillIdByGameId.get(entry.skill_id)
			if (skill === undefined) {
				unknownSkillIds.add(entry.skill_id)
				continue
			}
			if (skills.some((each) => each.skill === skill)) continue
			const level = isWhole(entry.level) && entry.level >= 1 && entry.level <= 10 ? entry.level : 1
			skills.push({ skill, level })
		}
		veterans.push({
			import_key: row.trained_chara_id as number,
			uma,
			rank_score: isWhole(row.rank_score) && row.rank_score >= 0 ? row.rank_score : null,
			speed: stat("speed"),
			stamina: stat("stamina"),
			power: stat("power"),
			guts: stat("guts"),
			wit: stat("wit"),
			apt,
			skills,
			createdAt: createdAt(row.create_time),
		})
	}
	veterans.sort((a, b) => b.createdAt - a.createdAt)
	return { ok: true, veterans, unknownUmas, unknownSkills: unknownSkillIds.size }
}

/** A row as the import route takes it: the same minus the local-only time. */
export function toImportItem({ createdAt: _createdAt, ...item }: ImportedVeteran): Omit<ImportedVeteran, "createdAt"> {
	return item
}
