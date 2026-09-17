/**
 * A named pull plan: a list of planned banner rows, and nothing else.
 *
 * A PLAN HOLDS CHOICES. THE ACCOUNT HOLDS FACTS. Carats, tickets, ranks, the
 * income toggles, planned purchases and step-up picks all belong to the
 * account and are the same whichever plan is open. Only the banner rows change
 * on a switch. That is why the projection engine (useBannerResources) needed no
 * change for plans: it reads the same `userPlannedBannerData` it always did,
 * which now means "the active plan's rows".
 *
 * Full reasoning, including why this makes a plan safe to copy between
 * accounts later: backend/docs/data-model.md ("`Plan`").
 *
 * A guest has one unnamed plan in memory, so for a guest `plans` is `[]` and
 * `activePlanId` is `null`. That pair is how the UI knows to hide the switcher.
 */
import type { UserPlannedBanner } from "./user"

export interface Plan {
	id: number
	name: string
	is_active: boolean
	/** ISO instant. Moves on rename, on activate, and when the rows are saved. */
	updated_at: string
}

/** POST /plans and GET /plans/<id>: a plan together with its banner rows. */
export interface PlanWithRows {
	plan: Plan
	/** Shaped and ordered exactly like the same key on GET /calculator-data. */
	user_planned_banner_data: UserPlannedBanner[]
}

/**
 * The most plans an account can hold. Mirrors PLAN_CAP in the backend's
 * models/plan.py, which is the one that is enforced; this copy only lets the
 * UI disable "New plan" up front instead of offering a button that 400s.
 */
export const PLAN_CAP = 5

/** Matches Plan.name's max_length on the server. */
export const PLAN_NAME_MAX_LENGTH = 40
