/**
 * A named pull plan: a list of planned banner rows, and nothing else.
 *
 * A PLAN HOLDS CHOICES. THE ACCOUNT HOLDS FACTS. Carats, tickets, ranks, the
 * income toggles, planned purchases and step-up picks all belong to the
 * account, never to the plan. Step-up picks are the same whichever plan is
 * open. The stats (`userStatsData`) and the planned purchases
 * (`userPlannedPurchaseData`) are the OPEN PLAN'S: normally the account's
 * own, but a plan with "separate resources" on reads its own copy of both,
 * for people who plan for more than one game account. Which one is the
 * server's decision (`income_profile_id` says which); the client stores
 * whatever GET /plans/<id> hands it, in the same shape either way. That is why
 * the projection engine (useBannerResources) needed no change for plans: it
 * reads the same `userPlannedBannerData`, `userStatsData` and
 * `userPlannedPurchaseData` it always did, which now mean "the active plan's".
 *
 * Full reasoning, including why this makes a plan safe to copy between
 * accounts later: backend/docs/data-model.md ("`Plan`").
 *
 * A guest has one unnamed plan on their device, so for a guest `plans` is `[]` and
 * `activePlanId` is `null`. That pair is how the UI knows to hide the switcher.
 *
 * SHARING. A plan's owner can switch on a link (`/app/<public_id>`) that lets
 * anyone take a COPY of it. Nobody but the owner ever opens the plan itself:
 * the link leads to a landing card (SharedPlanLanding) whose one action is
 * "copy". Full rules: backend/docs/data-model.md ("Share links").
 */
import type { UserPlannedPurchase } from "./anniversary"
import type { PlannedBannerPayload } from "../services/calculatorFetchCalls"
import type { UserPlannedBanner, UserStats } from "./user"

export interface Plan {
	id: number
	name: string
	is_active: boolean
	/**
	 * Non-null when the plan reads its own stats ("separate resources") rather
	 * than the account's. Read-only; the switch is `separate_income` on the
	 * PATCH route (planSetSeparateIncome). Absent from an API older than this.
	 */
	income_profile_id?: number | null
	/**
	 * The share link's id, 8 letters or digits. Exists from the plan's birth
	 * whether or not sharing is on; "Reset link" replaces it. The five sharing
	 * fields are optional for the same reason as income_profile_id: an API
	 * older than sharing omits them, and the share face then stays hidden.
	 */
	public_id?: string
	/** The link answers only while this is on. Off by default. */
	is_shared?: boolean
	/** A copy starts with the owner's carats, tickets and ranks. Off by default. */
	share_stats?: boolean
	/** A copy keeps the notes on the rows. Off by default. */
	share_notes?: boolean
	/** Copies taken through the link. Read-only. */
	copy_count?: number
	/** ISO instant. Moves on rename, on activate, and when the rows are saved. */
	updated_at: string
}

/** The three share settings the owner can change (PATCH /plans/<id>). */
export type PlanSharingChanges = Partial<Pick<Plan, "is_shared" | "share_stats" | "share_notes">>

/**
 * GET /plans/public/<public_id>: what the landing card shows before a copy.
 * Catalogue ids and counts only. No pull counts, notes, stats, plan id, plan
 * name or owner ever reach a viewer; the card resolves the ids against the
 * catalogue the app already holds.
 */
export interface SharedPlanSummary {
	public_id: string
	/** ISO instant: the last time the owner changed the plan. */
	updated_at: string
	copy_count: number
	/** Whether a copy comes with the owner's resources and notes. */
	share_stats: boolean
	share_notes: boolean
	row_count: number
	/** In the owner's order. Exactly one id is set on each. */
	rows: { banner_uma: number | null; banner_support: number | null; banner_step_up: number | null }[]
}

/** What the copier chose on the landing card. */
export interface SharedPlanCopyOptions {
	/** Signed in only: what to call the new plan. */
	name?: string
	/**
	 * Guest only: take the owner's carats, tickets and ranks too, replacing the
	 * guest's own. Off unless the guest ticks it, even when the owner shared
	 * them: a device holds one set of stats, and losing yours is your call.
	 */
	includeStats?: boolean
}

/**
 * POST /plans/public/<public_id>/copy WITHOUT an account: the plan to keep on
 * the device, in the device store's shape (ids, no row id). A signed-in copy
 * answers with a PlanWithRows instead, the way POST /plans does.
 */
export interface SharedPlanCopy {
	/** `note` is present only when the owner shares notes. */
	user_planned_banner_data: PlannedBannerPayload[]
	/** The owner's stats when they share them AND the guest asked, else null. */
	user_stats_data: UserStats | null
}

/** POST /plans and GET /plans/<id>: a plan together with its banner rows. */
export interface PlanWithRows {
	plan: Plan
	/**
	 * THIS plan's stats, shaped exactly like the same key on GET
	 * /calculator-data. Optional only because an API from before separate
	 * resources existed omits it; the provider then keeps what is on screen.
	 */
	user_stats_data?: UserStats
	/** Shaped and ordered exactly like the same key on GET /calculator-data. */
	user_planned_banner_data: UserPlannedBanner[]
	/**
	 * THIS plan's purchases: the ones of the same stats block `user_stats_data`
	 * came from. Optional because an API from before purchases followed the
	 * profile omits it; the provider then keeps what is on screen.
	 */
	user_planned_purchase_data?: UserPlannedPurchase[]
}

/**
 * The most plans an account can hold. Mirrors PLAN_CAP in the backend's
 * models/plan.py, which is the one that is enforced; this copy only lets the
 * UI disable "New plan" up front instead of offering a button that 400s.
 */
export const PLAN_CAP = 5

/** Matches Plan.name's max_length on the server. */
export const PLAN_NAME_MAX_LENGTH = 40
