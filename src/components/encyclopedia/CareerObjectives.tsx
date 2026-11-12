/**
 * An uma's career goals on her page (notes/encyclopedia-plan.md, Phase 3): the
 * race goals in order, grouped by year, each with when, the race, its grade
 * and the placing needed. Worded by the API (backend career.py) from the game
 * files. Goals of kinds nobody has decoded yet (a fan count, places in several
 * races) are left out, and the section says so rather than look complete.
 */

import type { CareerGoal } from "../../types/encyclopedia"

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
		<div className="flex flex-col gap-3">
			{years.map(({ year, goals: inYear }) => (
				<div key={year}>
					<h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{year}</h3>
					<ol className="flex flex-col gap-1">
						{inYear.map((goal) => (
							<li
								key={goal.turn}
								className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 rounded-lg border border-edge bg-(--card-fill) px-3 py-1.5 text-sm text-gray-100"
							>
								<span className="text-xs text-gray-400">{splitWhen(goal.when)[1]}</span>
								<span className="min-w-0 truncate">
									{goal.race}
									{goal.grade && <span className="ml-1.5 rounded border border-gray-500 px-1 text-[10px] text-gray-300">{goal.grade}</span>}
								</span>
								<span className="text-xs font-semibold text-brand">{goal.need}</span>
							</li>
						))}
					</ol>
				</div>
			))}
			{hidden > 0 && (
				<p className="text-xs text-gray-400">
					{hidden === 1 ? "One more goal isn't" : `${hidden} more goals aren't`} shown yet: we haven't confirmed how the game words
					{hidden === 1 ? " it" : " them"}.
				</p>
			)}
		</div>
	)
}
