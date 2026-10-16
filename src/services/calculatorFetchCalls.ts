/**
 * API fetch calls for calculator data.
 *
 * TYPESCRIPT CONCEPT: Typing API Boundaries
 *
 * API calls are where type safety matters most, because they're where
 * your app meets the outside world. The data coming back from fetch()
 * is untyped — TypeScript has no way to verify the server actually
 * returns what you say it does.
 *
 * We handle this in two ways:
 * 1. Type the PARAMETERS going out (so we don't send garbage to the server)
 * 2. Type the RESPONSE with CalculatorData (so the rest of the app has types)
 *
 * The response typing is technically a "trust me" assertion — if the server
 * changes its response shape, TypeScript won't catch it. For stronger
 * guarantees, you'd use a runtime validator like Zod. But for a project
 * where you control both ends, this is standard practice.
 */

import { plannedBannerTarget } from "../utils/bannerHelpers"
import { authHeaders, getAuthToken } from "./authToken"
import type {
	UserStats,
	PaidCaratUse,
	UserPlannedBanner,
	UserPlannedPurchase,
	UserStepUpSelection
} from "../types"

const API_URL = import.meta.env.VITE_API_URL

/**
 * The shape of each planned banner when sent TO the server.
 * Note this differs from UserPlannedBanner — when sending data,
 * we only send the FK ids (number | null), not the full nested objects.
 *
 * TYPESCRIPT CONCEPT: Separate Types for Request vs Response
 * The server sends us full nested objects (BannerUma with all fields),
 * but we send back just the id. These are different shapes, so they
 * deserve different types. Don't try to make one type serve both roles.
 */
export interface PlannedBannerPayload {
	id?: number
	number_of_pulls: number
	reserved_copies: number
	/** Absent on a row that never had one; the server defaults it to "". */
	note?: string
	/** Absent or null: the default card / two-card odds off. */
	primary_card?: number | null
	second_card?: number | null
	/** Absent or null: the default target for the banner type. */
	primary_target?: number | null
	/** The row options; each absent means its default (see UserPlannedBanner). */
	tickets_to_use?: number | null
	paid_carat_use?: PaidCaratUse | null
	pulls_already_made?: number
	excluded_from_projection?: boolean
	banner_uma: number | null
	banner_support: number | null
	banner_step_up: number | null
}

/**
 * A planned purchase on the way out. Closer to its response shape than planned
 * banners are to theirs — the server already sends `product` as an id, because
 * the client holds the whole campaign catalogue and joins on it.
 */
export interface PlannedPurchasePayload {
	id?: number
	product: number
	quantity: number
	target_uma: number | null
	target_support: number | null
}

/**
 * A step-up card selection on the way out.
 *
 * NOTE THE ABSENT `id`, and that it is absent on purpose rather than optional.
 * This is the only collection carrying a UNIQUE constraint
 * (user, banner_step_up, slot). The server's reconcile updates id-carrying rows
 * ONE AT A TIME, so moving a card from slot 3 to slot 4 while slot 4 is also
 * being rewritten transiently duplicates slot 4 and trips the constraint.
 * Sending every row id-less makes the reconcile a delete-all-then-create, which
 * cannot collide — and a selection's content IS its identity, so there is
 * nothing to preserve across the replace.
 * → backend/docs/api-reference.md
 */
export interface StepUpSelectionPayload {
	banner_step_up: number
	uma: number | null
	support: number | null
	slot: number
	is_target: boolean
}

/**
 * Converts planned banners from response shape (nested objects) to request
 * shape (FK ids), dropping client-only fields (tempId) and empty rows.
 *
 * A pure function rather than provider-internal logic because the guest
 * migration flow needs to run it on data that isn't in React state yet
 * (banners fresh off the GET response). Saved banners keep their `id` —
 * that's what tells the PATCH endpoint to preserve rather than delete them.
 */
export function toBannerPayload(
	banners: UserPlannedBanner[]
): PlannedBannerPayload[] {
	return banners
		// Rows with no banner chosen yet are dropped — the server requires
		// exactly one target. Asked through the shared helper rather than by
		// listing the FKs here: a row whose kind this file did not know about
		// failed the old two-FK test and was silently discarded from EVERY save
		// path (autosave, the Navbar save, guest migration), so the row worked
		// perfectly until the next reload and then vanished.
		.filter((plannedBanner) => plannedBannerTarget(plannedBanner).type !== "Empty")
		.map((plannedBanner) => {
			const { tempId: _tempId, ...rest } = plannedBanner
			const target = plannedBannerTarget(plannedBanner)
			return {
				...rest,
				banner_uma: target.type === "Uma" ? target.banner.id : null,
				banner_support: target.type === "Support" ? target.banner.id : null,
				banner_step_up: target.type === "StepUp" ? target.banner.id : null,
			}
		})
}

/**
 * Same conversion for planned purchases. Rows whose product has gone away are
 * dropped rather than sent — the server would reject the whole PATCH, taking
 * the rest of the user's plan down with it.
 */
export function toPurchasePayload(
	purchases: UserPlannedPurchase[]
): PlannedPurchasePayload[] {
	return purchases
		.filter((purchase) => purchase.product && purchase.quantity > 0)
		.map((purchase) => {
			const { tempId: _tempId, ...rest } = purchase
			return {
				...rest,
				target_uma: purchase.target_uma ?? null,
				target_support: purchase.target_support ?? null
			}
		})
}

/**
 * Same conversion for step-up selections. Drops the server-issued `id` (see
 * StepUpSelectionPayload) and any row whose card has gone away — a row with
 * neither FK set fails the server's exactly_one_selection_card constraint and
 * would 400 the whole PATCH, taking the rest of the plan with it.
 */
export function toStepUpSelectionPayload(
	selections: UserStepUpSelection[]
): StepUpSelectionPayload[] {
	return selections
		.filter((selection) => selection.uma !== null || selection.support !== null)
		.map((selection) => ({
			banner_step_up: selection.banner_step_up,
			uma: selection.uma ?? null,
			support: selection.support ?? null,
			slot: selection.slot,
			is_target: selection.is_target
		}))
}

/**
 * `planId` says which plan the banner rows belong to, and it must be the plan
 * those rows were LOADED from, never "whichever is active now".
 *
 * The server deletes every banner row the body does not name. Auto-save fires
 * five seconds after the last edit, so without an explicit id this sequence
 * loses data: edit plan A, switch to plan B three seconds later, timer fires
 * with A's rows. Written to "the active plan", A's rows land in B and B's own
 * rows are deleted. With A's id in the body they land in A.
 *
 * `null` omits the key, which the server reads as "the active plan". That is
 * right in exactly one case: an API from before plans existed (it sent no
 * `active_plan_id`, so there is no id to send and only one plan to mean).
 *
 * A COLLECTION passed as `null` is omitted too, and the server then leaves it
 * alone (an absent key is "not part of this save"; `[]` is "delete every
 * row"). Auto-save always sends all three. The one caller that omits any is
 * the sign-in import (guestPlanImport.ts), which adds rows to a new plan and
 * must not touch purchases it never loaded.
 */
export function userCalculatorDataPatch(
	planId: number | null,
	userStatsData: UserStats | null,
	userPlannedBannerData: PlannedBannerPayload[] | null,
	userPlannedPurchaseData: PlannedPurchasePayload[] | null,
	userStepUpSelectionData: StepUpSelectionPayload[] | null
): Promise<Response> {
	return fetch(`${API_URL}/calculator-data`, {
		method: "PATCH",
		headers: {
			"Content-Type": "application/json",
			...authHeaders()
		},
		body: JSON.stringify({
			...(planId !== null ? { plan_id: planId } : {}),
			user_stats_data: userStatsData,
			...(userPlannedBannerData !== null
				? { user_planned_banner_data: userPlannedBannerData }
				: {}),
			...(userPlannedPurchaseData !== null
				? { user_planned_purchase_data: userPlannedPurchaseData }
				: {}),
			...(userStepUpSelectionData !== null
				? { user_step_up_selection_data: userStepUpSelectionData }
				: {})
		})
	})
}

/**
 * TYPESCRIPT CONCEPT: Return Type Annotations on Exported Functions
 *
 * We explicitly annotate the return type as Promise<Response> rather than
 * letting TypeScript infer it. For exported functions, explicit return types:
 *   1. Serve as documentation (you can see what it returns without reading the body)
 *   2. Catch accidental changes (if you refactor and accidentally return
 *      something different, the type annotation flags the error immediately)
 *   3. Speed up type checking (the compiler doesn't have to trace through the body)
 */
export function initialCalculatorDataFetch(signal?: AbortSignal): Promise<Response> {
	const early = takePrefetchedCalculatorData()
	if (early) return early

	return fetch(`${API_URL}/calculator-data`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			...authHeaders()
		},
		signal
	})
}

/* ---------------------------------------------------------------------------
 * The loading gate's deadline
 *
 * Nothing under /app renders until /calculator-data lands, and a fetch has no
 * deadline of its own: when the API is queued behind a banner-launch crowd the
 * request just waits, and the page shows a spinner until Cloudflare gives up
 * about 100 s later. To a visitor that looks the same as the site being down
 * (2026-09-23 and 2026-10-14). A request that fails after 20 s with a "try
 * again" button is a much better experience than one that never answers.
 * ------------------------------------------------------------------------- */

/** How long /app waits for the catalogue before offering a retry. */
export const CALCULATOR_DATA_TIMEOUT_MS = 20_000

/** The deadline passed. Named so the provider can tell it from an abort. */
export class CalculatorDataTimeout extends Error {
	constructor(ms: number) {
		super(`calculator-data took longer than ${ms} ms`)
		this.name = "CalculatorDataTimeout"
	}
}

/**
 * `work`, or a CalculatorDataTimeout if it has not settled within `ms`. On a
 * timeout `controller` is aborted too, so the request stops instead of
 * finishing unseen.
 *
 * WHY A RACE AND NOT `AbortSignal.timeout()` ON THE FETCH: the request the
 * provider waits on is often the home page's PREFETCH (below), which was
 * started without the provider's signal, so a signal on the provider's own
 * fetch would never reach it. The race covers whichever request it turns out
 * to be, and the body download as well as the headers. It also avoids
 * `AbortSignal.any()`, which iPhones older than iOS 17.4 lack.
 */
export function withDeadline<T>(
	work: Promise<T>,
	ms: number,
	controller: AbortController
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	const deadline = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			// Reject BEFORE aborting: the abort makes `work` reject too, and the
			// race must settle on the timeout, not on the AbortError it causes.
			reject(new CalculatorDataTimeout(ms))
			controller.abort()
		}, ms)
	})
	return Promise.race([work, deadline]).finally(() => clearTimeout(timer))
}

/* ---------------------------------------------------------------------------
 * Prefetching /calculator-data
 *
 * Nothing under /app renders until this request lands, so the wait is the whole
 * cost of moving from the home page into the calculator. The home page itself
 * needs none of it — so it starts the request while the user is still reading,
 * and by the time they click through, the response is usually already here.
 *
 * The result is kept as the in-flight PROMISE rather than parsed data, so a
 * consumer arriving mid-flight waits on the same request instead of starting a
 * second one.
 * ------------------------------------------------------------------------- */

interface PrefetchRecord {
	promise: Promise<Response>
	/** The auth token as it stood when the request went out. */
	token: string | null
	startedAt: number
}

let prefetched: PrefetchRecord | null = null

/**
 * How long a prefetched payload may be handed out. Someone who leaves the home
 * page open and comes back an hour later should get fresh data, not whatever
 * the catalogue looked like when the tab was opened.
 */
const PREFETCH_MAX_AGE_MS = 5 * 60 * 1000

function prefetchIsUsable(record: PrefetchRecord): boolean {
	// The token check is the important one, and it is about correctness rather
	// than freshness. The usual path into the app is: browse as a guest (we
	// prefetch, and the server answers "no saved plan"), sign in, land on /app.
	// Serving that guest response afterwards would show a signed-in user an
	// EMPTY PLAN — their saved banners apparently gone. A token that has
	// changed in either direction (signed in, signed out, or swapped accounts)
	// invalidates the prefetch.
	if (record.token !== getAuthToken()) return false
	return Date.now() - record.startedAt < PREFETCH_MAX_AGE_MS
}

/**
 * Start fetching /calculator-data ahead of the calculator being opened.
 *
 * Safe to call repeatedly — a usable request already in flight is left alone
 * rather than duplicated, so wiring it to a hover handler costs nothing.
 */
export function prefetchCalculatorData(): void {
	if (prefetched && prefetchIsUsable(prefetched)) return

	const promise = fetch(`${API_URL}/calculator-data`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			...authHeaders()
		}
	})

	// Attaching a handler here marks the rejection as handled, so a prefetch
	// that fails with nobody yet waiting on it doesn't surface as an unhandled
	// promise rejection in the console. It does NOT swallow the error for real
	// consumers: `promise` itself still rejects, and initialCalculatorDataFetch's
	// caller has its own catch. A failed prefetch is also dropped, so the
	// provider falls through to a normal fetch rather than inheriting the
	// failure.
	promise.catch(() => {
		prefetched = null
	})

	prefetched = {
		promise,
		token: getAuthToken(),
		startedAt: Date.now()
	}
}

/**
 * The prefetched response, or null if there isn't a usable one.
 *
 * Hands out a CLONE and never the original. A Response body can only be read
 * once, and this may legitimately be consumed more than once — React's
 * StrictMode double-invokes the provider's mount effect in development, and the
 * stale-token path re-fetches after a 401. Cloning keeps the stored response
 * unread so every consumer gets a readable body of its own.
 */
function takePrefetchedCalculatorData(): Promise<Response> | null {
	if (!prefetched || !prefetchIsUsable(prefetched)) {
		prefetched = null
		return null
	}
	return prefetched.promise.then((response) => response.clone())
}

/**
 * Forget any in-flight or completed prefetch. A test seam, and what the
 * loading gate's "Try again" calls first, so a prefetch that failed or hung
 * is never handed out a second time.
 */
export function resetCalculatorDataPrefetch(): void {
	prefetched = null
}