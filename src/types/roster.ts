/**
 * What a player owns: umas (outfits) and support cards, for the Collection's
 * Umas and Support cards tabs. Mirrors backend/calculatorapi/views/roster.py;
 * shapes in backend/docs/api-reference.md ("/roster"). Account only.
 */

export interface OwnedUmaRow {
	uma: number
	/** 1..5, null when not set. */
	stars: number | null
	/** Potential, 1..5, null when not set. */
	talent_level: number | null
	/** Where the values last came from; the next import overwrites either. */
	source: "import" | "manual"
	obtained_at: string | null
}

export interface OwnedCardRow {
	support_card: number
	/** 0..4; 4 is MLB. */
	limit_break: number
	/** Copies held beyond the one in use (the game's `stock`). */
	spare_copies: number
	source: "import" | "manual"
	obtained_at: string | null
}

export interface Roster {
	umas: OwnedUmaRow[]
	support_cards: OwnedCardRow[]
}

/** One grid edit; `owned: false` removes the row. */
export interface UmaChange {
	uma: number
	owned: boolean
	stars?: number | null
	talent_level?: number | null
}

export interface CardChange {
	support_card: number
	owned: boolean
	limit_break?: number
	spare_copies?: number
}

export interface RosterChanges {
	umas?: UmaChange[]
	support_cards?: CardChange[]
}

/** How an import went, per list it replaced. */
export interface ImportCounts {
	added: number
	updated: number
	removed: number
}

/** The two lists, by the name the import and the start-over route use. */
export type RosterList = "umas" | "support_cards"
