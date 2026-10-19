/**
 * The ledger-based income engine.
 *
 * WHY IT LOOKS LIKE THIS
 * ----------------------
 * It replaced an incremental WALK, deleted 2026-08-18: a cursor stepped banner
 * to banner accruing income into chained half-open `(prevEnd, thisEnd]` windows.
 * Every income source needed its own occurrence counter and every counter had to
 * tile — `(a,b] + (b,c] === (a,c]` — or totals drifted with how many banners the
 * user planned. That requirement produced a long run of drift bugs against the
 * source spreadsheet. Do not reintroduce per-window accumulation.
 *
 * This engine does what the sheet does. Income for a banner is an ABSOLUTE
 * cumulative total from today to that banner's own end date (see
 * ./utils/cumulativeIncome and ./utils/incomeLedger), computed independently of
 * every other banner. Spend is then subtracted as a running total of what the
 * banners resolving earlier committed — the sheet's `AW42`, a self-join over the
 * banner rows.
 *
 * The consequence worth internalising: **banner order no longer affects income
 * at all.** It only decides who has already spent by the time a given banner is
 * reached. That is why this is still a single forward pass and not something
 * quadratic — it just carries spend rather than income.
 *
 * Returns `BannerResources[]`, positionally aligned with
 * `userPlannedBannerData`.
 */

import { useMemo } from "react"
import { createIncomeProjection, projectionWalkOrder } from "../utils/incomeProjection"
import { utcDaysBetween } from "../utils/utcDates"
import {
	applyPullStrategy,
	applyStepUpStrategy,
	allocateReservedCopies,
	plannedBannerTarget,
	plannedPulls,
	plannedSteps,
} from "../utils/bannerHelpers"
import type { PullStrategyResult } from "../utils/bannerHelpers"
import { isExcludedFromProjection, rowSpendSettings } from "../utils/rowOptions"
import { addSelectorTickets, isCardSelectable } from "../utils/selectorTickets"
import type { SelectorTicketBucket } from "../utils/selectorTickets"
import { EMPTY_BANNER_RESOURCES } from "./bannerResources"
import type { BannerResources } from "./bannerResources"
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

interface BannerResourcesParams {
	userStatsData: UserStats | null
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	leagueOfHeroesRankData: LeagueOfHeroesRank[]
	userPlannedBannerData: UserPlannedBanner[]
	anniversaryEventData: AnniversaryEvent[]
	userPlannedPurchaseData: UserPlannedPurchase[]
	incomeLedger: IncomeLedgerRow[]
	/** Admin-editable tunables, already overlaid on DEFAULT_CONSTANTS. */
	constants: CalculationConstants
}

/** Running total of what the banners resolving before this one committed. */
interface SpendTotals {
	freeCarats: number
	paidCarats: number
	umaTickets: number
	supportTickets: number
	ssrCrystals: number
}

export function useBannerResources({
	userStatsData,
	clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	leagueOfHeroesRankData,
	userPlannedBannerData,
	anniversaryEventData,
	userPlannedPurchaseData,
	incomeLedger,
	constants,
}: BannerResourcesParams): BannerResources[] {
	return useMemo(() => {
		if (!userStatsData) return []

		const results: BannerResources[] = userPlannedBannerData.map(
			() => EMPTY_BANNER_RESOURCES
		)

		// The income side (the two anchors, the campaign credits and
		// `incomeTo`) lives in utils/incomeProjection, because the forecast
		// chart reads the very same function. See that module for the model.
		const { today, purchaseCredits, incomeTo } = createIncomeProjection({
			userStatsData,
			clubRankData,
			teamTrialsRankData,
			championsMeetingRankData,
			leagueOfHeroesRankData,
			anniversaryEventData,
			userPlannedPurchaseData,
			incomeLedger,
			constants,
		})

		// Selector tickets are banked UP FRONT rather than credited at their
		// campaign's date — unlike the paid carats from the very same purchase.
		// A selector is not spent at a banner: it takes a card out of the back
		// catalogue, and a card stays there after its banner ends. What still
		// constrains it is its CUTOFF, which is calendar-independent. Carried
		// through the pass so the pool can't be spent twice.
		//
		// Tickets the account already OWNS have no pick anywhere, so they go in
		// with no target and stay usable on any eligible banner. A PURCHASED
		// selector is only usable on the card picked for it, and one with no
		// pick yet is usable on nothing: it is counted rather than banked, so
		// the row can tell the user why a reserved copy went unfunded.
		let umaSelectorTickets: SelectorTicketBucket[] = addSelectorTickets(
			[], null, userStatsData.uma_selector_ticket || 0
		)
		let supportSelectorTickets: SelectorTicketBucket[] = addSelectorTickets(
			[], null, userStatsData.support_selector_ticket || 0
		)
		let unpickedUmaSelectors = 0
		let unpickedSupportSelectors = 0
		for (const credit of purchaseCredits) {
			if (credit.productType === "uma_selector") {
				if (credit.targetCardId === null) {
					unpickedUmaSelectors += credit.quantity
					continue
				}
				umaSelectorTickets = addSelectorTickets(
					umaSelectorTickets, credit.jpCutoff, credit.quantity,
					credit.targetCardId
				)
			} else if (credit.productType === "support_selector") {
				if (credit.targetCardId === null) {
					unpickedSupportSelectors += credit.quantity
					continue
				}
				supportSelectorTickets = addSelectorTickets(
					supportSelectorTickets, credit.jpCutoff, credit.quantity,
					credit.targetCardId
				)
			}
		}

		// Start day, then display position: see projectionWalkOrder.
		const walkOrder = projectionWalkOrder(userPlannedBannerData)

		const spent: SpendTotals = {
			freeCarats: 0,
			paidCarats: 0,
			umaTickets: 0,
			supportTickets: 0,
			ssrCrystals: 0,
		}

		for (const { banner, index, endDate, startDate } of walkOrder) {
			const income = incomeTo(endDate)

			const freeCarats =
				(userStatsData.current_carat || 0) + income.freeCarats - spent.freeCarats
			// Paid is floored at 0 (the sheet's MAX(0, ...) on N43) while free is
			// allowed to go negative — an unaffordable plan surfaces as a carat
			// debt on the free balance, which is what the red state reads.
			const paidCarats = Math.max(
				0,
				(userStatsData.current_paid_carat || 0) + income.paidCarats - spent.paidCarats
			)
			const umaTickets =
				(userStatsData.uma_ticket || 0) + income.umaTickets - spent.umaTickets
			const supportTickets =
				(userStatsData.support_ticket || 0) +
				income.supportTickets -
				spent.supportTickets

			// Shards roll into crystals at this checkpoint, not once at the end,
			// so the crystals are spendable on THIS banner's reserved copies.
			const totalShards = (userStatsData.ssr_shards || 0) + income.ssrShards
			const ssrShards = totalShards % constants.shards_per_crystal
			const ssrCrystals =
				(userStatsData.ssr_crystals || 0) +
				income.ssrCrystals +
				Math.floor(totalShards / constants.shards_per_crystal) -
				spent.ssrCrystals

			// Discounted pulls are once per day, capped by the banner's OWN
			// window measured from its start — not from today, so the allowance
			// doesn't shrink under the user while a banner is running. Inclusive
			// calendar days, matching the sheet's DATEDIF(start, end + 1, "D").
			const bannerStart = startDate ?? today
			const discountDays = Math.max(0, utcDaysBetween(bannerStart, endDate) + 1)

			const target = plannedBannerTarget(banner)
			const isUmaBanner = target.type === "Uma"
			// The gear menu's switches with this row's own overrides on top
			// (utils/rowOptions). Ignored on a step-up, which is paid-only.
			const spendSettings = rowSpendSettings(banner, userStatsData)
			const freePulls =
				target.type === "Uma" || target.type === "Support"
					? target.banner.free_pulls
					: 0

			// A step-up is paid-carats-only: no free pulls, no tickets, no daily
			// discount. It runs its own strategy rather than a mode flag through
			// applyPullStrategy — see applyStepUpStrategy for why.
			const stepUp =
				target.type === "StepUp"
					? applyStepUpStrategy({
							plannedSteps: plannedSteps(banner),
							bannerCount: target.banner.banner_count,
							paidCarats,
							constants,
					  })
					: null

			// Both branches produce the same shape so the spend-banking below
			// stays one code path. On a step-up every balance but paid carats
			// passes through untouched, which is exactly what "paid only" means.
			const strategy: PullStrategyResult = stepUp
				? {
						freeCarats,
						paidCarats: stepUp.paidCarats,
						umaTickets,
						supportTickets,
						maxPossiblePulls: 0,
						maxPullBreakdown: {
							freePulls: 0,
							tickets: 0,
							paidPulls: 0,
							freeCaratPulls: 0,
						},
				  }
				: applyPullStrategy({
						isUmaBanner,
						plannedPulls: plannedPulls(banner),
						freePulls,
						umaTickets,
						supportTickets,
						freeCarats,
						paidCarats,
						discountDays,
						discountedPaidPulls: spendSettings.discountedPaidPulls,
						fullPricePaidPulls: spendSettings.fullPricePaidPulls,
						// Resolved by rowSpendSettings, which also owns the
						// "missing switch means spend them" rule for a deploy
						// where the API does not send it yet.
						spendTickets: spendSettings.spendTickets,
						ticketLimit: spendSettings.ticketLimit,
				  })

			// A selector only has to reach ONE card on the banner — it takes a
			// single card and the user picks which — so the OLDEST featured card
			// sets the bar. Cards with no known release date are skipped, so an
			// unknown neither qualifies a banner nor blocks one.
			//
			// Cards barred from selectors outright (time-limited, not ★3) drop
			// out FIRST, before the date is read: otherwise a banner whose only
			// old featured unit is time-limited reads as selector-fundable off a
			// card no selector can actually grant. Filtering rather than
			// blocking keeps the ONE-card rule intact — barred units sit
			// alongside ordinary ones, and the siblings still qualify the banner.
			const featured =
				target.type === "Uma"
					? target.banner.umas
					: target.type === "Support"
					? target.banner.support_cards
					: []
			const selectable = featured.filter(isCardSelectable)
			// Only a banner that HAS featured cards, none of them takeable, bars
			// selectors. An empty list is a data gap, not a bar — see
			// ReservedCopiesInput.selectorsBarred.
			const selectorsBarred = featured.length > 0 && selectable.length === 0
			const oldestFeaturedJpDate = selectable.reduce<string | null>(
				(oldest, card) => {
					if (!card.first_jp_date) return oldest
					return !oldest || card.first_jp_date < oldest
						? card.first_jp_date
						: oldest
				},
				null
			)
			const reserved = allocateReservedCopies({
				// Disabled on step-up rows in v1. Reserving a copy needs a featured
				// card list to date a selector ticket against, and a step-up has
				// none — it draws from the back catalogue under the campaign's own
				// cutoff. The sheet has no equivalent concept either. Passing 0
				// returns the buckets untouched, so tickets still carry forward.
				reservedCopies: stepUp ? 0 : banner.reserved_copies,
				isUmaBanner,
				oldestFeaturedJpDate,
				selectorsBarred,
				// What a PICKED ticket is matched against: it pays only if its
				// card is one of these. Already past the intrinsic gate above.
				selectableFeatured: selectable,
				umaSelectorTickets,
				supportSelectorTickets,
				ssrCrystals,
			})

			results[index] = {
				carats: freeCarats + paidCarats,
				freeCarats,
				paidCarats,
				maxPossiblePulls: strategy.maxPossiblePulls,
				maxPullBreakdown: strategy.maxPullBreakdown,
				umaTickets,
				supportTickets,
				umaSelectorTickets,
				supportSelectorTickets,
				ssrCrystals,
				ssrShards,
				usdSpent: income.usdSpent,
				// What this row's pulls take from the free balance. The forecast
				// chart draws it as the drop at the banner's end date.
				freeCaratsSpent: freeCarats - strategy.freeCarats,
				ticketsSpent: isUmaBanner
					? umaTickets - strategy.umaTickets
					: supportTickets - strategy.supportTickets,
				reservedFunding: reserved.funding,
				unpickedSelectorTickets: stepUp
					? 0
					: isUmaBanner
					? unpickedUmaSelectors
					: unpickedSupportSelectors,
				...(stepUp && {
					maxPossibleSteps: stepUp.maxPossibleSteps,
					chargeableSteps: stepUp.chargeableSteps,
					stepLabel: stepUp.stepLabel,
				}),
			}

			// A row left out of the projection is shown with what it WOULD cost
			// (the result above is filled in as usual) but commits nothing, so
			// the banners after it see the balances as if it were not planned.
			// Its selectors and crystals stay in the pool for the same reason.
			if (isExcludedFromProjection(banner)) continue

			// Bank what this banner committed, so the banners after it start from
			// a balance that already accounts for it.
			spent.freeCarats += freeCarats - strategy.freeCarats
			spent.paidCarats += paidCarats - strategy.paidCarats
			spent.umaTickets += umaTickets - strategy.umaTickets
			spent.supportTickets += supportTickets - strategy.supportTickets
			spent.ssrCrystals += ssrCrystals - reserved.ssrCrystals

			// Selector buckets are a pool rather than a scalar, so they carry
			// directly instead of being differenced.
			umaSelectorTickets = reserved.umaSelectorTickets
			supportSelectorTickets = reserved.supportSelectorTickets
		}

		return results
	}, [
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		userPlannedBannerData,
		anniversaryEventData,
		userPlannedPurchaseData,
		incomeLedger,
		constants,
	])
}
