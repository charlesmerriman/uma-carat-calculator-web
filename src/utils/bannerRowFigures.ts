import { startOfDay } from "date-fns"
import type { UserPlannedBanner } from "../types"
import type { BannerResources } from "../hooks/bannerResources"
import {
	getFreePulls,
	getPullCountStatus,
	getReservedStatus,
	getStepCountStatus,
	plannedBannerTimeline,
} from "./bannerHelpers"
import { pullsAlreadyMade } from "./rowOptions"
import type { PullCountStatus, ReservedFunding } from "./bannerHelpers"

/** One box of a row's derived-stats strip. */
export interface BannerRowStat {
	label: string
	value: string
	title: string
	valueClass?: string
}

/**
 * What a planner row SHOWS, worked out from its resources.
 *
 * Lifted out of BannerRow so the share picture (PlanPicture) reads the
 * same function: a picture of a plan that showed one number while the sheet
 * showed another would be worse than no picture. Pure; `now` is passed in.
 *
 * The pull economics themselves are useBannerResources' (applyPullStrategy).
 * This only applies what the row adds on top: the "Passed" gate for a banner
 * that has ended, the carat estimates floored to tens, and the four stat boxes.
 */
export interface BannerRowFigures {
	/** Ended before the start of today (local midnight, the projection's anchor). */
	bannerHasEnded: boolean
	maxPossiblePulls: number | "Passed"
	maxPossibleSteps: number | "Passed"
	/** The pull and step ceilings as numbers: 0 for a banner that has ended. */
	pullUpperBound: number
	stepUpperBound: number
	displayFreeCarats: number
	displayPaidCarats: number
	ticketPulls: number
	paidPulls: number
	freePulls: number
	/** Copies actually paid for; a passed banner funds nothing. */
	reservedFunding: ReservedFunding
	fundedReservedCopies: number
	reservedStatus: PullCountStatus
	/** Pulls already made on this banner (a row option); always 0 on a step-up. */
	alreadyMade: number
	/** The pulls (or steps) field's colour: ok, neutral or over. */
	countStatus: PullCountStatus
	/** The derived-stats strip, in order. Both of BannerRow's layouts render it. */
	stats: BannerRowStat[]
}

export function bannerRowFigures(
	plannedBanner: UserPlannedBanner,
	resources: BannerResources,
	isStepUp: boolean,
	now: Date
): BannerRowFigures {
	// A banner ending *today* is still active, so it shows an estimate.
	const endDate = plannedBannerTimeline(plannedBanner)?.end_date
	const bannerHasEnded =
		!!endDate && new Date(endDate).getTime() < startOfDay(now).getTime()

	const maxPossiblePulls: number | "Passed" = bannerHasEnded ? "Passed" : resources.maxPossiblePulls
	// A step-up row's engine fields are optional (absent on every other kind),
	// so the fallback is 0 rather than a non-null assertion.
	const maxPossibleSteps: number | "Passed" = bannerHasEnded ? "Passed" : resources.maxPossibleSteps ?? 0
	const pullUpperBound = typeof maxPossiblePulls === "number" ? maxPossiblePulls : 0
	const stepUpperBound = typeof maxPossibleSteps === "number" ? maxPossibleSteps : 0

	// Round a *displayed* carat estimate DOWN to the nearest ten. Flooring rather
	// than rounding to nearest avoids overstating: rounding 145 up to 150 would
	// imply a pull is affordable while "Max Pulls" (which floors 145/150 to 0)
	// says it isn't. Presentation only: the raw balances still drive the maths.
	// A passed banner shows 0: its resources were spent or expired.
	const toDisplayCarats = (carats: number): number => (bannerHasEnded ? 0 : Math.floor(carats / 10) * 10)
	const displayFreeCarats = toDisplayCarats(resources.freeCarats)
	const displayPaidCarats = toDisplayCarats(resources.paidCarats)

	// Straight from the strategy's breakdown, which already resolved which ticket
	// type matches this banner. Zeroed for a passed banner, like the carats.
	const { tickets: ticketPulls, paidPulls } = bannerHasEnded
		? { tickets: 0, paidPulls: 0 }
		: resources.maxPullBreakdown

	const reservedFunding = bannerHasEnded
		? { selectors: 0, crystals: 0, unfunded: 0 }
		: resources.reservedFunding
	const fundedReservedCopies = reservedFunding.selectors + reservedFunding.crystals
	const reservedStatus = getReservedStatus(reservedFunding)

	// number_of_pulls carries STEPS on a step-up row (step-up.md).
	const plannedCount = plannedBanner.number_of_pulls
	const alreadyMade = isStepUp ? 0 : pullsAlreadyMade(plannedBanner)
	const countStatus = isStepUp
		? getStepCountStatus(plannedCount, stepUpperBound)
		: getPullCountStatus(plannedCount, pullUpperBound, alreadyMade)

	// "" on a row with no banner yet; the strip shows 0 there.
	const freePulls = Number(getFreePulls(plannedBanner)) || 0

	// Labels follow the source spreadsheet ("Carat Est.", "Free/Tickets/Paid"), so
	// players coming from the sheet read the same words; `title` is the long form.
	// Two boxes say something different on a step-up row, which is how the sheet's
	// header swaps (Max Pulls to Max Steps, Misc Pulls to Step #) land per row
	// without touching the shared header. Plain strings, never NumberFlow (web
	// #156 tried it and lagged 20-row plans; reverted 2026-10-22).
	const stats: BannerRowStat[] = [
		isStepUp
			? {
					label: "Step #",
					// "5x2-3" is two completed banners plus three steps into a third.
					value: resources.stepLabel ?? "0",
					title: "How far up the ladder this plan reaches. 5xN means N completed banners; a trailing -r is r steps into the next one",
				}
			: {
					// Unspaced slashes, matching formatDate's a/b/c. No thousands
					// separators: these are small counts and commas would collide.
					label: "Free/Tickets/Paid",
					value: `${freePulls}/${ticketPulls}/${paidPulls}`,
					title: "Pulls you don't pay free carats for: the banner's free pulls, matching tickets, and pulls funded by paid carats",
				},
		{
			label: "Carat Est.",
			value: displayFreeCarats.toLocaleString(),
			title: "Estimated free (earned) carats available for this banner",
			valueClass: "text-brand",
		},
		{
			label: "Paid Carat Est.",
			value: displayPaidCarats.toLocaleString(),
			title: "Estimated paid (purchased) carats available for this banner",
			valueClass: "text-brand",
		},
		isStepUp
			? {
					label: "Max Steps",
					value: String(maxPossibleSteps),
					title: "The most steps you could climb here before your paid carats or the campaign's banners run out",
				}
			: {
					label: "Max Pulls",
					value: String(maxPossiblePulls),
					title: "The most pulls this banner could support if every available resource went into it",
				},
	]

	return {
		bannerHasEnded,
		maxPossiblePulls,
		maxPossibleSteps,
		pullUpperBound,
		stepUpperBound,
		displayFreeCarats,
		displayPaidCarats,
		ticketPulls,
		paidPulls,
		freePulls,
		reservedFunding,
		fundedReservedCopies,
		reservedStatus,
		alreadyMade,
		countStatus,
		stats,
	}
}
