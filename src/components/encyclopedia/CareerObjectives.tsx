/**
 * An uma's career goals on her page (notes/encyclopedia-plan.md, Phase 3):
 * one track from her debut to the end of her senior year, the goals as posts
 * on it in order, a chequered flag after the last (the redesign of
 * 2026-11-17). A race she must WIN is a gold post. A race goal shows when,
 * the race, its grade in the game's colour and the placing needed; a fan
 * count or a placings goal ("Get 3,000 fans", "Place 3rd or better in 2 G1
 * races") shows its sentence in the race's place. Worded by the API (backend
 * career.py) from the game files. A goal whose wording nobody has confirmed
 * yet is left out, and the section says so rather than look complete.
 */

import type { CareerGoal } from "../../types/encyclopedia"
import { SectionNote } from "./pieces"

/** "Classic Year, Early Feb" -> ["Classic Year", "Early Feb"] */
function splitWhen(when: string): [string, string] {
	const [year, ...rest] = when.split(", ")
	return [year, rest.join(", ")]
}

export function CareerObjectives({ goals, hidden }: { goals: CareerGoal[]; hidden: number }) {
	return (
		<>
			<ol className="enc-career">
				{goals.map((goal, index) => {
					const [year, when] = splitWhen(goal.when)
					// The year is said once, over the first goal of that year.
					const opensYear = index === 0 || splitWhen(goals[index - 1].when)[0] !== year
					return (
						// A race she must WIN is a gold post; a goal that isn't one race is a diamond.
						<li key={goal.turn} className="enc-stop" data-win={goal.need === "Win"} data-kind={goal.kind ?? "race"}>
							<span className="enc-stop__year">{opensYear ? year : ""}</span>
							<span className="enc-stop__when">{when}</span>
							<span className="enc-stop__post" aria-hidden="true" />
							<span className="enc-stop__race">{goal.race}</span>
							{(goal.grade || goal.need) && (
								<span className="enc-stop__meta">
									{goal.grade && <span className="grade-pill" data-grade={goal.grade}>{goal.grade}</span>}
									{/* A fan count or a placings goal says it all in its sentence. */}
									{goal.need && <span className="enc-stop__need">{goal.need}</span>}
								</span>
							)}
						</li>
					)
				})}
			</ol>
			{hidden > 0 && (
				<SectionNote>
					{hidden === 1 ? "One more goal isn't" : `${hidden} more goals aren't`} shown yet: we haven't confirmed how the game words
					{hidden === 1 ? " it" : " them"}.
				</SectionNote>
			)}
		</>
	)
}
