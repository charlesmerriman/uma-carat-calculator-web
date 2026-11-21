/**
 * ONE RULE FOR EVERY NAME SEARCH ON THE SITE (Daptrius, board "Design Parity
 * with the Encyclopedia", 2026-11-19: "Searching for a character like Mr. C.B.
 * on the timeline can be done as `mr cb`, on the ... selectors, legend race,
 * and pvp pages, it has to be done as `mr. C.b.`").
 *
 * A name and a query are compared as their letters and digits only: case,
 * accents, spaces and punctuation dropped, so "mr cb" finds "Mr. C.B.",
 * "tm opera" finds "T.M. Opera O" and "condor" finds "El Cóndor Pasa". Each
 * word typed must be found somewhere in the name, in any order, so "summer
 * maruzensky" finds "Maruzensky (Summer)".
 *
 * Skill searches keep their own rule (utils/skillList.ts `skillMatches`),
 * which also reads a skill's other names and its ○ / ◎ marks.
 */

/** Lower case, accents dropped, letters and digits only. */
export function searchKey(text: string): string {
	return text.normalize("NFD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
}

/** The query's words, each as a search key; empty ones (a lone "." or "-") dropped. */
function queryWords(query: string): string[] {
	return query.split(/\s+/).map(searchKey).filter(Boolean)
}

/**
 * Does the query find this name (or any of these names)? An empty query, or
 * one of punctuation alone, finds everything.
 */
export function nameMatches(query: string, ...names: Array<string | null | undefined>): boolean {
	const words = queryWords(query)
	if (words.length === 0) return true
	return names.some((name) => {
		if (!name) return false
		const key = searchKey(name)
		return words.every((word) => key.includes(word))
	})
}
