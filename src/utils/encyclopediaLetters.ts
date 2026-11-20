/**
 * Which letter a list's rows file under, for the Encyclopedia's letter
 * headings and A to Z index (components/encyclopedia/letters.tsx). Plain
 * helpers, kept out of the component file so it exports components only.
 */

export interface LetterGroup<T> {
	letter: string
	items: T[]
}

/** The heading a name files under: its first letter, or "#" for anything that isn't one. */
function letterOf(name: string): string {
	const first = name.trim().charAt(0).toUpperCase()
	return /[A-Z]/.test(first) ? first : "#"
}

/**
 * The list cut into runs of one starting letter, in the order given (so a
 * Z to A list runs Z to A). Null when headings shouldn't show: the list is
 * filtered, sorted by something else, or too short to need them.
 */
export function lettersFor<T>(items: T[], nameOf: (item: T) => string, show: boolean): LetterGroup<T>[] | null {
	if (!show || items.length < 40) return null
	const groups: LetterGroup<T>[] = []
	for (const item of items) {
		const letter = letterOf(nameOf(item))
		const last = groups[groups.length - 1]
		if (last?.letter === letter) last.items.push(item)
		else groups.push({ letter, items: [item] })
	}
	return groups
}

/** The element id a letter's heading carries, per list, so two lists never clash. */
export const letterId = (scope: string, letter: string) => `enc-${scope}-letter-${letter === "#" ? "other" : letter}`
