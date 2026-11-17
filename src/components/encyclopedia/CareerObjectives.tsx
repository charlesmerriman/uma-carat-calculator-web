/**
 * An uma's career goals on her page (notes/encyclopedia-plan.md, Phase 3).
 * On a phone, one track from her debut to the end of her senior year, the
 * goals as posts on it in order and a chequered flag after the last (the
 * redesign of 2026-11-17). On a wider screen, one track PER YEAR side by
 * side, as before the redesign (Daptrius, board "Desktop Career Objectives",
 * 2026-11-17: the single track wrapped to two rows for most characters, so
 * it saved no space and read worse). One markup for both, grouped by year;
 * encyclopedia.css switches the layout at 48rem, never a media query in
 * render (the page is prerendered).
 *
 * A race she must WIN is a gold post. A race goal shows when, the race, its
 * grade in the game's colour and the placing needed; a fan count or a
 * placings goal ("Get 3,000 fans", "Place 3rd or better in 2 G1 races")
 * shows its sentence in the race's place. Worded by the API (backend
 * career.py) from the game files. A goal whose wording nobody has confirmed
 * yet is left out, and the section says so rather than look complete.
 */

import type { CSSProperties } from "react"
import type { CareerGoal } from "../../types/encyclopedia"
import { SectionNote } from "./pieces"

/** "Classic Year, Early Feb" -> ["Classic Year", "Early Feb"] */
function splitWhen(when: string): [string, string] {
	const [year, ...rest] = when.split(", ")
	return [year, rest.join(", ")]
}

/** The goals in order, cut into runs of one year each. */
function byYear(goals: CareerGoal[]): { year: string; goals: CareerGoal[] }[] {
	const years: { year: string; goals: CareerGoal[] }[] = []
	for (const goal of goals) {
		const [year] = splitWhen(goal.when)
		const last = years[years.length - 1]
		if (last?.year === year) last.goals.push(goal)
		else years.push({ year, goals: [goal] })
	}
	return years
}

export function CareerObjectives({ goals, hidden }: { goals: CareerGoal[]; hidden: number }) {
	const years = byYear(goals)
	return (
		<>
			{/* --years: how many columns the wide layout draws. */}
			<div className="enc-career" style={{ "--years": years.length } as CSSProperties}>
				{years.map(({ year, goals: inYear }) => (
					<ol key={year} className="enc-career__year" aria-label={year}>
						{inYear.map((goal, index) => (
							// A race she must WIN is a gold post; a goal that isn't one race is a diamond.
							<li key={goal.turn} className="enc-stop" data-win={goal.need === "Win"} data-kind={goal.kind ?? "race"}>
								{/* The year is said once, over its first goal: on a phone it heads its stretch of the track. */}
								<span className="enc-stop__year">{index === 0 ? year : ""}</span>
								<span className="enc-stop__when">{splitWhen(goal.when)[1]}</span>
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
						))}
					</ol>
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
