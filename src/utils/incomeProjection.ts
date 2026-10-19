/**
 * The projection's income side, shared by everything that reads the engine.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * `incomeTo(end)` used to be a closure inside useBannerResources. The planner
 * rows were its only reader, so that was fine. The carat forecast chart reads
 * it too (the same question asked for every day rather than for every banner),
 * and "the rows and the tiles read one engine" has to hold for the chart as
 * well: a line that disagreed with the rows under it would be worse than no
 * line. So the closure moved here unchanged, and both callers build it through
 * `createIncomeProjection`.
 *
 * Nothing about the model changed in the move. Income is still a pure function
 * of the end date, measured from the two anchors (`today` for spans, `now` for
 * reward instants), and the constants still arrive as a parameter.
 */

import {
	cumulativeClubRankCarats,
	cumulativeDailyCarats,
	cumulativeDailyCaratPack,
	cumulativeLoginAndGiftCarats,
	cumulativeMiscEarningsCarats,
	cumulativeMonthlyShopTickets,
	cumulativeTeamTrialsCarats,
	cumulativeTrainingPassIncome,
} from "./cumulativeIncome"
import {
	cumulativeEventRewards,
	cumulativeRaceRewards,
	cumulativeThroughoutCarats,
	parseLedger,
} from "./incomeLedger"
import { startOfUtcDay } from "./utcDates"
import { plannedBannerTimeline } from "./bannerHelpers"
import { purchaseCarats } from "./campaignPurchases"
import type {
	UserStats,
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank,
	UserPlannedBanner,
	AnniversaryEvent,
	UserPlannedPurchase,
	IncomeLedgerRow,
} from "../types"
import type { CalculationConstants } from "../types/constants"

export interface IncomeProjectionParams {
	userStatsData: UserStats
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	leagueOfHeroesRankData: LeagueOfHeroesRank[]
	anniversaryEventData: AnniversaryEvent[]
	userPlannedPurchaseData: UserPlannedPurchase[]
	incomeLedger: IncomeLedgerRow[]
	constants: CalculationConstants
	/**
	 * The live instant. Optional and defaulted to the clock: a caller only
	 * passes it so that two readers built in the same render agree on "now".
	 */
	now?: Date
}

/** One campaign purchase, resolved to the instant its carats are credited. */
export interface PurchaseCredit {
	creditAt: Date
	productType: string
	jpCutoff: string | null
	/** The card picked for a selector on the Selectors page, if any. */
	targetCardId: number | null
	paidCarats: number
	freeCarats: number
	usd: number
	quantity: number
}

/** Everything earned between today and one end date, before any spending. */
export interface IncomeTotals {
	freeCarats: number
	paidCarats: number
	usdSpent: number
	umaTickets: number
	supportTickets: number
	ssrShards: number
	ssrCrystals: number
}

export interface IncomeProjection {
	now: Date
	today: Date
	purchaseCredits: PurchaseCredit[]
	incomeTo: (end: Date) => IncomeTotals
}

export function createIncomeProjection({
	userStatsData,
	clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	leagueOfHeroesRankData,
	anniversaryEventData,
	userPlannedPurchaseData,
	incomeLedger,
	constants,
	now = new Date(),
}: IncomeProjectionParams): IncomeProjection {
	// Two anchors, and they are NOT interchangeable — the sheet keeps them
	// apart too. `today` (its $AG$3, TODAY) measures spans, so every estimate
	// on a given calendar day is identical no matter when the page is opened.
	// `now` (its $AG$2, NOW) filters reward instants: an event that already
	// opened today has paid out, and its carats are in the balance the user
	// typed in.
	const today = startOfUtcDay(now)

	const ledger = parseLedger(incomeLedger)

	const clubRank = clubRankData.find((r) => r.id === userStatsData.club_rank)
	const teamTrialsRank = teamTrialsRankData.find(
		(r) => r.id === userStatsData.team_trials_rank
	)
	const championsMeetingRank = championsMeetingRankData.find(
		(r) => r.id === userStatsData.champions_meeting_rank
	)
	const leagueOfHeroesRank = leagueOfHeroesRankData.find(
		(r) => r.id === userStatsData.league_of_heroes_rank
	)

	// Campaign purchases, resolved to the instant they are credited: the
	// campaign's MAIN part start — the anniversary itself, not the Part 1
	// run-up that opens the campaign, because that is when the packs go on
	// sale. Its SELECTOR TICKETS are the exception and are banked up front by
	// useBannerResources; see the note there.
	const productsById = new Map(
		anniversaryEventData.flatMap((event) =>
			event.products.map((product) => [product.id, { product, event }] as const)
		)
	)
	const purchaseCredits: PurchaseCredit[] = userStatsData.include_purchases_in_projection
		? userPlannedPurchaseData.flatMap((purchase) => {
				const entry = productsById.get(purchase.product)
				const startDate = entry?.event.main_start_date ?? entry?.event.start_date
				if (!entry || !startDate) return []
				const quantity = Math.max(0, purchase.quantity)
				if (quantity === 0) return []
				const { product } = entry
				// The pack's own carats are paid; the webstore bonus on top is
				// granted as FREE carats. Split here rather than folding the
				// multiplier into paidCarats, or the bonus would silently
				// enlarge the balance a step-up is allowed to spend.
				const { paidCarats, freeCarats } = purchaseCarats(
					product, quantity, userStatsData.webstore_bonus
				)
				return [{
					creditAt: new Date(startDate),
					productType: product.product_type,
					jpCutoff: product.jp_cutoff_date,
					// The card picked for a selector on the Selectors page. The
					// serializer sends at most one of the two (a check constraint
					// guarantees it), and neither for a carat pack.
					targetCardId: purchase.target_uma ?? purchase.target_support ?? null,
					paidCarats,
					freeCarats,
					usd: product.usd_cost * quantity,
					quantity,
				}]
			})
		: []

	/**
	 * Everything the user will have earned between today and `end`, before
	 * any spending. A pure function of `end` — nothing about the rest of the
	 * plan reaches it, which is the property the whole rewrite is for.
	 */
	const incomeTo = (end: Date): IncomeTotals => {
		const events = cumulativeEventRewards(ledger, now, end)
		// Valued per event, not count x rank amount: an event can pay below
		// the user's rank (League of Heroes #1 only ran to Platinum 1).
		const cmRewards = cumulativeRaceRewards(
			ledger, "champions_meeting", today, end,
			championsMeetingRank, championsMeetingRankData
		)
		const lohRewards = cumulativeRaceRewards(
			ledger, "league_of_heroes", today, end,
			leagueOfHeroesRank, leagueOfHeroesRankData
		)
		const pack = userStatsData.daily_carat
			? cumulativeDailyCaratPack(today, end, constants)
			: { freeCarats: 0, paidCarats: 0 }
		const pass = cumulativeTrainingPassIncome(
			today, end, userStatsData.training_pass, constants
		)
		const shop = userStatsData.monthly_shop_tickets
			? cumulativeMonthlyShopTickets(today, end, constants, {
					uma: userStatsData.shop_uma_tickets_bought,
					support: userStatsData.shop_support_tickets_bought,
			  })
			: { umaTickets: 0, supportTickets: 0 }

		// One pass over the campaign credits: free carats, paid carats and
		// USD all come off the same rows and share the same window test, so
		// splitting them across two loops would only invite the two filters
		// to drift apart.
		let purchaseFree = 0
		let purchasePaid = 0
		let purchaseUsd = 0
		for (const credit of purchaseCredits) {
			if (credit.creditAt < now || credit.creditAt > end) continue
			purchaseFree += credit.freeCarats
			purchasePaid += credit.paidCarats
			purchaseUsd += credit.usd
		}

		const freeCarats =
			events.carats +
			cumulativeThroughoutCarats(ledger, now, end, constants) +
			cmRewards.carats +
			lohRewards.carats +
			cumulativeDailyCarats(today, end, constants) +
			cumulativeTeamTrialsCarats(today, end, teamTrialsRank?.income_amount ?? 0) +
			cumulativeClubRankCarats(today, end, clubRank?.income_amount ?? 0) +
			cumulativeLoginAndGiftCarats(today, end, constants) +
			(userStatsData.misc_earnings
				? cumulativeMiscEarningsCarats(today, end, constants)
				: 0) +
			pack.freeCarats +
			pass.freeCarats +
			purchaseFree

		// A campaign pack's own carats are PAID — they were bought, so they
		// land in the balance that funds discounted pulls and step-ups. Its
		// webstore bonus is free and is summed into `freeCarats` above.
		// Credited at an absolute instant, never per-window.
		const paidCarats = pack.paidCarats + pass.paidCarats + purchasePaid

		const umaTickets =
			events.umaTickets +
			cmRewards.umaTickets +
			lohRewards.umaTickets +
			shop.umaTickets +
			pass.umaTickets
		const supportTickets =
			events.supportTickets +
			cmRewards.supportTickets +
			lohRewards.supportTickets +
			shop.supportTickets +
			pass.supportTickets

		const ssrShards =
			events.ssrShards + cmRewards.ssrShards + lohRewards.ssrShards + pass.ssrShards

		return {
			freeCarats,
			paidCarats,
			usdSpent: purchaseUsd,
			umaTickets,
			supportTickets,
			ssrShards,
			ssrCrystals: events.ssrCrystals,
		}
	}

	return { now, today, purchaseCredits, incomeTo }
}

/** One planned banner in the order the projection charges it. */
export interface WalkEntry {
	banner: UserPlannedBanner
	/** Its position in `userPlannedBannerData`, which every result is keyed by. */
	index: number
	endDate: Date
	startDate: Date | null
}

/**
 * THE ORDER. Income does not depend on it — only spend attribution does, so
 * this decides which banner is charged first when two compete for the same
 * carats.
 *
 * Keyed on the banner's START day, which is the sheet's AH44. The sheet
 * implements the tiebreak by nudging duplicate start dates forward a day each
 * (`AH42 + count of earlier rows sharing that start`); sorting by (start day,
 * display position) is the same ordering without the artifact that a nudged
 * banner can collide with one genuinely starting the next day. A banner with
 * no resolvable end date is left out, and keeps its zeroed slot.
 */
export function projectionWalkOrder(userPlannedBannerData: UserPlannedBanner[]): WalkEntry[] {
	return userPlannedBannerData
		.map((banner, index) => {
			const timeline = plannedBannerTimeline(banner)
			const endDate = timeline?.end_date ? new Date(timeline.end_date) : null
			const startDate = timeline?.start_date ? new Date(timeline.start_date) : null
			return { banner, index, endDate, startDate }
		})
		.filter((entry): entry is WalkEntry => entry.endDate !== null)
		.sort((a, b) => {
			const aStart = a.startDate ? startOfUtcDay(a.startDate).getTime() : Infinity
			const bStart = b.startDate ? startOfUtcDay(b.startDate).getTime() : Infinity
			if (aStart !== bStart) return aStart - bStart
			return a.index - b.index
		})
}
