/**
 * The A to Z order of the Encyclopedia's lists, and the letter each name
 * files under, from ONE reading of the name so the two can never disagree.
 *
 * WHY THE CLIENT SORTS (Daptrius, board "Skill Name Sort: The 49 ABCs",
 * 2026-11-25): the Skills list used to keep GET /skills's order, which is
 * the database's. Production's Postgres collation skips a leading sign, so
 * "#LookatCurren" sorted among the L's, while the headings filed it under
 * "#". Every such name cut its letter in two: the jump list read
 * "# あ # A B # B # B C ..." and L had three headings. SQLite (local) sorts
 * by code point, so the bug never showed locally. One key, read here, makes
 * the order the same on every database and in every browser locale.
 *
 * THE RULE:
 *   - a leading sign or space is skipped, so "#LookatCurren" is an L,
 *     "…found you." an F and "¡Qué alegría!" a Q, the way the game (and
 *     production's old order) files them;
 *   - an accent is dropped, so "Élan" is an E;
 *   - a name that then starts with a digit files under "#", first;
 *   - one that starts in another script (Japanese, a Greek α) under "あ",
 *     last;
 *   - a name with nothing but signs files under "#" too.
 */

/** Where a name files: its section's rank (0 "#", 1 to 26 A to Z, 27 "あ") and the letter shown. */
interface NameInitial {
	rank: number
	letter: string
}

/** The digits' section, first, and the other scripts', last. */
export const DIGIT_LETTER = "#"
export const OTHER_SCRIPT_LETTER = "あ"
const OTHER_SCRIPT_RANK = 27

/** Every leading character that is not a letter or a digit in any script. */
const LEADING_SIGNS = /^[^\p{L}\p{N}]+/u
/** Combining marks left behind by NFD ("É" becomes "E" + an accent). */
const ACCENTS = /\p{M}/gu

/** The name as it sorts: leading signs gone, accents dropped. */
function nameSortText(name: string): string {
	return name.normalize("NFD").replace(ACCENTS, "").replace(LEADING_SIGNS, "")
}

/** The section a name files under (see the rule above). */
export function nameInitial(name: string): NameInitial {
	const first = nameSortText(name).charAt(0).toUpperCase()
	if (first === "") return { rank: 0, letter: DIGIT_LETTER }
	if (/[A-Z]/.test(first)) return { rank: first.charCodeAt(0) - 64, letter: first }
	if (/\p{N}/u.test(first)) return { rank: 0, letter: DIGIT_LETTER }
	return { rank: OTHER_SCRIPT_RANK, letter: OTHER_SCRIPT_LETTER }
}

// A fixed locale, so a reader's browser language can't move a name. Base
// sensitivity ignores case and accents; `numeric` puts "9" before "10";
// `ignorePunctuation` lets "Late-Surger" and "Late Surger" sit together.
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true, ignorePunctuation: true })

/**
 * A to Z by name: the section first (so every section is one unbroken run),
 * then the collator, then the raw name so equal keys still order the same
 * way every time.
 */
export function compareNames(a: string, b: string): number {
	const rankA = nameInitial(a).rank
	const rankB = nameInitial(b).rank
	if (rankA !== rankB) return rankA - rankB
	return collator.compare(nameSortText(a), nameSortText(b)) || (a < b ? -1 : a > b ? 1 : 0)
}
