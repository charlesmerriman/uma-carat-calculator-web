/**
 * Pulls required to earn one guaranteed copy from the pity exchange.
 *
 * Exported because the UI also keys off it: a planned pull count that lands
 * exactly on a multiple of this spends nothing on a partial, unredeemable pity
 * counter, which is what `getPullCountStatus` signals green.
 */
export const PULLS_PER_PITY_COPY = 200

/**
 * 5 copies = MLB (the card itself plus 4 limit breaks). There is no 5LB, so
 * copies beyond this are wasted and the 5-copy bucket has to absorb them.
 */
export const MAX_COPIES = 5

/**
 * A two-card target the strip can show: a whole number of copies from one to
 * MLB. The one rule for the saved `primary_target`, shared by the odds display
 * (which falls back to a default when it fails) and the guest store (which
 * drops the value when it fails).
 */
export function isTargetCopies(value: unknown): value is number {
	return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_COPIES
}

/** A batch of independent random attempts that all share one chance. */
export interface AttemptGroup {
	/** How many attempts are in the batch. */
	trials: number
	/**
	 * Per-attempt chance of the card being chased, as a DECIMAL (0.0075, not
	 * 0.75). The one easy mistake to make here, hence the shouting.
	 */
	rate: number
}

/**
 * One banner's odds, reduced to the things that actually vary.
 *
 * Standard banners and step-ups differ only in these numbers — same binomial,
 * same MLB cap, same "copies in hand don't need rolling for" treatment — so
 * they share one implementation instead of two that can drift apart.
 */
export interface CopyDistributionInput {
	/**
	 * The random attempts, grouped by their chance. A standard banner has one
	 * group: its pulls at the chased card's rate-up rate. A step-up has two, because its step 3 and 4
	 * guaranteed slots land on the chased card at 1 in 10, far more often than
	 * an ordinary pull does. See stepUpLadder.ts.
	 */
	attempts: AttemptGroup[]
	/**
	 * Copies handed over outright, never rolled for — pity exchanges on a normal
	 * banner, the step 5 pick on a step-up.
	 */
	guaranteed: number
}

/**
 * Binomial PMF: the probability of landing exactly `successes` hits in `trials`
 * independent attempts. `combos` is "trials choose successes" built up
 * iteratively to avoid overflowing on large factorials.
 */
function getExactProbability(
	trials: number,
	successes: number,
	rate: number
): number {
	// You cannot succeed more often than you rolled. Guarding here also keeps
	// the loop below from running past `trials` into negative terms, which would
	// return -0 and render as an invalid `width: -0%` on the bars.
	if (successes > trials) {
		return 0
	}

	let combos = 1
	for (let i = 0; i < successes; i++) {
		combos *= (trials - i) / (i + 1)
	}
	return (
		combos * Math.pow(rate, successes) * Math.pow(1 - rate, trials - successes)
	)
}

/**
 * Probability (0-100) of finishing with at least `copiesNeeded` copies, given
 * the guarantees already in hand.
 *
 * Guarantees are modelled as copies already held, so the random attempts only
 * have to supply the shortfall. A non-positive shortfall means the guarantees
 * alone get you there and the result is a certainty.
 */
function getAtLeastProbability(
	{ trials, rate, guaranteed }: AttemptGroup & { guaranteed: number },
	copiesNeeded: number
): number {
	const randomNeeded = copiesNeeded - guaranteed

	if (randomNeeded <= 0) {
		return 100
	}

	// P(at least n) = 1 - P(0) - P(1) - ... - P(n-1)
	let below = 0
	for (let i = 0; i < randomNeeded; i++) {
		below += getExactProbability(trials, i, rate)
	}

	// Summing many small floats can drift a hair past 1, which would surface as
	// a negative percentage. Clamp rather than Math.abs — abs would flip a
	// negative into a plausible-looking positive and hide the drift.
	return Math.max(1 - below, 0) * 100
}

/**
 * Exchanges the planned pulls unlock, uncapped. The game's counter is per
 * banner, so pulls ALREADY made on it (the row's pulls_already_made) count
 * toward the next 200 without being rolled again: 120 made plus 80 planned
 * is one exchange, not none. Exchanges the counter passed BEFORE the plan are
 * the player's history, not something these pulls hand over, so they are
 * subtracted. With nothing made, this is the old `floor(pulls / 200)`.
 */
export function pityExchanges(pulls: number, priorPulls = 0): number {
	const planned = Math.max(0, Math.floor(pulls))
	const prior = Math.max(0, Math.floor(priorPulls))
	return (
		Math.floor((prior + planned) / PULLS_PER_PITY_COPY) -
		Math.floor(prior / PULLS_PER_PITY_COPY)
	)
}

/**
 * Copies the pity exchange hands over for free at this pull count — one per
 * 200 pulls, capped at MLB since further exchanges have nothing left to break.
 */
export function getGuaranteedCopies(pulls: number, priorPulls = 0): number {
	return Math.min(pityExchanges(pulls, priorPulls), MAX_COPIES)
}

/**
 * Probability (0-100) of finishing a STANDARD banner with at least
 * `copiesNeeded` copies, at `rate` per pull with pity every 200 pulls.
 *
 * `rate` is the chased card's rate-up rate as a decimal, from
 * utils/rateUpRates.ts. It is a parameter, never a module constant, because
 * it varies by banner and the numbers behind it come from the API.
 */
export function calculateSuccessProbability(
	pulls: number,
	copiesNeeded: number,
	rate: number,
	priorPulls = 0
): number {
	return getAtLeastProbability(
		{ trials: pulls, rate, guaranteed: getGuaranteedCopies(pulls, priorPulls) },
		copiesNeeded
	)
}

/**
 * The chance of EXACTLY 0, 1, ... MAX_COPIES - 1 random hits across every
 * group of attempts, as decimals.
 *
 * Groups combine by convolution: the chance of k hits in total is the sum,
 * over every way of splitting k between the groups, of the chances of each
 * side of the split. One step-up round, 47 pulls at 0.3% plus 2 slots at 10%:
 *
 *     P(0 total) = P(0 from pulls) * P(0 from slots)
 *     P(1 total) = P(1 from pulls) * P(0 from slots)
 *                + P(0 from pulls) * P(1 from slots)
 *     P(2 total) = P(2, 0) + P(1, 1) + P(0, 2)       ...and so on
 *
 * Only counts below MLB are kept. That loses nothing: a low total can only be
 * made of low counts from each group, so the truncated arrays still combine
 * exactly. Everything at or past MLB is recovered by the caller as "whatever
 * probability is left over".
 */
function randomHitsBelowCap(attempts: AttemptGroup[]): number[] {
	// Before any attempt, zero hits is a certainty. Starting from this rather
	// than from the first group means one group passes through untouched
	// (x * 1 and x + 0 are exact), so a standard banner's odds come out
	// bit-for-bit the same as the single-binomial code this replaced.
	let combined: number[] = Array.from({ length: MAX_COPIES }, (_, hits) =>
		hits === 0 ? 1 : 0
	)

	for (const { trials, rate } of attempts) {
		const group = Array.from({ length: MAX_COPIES }, (_, hits) =>
			getExactProbability(trials, hits, rate)
		)

		combined = combined.map((_, total) => {
			let sum = 0
			for (let fromGroup = 0; fromGroup <= total; fromGroup++) {
				sum += combined[total - fromGroup] * group[fromGroup]
			}
			return sum
		})
	}

	return combined
}

/**
 * The full distribution of final copy counts as percentages, indexed by copy
 * count: [exactly 0, exactly 1, ... exactly 4, five-or-more].
 *
 * These are discrete outcomes — each entry is the chance of landing on that
 * result and nothing else — so the array sums to 100. The last entry is the
 * one deliberate exception: extra copies past MLB have nowhere else to go, so
 * that bucket stays cumulative or the total would fall short of 100.
 */
export function copyDistribution({
	attempts,
	guaranteed,
}: CopyDistributionInput): number[] {
	// Guarantees past MLB are real but unusable — a long step-up ladder can hand
	// over more than five. Clamping here rather than at each call site keeps a
	// caller from silently producing an all-zero distribution.
	const floor = Math.min(Math.max(0, Math.floor(guaranteed)), MAX_COPIES)
	const random = randomHitsBelowCap(attempts)

	// Guarantees already cover `floor` copies, so random attempts need only
	// make up the difference. Totals below that floor are unreachable.
	const exact = Array.from({ length: MAX_COPIES }, (_, copies) =>
		copies < floor ? 0 : random[copies - floor] * 100
	)

	// The MLB bucket is 1 minus every random count that falls short of it.
	// Summing many small floats can drift a hair past 1, which would surface as
	// a negative percentage. Clamp rather than Math.abs — abs would flip a
	// negative into a plausible-looking positive and hide the drift.
	let shortOfMlb = 0
	for (let hits = 0; hits < MAX_COPIES - floor; hits++) {
		shortOfMlb += random[hits]
	}

	return [...exact, Math.max(1 - shortOfMlb, 0) * 100]
}

/**
 * The copy distribution for a STANDARD banner at `pulls` pulls, at `rate` per
 * pull (the chased card's rate-up rate; see utils/rateUpRates.ts), with pity
 * credited every 200 pulls. `priorPulls` are pulls already made on the
 * banner: they move the exchange counter and are never rolled (pityExchanges).
 */
export function calculateCopyDistribution(
	pulls: number,
	rate: number,
	priorPulls = 0
): number[] {
	return copyDistribution({
		attempts: [{ trials: pulls, rate }],
		guaranteed: getGuaranteedCopies(pulls, priorPulls),
	})
}

/**
 * Shift a copy distribution right by copies obtained outside of pulling — a
 * selector ticket or an SSR crystal spent on this banner's featured card.
 *
 * Those copies are certainties, not probabilities, so they don't belong inside
 * the binomial at all: the pulls still produce whatever they produce, and the
 * reserved copies simply sit on top. That makes this a pure re-indexing of the
 * existing distribution rather than a change to how it is computed:
 *
 *     P(total = k) = P(pulls give k - reserved)      for k < MAX_COPIES
 *     P(total = 5) = P(pulls give >= 5 - reserved)
 *
 * The top bucket absorbs the tail because there is no 5LB — every outcome that
 * would have overshot MLB lands there, which is also what keeps the array
 * summing to 100 (the same reason calculateCopyDistribution makes it cumulative).
 */
export function shiftDistribution(
	distribution: number[],
	reservedCopies: number
): number[] {
	const reserved = Math.max(0, Math.floor(reservedCopies))
	if (reserved === 0) return distribution

	return Array.from({ length: MAX_COPIES + 1 }, (_, copies) => {
		// Below the reserved floor is now unreachable — those copies are already
		// in hand before a single pull.
		if (copies < reserved) return 0

		const fromPulls = copies - reserved
		if (copies < MAX_COPIES) return distribution[fromPulls] ?? 0

		// Fold every outcome at or past the cap into the top bucket.
		return distribution
			.slice(fromPulls)
			.reduce((sum, probability) => sum + probability, 0)
	})
}

/** One row's two-card odds: the chased card A, and a second card B beside it. */
export interface TwoCardInput {
	/** Pulls planned on the banner. Every pull can land A, B, or neither. */
	pulls: number
	/** Per-pull chance of A and of B, as decimals (utils/rateUpRates.ts). */
	rateA: number
	rateB: number
	/**
	 * The row's funded reserved copies (selectors and crystals). Free copies
	 * of EITHER card, pooled with the exchanges: a selector or a crystal buys
	 * a copy of whichever card you choose, the same as an exchange does.
	 */
	reservedCopies: number
	/**
	 * Copies A is taken to before any free copy goes to B: 1..MAX_COPIES from
	 * the odds panel's toggle (oddsTarget in utils/oddsDisplay).
	 */
	targetA: number
	/**
	 * Pulls already made on the banner: they move the exchange counter (so
	 * the pot) and are never rolled. Absent = 0. See pityExchanges.
	 */
	priorPulls?: number
}

/**
 * The chance of finishing with A at its target AND B at each level, as
 * percentages indexed by B's copy count: [A at target + B none, A at target
 * + B 1 copy, ... A at target + B MLB]. What a player asks on a double
 * rate-up: "if I get the one I want, what do I get of the other?"
 *
 * These are JOINT chances, so the six add up to A's own chance of reaching
 * the target, not to 100. That is on purpose: the cells answer "how likely is
 * this exact finish", and the finishes where A falls short are not on the
 * strip.
 *
 * Three things make this more than two copies of the one-card odds:
 *
 *   - The cards share pulls. One pull gives A, or B, or neither, never both,
 *     so the counts are a three-way split of the same pulls, not two coins:
 *
 *         P(i of A, j of B) = Binomial(pulls, i; rateA)
 *                           x Binomial(pulls - i, j; rateB / (1 - rateA))
 *
 *     (the second factor is B's chance among the pulls that were NOT A).
 *
 *   - The free copies are ONE pot for the whole banner, spent after pulling:
 *     one exchange per 200 pulls, plus the row's reserved copies, which buy a
 *     copy of whichever card needs it just as an exchange does. The pot goes
 *     to A until A reaches the target, and the rest goes to B. So a reserved
 *     copy A turned out not to need is a copy of B, not a wasted one.
 *
 *   - A past the target still counts. Extra copies of A are luck, not a
 *     miss, so with a target of one copy the row "pulls gave three of A" is
 *     in, and every free copy on it goes to B.
 *
 * Because A gets the pot first, the six cells always add up to the one-card
 * strip's cells from the target up (its MLB cell when the target is MLB). A
 * test pins that.
 */
export function twoCardDistribution({
	pulls,
	rateA,
	rateB,
	reservedCopies,
	targetA,
	priorPulls = 0,
}: TwoCardInput): number[] {
	const n = Math.max(0, Math.floor(pulls))
	// A target the strip cannot show falls back to MLB rather than throwing;
	// oddsTarget never sends one, this is belt and braces.
	const target = isTargetCopies(targetA) ? targetA : MAX_COPIES
	// NOT getGuaranteedCopies: that caps at MLB because one card can use no
	// more, but here a copy A cannot use still buys a copy of B.
	const pot = pityExchanges(n, priorPulls) + Math.max(0, Math.floor(reservedCopies))
	// B's chance on a pull that did not give A. Guarded so a (nonsensical)
	// rateA of 1 cannot divide by zero.
	const rateBGivenNotA = rateA < 1 ? Math.min(rateB / (1 - rateA), 1) : 0

	// joint[i][j]: the chance of EXACTLY i random A and j random B, for
	// i, j < MAX_COPIES. Index MAX_COPIES is "this many or more", filled below
	// from what the exact cells leave over, the same way copyDistribution
	// builds its top bucket.
	const size = MAX_COPIES + 1
	const joint = Array.from({ length: size }, () => new Array<number>(size).fill(0))
	for (let i = 0; i < MAX_COPIES; i++) {
		const aExactly = getExactProbability(n, i, rateA)
		for (let j = 0; j < MAX_COPIES; j++) {
			joint[i][j] = aExactly * getExactProbability(n - i, j, rateBGivenNotA)
		}
	}

	// The "or more" edges. A row's total is A's own binomial, and a column's
	// is B's (on its own, B is just a binomial at rateB), so each edge cell is
	// that total minus the exact cells already in it. Clamped like the top
	// bucket in copyDistribution: summing small floats can overshoot by a hair.
	let exactTotal = 0
	for (let i = 0; i < MAX_COPIES; i++) {
		let rowSum = 0
		let columnSum = 0
		for (let j = 0; j < MAX_COPIES; j++) {
			rowSum += joint[i][j]
			columnSum += joint[j][i]
		}
		exactTotal += rowSum
		joint[i][MAX_COPIES] = Math.max(getExactProbability(n, i, rateA) - rowSum, 0)
		joint[MAX_COPIES][i] = Math.max(getExactProbability(n, i, rateB) - columnSum, 0)
	}
	let edgeTotal = 0
	for (let k = 0; k < MAX_COPIES; k++) {
		edgeTotal += joint[k][MAX_COPIES] + joint[MAX_COPIES][k]
	}
	joint[MAX_COPIES][MAX_COPIES] = Math.max(1 - exactTotal - edgeTotal, 0)

	// Spend the pot, A first up to the target and the rest on B, then keep
	// only the finishes where A got there. A row past the target (i >= target)
	// needs nothing, so its whole pot goes to B.
	const result = new Array<number>(size).fill(0)
	for (let i = 0; i < size; i++) {
		const onA = Math.min(pot, Math.max(target - i, 0))
		if (i + onA < target) continue

		const onB = pot - onA
		for (let j = 0; j < size; j++) {
			result[Math.min(j + onB, MAX_COPIES)] += joint[i][j]
		}
	}

	return result.map((chance) => chance * 100)
}
