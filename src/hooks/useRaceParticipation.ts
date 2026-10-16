import { useCallback } from "react"
import { useCalculatorDataSafe } from "../services/CalculatorContext"
import {
	isRaceSkipped,
	racePayoutAhead,
	withRaceParticipation,
} from "../utils/raceParticipation"
import type { RaceEvent } from "../types"

export interface RaceParticipation {
	/** False once the player has said they're skipping this event. */
	participating: boolean
	setParticipating: (participating: boolean) => void
}

/**
 * The Timeline card's "taking part" switch for one race event, or null when
 * there is nothing to switch: outside the calculator's provider (a test, a
 * prerender), before stats exist, or once the event's payout is behind the
 * projection and skipping it would change no number.
 *
 * The event's kind comes from `event_type`, which carries the same strings as
 * the ledger's race kinds. Read here rather than in RaceEventCard, which by
 * design never looks at which of the two race types it is drawing.
 */
export function useRaceParticipation(event: RaceEvent): RaceParticipation | null {
	const calculator = useCalculatorDataSafe()
	const kind = event.event_type
	const stats = calculator?.userStatsData
	const setStats = calculator?.setUserStatsData

	const setParticipating = useCallback(
		(participating: boolean) => {
			// Functional update: two quick flips on two cards must both land,
			// not the second overwrite the first from a stale closure.
			setStats?.((prev) =>
				prev
					? {
							...prev,
							skipped_race_events: withRaceParticipation(
								prev.skipped_race_events,
								kind,
								event.id,
								participating
							),
					  }
					: prev
			)
		},
		[setStats, kind, event.id]
	)

	if (!calculator || !stats || !setStats) return null
	// The UNFILTERED ledger: a skipped event is missing from the projection's
	// one, and the switch has to find it to offer it back.
	if (!racePayoutAhead(calculator.fullIncomeLedger, kind, event.id, new Date())) {
		return null
	}
	return {
		participating: !isRaceSkipped(stats.skipped_race_events, kind, event.id),
		setParticipating,
	}
}
