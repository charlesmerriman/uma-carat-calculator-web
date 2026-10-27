/**
 * The PvP team builder's routes: the public catalogue, and a signed-in
 * player's teams. Shapes and refusals: backend/docs/api-reference.md
 * ("GET /pvp-catalogue", "/pvp-teams").
 *
 * The team calls return the raw Response, like the rest of the fetch modules,
 * so PvpTeamsProvider decides what a failure means. The catalogue is the
 * exception: it is fetched once per tab and shared, so it is a cached promise.
 */
import { authHeaders } from "./authToken"
import type { PvpTeamContent, PvpTeamMember, PvpCatalogue, PvpNote } from "../types/pvpTeam"
import type { PvpEventRef } from "../utils/pvpEvent"
import { placeholderOrder, placeholderName } from "../utils/pvpTeams"

const API_URL = import.meta.env.VITE_API_URL

const jsonHeaders = (): HeadersInit => ({
	"Content-Type": "application/json",
	...authHeaders(),
})

let cataloguePromise: Promise<PvpCatalogue> | null = null

/**
 * GET /pvp-catalogue, once per tab. Every picker shares the one promise, so
 * opening a second picker (or the drawer, later) costs nothing. A failure is
 * forgotten, so the next picker to open tries again.
 */
export function loadPvpCatalogue(): Promise<PvpCatalogue> {
	if (!cataloguePromise) {
		cataloguePromise = fetch(`${API_URL}/pvp-catalogue`, { method: "GET" })
			.then(async (response) => {
				if (!response.ok) throw new Error(`GET /pvp-catalogue failed: ${response.status}`)
				const catalogue = (await response.json()) as PvpCatalogue
				// Placeholders take their player-facing name here, once, so every
				// picker, team and gallery post that draws a card name says
				// "Your best SSR Speed card" without knowing about them.
				// They also sort among themselves SSR first, then by type, where
				// the admin's names would put "R Friend" first.
				const placeholders = catalogue.support_cards
					.filter((card) => card.placeholder)
					.sort((a, b) => placeholderOrder(a) - placeholderOrder(b))
					.map((card) => ({ ...card, name: placeholderName(card), title: "" }))
				return {
					...catalogue,
					support_cards: [...placeholders, ...catalogue.support_cards.filter((card) => !card.placeholder)],
				}
			})
			.catch((error: unknown) => {
				cataloguePromise = null
				throw error
			})
	}
	return cataloguePromise
}

export function pvpTeamsFetch(): Promise<Response> {
	return fetch(`${API_URL}/pvp-teams`, { method: "GET", headers: jsonHeaders() })
}

export function pvpTeamCreate(ref: PvpEventRef, content: PvpTeamContent): Promise<Response> {
	return fetch(`${API_URL}/pvp-teams`, {
		method: "POST",
		headers: jsonHeaders(),
		body: JSON.stringify({ kind: ref.kind, event: ref.id, ...content }),
	})
}

/** Replace a team's members and cards, and its notes. */
export function pvpTeamReplace(id: number, members: PvpTeamMember[], notes: PvpNote[]): Promise<Response> {
	return fetch(`${API_URL}/pvp-teams/${id}`, {
		method: "PUT",
		headers: jsonHeaders(),
		body: JSON.stringify({ members, notes }),
	})
}

/** Rename and/or pin. `is_focus: true` moves the account's one pin here. */
export function pvpTeamPatch(id: number, changes: { name?: string; is_focus?: boolean }): Promise<Response> {
	return fetch(`${API_URL}/pvp-teams/${id}`, {
		method: "PATCH",
		headers: jsonHeaders(),
		body: JSON.stringify(changes),
	})
}

export function pvpTeamDelete(id: number): Promise<Response> {
	return fetch(`${API_URL}/pvp-teams/${id}`, { method: "DELETE", headers: jsonHeaders() })
}
