/**
 * The /plans routes: create, rename, switch, copy, share and delete a
 * signed-in user's pull plans, plus a shared plan's two public routes (its
 * summary, and taking a copy). Shapes and status codes:
 * backend/docs/api-reference.md ("Plans", "Share links").
 *
 * Banner ROWS are not saved here. They still go through
 * userCalculatorDataPatch (calculatorFetchCalls.ts) with a `planId`, because
 * the auto-save sends stats, banners, purchases and selections as one
 * transaction on the server.
 *
 * Every call returns the raw Response, like the rest of the fetch modules, so
 * the provider decides what a failure means.
 */
import { authHeaders } from "./authToken"
import type { PlanSharingChanges } from "../types"

const API_URL = import.meta.env.VITE_API_URL

const jsonHeaders = (): HeadersInit => ({
	"Content-Type": "application/json",
	...authHeaders()
})

/** One plan and its rows. What a switch fetches, instead of the ~1 MB catalogue. */
export function planFetch(planId: number): Promise<Response> {
	return fetch(`${API_URL}/plans/${planId}`, {
		method: "GET",
		headers: jsonHeaders()
	})
}

/**
 * A new plan, blank or copied from another of the caller's plans. The server
 * creates it INACTIVE; switching to it is a separate planActivate call, made
 * after the pending save for the plan being left has been flushed.
 */
export function planCreate(name: string, copyFromId?: number): Promise<Response> {
	return fetch(`${API_URL}/plans`, {
		method: "POST",
		headers: jsonHeaders(),
		body: JSON.stringify({
			name,
			...(copyFromId !== undefined ? { copy_from: copyFromId } : {})
		})
	})
}

export function planRename(planId: number, name: string): Promise<Response> {
	return fetch(`${API_URL}/plans/${planId}`, {
		method: "PATCH",
		headers: jsonHeaders(),
		body: JSON.stringify({ name })
	})
}

/**
 * Makes this the plan the calculator opens on next time. There is no
 * deactivate: an account always has one active plan, so the way to leave a
 * plan is to activate another.
 */
export function planActivate(planId: number): Promise<Response> {
	return fetch(`${API_URL}/plans/${planId}`, {
		method: "PATCH",
		headers: jsonHeaders(),
		body: JSON.stringify({ is_active: true })
	})
}

/**
 * Give this plan its own resources and income settings (`on`), or send it back
 * to the account's (`off`). The server seeds the new copy from the stats the
 * plan reads today and answers with the Plan only; the provider follows up
 * with planFetch for the stats, the same path a switch uses.
 */
export function planSetSeparateIncome(planId: number, on: boolean): Promise<Response> {
	return fetch(`${API_URL}/plans/${planId}`, {
		method: "PATCH",
		headers: jsonHeaders(),
		body: JSON.stringify({ separate_income: on })
	})
}

/**
 * The owner's share settings for a plan: the link on or off, and what a copy
 * carries. Answers with the Plan (the provider replaces its copy in `plans`).
 */
export function planSetSharing(planId: number, changes: PlanSharingChanges): Promise<Response> {
	return fetch(`${API_URL}/plans/${planId}`, {
		method: "PATCH",
		headers: jsonHeaders(),
		body: JSON.stringify(changes)
	})
}

/** "Reset link": a new public_id, so the old link stops working. Answers with the Plan. */
export function planResetLink(planId: number): Promise<Response> {
	return fetch(`${API_URL}/plans/${planId}`, {
		method: "PATCH",
		headers: jsonHeaders(),
		body: JSON.stringify({ regenerate_public_id: true })
	})
}

/**
 * A shared plan's summary for the landing card. Public, so it works without a
 * token; one is still sent when there is one, which only changes whose rate
 * limit it counts against. 404 when the link is wrong or sharing is off.
 */
export function sharedPlanSummaryFetch(publicId: string): Promise<Response> {
	return fetch(`${API_URL}/plans/public/${encodeURIComponent(publicId)}`, {
		method: "GET",
		headers: jsonHeaders()
	})
}

/**
 * Take a copy of a shared plan. With a token: `{ name }`, and the answer is a
 * new plan in the account, created inactive, as a PlanWithRows. Without one:
 * `{ include_stats }`, and the answer is a SharedPlanCopy for the device store,
 * carrying the owner's stats only when they shared them AND this is true.
 * Which one the server does follows the token, so the caller must only call
 * this in the mode its tab loaded in (CalculatorProvider's loadedAsRef).
 */
export function sharedPlanCopy(
	publicId: string,
	body: { name: string } | { include_stats: boolean }
): Promise<Response> {
	return fetch(`${API_URL}/plans/public/${encodeURIComponent(publicId)}/copy`, {
		method: "POST",
		headers: jsonHeaders(),
		body: JSON.stringify(body)
	})
}

/** Resolves to `{ active_plan_id }`: where the account landed afterwards. */
export function planDelete(planId: number): Promise<Response> {
	return fetch(`${API_URL}/plans/${planId}`, {
		method: "DELETE",
		headers: jsonHeaders()
	})
}
