/**
 * The Encyclopedia's uma and card pages as server state (TanStack Query).
 *
 * WHY A QUERY CACHE: a page is "data by id", reached from a list, a search, a
 * skill and another page, and Back should be instant. Keyed
 * ["encyclopedia", kind, gameId], so every reader of one page shares one
 * request. The skill LIST keeps its module-level promise (skillsFetchCalls.ts):
 * the guide editor shares it.
 *
 * Early access only: the fetch sends the token, and the API answers 401 / 403
 * to anyone else. The QueryProvider resets every query on a sign-in change.
 */

import { useQuery } from "@tanstack/react-query"
import { authHeaders } from "./authToken"
import { HttpError } from "./queryClient"
import { fetchSkillDetail } from "./skillsFetchCalls"
import type { CardEffectsData, CardPageData, UmaPageData } from "../types/encyclopedia"

const API_URL = import.meta.env.VITE_API_URL

export const encyclopediaKeys = {
	uma: (gameId: number) => ["encyclopedia", "uma", gameId] as const,
	card: (gameId: number) => ["encyclopedia", "card", gameId] as const,
	skill: (gameId: number) => ["encyclopedia", "skill", gameId] as const,
	cardEffects: ["encyclopedia", "card-effects"] as const,
}

/** One page, or null when the API has no such page (404). */
async function fetchPage<T>(path: string): Promise<T | null> {
	const response = await fetch(`${API_URL}${path}`, { method: "GET", headers: authHeaders() })
	if (response.status === 404) return null
	if (!response.ok) throw new HttpError(response.status, "This page didn't load.")
	return (await response.json()) as T
}

/** Asks only while `gameId` is a real id. */
export function useUmaPage(gameId: number | null) {
	return useQuery({
		queryKey: encyclopediaKeys.uma(gameId ?? 0),
		enabled: gameId !== null,
		queryFn: () => fetchPage<UmaPageData>(`/encyclopedia/umas/${gameId}`),
	})
}

/** One skill's page, through the fetch the guide editor already uses. */
export function useSkillPage(gameId: number | null) {
	return useQuery({
		queryKey: encyclopediaKeys.skill(gameId ?? 0),
		enabled: gameId !== null,
		queryFn: () => fetchSkillDetail(gameId as number),
	})
}

export function useCardPage(gameId: number | null) {
	return useQuery({
		queryKey: encyclopediaKeys.card(gameId ?? 0),
		enabled: gameId !== null,
		queryFn: () => fetchPage<CardPageData>(`/encyclopedia/cards/${gameId}`),
	})
}

/**
 * Every card's effects, for the card list's "By effect" sort. Asked only
 * once that sort is picked (`enabled`), so nobody else downloads it.
 */
export function useCardEffects(enabled: boolean) {
	return useQuery({
		queryKey: encyclopediaKeys.cardEffects,
		enabled,
		queryFn: () => fetchPage<CardEffectsData>("/encyclopedia/card-effects"),
		// The game data changes at a release, not while a list is open.
		staleTime: 30 * 60 * 1000,
	})
}
