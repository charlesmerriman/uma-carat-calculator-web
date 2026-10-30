/** "1,200 pulls", "1 step". */
export const plural = (count: number, one: string, many: string): string =>
	`${count.toLocaleString()} ${count === 1 ? one : many}`

/**
 * "230 pulls", "230 pulls, 6 steps", or "6 steps" for a plan of only step-ups.
 * A step-up row counts steps, never pulls (plannedSteps()), and the server
 * sums the two apart.
 */
export const planTotalsLine = (pulls: number, steps: number): string =>
	[
		(pulls > 0 || steps === 0) && plural(pulls, "pull", "pulls"),
		steps > 0 && plural(steps, "step", "steps"),
	]
		.filter(Boolean)
		.join(", ")
