/**
 * "I'm not taking part in this Champions Meeting / League of Heroes."
 *
 * The choice is stored on the stats block as `skipped_race_events`
 * (`{ champions_meeting: [ids], league_of_heroes: [ids] }`, see
 * backend/calculatorapi/models/game_stats.py) and applied in exactly ONE place:
 * CalculatorProvider hands every consumer a ledger with the skipped race rows
 * already removed (withoutSkippedRaces below). The planner rows, the income
 * tiles and the uncap panel all read that one ledger, so a skip can never
 * reach one of them and miss another, which is the "rows and tiles read one
 * engine" rule.
 *
 * Removing the row, rather than valuing it at zero, is also why no projection
 * function needed to change: to the engine a skipped event simply isn't there.
 */

import type { IncomeLedgerRow, LedgerRowKind } from "../types/ledger"
import type { SkippedRaceEvents } from "../types/user"
import { startOfUtcDay } from "./utcDates"

/** The ledger kinds a player can skip: the two race kinds, never `event`. */
export type RaceLedgerKind = Exclude<LedgerRowKind, "event">

const RACE_KINDS: readonly RaceLedgerKind[] = ["champions_meeting", "league_of_heroes"]

/** Whether the stats block marks this event as skipped. */
export function isRaceSkipped(
	skips: SkippedRaceEvents | undefined,
	kind: RaceLedgerKind,
	eventId: number
): boolean {
	return skips?.[kind]?.includes(eventId) ?? false
}

/**
 * A copy of `skips` with one event switched on or off. Never mutates: the
 * result goes straight into `setUserStatsData`, and React only re-renders
 * (and auto-save only fires) on a new object.
 *
 * Lists stay sorted and an emptied kind is dropped, matching what the server
 * stores (GameStatsSerializer.validate_skipped_race_events), so local state
 * never differs from what a reload would bring back.
 */
export function withRaceParticipation(
	skips: SkippedRaceEvents | undefined,
	kind: RaceLedgerKind,
	eventId: number,
	participating: boolean
): SkippedRaceEvents {
	const current = skips?.[kind] ?? []
	const next = participating
		? current.filter((id) => id !== eventId)
		: [...new Set([...current, eventId])].sort((a, b) => a - b)
	const result: SkippedRaceEvents = { ...skips }
	if (next.length > 0) result[kind] = next
	else delete result[kind]
	return result
}

/**
 * The ledger with every skipped race row removed. Returns the SAME array when
 * nothing is skipped, so the memo downstream of it (every engine hook) keeps
 * its cache for the overwhelming majority of players who skip nothing.
 */
export function withoutSkippedRaces<T extends IncomeLedgerRow>(
	ledger: T[],
	skips: SkippedRaceEvents | undefined
): T[] {
	if (!skips || RACE_KINDS.every((kind) => !skips[kind]?.length)) return ledger
	return ledger.filter(
		(row) => row.kind === "event" || !isRaceSkipped(skips, row.kind, row.source_id)
	)
}

/**
 * Whether skipping this event would change anything: true while its payout is
 * still ahead of the projection. The bound is raceEventsInWindow's own
 * (`date >= today` at UTC midnight, utils/incomeLedger), so the switch shows
 * exactly when the engine would count the event, never for one it already
 * ignores. False for an event with no ledger row (no resolvable end date).
 */
export function racePayoutAhead(
	ledger: IncomeLedgerRow[],
	kind: RaceLedgerKind,
	eventId: number,
	now: Date
): boolean {
	const from = startOfUtcDay(now).getTime()
	return ledger.some(
		(row) =>
			row.kind === kind &&
			row.source_id === eventId &&
			new Date(row.date).getTime() >= from
	)
}

/**
 * How many events are skipped whose payout is still ahead. Past skips are
 * left out: they change no number, so "Skipping 3 events" when only one
 * still matters would send the player looking for two that don't.
 */
export function upcomingSkipCount(
	ledger: IncomeLedgerRow[],
	skips: SkippedRaceEvents | undefined,
	now: Date
): number {
	if (!skips) return 0
	return RACE_KINDS.reduce(
		(count, kind) =>
			count +
			(skips[kind] ?? []).filter((id) => racePayoutAhead(ledger, kind, id, now))
				.length,
		0
	)
}

/**
 * A stored value read defensively, for the guest's device store: anything
 * that isn't the expected shape falls back to "skipping nothing" rather than
 * reaching the engine.
 */
export function readSkippedRaceEvents(raw: unknown): SkippedRaceEvents | null {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
	const stored = raw as Record<string, unknown>
	const result: SkippedRaceEvents = {}
	for (const kind of RACE_KINDS) {
		const ids = stored[kind]
		if (ids === undefined) continue
		if (!Array.isArray(ids)) return null
		const valid = ids.filter(
			(id): id is number => Number.isInteger(id) && (id as number) > 0
		)
		if (valid.length > 0) result[kind] = [...new Set(valid)].sort((a, b) => a - b)
	}
	return result
}
