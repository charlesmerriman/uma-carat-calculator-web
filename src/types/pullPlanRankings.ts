/**
 * GET /rankings/pull-plans (backend views/rankings.py): the admin
 * analytics' banner tables and demand by month, hourly. Shares, never a
 * count of planners or pulls (backend rankings_shares.pull_plan_shares).
 */

export type PlannedBannerType = "uma" | "support" | "step_up"

export interface PlannedBannerRank {
	type: PlannedBannerType
	/** A step-up's figures are ladder STEPS, never pulls (rules file step-up.md). */
	unit: "pulls" | "steps"
	id: number
	name: string
	/** The banner's window, predicted until the game announces it. */
	start_date: string | null
	end_date: string | null
	predicted: boolean
	status: "upcoming" | "running" | "ended"
	/** Its planners, of everyone with a plan: 0 to 1. */
	share: number
	average: number
	/** The middle planner's figure: the "typical" column. */
	median: number
	/**
	 * How planners spread their pulls (steps on a step-up): `shares[i]` plan
	 * from `edges[i]` up to the next edge, the last open. Null for a banner
	 * with no sane row.
	 */
	spread?: { edges: number[]; shares: number[] } | null
	/** The three running or upcoming banners most often in the same plans: `share` of this banner's planners. */
	also?: Array<{ type: PlannedBannerType; id: number; name: string; share: number }>
}

export interface DemandMonth {
	/** "2026-11", or "Later" for everything past the listed months and anything undated. */
	month: string
	/** This month's share of every planned pull. */
	share: number
}

export interface PullPlanRankingsPayload {
	generated_at: string
	banners: PlannedBannerRank[]
	demand: DemandMonth[]
	/** "<type>-<id>" by planners at the start of the week, for rank movement (api #193). */
	previous?: { generated_at: string; banners: string[] } | null
}
