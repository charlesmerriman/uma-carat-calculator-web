/**
 * The Encyclopedia's uma and card pages as server state (TanStack Query).
 *
 * WHY A QUERY CACHE: a page is "data by id", reached from a list, a search, a
 * skill and another page, and Back should be instant. Keyed
 * ["encyclopedia", kind, gameId], so every reader of one page shares one
 * request. The skill LIST keeps its module-level promise (skillsFetchCalls.ts):
 * the guide editor shares it.
 *
 * Public: the API answers the same bytes to everyone. The fetch still sends
 * the token when there is one, as every call does.
 */

import { useQuery, type QueryClient } from "@tanstack/react-query"
import { authHeaders } from "./authToken"
import { HttpError } from "./queryClient"
import { fetchSkillDetail } from "./skillsFetchCalls"
import type { CardEffectsData, CardPageData, UmaPageData } from "../types/encyclopedia"
import type { SkillDetailData } from "../types/skills"
import type { EncyclopediaPageKind, EncyclopediaPageRef } from "../utils/encyclopediaRoutes"

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

/**
 * How long a page counts as fresh. The pages themselves keep the client's
 * default; a hover card (components/hovercards) asks for longer, so hovering
 * the same uma again later in the session reuses what it fetched.
 */
interface PageOptions {
	staleTime?: number
}

/**
 * The id of the JSON block a built detail page carries: its payload as the
 * build rendered it, read back by main.tsx before hydrating. Mirrors
 * PAGE_DATA_ELEMENT_ID in scripts/prerender-html.mjs.
 */
export const PAGE_DATA_ELEMENT_ID = "page-data"

/** The API route listing every detail page there is, by game id per kind (what the build writes). */
export const ENCYCLOPEDIA_INDEX_PATH = "/encyclopedia/index"

/**
 * Where the API serves a detail page's payload. The build fetches each page
 * from here too (scripts/prerender.mjs, through entry-server.ts), so what a
 * built document carries is what the page itself asks for. A skill's is the
 * skills route, which the guide editor shares (skillsFetchCalls.ts).
 */
export function encyclopediaApiPath(kind: EncyclopediaPageKind, gameId: number): string {
	if (kind === "uma") return `/encyclopedia/umas/${gameId}`
	if (kind === "card") return `/encyclopedia/cards/${gameId}`
	return `/skills/${gameId}`
}

// A page's key and fetch, in one place: the hooks below and the prefetch
// must ask the same question to share one cache entry.
const umaPageQuery = (gameId: number) => ({
	queryKey: encyclopediaKeys.uma(gameId),
	queryFn: () => fetchPage<UmaPageData>(encyclopediaApiPath("uma", gameId)),
})
const cardPageQuery = (gameId: number) => ({
	queryKey: encyclopediaKeys.card(gameId),
	queryFn: () => fetchPage<CardPageData>(encyclopediaApiPath("card", gameId)),
})

/**
 * Starts a page's fetch ahead of the component that will read it: the uma and
 * card popup (components/hovercards) calls this on the press, so the page is
 * usually in the cache by the click. Does nothing when a copy younger than
 * `staleTime` is already there, and a failure is left for the hook to report.
 */
export function prefetchEncyclopediaPage(client: QueryClient, kind: "uma" | "card", gameId: number, staleTime: number): void {
	if (kind === "uma") void client.prefetchQuery({ ...umaPageQuery(gameId), staleTime })
	else void client.prefetchQuery({ ...cardPageQuery(gameId), staleTime })
}

const skillPageQuery = (gameId: number) => ({
	queryKey: encyclopediaKeys.skill(gameId),
	queryFn: () => fetchSkillDetail(gameId),
})

function pageQuery(kind: EncyclopediaPageKind, gameId: number) {
	if (kind === "uma") return umaPageQuery(gameId)
	if (kind === "card") return cardPageQuery(gameId)
	return skillPageQuery(gameId)
}

/**
 * A detail page's payload with its kind as the tag, so a reader narrows on
 * `kind`: undefined while it loads, null when the API has no such page.
 */
export type EncyclopediaPageState =
	| { kind: "uma"; data: UmaPageData | null | undefined }
	| { kind: "card"; data: CardPageData | null | undefined }
	| { kind: "skill"; data: SkillDetailData | null | undefined }

/**
 * Puts a page's payload in the cache before anything renders, under the key the
 * page's own hook reads, so the page draws itself on the first render. The
 * build-time render does this with the payload it fetched (entry-server.ts),
 * and the browser will do it with the copy a prerendered document carries.
 *
 * `updatedAt: 0` marks the copy as old, so the page's hook refetches in the
 * background as soon as it mounts and anything changed since the build lands.
 * Null is a real answer (the API has no such page), the same as a 404.
 */
export function primeEncyclopediaPage(
	client: QueryClient,
	page: { kind: EncyclopediaPageKind; gameId: number },
	data: unknown,
	{ updatedAt }: { updatedAt?: number } = {},
): void {
	client.setQueryData(pageQuery(page.kind, page.gameId).queryKey, data, updatedAt === undefined ? undefined : { updatedAt })
}

/**
 * The detail page a route names, read from the same cache entry the page
 * reads, so the two share one request (AppRouteMeta titles the page from it).
 * Null for a route that isn't a detail page.
 */
export function useEncyclopediaPage(page: EncyclopediaPageRef | null): EncyclopediaPageState | null {
	const kind = page?.kind ?? "uma"
	const query = useQuery<unknown>({
		...pageQuery(kind, page?.gameId ?? 0),
		enabled: page !== null && page.gameId !== null,
	})
	if (page === null) return null
	// A segment that isn't an id has no page, the same as an id the API doesn't know.
	const data = page.gameId === null ? null : query.data
	// The kind picked the query, so the data is that kind's payload.
	return { kind, data } as EncyclopediaPageState
}

/** Asks only while `gameId` is a real id. */
export function useUmaPage(gameId: number | null, { staleTime }: PageOptions = {}) {
	return useQuery({
		...umaPageQuery(gameId ?? 0),
		enabled: gameId !== null,
		...(staleTime === undefined ? {} : { staleTime }),
	})
}

/** One skill's page, through the fetch the guide editor already uses. */
export function useSkillPage(gameId: number | null) {
	return useQuery({
		...skillPageQuery(gameId ?? 0),
		enabled: gameId !== null,
	})
}

export function useCardPage(gameId: number | null, { staleTime }: PageOptions = {}) {
	return useQuery({
		...cardPageQuery(gameId ?? 0),
		enabled: gameId !== null,
		...(staleTime === undefined ? {} : { staleTime }),
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
