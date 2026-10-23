/**
 * GET /skills and GET /skills/<game_id>. Public, cached by the API.
 *
 * The list is fetched once per page load and shared through a module-level
 * promise, like the PvP catalogue (pvpTeamFetchCalls.ts): the guide editor and
 * the Skills page both read it, and a second reader costs no request. A failed
 * fetch is retried by the next caller.
 */

import type { SkillDetailData, SkillListRow } from "../types/skills"

const API_URL = import.meta.env.VITE_API_URL

let listPromise: Promise<SkillListRow[]> | null = null

export function loadSkillList(): Promise<SkillListRow[]> {
	if (!listPromise) {
		listPromise = fetch(`${API_URL}/skills`, { method: "GET" })
			.then(async (response) => {
				if (!response.ok) throw new Error(`GET /skills failed: ${response.status}`)
				return (await response.json()) as SkillListRow[]
			})
			.catch((error: unknown) => {
				listPromise = null
				throw error
			})
	}
	return listPromise
}

/** One skill in full; null when the API has no shown skill of that id (404). */
export async function fetchSkillDetail(gameId: number): Promise<SkillDetailData | null> {
	const response = await fetch(`${API_URL}/skills/${gameId}`, { method: "GET" })
	if (response.status === 404) return null
	if (!response.ok) throw new Error(`GET /skills/${gameId} failed: ${response.status}`)
	return (await response.json()) as SkillDetailData
}

/** For tests: forget the shared list. */
export function resetSkillListForTests(): void {
	listPromise = null
}
