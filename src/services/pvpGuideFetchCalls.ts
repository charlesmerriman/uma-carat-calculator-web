/**
 * GET /pvp-guides/<kind>/<event_id>: one event's PvP guide.
 *
 * The auth header rides along so a signed-in STAFF account gets a Private
 * guide to preview and an early-access account a Supporters one. Everyone
 * else gets 404 for a Private guide (the same as no guide) and 403 for a
 * Supporters one (guide-visibility-plan.md). Same raw-Response convention as
 * the other *FetchCalls modules: the caller checks `.ok` and parses.
 */
import { authHeaders } from "./authToken"
import type { PvpEventRef } from "../utils/pvpEvent"

const API_URL = import.meta.env.VITE_API_URL

export function pvpGuideFetch(ref: PvpEventRef, signal?: AbortSignal): Promise<Response> {
	return fetch(`${API_URL}/pvp-guides/${ref.kind}/${ref.id}`, {
		method: "GET",
		headers: authHeaders(),
		signal,
	})
}
