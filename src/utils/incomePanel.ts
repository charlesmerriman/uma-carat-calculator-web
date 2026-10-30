import type { UserStats } from "../types"

/**
 * Does the Income panel start open on a phone? It's a screen and a half tall
 * there, so only for a player who has picked no ranks yet: until they do, the
 * numbers below mean little (Daptrius, 2026-10-30).
 */
export function incomeStartsOpenOnPhone(stats: UserStats | null): boolean {
	const ranks = [stats?.club_rank, stats?.team_trials_rank, stats?.champions_meeting_rank, stats?.league_of_heroes_rank]
	return ranks.every((rank) => rank == null)
}
