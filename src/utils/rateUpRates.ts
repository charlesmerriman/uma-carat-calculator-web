import type { CalculationConstants } from "../types/constants"
import { allRateUps, type PlannedBannerTarget } from "./bannerHelpers"

/**
 * Per-pull chance of each rate-up card on an ordinary uma or support banner.
 *
 * Not a flat 0.75%. The global client's own gacha table shows one rule behind
 * every ordinary banner: each card gets its rarity's usual rate-up chance,
 * unless more cards share the rate-up than that rarity's pool allows, in which
 * case the pool is split evenly between them:
 *
 *     rate = min(rate_up_rate_N, rate_up_pool_N / rate-up cards of rarity N)
 *
 *     1 SSR, or 2 SSRs          -> 0.75% each   (2 x 0.75% fits inside 3%)
 *     20 SSRs (launch banner)   -> 0.15% each   (3% / 20)
 *     a ★3 and a ★2 on one banner -> 0.75% and 2.25%, each against its own pool
 *
 * Two editor-set inputs bend it. A select banner ("10 Select 2") lists every
 * card the player COULD pick, but only the picks are rate-ups, so the pool is
 * split by `rate_up_picks` rather than the list. And a card whose rate breaks
 * the rule outright carries a `rate_overrides` entry, which wins.
 *
 * The numbers come from the API (`calculation_constants`) and are passed in,
 * like every other constant. Step-ups do not come through here: their odds are
 * stepUpLadder.ts.
 */

/** The targets this rule applies to: an ordinary uma or support banner. */
export type RateUpTarget = Extract<PlannedBannerTarget, { type: "Uma" | "Support" }>

/** One featured card, with what the odds need to know about it. */
export interface RateUpCard {
	id: number
	name: string
	image: string
	/** 3 = ★3/SSR, 2 = ★2/SR, 1 = ★1/R. A missing rarity has already become 3. */
	rarity: number
	/** Per-pull chance as a DECIMAL (0.0075, not 0.75). */
	rate: number
}

/**
 * The rate-up rate and pool for a rarity on a banner of `kind`. Anything
 * outside 1..3 is treated as ★3/SSR, the same default a missing rarity gets.
 *
 * SR and R SUPPORT cards read their own pair: the game rates them differently
 * from ★2 and ★1 umas (an R card 3.75%, a ★1 uma 10%), so one set of numbers
 * can't serve both. SSRs share one pair whatever the banner.
 */
function rarityRule(
	rarity: number,
	kind: RateUpTarget["type"],
	constants: CalculationConstants
): { rate: number; pool: number } {
	const support = kind === "Support"
	switch (rarity) {
		case 1:
			return support
				? { rate: constants.support_rate_up_rate_1, pool: constants.support_rate_up_pool_1 }
				: { rate: constants.rate_up_rate_1, pool: constants.rate_up_pool_1 }
		case 2:
			return support
				? { rate: constants.support_rate_up_rate_2, pool: constants.support_rate_up_pool_2 }
				: { rate: constants.rate_up_rate_2, pool: constants.rate_up_pool_2 }
		default:
			return { rate: constants.rate_up_rate_3, pool: constants.rate_up_pool_3 }
	}
}

/**
 * Every rate-up card on the banner, with its rate, in the banner's order: a
 * support banner's SSRs, then its SRs and Rs (`allRateUps`).
 */
export function rateUpCards(
	target: RateUpTarget,
	constants: CalculationConstants
): RateUpCard[] {
	const cards =
		target.type === "Uma" ? target.banner.umas : allRateUps(target.banner)
	const overrides = target.banner.rate_overrides ?? {}
	const picks = target.banner.rate_up_picks ?? null

	// Null and undefined both mean "not imported yet", which reads as ★3/SSR.
	const withRarity = cards.map((card) => ({ card, rarity: card.rarity ?? 3 }))

	// How many rate-ups share each rarity's pool. A select banner's picks
	// replace the count: ten listed, two chosen, two sharing.
	const sharing = new Map<number, number>()
	for (const { rarity } of withRarity) {
		sharing.set(rarity, (sharing.get(rarity) ?? 0) + 1)
	}

	return withRarity.map(({ card, rarity }) => {
		const { rate, pool } = rarityRule(rarity, target.type, constants)
		// A select banner's picks are SSRs, so they split the SSR pool only;
		// its SRs and Rs share theirs by count like anywhere else.
		const shares = (rarity === 3 ? picks : null) ?? sharing.get(rarity) ?? 1

		return {
			id: card.id,
			name: card.name,
			image: card.image,
			rarity,
			// `shares` of 0 would divide to Infinity, and min() then falls back
			// to the plain rate, which is the sensible reading of a stray 0.
			rate: overrides[card.id] ?? Math.min(rate, pool / shares),
		}
	})
}

/**
 * The card a row's odds are about when the player hasn't said: the first card
 * of the banner's highest rarity. On the usual one- or two-SSR banner every
 * card has the same rate, so which one wins changes nothing; on a ★3 + ★2
 * banner it makes sure the strip shows the ★3, which is what players pull for.
 *
 * Null for a banner with no featured cards yet (an editor's half-made row).
 */
export function primaryRateUpCard(
	target: RateUpTarget,
	constants: CalculationConstants
): RateUpCard | null {
	let best: RateUpCard | null = null
	for (const card of rateUpCards(target, constants)) {
		if (!best || card.rarity > best.rarity) best = card
	}
	return best
}

/**
 * The per-pull rate a row's odds should use. Falls back to the ★3/SSR rate for
 * a banner with no featured cards, which is what every row used before rates
 * were per card.
 */
export function rowRateUpRate(
	target: RateUpTarget,
	constants: CalculationConstants
): number {
	return primaryRateUpCard(target, constants)?.rate ?? constants.rate_up_rate_3
}

/** The two cards a row's odds are about. See `oddsCards`. */
export interface OddsCards {
	/** Every featured card, for the pickers. */
	cards: RateUpCard[]
	/** The card the strip is about. Null only on a banner with no cards. */
	primary: RateUpCard | null
	/** The second card for two-card odds, or null when they are off. */
	second: RateUpCard | null
}

/**
 * Resolves a row's saved card choices against the banner's featured cards.
 *
 * Forgiving on purpose: an id the banner does not (or no longer) feature is
 * ignored rather than trusted, because the server stores the ids without
 * checking them (an editor removing a card must not break a plan). So a stale
 * primary falls back to the default card, and a second card that is missing,
 * or the same card as the primary, switches two-card odds off.
 */
export function oddsCards(
	target: RateUpTarget,
	row: { primary_card?: number | null; second_card?: number | null },
	constants: CalculationConstants
): OddsCards {
	const cards = rateUpCards(target, constants)
	const primary =
		cards.find((card) => card.id === row.primary_card) ??
		primaryRateUpCard(target, constants)
	const second =
		row.second_card == null || primary === null
			? null
			: cards.find((card) => card.id === row.second_card && card.id !== primary.id) ??
				null

	return { cards, primary, second }
}
