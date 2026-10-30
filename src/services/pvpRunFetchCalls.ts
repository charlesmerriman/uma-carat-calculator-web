/**
 * The CM Runs view's routes: a signed-in player's logged results for one
 * event. Shapes and refusals: backend/docs/api-reference.md ("/pvp-runs").
 *
 * A run is addressed by its slot (a day's ticket, or the final), never by an
 * id, so the first save of a ticket creates it and every later save writes
 * the same row. Returns the raw Response, like the other fetch modules;
 * services/pvpRunQueries.ts decides what a failure means.
 */
import { authHeaders } from "./authToken"
import type { PvpRunContent, PvpRunSlot } from "../types/pvpRun"
import type { PvpEventRef } from "../utils/pvpEvent"

const API_URL = import.meta.env.VITE_API_URL

const jsonHeaders = (): HeadersInit => ({
	"Content-Type": "application/json",
	...authHeaders(),
})

function eventPath(ref: PvpEventRef): string {
	return `${API_URL}/pvp-runs/${ref.kind}/${ref.id}`
}

function slotPath(ref: PvpEventRef, slot: PvpRunSlot): string {
	return slot.stage === "final"
		? `${eventPath(ref)}/final`
		: `${eventPath(ref)}/day/${slot.day}/ticket/${slot.ticket}`
}

/** Every run the player logged, in every event: the Collection's CM history. */
export function pvpRunHistoryFetch(): Promise<Response> {
	return fetch(`${API_URL}/pvp-runs`, { method: "GET", headers: jsonHeaders() })
}

export function pvpRunsFetch(ref: PvpEventRef): Promise<Response> {
	return fetch(eventPath(ref), { method: "GET", headers: jsonHeaders() })
}

/** Write one slot whole; the server creates the row on the first save. */
export function pvpRunPut(ref: PvpEventRef, slot: PvpRunSlot, content: PvpRunContent): Promise<Response> {
	return fetch(slotPath(ref, slot), { method: "PUT", headers: jsonHeaders(), body: JSON.stringify(content) })
}

/** Clear one slot. A 204 whether or not anything was logged there. */
export function pvpRunDelete(ref: PvpEventRef, slot: PvpRunSlot): Promise<Response> {
	return fetch(slotPath(ref, slot), { method: "DELETE", headers: jsonHeaders() })
}
