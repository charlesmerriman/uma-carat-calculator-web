/**
 * The Encyclopedia's addresses (notes/encyclopedia-plan.md): the ONLY builders
 * of these links, so a later readable suffix ("/app/umas/100101-special-week")
 * is one change here.
 *
 * Pages are keyed by the GAME's id, never a row's pk or a name: names change
 * (a JP-only uma takes its Global name on release, and many cards share one)
 * while the game's id is the same everywhere, so a link pasted in Discord
 * keeps working.
 */

export const UMA_LIST_PATH = "/app/umas"
export const CARD_LIST_PATH = "/app/cards"
export const SKILL_LIST_PATH = "/app/skills"

export const umaHref = (gameId: number): string => `${UMA_LIST_PATH}/${gameId}`
export const cardHref = (gameId: number): string => `${CARD_LIST_PATH}/${gameId}`

/**
 * A route's `:gameId` as a number, or null for anything that isn't a plain
 * positive whole number. Only the leading digits are read, so a readable
 * suffix added later ("100101-special-week") still finds the page.
 */
export function parseGameId(raw: string | undefined): number | null {
	const digits = /^(\d+)/.exec(raw ?? "")?.[1]
	if (!digits) return null
	const value = Number(digits)
	return Number.isSafeInteger(value) && value > 0 ? value : null
}

/**
 * The Encyclopedia screen's bar: its three lists, by name only (Daptrius,
 * board "Encyclopedia sticky nav", 2026-11-25: "Just name, not numbers"; the
 * masthead's tabs keep the counts). Drawn by the shared ScreenTabs
 * (components/encyclopedia/EncyclopediaScreenTabs.tsx) on the three lists.
 */
export const ENCYCLOPEDIA_TABS = [
	{ to: UMA_LIST_PATH, label: "Umas" },
	{ to: CARD_LIST_PATH, label: "Support cards", short: "Supports" },
	{ to: SKILL_LIST_PATH, label: "Skills" },
] as const

/** Whether `pathname` is one of the three lists (not a detail page), with or without a trailing slash. */
export function isEncyclopediaList(pathname: string): boolean {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
	return ENCYCLOPEDIA_TABS.some((tab) => tab.to === path)
}

/** Whether a pathname is one of the Encyclopedia's lists or pages. */
export function isEncyclopediaPath(pathname: string): boolean {
	return /^\/app\/(umas|cards|skills)(\/|$)/.test(pathname)
}

/** Which kind of detail page: the key its payload is cached under (services/encyclopediaQueries.ts). */
export type EncyclopediaPageKind = "uma" | "card" | "skill"

/**
 * One detail page a pathname names. `gameId` is null for a segment that isn't
 * an id ("/app/umas/abc"): the route still matches and draws "no page for
 * that", so the page is still one of these.
 */
export interface EncyclopediaPageRef {
	kind: EncyclopediaPageKind
	gameId: number | null
}

const KIND_OF_LIST: Record<string, EncyclopediaPageKind> = { umas: "uma", cards: "card", skills: "skill" }

/**
 * A detail page's address by kind, for code that holds a kind rather than
 * calling umaHref/cardHref directly: the build writes one document per page
 * at this path (scripts/prerender.mjs). The skill path matches
 * skillSearch.skillHref.
 */
export function encyclopediaHref(kind: EncyclopediaPageKind, gameId: number): string {
	if (kind === "uma") return umaHref(gameId)
	if (kind === "card") return cardHref(gameId)
	return `${SKILL_LIST_PATH}/${gameId}`
}

/**
 * The detail page a pathname names, or null for anything else (a list, a tab).
 * The one reader of a detail path's shape: the app shell lets these pages past
 * its loading gate, the route meta titles them, and the build-time render primes
 * their data, all from this.
 */
export function encyclopediaPageOf(pathname: string): EncyclopediaPageRef | null {
	const match = /^\/app\/(umas|cards|skills)\/([^/]+)\/?$/.exec(pathname)
	if (!match) return null
	return { kind: KIND_OF_LIST[match[1]], gameId: parseGameId(match[2]) }
}
