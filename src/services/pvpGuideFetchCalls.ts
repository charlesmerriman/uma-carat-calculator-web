/**
 * GET /pvp-guides/<kind>/<event_id>: one event's PvP guide.
 *
 * Public; the auth header rides along so a signed-in STAFF account gets a
 * draft (`is_published: false`) to preview. Everyone else gets 404 for a
 * draft, the same as for an event with no guide. Same raw-Response convention
 * as the other *FetchCalls modules: the caller checks `.ok` and parses.
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
