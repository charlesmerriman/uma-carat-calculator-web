/**
 * Calculates average monthly income over a fixed 5-month window starting today.
 * This is purely additive — pull costs are not deducted.
 */

import { useMemo } from "react"
import {
	cumulativeClubRankCarats,
	cumulativeDailyCarats,
	cumulativeDailyCaratPack,
	cumulativeLoginAndGiftCarats,
	cumulativeMiscEarningsCarats,
	cumulativeMonthlyShopTickets,
	cumulativeTeamTrialsCarats,
	cumulativeTrainingPassIncome,
} from "../utils/cumulativeIncome"
import {
	cumulativeEventRewards,
	cumulativeRaceRewards,
	cumulativeThroughoutCarats,
	parseLedger,
} from "../utils/incomeLedger"
import { startOfUtcDay } from "../utils/utcDates"
import type { CalculationConstants } from "../types/constants"
import type {
	UserStats,
	IncomeLedgerRow,
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank,
} from "../types"

export interface AverageMonthlyIncome {
	carats: number
	umaTickets: number
	supportTickets: number
	ssrShards: number
	srShards: number
}

interface AverageMonthlyIncomeParams {
	userStatsData: UserStats | null
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	leagueOfHeroesRankData: LeagueOfHeroesRank[]
	incomeLedger: IncomeLedgerRow[]
	constants: CalculationConstants
}

const WINDOW_MONTHS = 5

/**
 * Average monthly income over a fixed 5-month window starting today.
 *
 * Every income source here is a cumulative total from today to one fixed end
 * date, which is exactly what the per-banner engine asks for at each banner —
 * so this is one call to the same primitives rather than a parallel
 * re-implementation of every income rule. A second, hand-mirrored version of
 * this calculation used to live beside it and was deleted with the legacy
 * engine; that duplication was why the two could silently drift, and why a
 * maintenance rule existed telling you to mirror every new income source into
 * both.
 *
 * These tiles MUST agree with the banner rows below them, which is now
 * structural rather than a rule to remember: useBannerResources drives the
 * rows and both read the same ledger.
 *
 * Campaign purchases stay excluded, deliberately: they are one-off, and
 * averaging them across five months would report a recurring income nobody
 * earns.
 */
export function useAverageMonthlyIncome({
	userStatsData,
	clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	leagueOfHeroesRankData,
	incomeLedger,
	constants,
}: AverageMonthlyIncomeParams): AverageMonthlyIncome {
	return useMemo(() => {
		const zero = { carats: 0, umaTickets: 0, supportTickets: 0, ssrShards: 0, srShards: 0 }
		if (!userStatsData) return zero

		const now = new Date()
		const today = startOfUtcDay(now)
		// Date.UTC rolls a month overflow forward, so this is the same calendar
		// day five months out without needing a clamp.
		const end = new Date(
			Date.UTC(
				today.getUTCFullYear(),
				today.getUTCMonth() + WINDOW_MONTHS,
				today.getUTCDate()
			)
		)

		const ledger = parseLedger(incomeLedger)
		const clubRank = clubRankData.find((r) => r.id === userStatsData.club_rank)
		const teamTrialsRank = teamTrialsRankData.find(
			(r) => r.id === userStatsData.team_trials_rank
		)
		const cmRank = championsMeetingRankData.find(
			(r) => r.id === userStatsData.champions_meeting_rank
		)
		const lohRank = leagueOfHeroesRankData.find(
			(r) => r.id === userStatsData.league_of_heroes_rank
		)

		const events = cumulativeEventRewards(ledger, now, end)
		// Valued per event, not count x rank amount: an event can pay below
		// the user's rank (League of Heroes #1 only ran to Platinum 1).
		const cmRewards = cumulativeRaceRewards(
			ledger, "champions_meeting", today, end,
			cmRank, championsMeetingRankData
		)
		const lohRewards = cumulativeRaceRewards(
			ledger, "league_of_heroes", today, end,
			lohRank, leagueOfHeroesRankData
		)
		const pack = userStatsData.daily_carat
			? cumulativeDailyCaratPack(today, end, constants)
			: { freeCarats: 0, paidCarats: 0 }
		const pass = cumulativeTrainingPassIncome(
			today, end, userStatsData.training_pass, constants
		)
		const shop = userStatsData.monthly_shop_tickets
			? cumulativeMonthlyShopTickets(today, end, constants)
			: { umaTickets: 0, supportTickets: 0 }

		// One combined carat figure here, unlike the per-banner projection: the
		// free/paid split only matters where the two balances buy pulls at
		// different prices.
		const carats =
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
			pack.freeCarats + pack.paidCarats +
			pass.freeCarats + pass.paidCarats

		const umaTickets =
			events.umaTickets +
			cmRewards.umaTickets +
			lohRewards.umaTickets +
			shop.umaTickets + pass.umaTickets
		const supportTickets =
			events.supportTickets +
			cmRewards.supportTickets +
			lohRewards.supportTickets +
			shop.supportTickets + pass.supportTickets

		const ssrShards =
			events.ssrShards +
			cmRewards.ssrShards +
			lohRewards.ssrShards +
			pass.ssrShards
		const srShards =
			events.srShards +
			cmRewards.srShards +
			lohRewards.srShards

		return {
			carats: Math.round(carats / WINDOW_MONTHS),
			umaTickets: Math.round(umaTickets / WINDOW_MONTHS),
			supportTickets: Math.round(supportTickets / WINDOW_MONTHS),
			ssrShards: Math.round(ssrShards / WINDOW_MONTHS),
			srShards: Math.round(srShards / WINDOW_MONTHS),
		}
	}, [
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		incomeLedger,
		constants,
	])
}
