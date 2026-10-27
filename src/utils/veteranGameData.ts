/**
 * Reading one veteran's raw game object (`game_data` on GET /trained-umas/<id>)
 * for the Collection's veteran card. Pure, so each rule has a plain test
 * (src/__tests__/veteranGameData.test.ts); the card never reads a raw key.
 *
 * The object came from the player's own file (umadump's trained_chara_data.json)
 * and is kept as the game wrote it, so nothing about its shape is trusted:
 * every reader checks what it reads and leaves out what it can't, never throws.
 *
 * What the fields mean was checked on 2026-10-27 against the owner's export
 * (256 veterans) and the global client's master.mdb; the list is in
 * notes/collection-redesign-plan.md ("What the game data says"):
 *
 *   factor_info_array          her sparks, as ids; the API names them (`sparks`)
 *   succession_chara_array     her lineage: positions 10 and 20 are her parents,
 *                              11/12 and 21/22 their parents; each has its own
 *                              `card_id` (the outfit), `rank` (the grade number)
 *                              and `factor_info_array`
 *   support_card_list          her training deck: position, the card's game id,
 *                              limit_break_count (4 is MLB)
 *   race_result_list           her career, one row per race: turn, result_rank
 *   win_saddle_id_array        her titles (special titles and graded wins)
 *   fans, scenario_id, running_style (1 front, 2 pace, 3 late, 4 end)
 */

import type { SparkKind, SparkName } from "../types/trainedUma"

export interface Spark extends SparkName {
	id: number
}

/** One of her parents or grandparents. `cardId` is the GAME's outfit id (the catalogue's `game_id`). */
export interface Relative {
	position: number
	cardId: number | null
	/** The game's grade number (utils/veteranGrade.ts gradeLabel reads it); the game keeps no score for a parent. */
	grade: number | null
	sparks: Spark[]
}

export interface Parent extends Relative {
	grandparents: Relative[]
}

export interface DeckCard {
	position: number
	/** The GAME's support card id (the catalogue's `game_id`). */
	cardId: number
	/** 0..4; 4 is MLB. */
	limitBreak: number
}

export type RunningStyle = "front" | "pace" | "late" | "end"

export interface VeteranGame {
	sparks: Spark[]
	/** Sparks in her lineage or her own that the API has no name for (a brand-new uma's). Not drawn. */
	unknownSparks: number
	parents: Parent[]
	deck: DeckCard[]
	/** Her finishing place in every race, in the order she ran them. */
	places: number[]
	fans: number | null
	titles: number | null
	scenario: string | null
	runningStyle: RunningStyle | null
}

/**
 * The game's scenario_id -> its short name, from the global client's text
 * table (text_data category 237, 2026-10-27). A scenario not listed yet
 * shows no name rather than a guess.
 */
const SCENARIO_NAMES: Record<number, string> = {
	1: "URA Finale",
	2: "Unity Cup",
	3: "Grand Concert",
	4: "TS Climax",
	5: "Grandmasters",
}

const RUNNING_STYLES: Record<number, RunningStyle> = { 1: "front", 2: "pace", 3: "late", 4: "end" }

/** The order the game lists a veteran's sparks in: blue, pink, green, then the white ones. */
const KIND_ORDER: SparkKind[] = ["stat", "aptitude", "unique", "skill", "race", "scenario", "carnival"]

const PARENT_POSITIONS = [10, 20]

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value)
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value)
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isRow) : [])
const whole = (value: unknown): number | null => (isWhole(value) && value >= 0 ? value : null)

/** A row's sparks with their names, in the game's order, and how many had no name. */
function sparksOf(row: Row, names: Record<string, SparkName>): { sparks: Spark[]; unknown: number } {
	const sparks: Spark[] = []
	let unknown = 0
	for (const factor of rows(row.factor_info_array)) {
		if (!isWhole(factor.factor_id)) continue
		const name = names[String(factor.factor_id)]
		if (name) sparks.push({ id: factor.factor_id, ...name })
		else unknown += 1
	}
	// Stable: within a kind, the game's own order.
	sparks.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
	return { sparks, unknown }
}

function relative(row: Row, position: number, names: Record<string, SparkName>): { relative: Relative; unknown: number } {
	const { sparks, unknown } = sparksOf(row, names)
	return {
		relative: { position, cardId: whole(row.card_id), grade: whole(row.rank), sparks },
		unknown,
	}
}

/** Everything the card shows from her game data, or null for a hand entry (no object). */
export function readVeteranGame(gameData: unknown, names: Record<string, SparkName> = {}): VeteranGame | null {
	if (!isRow(gameData)) return null
	const own = sparksOf(gameData, names)
	let unknownSparks = own.unknown

	// Her lineage by position. A grandparent belongs to the parent whose tens
	// digit it shares: 11 and 12 are 10's parents.
	const byPosition = new Map<number, Row>()
	for (const row of rows(gameData.succession_chara_array)) {
		if (isWhole(row.position_id)) byPosition.set(row.position_id, row)
	}
	const parents: Parent[] = []
	for (const position of PARENT_POSITIONS) {
		const row = byPosition.get(position)
		if (!row) continue
		const parent = relative(row, position, names)
		unknownSparks += parent.unknown
		const grandparents: Relative[] = []
		for (const [other, grandRow] of byPosition) {
			if (other === position || Math.floor(other / 10) * 10 !== position) continue
			const grandparent = relative(grandRow, other, names)
			unknownSparks += grandparent.unknown
			grandparents.push(grandparent.relative)
		}
		grandparents.sort((a, b) => a.position - b.position)
		parents.push({ ...parent.relative, grandparents })
	}

	const deck = rows(gameData.support_card_list)
		.filter((row) => isWhole(row.support_card_id))
		.map((row) => ({
			position: whole(row.position) ?? 0,
			cardId: row.support_card_id as number,
			limitBreak: Math.min(4, whole(row.limit_break_count) ?? 0),
		}))
		.sort((a, b) => a.position - b.position)

	const places = rows(gameData.race_result_list)
		.filter((row) => isWhole(row.result_rank) && row.result_rank >= 1)
		.sort((a, b) => (whole(a.turn) ?? 0) - (whole(b.turn) ?? 0))
		.map((row) => row.result_rank as number)

	const scenarioId = whole(gameData.scenario_id)
	const style = whole(gameData.running_style)
	return {
		sparks: own.sparks,
		unknownSparks,
		parents,
		deck,
		places,
		fans: whole(gameData.fans),
		titles: Array.isArray(gameData.win_saddle_id_array) ? gameData.win_saddle_id_array.length : null,
		scenario: scenarioId === null ? null : (SCENARIO_NAMES[scenarioId] ?? null),
		runningStyle: style === null ? null : (RUNNING_STYLES[style] ?? null),
	}
}

export interface LegacyTotal {
	kind: "stat" | "aptitude"
	name: string
	/** Stars summed over her and her parents. */
	stars: number
}

export interface Legacy {
	totals: LegacyTotal[]
	uniques: number
	whites: number
}

/**
 * What she passes on as a parent: her sparks plus her two parents', the way
 * the game counts a legacy (her grandparents are too far back to count).
 * Blue and pink sparks are summed by name, most stars first; unique and white
 * ones are counted.
 */
export function legacyOf(game: Pick<VeteranGame, "sparks" | "parents">): Legacy {
	const totals = new Map<string, LegacyTotal>()
	let uniques = 0
	let whites = 0
	for (const spark of [game.sparks, ...game.parents.map((parent) => parent.sparks)].flat()) {
		if (spark.kind === "stat" || spark.kind === "aptitude") {
			const key = `${spark.kind}:${spark.name}`
			const total = totals.get(key) ?? { kind: spark.kind, name: spark.name, stars: 0 }
			total.stars += spark.stars
			totals.set(key, total)
		} else if (spark.kind === "unique") uniques += 1
		else whites += 1
	}
	return {
		// Most stars first; a blue before a pink on a tie, as the game lists them.
		totals: [...totals.values()].sort(
			(a, b) => b.stars - a.stars || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
		),
		uniques,
		whites,
	}
}

/** Her blue spark, the one a grandparent row shows beside the name. */
export function statSpark(relative: Relative): Spark | null {
	return relative.sparks.find((spark) => spark.kind === "stat") ?? null
}
