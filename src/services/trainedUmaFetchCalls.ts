/**
 * The Collection page's routes: a signed-in player's veterans. Shapes and
 * refusals: backend/docs/api-reference.md ("/trained-umas"). Raw Responses,
 * like the other fetch modules; services/trainedUmaQueries.ts reads them.
 */
import { authHeaders } from "./authToken"
import type { VeteranInput } from "../types/trainedUma"

const API_URL = import.meta.env.VITE_API_URL

const jsonHeaders = (): HeadersInit => ({
	"Content-Type": "application/json",
	...authHeaders(),
})

export function trainedUmasFetch(): Promise<Response> {
	return fetch(`${API_URL}/trained-umas`, { method: "GET", headers: jsonHeaders() })
}

export function trainedUmaCreate(input: VeteranInput): Promise<Response> {
	return fetch(`${API_URL}/trained-umas`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify(input) })
}

/** Only what is sent changes. A veteran from the game takes `label` only. */
export function trainedUmaPatch(id: number, changes: Partial<VeteranInput>): Promise<Response> {
	return fetch(`${API_URL}/trained-umas/${id}`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify(changes) })
}

export function trainedUmaDelete(id: number): Promise<Response> {
	return fetch(`${API_URL}/trained-umas/${id}`, { method: "DELETE", headers: jsonHeaders() })
}

/**
 * Write a game export's veterans: update by the game's id, add new ones, and
 * remove the ones not in `items` unless a logged run links them. The items are
 * built in the browser from the player's file (utils/gameImport); the file
 * itself is never sent.
 */
export function trainedUmaImport(items: unknown[]): Promise<Response> {
	return fetch(`${API_URL}/trained-umas/import`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ items }) })
}

