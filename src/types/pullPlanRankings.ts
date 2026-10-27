/**
 * GET /rankings/pull-plans (backend views/rankings.py): the admin
 * analytics' banner tables and demand by month, hourly.
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
	planners: number
	total: number
	average: number
	/** The middle planner's figure: the "typical" column. */
	median: number
}

export interface DemandMonth {
	/** "2026-11", or "Later" for everything past the listed months and anything undated. */
	month: string
	banners: number
	planners: number
	total_pulls: number
	excluded: number
	step_up_planners: number
}

export interface PullPlanRankingsPayload {
	generated_at: string
	banners: PlannedBannerRank[]
	demand: DemandMonth[]
}
