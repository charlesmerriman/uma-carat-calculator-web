/**
 * Letter headings and the A to Z index down a list's left edge, as a printed
 * encyclopedia has them (the redesign, notes/encyclopedia-redesign-plan.md).
 *
 * Only for a FULL list sorted by name: once a filter or another sort is on,
 * the list is one plain grid (a heading over one or two tiles each looked
 * worse than none). `lettersFor` (utils/encyclopediaLetters.ts) decides; the
 * page asks it and draws either.
 */

import { useReducedMotion } from "framer-motion"
import { letterId } from "../../utils/encyclopediaLetters"

/**
 * A letter's heading inside the grid: it spans the row. `role="presentation"`
 * keeps it out of the list's items for a screen reader; the heading inside
 * still names the run.
 */
export function LetterHeading({ scope, letter, count, noun }: { scope: string; letter: string; count: number; noun: [string, string] }) {
	return (
		<li role="presentation" id={letterId(scope, letter)} className="enc-letter">
			<h2>{letter}</h2>
			<span>{count} {count === 1 ? noun[0] : noun[1]}</span>
		</li>
	)
}

/** The thumb index: one button per letter the list has, jumping to its heading. Wide screens only. */
export function LetterIndex({ scope, letters }: { scope: string; letters: string[] }) {
	const reducedMotion = useReducedMotion()
	return (
		<nav aria-label="Jump to a letter" className="enc-index">
			{letters.map((letter) => (
				<button
					key={letter}
					type="button"
					onClick={() => document.getElementById(letterId(scope, letter))?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })}
				>
					{letter}
				</button>
			))}
		</nav>
	)
}
