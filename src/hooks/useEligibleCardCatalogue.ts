import { useMemo } from "react"
import { isCardEligible, isCardSelectable } from "../utils/selectorTickets"
import type { BannerUma, BannerSupport, Uma, SupportCard } from "../types"

/** One selectable card, flattened out of the banner catalogues. */
export interface EligibleCard {
	/** The card's own id — `Uma.id` or `SupportCard.id` depending on `pool`. */
	value: number
	label: string
	image: string
	/** First JP banner date — the ordering key, and what eligibility is judged on. */
	firstJpDate: string | null
}

/** Which catalogue to draw from. Mirrors `BannerStepUp.card_type`. */
export type CardPool = "uma" | "support"

export interface EligibleCardCatalogueInput {
	pool: CardPool
	/** Cards released on JP after this are excluded. `null` = unrestricted. */
	jpCutoffDate: string | null
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
}

/**
 * A spreadsheet's "(All)" row is a non-gacha catch-all, not a banner the
 * calculator presents to users. It carries card links purely for source-data
 * bookkeeping, so those links must not make their cards selectable.
 *
 * Exported for the tests — this rule is invisible from outside and is exactly
 * the kind of thing a rewrite drops on the floor.
 */
export function isGachaBanner(name: string): boolean {
	return !/^\(all\)(?:\s+\d+)?$/i.test(name.trim())
}

/**
 * The catalogue of cards a selector ticket or a step-up may pick from: every
 * card on a real gacha banner, deduplicated, filtered to a JP cutoff AND to the
 * intrinsic gate (time-limited / non-★3 umas are never selectable), newest
 * release first.
 *
 * WHY THIS IS A HOOK AND NOT INLINE
 * ---------------------------------
 * It was inline in SelectorTargetPicker until the step-up selection picker
 * needed the same list. Two consumers of a rule set this fiddly — the "(All)"
 * exclusion, the inclusive cutoff, the null-date handling, the two-key sort —
 * is exactly the shape this repo has twice paid to un-duplicate
 * (`BannerTypeBadge`, and the two row components' banner selects).
 *
 * ORDERING
 * --------
 * Newest JP release first: the cutoff already caps the top of the list, so the
 * cards nearest it are the ones a user is choosing between. Dates are ISO
 * strings, so a plain string compare is chronological; sliced to the day
 * because the release date carries a time of day the ordering should ignore.
 * Name breaks ties, which is the common case — a banner releases several cards
 * on the same date.
 *
 * Cards with an unknown release date sort last. They only reach this list at
 * all under an unrestricted (null) cutoff, since `isCardEligible` refuses them
 * under a real one.
 */
export function useEligibleCardCatalogue({
	pool,
	jpCutoffDate,
	umaBannerData,
	supportBannerData,
}: EligibleCardCatalogueInput): EligibleCard[] {
	return useMemo(
		() => buildEligibleCardCatalogue({ pool, jpCutoffDate, umaBannerData, supportBannerData }),
		[pool, jpCutoffDate, umaBannerData, supportBannerData]
	)
}

/**
 * The hook's body, callable outside React.
 *
 * Split out so the rules above can be tested directly rather than through a
 * rendered component — the logic has no React in it, and the hook is only the
 * memo wrapper.
 */
export function buildEligibleCardCatalogue({
	pool,
	jpCutoffDate,
	umaBannerData,
	supportBannerData,
}: EligibleCardCatalogueInput): EligibleCard[] {
	const seen = new Map<number, Omit<EligibleCard, "value">>()

	const addEligibleCards = (cards: (Uma | SupportCard)[]): void => {
		for (const card of cards) {
			if (seen.has(card.id)) continue
			// BOTH gates. The intrinsic one first because it is unconditional —
			// a time-limited or non-★3 uma is off the list even when the cutoff
			// is null and every date qualifies.
			if (!isCardSelectable(card)) continue
			if (!isCardEligible(card.first_jp_date, jpCutoffDate)) continue
			seen.set(card.id, {
				label: card.name,
				image: card.image,
				firstJpDate: card.first_jp_date,
			})
		}
	}

	if (pool === "uma") {
		for (const banner of umaBannerData) {
			if (!isGachaBanner(banner.banner_timeline.name)) continue
			addEligibleCards(banner.umas)
		}
	} else {
		for (const banner of supportBannerData) {
			if (!isGachaBanner(banner.banner_timeline.name)) continue
			addEligibleCards(banner.support_cards)
		}
	}

	return [...seen.entries()]
		.map(([value, card]) => ({ value, ...card }))
		.sort((a, b) => {
			const aDate = a.firstJpDate?.slice(0, 10) ?? ""
			const bDate = b.firstJpDate?.slice(0, 10) ?? ""
			if (aDate !== bDate) return bDate.localeCompare(aDate)
			return a.label.localeCompare(b.label)
		})
}
