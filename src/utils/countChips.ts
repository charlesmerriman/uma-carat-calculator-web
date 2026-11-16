import type { BannerRowType } from "./bannerHelpers"

/**
 * One button in the stepper pad.
 *
 * `next` is a pure function of the CURRENT value rather than a fixed delta or a
 * fixed target, because the pad holds both kinds at once ("+10" and "Next pity")
 * and the disabled rule below wants to treat them identically.
 */
export interface CountChip {
	label: string
	title: string
	next: (current: number) => number
}

/**
 * The pad's contents, split by GROUP rather than by row — they render as one
 * row with a divider between them. The deltas are a symmetric ruler and the
 * presets are jump-to-a-value buttons; keeping them apart in the data is what
 * lets the pad draw that divider without hard-coding an index.
 */
export interface CountChipSet {
	deltas: CountChip[]
	presets: CountChip[]
	/** Footer line teaching the keyboard equivalents. */
	hint: string
}

/**
 * The coarse delta on a pull row, which is also what Ctrl+arrow steps by.
 *
 * A support card wants up to five copies, so its plans are several pities deep
 * and the useful big step is a whole pity (200). An uma only ever needs ONE
 * copy: nobody plans past the first pity, "Next pity" already jumps there, and
 * a ±200 that can only mean "0 or 200" duplicates it. Half a pity (100) is the
 * step that is still useful below that ceiling.
 *
 * Exported because the rows hand the same number to NumberField's `largeStep`,
 * and the pad and the keyboard must never disagree about it. Undefined on a
 * step-up, whose ladder tops out around 25 steps and has no third quantity.
 */
export function coarsePullDelta(
	rowType: BannerRowType,
	pullsPerPity: number
): number | undefined {
	if (rowType === "StepUp") return undefined
	return rowType === "Uma" ? pullsPerPity / 2 : pullsPerPity
}

/**
 * The pull/step quantities this planner actually deals in, per row kind.
 *
 *   Uma      −100 −10 +10 +100 | Next pity
 *   Support  −200 +200         | Next pity
 *   Step Up  −5 +5             | Limit N | Next round
 *
 * A pull row's unit of account is a pity copy, so one preset lands exactly on
 * the next threshold, which is also what turns the field green (see
 * getPullCountStatus). Support rows drop ±10 because their plans move in whole
 * pities; a one-off multi is quicker typed (or Shift+arrow) than hunted for.
 *
 * NO "Max" ON A PULL ROW. It used to jump to the affordable ceiling, but
 * spending every pull you own on one banner is almost never the plan, and the
 * Max Pulls tile right beside the field already shows the number.
 *
 * A step-up row is a different unit entirely: `number_of_pulls` carries STEPS
 * there, and a plan is 5-15 of them. People buy whole rounds, so the ruler is
 * ±5 only (single steps stay on the arrow keys).
 *
 * @param stepLimit The most steps the banner SELLS (`max_steps`, which is
 *   `banner_count * 5`), NOT what the carats can pay for. With two banners and
 *   carats for 8 steps the chip still reads "Limit 10": over-planning past the
 *   budget is surfaced as a red field rather than prevented (same rule as
 *   handlePullCountChange), and the chip's job is "plan the whole thing".
 *   Named "Limit" so it cannot be read as the affordable "Max Steps" tile.
 *   Pass Infinity when no banner is chosen yet and the chip is dropped rather
 *   than invented. Ignored on pull rows.
 */
export function buildCountChips({
	rowType,
	stepLimit,
	pullsPerPity,
	stepsPerRound,
	priorPulls = 0,
}: {
	rowType: BannerRowType
	stepLimit: number
	pullsPerPity: number
	stepsPerRound: number
	/**
	 * Pulls already made on the banner (the row's pulls_already_made). The
	 * pity counter is the banner's whole count, so "Next pity" lands the
	 * planned pulls where made + planned reaches the next threshold: 20 made
	 * means 180 planned, the same number getPullCountStatus turns green.
	 */
	priorPulls?: number
}): CountChipSet {
	// Never below zero, matching NumberField's own floor — a "-200" on a row
	// holding 10 lands on 0 rather than refusing to move.
	const by = (amount: number): CountChip["next"] => (current) =>
		Math.max(0, current + amount)

	/**
	 * Round UP to the next multiple, from strictly above the current value. The
	 * `+ 1` is what makes this "advance to the next one" rather than "stay put":
	 * on a row already holding exactly 200, snapping to 200 would be a no-op and
	 * the button would disable itself just when it is most useful.
	 */
	const toNextMultiple = (interval: number): CountChip["next"] => (current) =>
		Math.ceil((current + 1) / interval) * interval

	if (rowType === "StepUp") {
		/**
		 * Spread into the presets, so an unknown limit drops the chip instead of
		 * rendering one. Neither degenerate alternative is acceptable: "Limit
		 * Infinity" is not a button, and a Limit that quietly meant 0 would wipe
		 * a field the user had just filled in.
		 */
		const limitGroup: CountChip[] = Number.isFinite(stepLimit)
			? [
					{
						label: `Limit ${stepLimit}`,
						title: `Every step this banner sells (${stepLimit})`,
						next: () => stepLimit,
					},
			  ]
			: []

		return {
			deltas: [
				{ label: `−${stepsPerRound}`, title: `One round fewer (${stepsPerRound} steps)`, next: by(-stepsPerRound) },
				{ label: `+${stepsPerRound}`, title: `One round more (${stepsPerRound} steps)`, next: by(stepsPerRound) },
			],
			presets: [
				...limitGroup,
				{
					label: "Next round",
					title: `Round up to a complete ladder (a multiple of ${stepsPerRound} steps)`,
					next: toNextMultiple(stepsPerRound),
				},
			],
			hint: `↑↓ ±1 · Shift ±${stepsPerRound}`,
		}
	}

	const prior = Math.max(0, priorPulls)
	// Defined for both pull kinds; the fallback only satisfies the type.
	const coarse = coarsePullDelta(rowType, pullsPerPity) ?? pullsPerPity
	const coarseTitle = coarse === pullsPerPity ? "One pity copy" : "Half a pity"
	const multiChips = (sign: 1 | -1): CountChip[] =>
		rowType === "Uma"
			? [
					{
						label: `${sign > 0 ? "+" : "−"}10`,
						title: `One multi ${sign > 0 ? "more" : "fewer"} (10 pulls)`,
						next: by(sign * 10),
					},
			  ]
			: []

	return {
		deltas: [
			{ label: `−${coarse}`, title: `${coarseTitle} fewer (${coarse} pulls)`, next: by(-coarse) },
			...multiChips(-1),
			...multiChips(1),
			{ label: `+${coarse}`, title: `${coarseTitle} more (${coarse} pulls)`, next: by(coarse) },
		],
		presets: [
			{
				label: "Next pity",
				title: prior > 0
					? `Up to the next pity threshold, counting the ${prior} pulls you've already made`
					: `Round up to the next pity threshold (a multiple of ${pullsPerPity} pulls)`,
				next: (current) => toNextMultiple(pullsPerPity)(current + prior) - prior,
			},
		],
		// Shift ±10 stays on a support row's keyboard even though its pad has no
		// ±10 chip: a key costs no space, a chip does.
		hint: `↑↓ ±1 · Shift ±10 · Ctrl ±${coarse}`,
	}
}

/**
 * The pad for the copies field (copies taken with a selector or crystal). The
 * whole range is 0-5, so one copy either way is the only useful button.
 */
export function buildCopyChips(): CountChipSet {
	return {
		deltas: [
			{ label: "−1", title: "One copy fewer", next: (current) => Math.max(0, current - 1) },
			{ label: "+1", title: "One copy more", next: (current) => current + 1 },
		],
		presets: [],
		hint: "↑↓ ±1",
	}
}

/**
 * The pad for a discounted pack's quantity on the Selectors page.
 *
 * Unlike a pull count, this one CLAMPS: `max` is the campaign's purchase limit
 * (`max_quantity`), a rule of the shop and not a budget, so there is nothing
 * past it to plan. "+1" therefore stops at the limit and disables itself there,
 * and "Max" is the common case of buying every discounted pack on offer.
 */
export function buildQuantityChips(max: number): CountChipSet {
	return {
		deltas: [
			{ label: "−1", title: "One fewer", next: (current) => Math.max(0, current - 1) },
			{ label: "+1", title: "One more", next: (current) => Math.min(max, current + 1) },
		],
		presets: [
			{ label: `Max ${max}`, title: `Buy all ${max}, the most this campaign sells`, next: () => max },
		],
		hint: "↑↓ ±1",
	}
}
