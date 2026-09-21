import { PULL_COST_CARATS, DISCOUNTED_PULL_COST_CARATS } from "../constants/gameConstants"
import { PULLS_PER_PITY_COPY } from "./probabilityCalculations"
import {
	STEPS_PER_ROUND,
	cumulativeStepCost,
	stepLabel,
	stepsAffordable,
} from "./stepUpLadder"
import { spendSelectorTickets } from "./selectorTickets"
import type {
	SelectableFeaturedCard,
	SelectorTicketBucket
} from "./selectorTickets"
import type {
	UserPlannedBanner,
	BannerUma,
	BannerSupport,
	BannerStepUp,
	BannerTimeline,
	CalculationConstants,
} from "../types"

/**
 * Inputs to the pull-economics strategy for a single banner. All carat/ticket
 * values are the balances *available before spending on this banner*.
 */
export interface PullStrategyInput {
	/** True for an uma banner (uses uma tickets), false for a support banner. */
	isUmaBanner: boolean
	/** How many pulls the user planned for this banner. */
	plannedPulls: number
	/** Free pulls the banner grants (consumed before any paid resource). */
	freePulls: number
	umaTickets: number
	supportTickets: number
	/** Earned carats — receive nearly all income and are spent at full price. */
	freeCarats: number
	/**
	 * Purchased carats — the only source for discounted pulls. Grows only from
	 * the Daily Carat Pack's repurchase lump; every other income source is free.
	 */
	paidCarats: number
	/**
	 * Length of the banner's window in calendar days (start through end,
	 * inclusive). Caps the discounted-pull count, since the discount is a
	 * once-per-day feature. Deliberately the FULL window length rather than the
	 * days remaining, so the cap can't shrink under a user while the banner is
	 * live — see the derivation in useBannerResources.
	 */
	discountDays: number
	/** Whether the once-per-day 50-paid-carat discounted pull is enabled. */
	discountedPaidPulls: boolean
	/** Whether paid carats may be spent normally (150 per pull). */
	fullPricePaidPulls: boolean
}

/**
 * Decomposition of `maxPossiblePulls` by which resource pays for each pull.
 * Purely for display — the row shows "Free/Tickets/Paid" so a user can see where
 * their pulls come from instead of just how many there are.
 *
 * Normally these four sum exactly to `maxPossiblePulls`. The one exception is a
 * carat DEFICIT (negative `freeCarats`, cascaded from over-planning an earlier
 * banner): each part is clamped at 0 here while the total keeps its own clamp,
 * so the parts can sum HIGHER than the total. That is deliberate — free pulls
 * and tickets really are still available; the deficit is a carat debt, and
 * zeroing the ticket count to make the arithmetic tidy would be a lie.
 */
export interface MaxPullBreakdown {
	/** Free pulls the banner grants. */
	freePulls: number
	/** Matching-type tickets available (uma tickets on uma banners, and vice versa). */
	tickets: number
	/** Pulls funded by PAID carats: discounted (50 each) + the paid share of full-price. */
	paidPulls: number
	/** Pulls funded by FREE carats at full price. */
	freeCaratPulls: number
}

export interface PullStrategyResult {
	/** Balances remaining after actually spending `plannedPulls`. */
	freeCarats: number
	paidCarats: number
	umaTickets: number
	supportTickets: number
	/**
	 * The greatest number of pulls this banner could support if the user threw
	 * *all* available resources at it (ignores `plannedPulls`). Drives the
	 * "Max Pulls" display.
	 */
	maxPossiblePulls: number
	/** Where those max pulls come from. See MaxPullBreakdown. */
	maxPullBreakdown: MaxPullBreakdown
}

/**
 * Applies the pull-payment strategy for one banner. It does two things at once
 * from the same pre-spend state, keeping them consistent:
 *
 *   1. Spends `plannedPulls` and returns the leftover balances to carry to the
 *      next banner.
 *   2. Computes `maxPossiblePulls` — the hypothetical maximum if the user spent
 *      everything on this banner.
 *
 * Spend order (per the product decision): free pulls → matching tickets →
 * discounted paid pulls (50 paid carats each, one per banner day) → free carats
 * at 150 → full-price paid carats at 150. Free carats are spent before paid so
 * that more daily discounts stay available for later banners.
 *
 * Full-price pulls treat free + (enabled) paid carats as one pool of 150-carat
 * pulls, so leftover remainders combine exactly like the game's fungible carats
 * — this is what keeps default (discount-off, full-price-on) projections
 * identical to the old single-pool math. Any pulls that still can't be paid for
 * become a *free-carat* deficit (a negative balance), preserving the existing
 * "insufficient" signalling downstream.
 */
export function applyPullStrategy(input: PullStrategyInput): PullStrategyResult {
	const {
		isUmaBanner,
		plannedPulls,
		freePulls,
		discountDays,
		discountedPaidPulls,
		fullPricePaidPulls,
	} = input

	const matchingTickets = isUmaBanner ? input.umaTickets : input.supportTickets

	// ── maxPossiblePulls (greedy; ignores plannedPulls) ──────────────────────
	// NOTE: `discountDays` is the banner's full window length, so this figure is
	// stable for the life of the banner rather than decaying day by day.
	// Discounted pulls are strictly the cheapest use of paid carats, so use as
	// many as the day cap and paid balance allow, then feed the leftover paid
	// carats into the full-price pool.
	let paidForMax = input.paidCarats
	let discountMaxPulls = 0
	if (discountedPaidPulls) {
		discountMaxPulls = Math.min(
			discountDays,
			Math.floor(paidForMax / DISCOUNTED_PULL_COST_CARATS)
		)
		paidForMax -= discountMaxPulls * DISCOUNTED_PULL_COST_CARATS
	}
	const fullPricePool = input.freeCarats + (fullPricePaidPulls ? paidForMax : 0)
	const fullPriceMaxPulls = Math.floor(fullPricePool / PULL_COST_CARATS)
	// Match the old helper: a large carat deficit can drag the total down, and
	// only the final sum is clamped at 0 (never a negative "Max Pulls").
	const maxPossiblePulls = Math.max(
		0,
		freePulls + matchingTickets + discountMaxPulls + fullPriceMaxPulls
	)

	// ── Attributing full-price pulls to free vs paid carats ──────────────────
	// The full-price pool deliberately merges free and paid carats (see the
	// doc comment above), so "how many of those pulls did paid carats buy?" has
	// no answer until we pick a rule. Use the MARGINAL contribution: how many
	// pulls exist *because* paid carats were added to the pool. That matches the
	// documented spend order — free carats are spent before full-price paid
	// carats — and puts the boundary pull (part free remainder, part paid) in
	// the paid bucket, which is honest: without the paid carats it wouldn't
	// exist at all.
	const freeOnlyPulls = Math.floor(input.freeCarats / PULL_COST_CARATS)
	const maxPullBreakdown: MaxPullBreakdown = {
		freePulls,
		tickets: matchingTickets,
		paidPulls: discountMaxPulls + Math.max(0, fullPriceMaxPulls - freeOnlyPulls),
		// Clamped because a carat deficit makes freeOnlyPulls negative; see the
		// deficit note on MaxPullBreakdown.
		freeCaratPulls: Math.max(0, freeOnlyPulls),
	}

	// ── Actual spend of plannedPulls ─────────────────────────────────────────
	let freeCarats = input.freeCarats
	let paidCarats = input.paidCarats
	let umaTickets = input.umaTickets
	let supportTickets = input.supportTickets
	let remaining = plannedPulls

	// 1. Free pulls.
	remaining = Math.max(0, remaining - freePulls)

	// 2. Matching tickets.
	if (isUmaBanner) {
		const use = Math.min(remaining, umaTickets)
		umaTickets -= use
		remaining -= use
	} else {
		const use = Math.min(remaining, supportTickets)
		supportTickets -= use
		remaining -= use
	}

	// 3. Discounted paid pulls (paid carats only, one per banner-window day).
	if (discountedPaidPulls && remaining > 0) {
		const capacity = Math.min(
			discountDays,
			Math.floor(paidCarats / DISCOUNTED_PULL_COST_CARATS)
		)
		const use = Math.min(remaining, capacity)
		paidCarats -= use * DISCOUNTED_PULL_COST_CARATS
		remaining -= use
	}

	// 4. Full-price pulls: pay from free carats first, then paid (if enabled).
	//    Remainders combine because a 150 pull can be paid from any carats.
	if (remaining > 0) {
		let cost = remaining * PULL_COST_CARATS
		const fromFree = Math.min(freeCarats, cost)
		freeCarats -= fromFree
		cost -= fromFree
		if (fullPricePaidPulls && cost > 0) {
			const fromPaid = Math.min(paidCarats, cost)
			paidCarats -= fromPaid
			cost -= fromPaid
		}
		// Whatever we still couldn't cover becomes a free-carat deficit.
		freeCarats -= cost
	}

	return {
		freeCarats,
		paidCarats,
		umaTickets,
		supportTickets,
		maxPossiblePulls,
		maxPullBreakdown,
	}
}

/** Anything a planner row can point at. */
export type PlannableBanner = BannerUma | BannerSupport | BannerStepUp

/** The three catalogues the calculator holds, as the provider supplies them. */
export interface BannerCatalogue {
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	stepUpBannerData: BannerStepUp[]
}

/**
 * The catalogue a row of this kind may choose from.
 *
 * Both row components (BannerRow and StagedBannerRow) used to do this inline
 * and then re-check the result by shape — `"umas" in banner` — which is the
 * property sniffing plannedBannerTarget exists to replace. The kind already
 * decides the list, so once the list is picked by kind there is nothing left
 * to sniff.
 */
export function bannersForRowType(
	type: BannerRowType,
	catalogue: BannerCatalogue
): PlannableBanner[] {
	if (type === "Uma") return catalogue.umaBannerData
	if (type === "Support") return catalogue.supportBannerData
	return catalogue.stepUpBannerData
}

/**
 * The three target FKs for a row that has just selected `banner`.
 *
 * Setting one target CLEARS the other two. Exactly one may be set — the server
 * enforces it with the `exactly_one_banner_target` check constraint — so
 * writing the new FK without clearing the rest produces a row the PATCH
 * rejects. Returned as a whole object rather than assigned field by field at
 * the call site so a new kind cannot be added without clearing it here too.
 */
export function bannerTargetFields(
	type: BannerRowType,
	banner: PlannableBanner
): Pick<UserPlannedBanner, "banner_uma" | "banner_support" | "banner_step_up"> {
	return {
		banner_uma: type === "Uma" ? (banner as BannerUma) : undefined,
		banner_support: type === "Support" ? (banner as BannerSupport) : undefined,
		banner_step_up: type === "StepUp" ? (banner as BannerStepUp) : undefined,
	}
}

/**
 * Whether a banner is still selectable — its window has not closed yet.
 *
 * All three kinds carry the same `banner_timeline`, so this is one rule rather
 * than one per catalogue.
 */
export function isSelectableBanner(banner: PlannableBanner, now: Date): boolean {
	return new Date(banner.banner_timeline.end_date) > now
}

/**
 * Whether an editor has ticked this banner as Recommended — the gold star in
 * the planner's dropdown.
 *
 * Narrowed on the row's KIND, the same tag bannersForRowType() picks the
 * catalogue by, never on the banner's shape. A step-up has no such flag and is
 * never recommended.
 *
 * `=== true` rather than a truthiness read: during a deploy the frontend can
 * briefly run against an API that doesn't send the field yet, and a banner
 * missing it has to read as "not recommended".
 */
export function isRecommendedBanner(banner: PlannableBanner, type: BannerRowType): boolean {
	if (type === "StepUp") return false
	return (banner as BannerUma | BannerSupport).is_recommended === true
}

export interface StepUpStrategyInput {
	/** Steps the user planned. Not clamped by the caller — see below. */
	plannedSteps: number
	/** How many step-up banners the campaign actually runs. Each is 5 steps. */
	bannerCount: number
	/** Purchased carats available before this banner. Step-ups take NOTHING else. */
	paidCarats: number
	constants: CalculationConstants
}

export interface StepUpStrategyResult {
	/**
	 * Paid carats left after climbing. MAY GO NEGATIVE when the plan outruns the
	 * balance; the caller floors it at 0 for display, matching the sheet's
	 * MAX(0, ...) on N43, while the debt still carries through spend attribution.
	 */
	paidCarats: number
	/** What the climb cost. */
	caratsSpent: number
	/** The most steps this banner could support if all paid carats went to it. */
	maxPossibleSteps: number
	/** Steps actually charged for — planned, clamped to what exists. */
	chargeableSteps: number
	/** `chargeableSteps` in the sheet's spelling: "3", "5x1-2", "5x2". */
	stepLabel: string
}

/**
 * Applies the payment strategy for one step-up banner.
 *
 * Deliberately a SIBLING of applyPullStrategy rather than a branch inside it.
 * The two share no inputs beyond paid carats and no outputs at all: a step-up
 * has no free pulls, no tickets, no daily discount cap and no free carats —
 * it is paid-only, which is the whole constraint the feature exists to model.
 * Threading a mode flag through the app's most-tested function would buy a
 * shared name and nothing else.
 *
 * The two clamps are asymmetric on purpose (see the plan's over-plan clamp):
 *
 *   maxPossibleSteps — min(what exists, what you can afford)
 *   chargeableSteps  — min(what you planned, what EXISTS). Not affordability.
 *
 * Over-planning past your budget still charges (and still shows the optimistic
 * odds) because the resulting deficit is the message, exactly as an
 * over-planned pull count already behaves. Over-planning past what exists is
 * simply impossible — there is no sixth banner to buy — so it is clamped away
 * rather than reported.
 */
export function applyStepUpStrategy(
	input: StepUpStrategyInput
): StepUpStrategyResult {
	const { plannedSteps, bannerCount, paidCarats, constants } = input

	// The hard ceiling: five steps per banner the campaign actually runs. This
	// replaces the sheet's MIN(35, ...), whose 35 was the extent of its lookup
	// table rather than a game rule — banner_count is at most 3, so 35 could
	// never bind anyway.
	const stepsInExistence = Math.max(0, Math.floor(bannerCount)) * STEPS_PER_ROUND

	const maxPossibleSteps = Math.min(
		stepsInExistence,
		stepsAffordable(paidCarats, constants)
	)
	const chargeableSteps = Math.min(
		Math.max(0, Math.floor(plannedSteps)),
		stepsInExistence
	)
	const caratsSpent = cumulativeStepCost(chargeableSteps, constants)

	return {
		paidCarats: paidCarats - caratsSpent,
		caratsSpent,
		maxPossibleSteps,
		chargeableSteps,
		// Labels what was CHARGED, not what was planned, so the label can never
		// name a step that does not exist.
		stepLabel: stepLabel(chargeableSteps),
	}
}

/**
 * How a planned pull count should be presented to the user.
 *
 *   "over"    — more pulls than the banner's resources can pay for.
 *   "ok"      — lands exactly on a pity threshold (every carat buys a full
 *               guaranteed copy; nothing is stranded in a partial counter).
 *   "neutral" — affordable, but stops part-way through a pity counter.
 */
export type PullCountStatus = "ok" | "neutral" | "over"

/**
 * Classifies a planned pull count for display.
 *
 * The input is deliberately NOT clamped to `maxPulls` anywhere — a user is
 * allowed to plan beyond their means and see the shortfall (the deficit carries
 * forward as a negative carat balance via applyPullStrategy). This function is
 * what turns that into a visible signal instead of a silent one.
 *
 * "over" is checked FIRST because the two states can co-occur: 400 pulls when
 * only 300 are affordable is both on a pity threshold and unaffordable, and
 * "you can't pay for this" is the more actionable of the two.
 *
 * @param maxPulls Upper bound of affordable pulls. Pass `Infinity` where no
 *   bound is known (e.g. a staged banner, which has no projection yet) to opt
 *   out of the "over" state entirely.
 */
export function getPullCountStatus(
	pulls: number,
	maxPulls: number
): PullCountStatus {
	if (pulls > maxPulls) return "over"
	// 0 is a multiple of the pity threshold, but an untouched row is not a
	// planning achievement — greening every empty row would drain the signal.
	if (pulls > 0 && pulls % PULLS_PER_PITY_COPY === 0) return "ok"
	return "neutral"
}

/**
 * How a planned STEP count should be presented — the step-up mirror of
 * `getPullCountStatus`, sharing its vocabulary so a user reading a mixed table
 * learns one colour scheme rather than two.
 *
 * The green signal means the same thing in both places (no carats stranded in a
 * partial counter) but fires on a different number, because a step-up's unit of
 * completion is a five-step round rather than a 200-pull pity counter. Green
 * here is a FINISHED banner: every carat bought a full ladder, guarantee
 * included, with nothing left half-climbed.
 *
 * "over" is checked first for the same reason it is there — being both past
 * your budget and on a round boundary is possible, and the budget is the more
 * actionable half.
 *
 * @param maxSteps Upper bound of affordable steps. Pass `Infinity` where no
 *   bound is known, to opt out of the "over" state entirely.
 */
export function getStepCountStatus(
	steps: number,
	maxSteps: number
): PullCountStatus {
	if (steps > maxSteps) return "over"
	// Same carve-out as the pull version: 0 is a multiple of the round length,
	// but an untouched row has achieved nothing worth colouring.
	if (steps > 0 && steps % STEPS_PER_ROUND === 0) return "ok"
	return "neutral"
}

/**
 * How the copies reserved on a banner were paid for.
 *
 * `unfunded` is what the user asked for and could not cover. It is reported, not
 * clamped — the same choice the pull-count input makes, so an over-ambitious
 * plan stays visible instead of silently shrinking.
 */
export interface ReservedFunding {
	selectors: number
	crystals: number
	unfunded: number
}

export interface ReservedCopiesInput {
	/** Copies the user wants outside of pulling. */
	reservedCopies: number
	isUmaBanner: boolean
	/**
	 * JP release date of the OLDEST featured card on this banner — i.e. the
	 * easiest one for a selector to reach.
	 *
	 * A selector needs to clear only ONE card here, not all of them: the ticket
	 * takes a single card and the user picks which. Gating on the newest instead
	 * meant a lone recent unit poisoned the whole banner — an 11-uma banner with
	 * 8 cards inside the cutoff still read as unfundable because of the 9th.
	 *
	 * Cards with no known release date are excluded upstream rather than treated
	 * as old, so they can neither qualify a banner nor block one. All-unknown
	 * yields null, which selectors refuse under a real cutoff.
	 */
	oldestFeaturedJpDate: string | null
	/**
	 * True when this banner features cards and EVERY one of them is barred from
	 * selectors outright (time-limited, or not ★3).
	 *
	 * A separate signal because `oldestFeaturedJpDate` cannot carry it: an
	 * UNRESTRICTED (null-cutoff) ticket short-circuits `isCardEligible` before
	 * it ever looks at the date, so a null date still funds. Null there means
	 * "no dated card", which an unrestricted ticket is right to ignore — this
	 * means "no card a selector could take at all", which it must not.
	 *
	 * An EMPTY featured list is not barred. That is a data gap (banners exist
	 * with no cards linked yet), and the rule for unknowns everywhere else here
	 * is that they neither qualify a banner nor block one.
	 */
	selectorsBarred: boolean
	/**
	 * The banner's featured cards a selector could take, already filtered by
	 * `isCardSelectable`. A PICKED ticket (a purchased selector, tied to the card
	 * chosen on the Selectors page) pays here only if its card is in this list;
	 * an unpicked one ignores it and reads `oldestFeaturedJpDate` as before.
	 * Optional so an empty list is the default: no cards, no pick can match.
	 */
	selectableFeatured?: SelectableFeaturedCard[]
	umaSelectorTickets: SelectorTicketBucket[]
	supportSelectorTickets: SelectorTicketBucket[]
	/** SSR crystals available. Support banners only — there is no uma crystal. */
	ssrCrystals: number
}

export interface ReservedCopiesResult {
	funding: ReservedFunding
	umaSelectorTickets: SelectorTicketBucket[]
	supportSelectorTickets: SelectorTicketBucket[]
	ssrCrystals: number
}

/**
 * Decide which resources pay for a banner's reserved copies, and spend them.
 *
 * Selectors go FIRST, then crystals. Selectors are the constrained resource —
 * they are cutoff-gated and can only ever take older cards — while an SSR
 * crystal takes anything. Spending the constrained one while it happens to
 * qualify preserves the flexible one for a banner where nothing else works.
 * Within selectors the weakest qualifying ticket goes first, for the same reason
 * one level down (see utils/selectorTickets).
 *
 * On an UMA banner only selectors apply: crystals are a support-card currency
 * and this data model has no ★3 equivalent.
 *
 * Pure and total — never throws, never returns negatives. The caller owns what
 * an unfunded remainder means for display.
 */
export function allocateReservedCopies(
	input: ReservedCopiesInput
): ReservedCopiesResult {
	const wanted = Math.max(0, Math.floor(input.reservedCopies))
	const result: ReservedCopiesResult = {
		funding: { selectors: 0, crystals: 0, unfunded: 0 },
		umaSelectorTickets: input.umaSelectorTickets,
		supportSelectorTickets: input.supportSelectorTickets,
		ssrCrystals: input.ssrCrystals,
	}
	if (wanted === 0) return result

	const pool = input.isUmaBanner
		? input.umaSelectorTickets
		: input.supportSelectorTickets
	// Nothing on this banner is takeable, so no ticket qualifies — not even an
	// unrestricted one, which would otherwise skip the date check entirely.
	// Crystals below are unaffected: they take anything, and the intrinsic gate
	// is uma-side only.
	const { buckets, spent } = input.selectorsBarred
		? { buckets: pool, spent: 0 }
		: spendSelectorTickets(
				pool,
				wanted,
				input.oldestFeaturedJpDate,
				input.selectableFeatured ?? []
		  )
	result.funding.selectors = spent
	if (input.isUmaBanner) {
		result.umaSelectorTickets = buckets
	} else {
		result.supportSelectorTickets = buckets
	}

	let remaining = wanted - spent
	if (remaining > 0 && !input.isUmaBanner) {
		const fromCrystals = Math.min(remaining, Math.max(0, input.ssrCrystals))
		result.funding.crystals = fromCrystals
		result.ssrCrystals = input.ssrCrystals - fromCrystals
		remaining -= fromCrystals
	}

	result.funding.unfunded = remaining
	return result
}

/**
 * Classifies a reserved-copy count for display, mirroring getPullCountStatus.
 * "over" whenever any part of the request can't be paid for.
 */
export function getReservedStatus(funding: ReservedFunding): PullCountStatus {
	if (funding.unfunded > 0) return "over"
	if (funding.selectors + funding.crystals > 0) return "ok"
	return "neutral"
}

/**
 * The three kinds of row the planner has. "Banner type" has always meant this
 * axis (uma vs support); Step Up is a third VALUE on it, not a new axis.
 *
 * Not to be confused with `BannerTimeline.banner_category` (standard /
 * race-prep / revival / rerun), which is a genuinely different axis.
 */
export type BannerRowType = "Uma" | "Support" | "StepUp"

/**
 * A planned row's resolved target: which banner it points at, and that banner's
 * timeline, as ONE tagged value.
 *
 * TYPESCRIPT CONCEPT: Discriminated Unions, again
 *
 * The row carries three optional FKs of which at most one is ever set. Reading
 * that shape directly means every call site re-implements the same precedence
 * check, and every one of them has to be updated when a fourth kind appears —
 * which is exactly the bug this replaces:
 *
 *     const bannerType = b.banner_support ? "Support" : (initialBannerType ?? "Uma")
 *
 * A row with no FK at all read as "Uma" by luck there. Narrowing on `.type`
 * makes that unrepresentable: "Empty" is its own case and the compiler forces
 * you to handle it. Same tag-not-shape discipline as isRaceEvent /
 * isBannerTimeline in types/calculator.
 *
 * `timeline` is non-null on every non-Empty case because all three banner kinds
 * carry the same `banner_timeline` FK — the property the whole income engine
 * rests on.
 */
export type PlannedBannerTarget =
	| { type: "Uma"; banner: BannerUma; timeline: BannerTimeline }
	| { type: "Support"; banner: BannerSupport; timeline: BannerTimeline }
	| { type: "StepUp"; banner: BannerStepUp; timeline: BannerTimeline }
	| { type: "Empty"; banner: null; timeline: null }

/** Fields the target helpers read. Accepting this rather than a whole
 *  UserPlannedBanner lets staged rows and test fixtures pass too. */
type BannerTargetFields = Pick<
	UserPlannedBanner,
	"banner_uma" | "banner_support" | "banner_step_up"
>

/**
 * THE one place the three FKs are inspected. Everything else narrows on `.type`.
 */
export function plannedBannerTarget(
	plannedBanner: BannerTargetFields
): PlannedBannerTarget {
	if (plannedBanner.banner_uma) {
		return {
			type: "Uma",
			banner: plannedBanner.banner_uma,
			timeline: plannedBanner.banner_uma.banner_timeline,
		}
	}
	if (plannedBanner.banner_support) {
		return {
			type: "Support",
			banner: plannedBanner.banner_support,
			timeline: plannedBanner.banner_support.banner_timeline,
		}
	}
	if (plannedBanner.banner_step_up) {
		return {
			type: "StepUp",
			banner: plannedBanner.banner_step_up,
			timeline: plannedBanner.banner_step_up.banner_timeline,
		}
	}
	return { type: "Empty", banner: null, timeline: null }
}

/**
 * The row's timeline, or null when no banner is selected.
 *
 * All three banner kinds point at the same BannerTimeline shape, which is what
 * lets every date, ordering and income path treat them identically. Income is a
 * pure function of a banner's end date, so this is the only thing the income
 * half of the engine needs to know about a row.
 */
export function plannedBannerTimeline(
	plannedBanner: BannerTargetFields
): BannerTimeline | null {
	return plannedBannerTarget(plannedBanner).timeline
}

/**
 * Where a row sits among rows sharing its start date.
 *
 * The planner is sorted by start date, but a campaign routinely opens several
 * banners on the same instant, and a bare date sort leaves those tied rows in
 * whatever order they happened to arrive in — which differs between "just added
 * it" (append-then-sort) and "just reloaded" (database order). This rank is the
 * second sort key that makes the tie deterministic, in the order the sheet
 * reads best:
 *
 *   Uma -> Support -> Step-Up Uma -> Step-Up Support
 *
 * Note the step-up split: the two step-up ranks are NOT the row type, which is
 * a single "StepUp". They come off `BannerStepUp.card_type`, the model's own
 * one-row-per-card-type field — a campaign sells a star-3 ladder and an SSR
 * ladder as separate banners, and grouping each next to its ordinary
 * counterpart is the point of the ordering.
 *
 * An Empty row (no banner selected yet) ranks last. It has no start date
 * either, so it already sorts to the bottom; this only decides its order
 * against other undated rows.
 *
 * MUST stay in step with `_planned_banner_kind_rank` in
 * `backend/calculatorapi/views/calculator.py`. The server sorts the plan once
 * on load and the client re-sorts on every edit, so the two orderings are
 * visible to the same user minutes apart — if they disagree, rows appear to
 * shuffle themselves on refresh.
 */
export function plannedBannerOrderRank(
	plannedBanner: BannerTargetFields
): number {
	const target = plannedBannerTarget(plannedBanner)
	switch (target.type) {
		case "Uma":
			return 0
		case "Support":
			return 1
		case "StepUp":
			return target.banner.card_type === "uma" ? 2 : 3
		default:
			return 4
	}
}

/**
 * THE comparator for the calculator sheet's row order: start date ascending,
 * ties broken by `plannedBannerOrderRank`.
 *
 * Rows with no resolvable timeline sort last rather than throwing — a row can
 * legitimately exist before it has picked a banner.
 *
 * Both planner sort sites go through this so that adding a banner and selecting
 * one into an existing row cannot drift apart. `useBannerResources` does not
 * call it: its walk breaks ties on the row's original index, so it inherits
 * whatever order the sheet is already in, which is what keeps spend attribution
 * matching what the user sees.
 */
export function comparePlannedBanners(
	a: BannerTargetFields,
	b: BannerTargetFields
): number {
	const startTime = (banner: BannerTargetFields): number => {
		const start = plannedBannerTimeline(banner)?.start_date
		return start ? new Date(start).getTime() : Infinity
	}
	const byStart = startTime(a) - startTime(b)
	// Infinity - Infinity is NaN, which would corrupt the sort. Two undated rows
	// are tied, so fall through to the rank rather than returning the NaN.
	if (byStart !== 0 && !Number.isNaN(byStart)) return byStart
	return plannedBannerOrderRank(a) - plannedBannerOrderRank(b)
}

/**
 * What kind of row this is, whether or not it has picked a banner yet.
 *
 * Distinct from `plannedBannerTarget`: a staged row that hasn't chosen a banner
 * is "Empty" as a target but is still definitely (say) a Support row — that is
 * what decides which select it offers and which badge it wears.
 *
 * Precedence is FK first, then the staged row's declared type. The final
 * fallback is unreachable by construction (a row either came from the server
 * with an FK, or was staged by handleAddBanner which always sets
 * initialBannerType) and exists only to keep the return total; it is NOT the
 * old `?? "Uma"` guess, which sat on the FK check itself and so applied to real
 * rows.
 */
export function plannedBannerRowType(
	plannedBanner: BannerTargetFields & Pick<UserPlannedBanner, "initialBannerType">
): BannerRowType {
	const target = plannedBannerTarget(plannedBanner)
	if (target.type !== "Empty") return target.type
	return plannedBanner.initialBannerType ?? "Uma"
}

/**
 * The planned count, read as the unit the row actually measures.
 *
 * `number_of_pulls` is deliberately overloaded: on a step-up row it carries
 * STEPS, mirroring the source sheet's own overload of the same column. One
 * column, no migration, and no second field sitting null on almost every row —
 * but only safe as long as nothing reads the raw property and assumes pulls.
 * These two accessors are that guarantee.
 *
 * Each returns 0 for the wrong kind of row, so a mixed-up call site produces a
 * visibly empty number rather than a plausible wrong one.
 */
export function plannedPulls(
	plannedBanner: BannerTargetFields & Pick<UserPlannedBanner, "number_of_pulls">
): number {
	return plannedBannerTarget(plannedBanner).type === "StepUp"
		? 0
		: plannedBanner.number_of_pulls
}

export function plannedSteps(
	plannedBanner: BannerTargetFields & Pick<UserPlannedBanner, "number_of_pulls">
): number {
	return plannedBannerTarget(plannedBanner).type === "StepUp"
		? plannedBanner.number_of_pulls
		: 0
}

/**
 * Returns the free pull count for a planned banner, or empty string if no banner is set.
 *
 * TYPESCRIPT CONCEPT: Union Return Types
 *
 * This function returns `number | string` because it serves double duty:
 * a numeric value for calculations AND a display value ("" for empty state).
 * In a larger codebase, you might separate these concerns — one function
 * for the numeric value (returning number | null) and the component handles
 * the display formatting. But for a simple helper like this, the union is fine.
 */
export function getFreePulls(
	plannedBanner: UserPlannedBanner
): number | string {
	const target = plannedBannerTarget(plannedBanner)
	switch (target.type) {
		case "Uma":
		case "Support":
			return target.banner.free_pulls
		// A step-up grants none: every one of its pulls is bought with paid
		// carats up the cost ladder, so 0 is the real answer, not "unknown".
		case "StepUp":
			return 0
		case "Empty":
			return ""
	}
}

/**
 * Identity key for a planned banner.
 *
 * BannerUma and BannerSupport are SEPARATE Django tables with independent
 * autoincrement primary keys, so a bare `id` is ambiguous across the two —
 * uma #1 and support #1 are unrelated banners. Worse, the seed data was
 * populated in lockstep, so matching ids very often point at the same
 * BannerTimeline and therefore the same dates. Comparing planned banners by
 * bare id made "add the uma banner" wrongly mark the same-date support banner
 * as already planned, and vice versa.
 *
 * Every identity comparison must therefore carry the banner's type alongside
 * its id, which is what this key encodes.
 *
 * TYPESCRIPT CONCEPT: Template Literal Types
 *
 * Typing this as `` `uma:${number}` | `support:${number}` `` rather than plain
 * `string` is deliberate: it makes passing a bare id where a key is expected a
 * compile error, which is precisely the mistake this helper exists to prevent.
 */
export type BannerKey =
	| `uma:${number}`
	| `support:${number}`
	| `stepup:${number}`

const KEY_PREFIX: Record<BannerRowType, string> = {
	Uma: "uma",
	Support: "support",
	StepUp: "stepup",
}

export function bannerKey(type: BannerRowType, id: number): BannerKey {
	return `${KEY_PREFIX[type]}:${id}` as BannerKey
}

/**
 * Key for a planned/staged row, or null when the row has no banner selected
 * yet. Callers comparing two rows must treat null as "never equal" — two blank
 * rows are not duplicates of each other.
 */
export function plannedBannerKey(
	plannedBanner: BannerTargetFields
): BannerKey | null {
	const target = plannedBannerTarget(plannedBanner)
	return target.type === "Empty" ? null : bannerKey(target.type, target.banner.id)
}

/**
 * The next free `tempId` across every row the user holds — staged rows and
 * sheet rows alike, since a staged row keeps its id when it moves to the sheet.
 * Saved rows are counted by their server `id` for the same reason.
 *
 * Call this from *inside* a `setStagedBanners` updater, passing that updater's
 * own `prev` list. Computing it from a render-scoped copy of the list can hand
 * two rows the same id if two adds land before a re-render, and every staged
 * handler — update, confirm, discard — selects its row by `tempId`, so a
 * collision would silently edit or delete two rows at once.
 */
export function nextTempId(...bannerLists: UserPlannedBanner[][]): number {
	let highest = 0
	for (const list of bannerLists) {
		for (const banner of list) {
			highest = Math.max(highest, banner.tempId ?? banner.id ?? 0)
		}
	}
	return highest + 1
}
