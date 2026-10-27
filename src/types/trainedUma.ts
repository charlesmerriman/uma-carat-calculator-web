/**
 * A player's veterans: umas they finished training (the Collection page).
 *
 * Mirrors backend/calculatorapi/views/trained_uma.py; shapes and refusals in
 * backend/docs/api-reference.md ("/trained-umas"). Account only.
 */

import type { AptitudeKey } from "./pvpTeam"

export type StatKey = "speed" | "stamina" | "power" | "guts" | "wit"

export interface VeteranSkill {
	skill: number
	/** 1 for most skills; a unique skill levels up. */
	level: number
}

/** What a hand entry sends (POST) and an edit may send (PATCH). */
export interface VeteranInput extends Record<StatKey, number> {
	uma: number
	label: string
	/** The game's 1..8 (G..S), null when not known. */
	apt: Record<AptitudeKey, number | null>
	skills: VeteranSkill[]
	/** The evaluation score the game shows on her; a hand entry may type it. */
	rank_score?: number | null
}

export interface TrainedUma extends VeteranInput {
	id: number
	rank_score: number | null
	/** The game's grade number for that score (utils/veteranGrade.ts reads it); import only. */
	rank_grade: number | null
	/** "import": read from the game's export, numbers fixed. "manual": typed in. */
	source: "import" | "manual"
	import_key: number | null
	/** Kept by a re-import only because a logged CM run links it. */
	missing_from_import: boolean
	/** The player's own note on her, from the game. Shown only to them. */
	memo: string
	/** Another player's veteran (a rental), from the game. */
	is_borrowed: boolean
	/** When the game says she finished training (ISO), null for a hand entry. The list's order. */
	trained_at: string | null
	/** Whether the raw game object is kept (GET /trained-umas/<id> sends it as `game_data`). */
	has_game_data: boolean
	created_at: string
	updated_at: string
}

/** What a spark is, by the colour a player knows it by (backend models/spark.py). */
export type SparkKind = "stat" | "aptitude" | "unique" | "skill" | "race" | "scenario" | "carnival"

export interface SparkName {
	name: string
	kind: SparkKind
	/** 1..3. */
	stars: number
}

/** One veteran as GET /trained-umas/<id> sends her: the list's fields plus her game data. */
export interface VeteranDetail extends TrainedUma {
	/** The game's whole object for her, null for a hand entry. Read only through utils/veteranGameData.ts. */
	game_data: Record<string, unknown> | null
	/** Her sparks' and her lineage's names, keyed by the game's id. Absent from an API older than the field. */
	sparks?: Record<string, SparkName>
}
