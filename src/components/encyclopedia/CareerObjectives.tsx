/**
 * An uma's career goals on her page (notes/encyclopedia-plan.md, Phase 3): a
 * rail per year, the race goals as stops on it in order, each with when, the
 * race, its grade in the game's colour and the placing needed. Worded by the
 * API (backend career.py) from the game files. Goals of kinds nobody has
 * decoded yet (a fan count, places in several races) are left out, and the
 * section says so rather than look complete.
 */

import type { CareerGoal } from "../../types/encyclopedia"
import { SectionNote, SubHeading } from "./pieces"

/** "Classic Year, Early Feb" -> ["Classic Year", "Early Feb"] */
function splitWhen(when: string): [string, string] {
	const [year, ...rest] = when.split(", ")
	return [year, rest.join(", ")]
}

export function CareerObjectives({ goals, hidden }: { goals: CareerGoal[]; hidden: number }) {
	const years: { year: string; goals: CareerGoal[] }[] = []
	for (const goal of goals) {
		const [year] = splitWhen(goal.when)
		const last = years[years.length - 1]
		if (last?.year === year) last.goals.push(goal)
		else years.push({ year, goals: [goal] })
	}
	return (
		<>
			<div className="enc-career">
				{years.map(({ year, goals: inYear }) => (
					<div key={year} className="enc-career__year">
						<SubHeading>{year}</SubHeading>
						<ol className="enc-career__stops">
							{inYear.map((goal) => (
								// A race she must WIN fills its stop on the rail.
								<li key={goal.turn} className="enc-stop" data-win={goal.need === "Win"}>
									<span className="enc-stop__when">{splitWhen(goal.when)[1]}</span>
									<span className="enc-stop__race">
										{goal.race}
										{goal.grade && <span className="grade-pill" data-grade={goal.grade}>{goal.grade}</span>}
										<span className="enc-stop__need">{goal.need}</span>
									</span>
								</li>
							))}
						</ol>
					</div>
				))}
			</div>
			{hidden > 0 && (
				<SectionNote>
					{hidden === 1 ? "One more goal isn't" : `${hidden} more goals aren't`} shown yet: we haven't confirmed how the game words
					{hidden === 1 ? " it" : " them"}.
				</SectionNote>
			)}
		</>
	)
}
