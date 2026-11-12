/**
 * A skill's full page (GET /skills/<id>) reshaped into what the skill card
 * draws (a guide's PvpSkillRef), so the Encyclopedia's rows open the same
 * card a guide's chips do (components/pvp/SkillDetail.tsx).
 *
 * The card names a few sources and counts the rest, as a guide's does.
 */

import type { PvpSkillRef } from "../types/pvpGuide"
import type { SkillDetailData } from "../types/skills"
import { skillKind } from "./skillSearch"

/** How many umas and cards the card names before "+N more". */
const NAMED = 3

/** A row's own facts as a card with no body yet: what shows while the page loads. */
export function rowToCardSkill(row: {
	id: number; game_id: number; name: string; image: string | null; rarity: number; tier: number
	version: string; is_evolved: boolean; owners?: string[]; cost?: number | null; type?: string
}): PvpSkillRef {
	return {
		id: row.id,
		game_id: row.game_id,
		name: row.name,
		description: "",
		image: row.image,
		rarity: row.rarity,
		unique_of: row.owners?.length ? row.owners.join(", ") : null,
		is_inherited: skillKind(row) === "inherited",
		version: row.version,
		tier: row.tier,
		is_evolved: row.is_evolved,
		versions: [],
		cost: row.cost,
		type: row.type,
	}
}

export function detailToCardSkill(detail: SkillDetailData): PvpSkillRef {
	// A unique and its inherited copy are each other's version, as on the page.
	const versions = detail.pair ? [detail.pair, ...detail.versions] : detail.versions
	return {
		...rowToCardSkill(detail),
		description: detail.description,
		versions: versions.map((version) => ({
			id: version.id,
			name: version.name,
			// The page's version rows carry no description; the card lists them by name.
			description: "",
			image: version.image,
			rarity: version.rarity,
			tier: version.tier,
			version: version.version,
			is_evolved: version.is_evolved,
		})),
		availability: detail.availability,
		uses_translation: detail.uses_translation,
		readable: detail.readable,
		sources: {
			umas: detail.sources.umas.slice(0, NAMED).map(({ name, source, level, on_global }) => ({ name, source, level, on_global })),
			uma_count: detail.sources.umas.length,
			cards: detail.sources.cards.slice(0, NAMED).map(({ name, source, on_global }) => ({ name, source, on_global })),
			card_count: detail.sources.cards.length,
		},
	}
}
