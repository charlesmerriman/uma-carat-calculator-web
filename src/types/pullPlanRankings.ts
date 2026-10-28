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
	/**
	 * How planners spread their pulls (steps on a step-up): `planners[i]`
	 * plan from `edges[i]` up to the next edge, the last open. Null for a
	 * banner with no sane row; absent before api #192.
	 */
	spread?: { edges: number[]; planners: number[] } | null
	/** The three running or upcoming banners most often in the same plans, by people. */
	also?: Array<{ type: PlannedBannerType; id: number; name: string; planners: number }>
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
	/**
	 * Everyone with any banner in their active plan, each once: a row's
	 * share is out of this (api #191). Optional: an hour-old cached payload
	 * from before that release has none, and the shares wait for it.
	 */
	planners?: number
	banners: PlannedBannerRank[]
	demand: DemandMonth[]
}
