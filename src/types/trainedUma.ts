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
}

export interface TrainedUma extends VeteranInput {
	id: number
	rank_score: number | null
	/** "import": read from the game's export, numbers fixed. "manual": typed in. */
	source: "import" | "manual"
	import_key: number | null
	/** Kept by a re-import only because a logged CM run links it. */
	missing_from_import: boolean
	created_at: string
	updated_at: string
}
