/**
 * An uma's display name, for tiles that give the name and the outfit their own
 * lines (the Daily Legend Races cards, the PvP guide's uma tiles).
 */

/**
 * Split an alternate outfit off an uma's name, so a tile can give each half
 * its own line: "Mejiro McQueen (Anime)" -> base "Mejiro McQueen", outfit
 * "Anime". A name with no trailing parentheses comes back whole, with a null
 * outfit ("Special Week", "Ines Fujin ♡").
 *
 * Only a bracket at the very END counts, which is where every outfit sits.
 * The search still matches on the full name; this is for display only.
 */
export function splitOutfit(name: string): { base: string; outfit: string | null } {
	const match = /^(.*\S)\s*\(([^()]+)\)$/.exec(name.trim())
	return match ? { base: match[1], outfit: match[2] } : { base: name, outfit: null }
}
