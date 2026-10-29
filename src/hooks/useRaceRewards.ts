import { useCalculatorDataSafe } from "../services/CalculatorContext"
import { raceRewardSchedule, type RaceRewardSchedule } from "../utils/incomeLedger"
import { isRaceSkipped, racePayoutAhead } from "../utils/raceParticipation"
import type { RaceEvent } from "../types"

export interface RaceRewards extends RaceRewardSchedule {
	/** The finish the player picked in the planner's income form. */
	rankName: string
	/** False once the player has said they're skipping this event. */
	counted: boolean
}

/**
 * What one race event pays the player, payout by payout, for the Timeline
 * card's "Your rewards" panel. Null when there is nothing to show: outside the
 * calculator's provider (a test, a prerender), before stats exist, with no
 * finish picked for this kind of event (or one that pays nothing), and once
 * the event's payout is behind the projection. That last bound is the "Taking
 * part" switch's (racePayoutAhead), so the panel and the switch come and go
 * together.
 *
 * Reads the UNFILTERED ledger, like the switch: a skipped event is missing from
 * the projection's one, and the panel still shows what skipping gives up.
 * Like useRaceParticipation, this is where `event_type` is read, so the card
 * itself never looks at which race type it is drawing.
 */
export function useRaceRewards(event: RaceEvent): RaceRewards | null {
	const calculator = useCalculatorDataSafe()
	const kind = event.event_type
	const stats = calculator?.userStatsData
	const ledger = calculator?.fullIncomeLedger
	const ranks =
		kind === "champions_meeting"
			? calculator?.championsMeetingRankData
			: calculator?.leagueOfHeroesRankData
	// `champions_meeting_rank` / `league_of_heroes_rank`: the ledger kinds and
	// the stats fields share their stems.
	const rankId = stats?.[`${kind}_rank`]
	const rank = rankId == null ? undefined : ranks?.find((r) => r.id === rankId)
	const row = ledger?.find((r) => r.kind === kind && r.source_id === event.id)
	if (!stats || !ledger || !rank || !row) return null

	const now = new Date()
	if (!racePayoutAhead(ledger, kind, event.id, now)) return null
	const schedule = raceRewardSchedule(row, rank, now)
	if (schedule.total === 0 && !schedule.tickets && !schedule.shards) return null
	return {
		...schedule,
		rankName: rank.name,
		counted: !isRaceSkipped(stats.skipped_race_events, kind, event.id),
	}
}
