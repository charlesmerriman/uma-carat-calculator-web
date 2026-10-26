/**
 * Rank type definitions.
 *
 * These all share the same shape (id, name, income_amount).
 * You might wonder: why not just have one `Rank` type?
 *
 * TYPESCRIPT CONCEPT: Nominal vs Structural Typing
 * TypeScript uses structural typing — if two types have the same shape,
 * they're interchangeable. That means a function expecting ClubRank would
 * happily accept a TeamTrialsRank since they look identical.
 *
 * We keep them separate anyway because:
 * 1. They represent different domain concepts (a ClubRank IS NOT a TeamTrialsRank)
 * 2. As the app grows, they may diverge (e.g., TeamTrialsRank might gain new fields)
 * 3. It makes the code self-documenting — a function signature tells you
 *    exactly which rank it expects
 *
 * If you wanted true nominal typing, you could use branded types:
 *   type ClubRank = BaseRank & { readonly _brand: 'ClubRank' }
 * But that's overkill for this project.
 */

export interface ClubRank {
	id: number
	name: string
	income_amount: number
}

/**
 * NOTE: This was originally misspelled as "TeamTrailsRank" throughout the codebase.
 * Fixed to "TeamTrialsRank" to match the backend model name.
 */
export interface TeamTrialsRank {
	id: number
	name: string
	income_amount: number
}

/**
 * "From event #N on, this rank pays X carats" (backend models/race_rank_reward.py).
 * The game raised CM and LoH payouts at set event numbers. Read through
 * `raceRewardAmount` (utils/incomeLedger), never directly.
 */
export interface RaceRankReward {
	from_event_number: number
	income_amount: number
	/**
	 * Carats per payout day, adding up to `income_amount`. Empty: the rank's
	 * own split, scaled (`raceDayAmounts`). Absent from an older API.
	 */
	day_amounts?: number[]
}

export interface ChampionsMeetingRank {
	id: number
	name: string
	/** What the rank pays before its first `rewards` row (or always, with none). */
	income_amount: number
	uma_ticket_amount: number
	support_ticket_amount: number
	ssr_shard_amount: number
	sr_shard_amount: number
	/**
	 * Carats per payout day, adding up to `income_amount` (`raceDayAmounts`).
	 * Empty: everything on the last day. Absent from an older API.
	 */
	day_amounts?: number[]
	/** Ascending. Absent from an API older than the field. */
	rewards?: RaceRankReward[]
}

export interface LeagueOfHeroesRank {
	id: number
	name: string
	/** What the rank pays before its first `rewards` row (or always, with none). */
	income_amount: number
	uma_ticket_amount: number
	support_ticket_amount: number
	ssr_shard_amount: number
	sr_shard_amount: number
	/**
	 * Carats per payout day, adding up to `income_amount` (`raceDayAmounts`).
	 * Empty: everything on the last day. Absent from an older API.
	 */
	day_amounts?: number[]
	/** Ascending. Absent from an API older than the field. */
	rewards?: RaceRankReward[]
}