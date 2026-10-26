/**
 * The Collection's Umas and Support cards routes. Shapes and refusals:
 * backend/docs/api-reference.md ("/roster"). Raw Responses, like the other
 * fetch modules; services/rosterQueries.ts reads them.
 */
import { authHeaders } from "./authToken"
import { gzipText } from "./gzipBody"
import type { RosterChanges, RosterList } from "../types/roster"

const API_URL = import.meta.env.VITE_API_URL

const jsonHeaders = (): HeadersInit => ({
	"Content-Type": "application/json",
	...authHeaders(),
})

export function rosterFetch(): Promise<Response> {
	return fetch(`${API_URL}/roster`, { method: "GET", headers: jsonHeaders() })
}

/** Grid edits: every change applies or none does. */
export function rosterPatch(changes: RosterChanges): Promise<Response> {
	return fetch(`${API_URL}/roster`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify(changes) })
}

/**
 * A game export's umas and/or cards, gzipped where the browser can. Each list
 * sent REPLACES that list on the account; a list left out is untouched.
 */
export async function rosterImport(body: { umas?: unknown[]; support_cards?: unknown[] }): Promise<Response> {
	const text = JSON.stringify(body)
	const packed = await gzipText(text)
	return fetch(`${API_URL}/roster/import`, {
		method: "POST",
		headers: packed ? { ...jsonHeaders(), "Content-Encoding": "gzip" } : jsonHeaders(),
		body: packed ?? text,
	})
}

/** Start over: empty one list. */
export function rosterClear(list: RosterList): Promise<Response> {
	const path = list === "umas" ? "umas" : "support-cards"
	return fetch(`${API_URL}/roster/${path}`, { method: "DELETE", headers: jsonHeaders() })
}

