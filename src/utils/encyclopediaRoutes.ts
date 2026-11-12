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

/** Whether a pathname is one of the Encyclopedia's lists or pages. */
export function isEncyclopediaPath(pathname: string): boolean {
	return /^\/app\/(umas|cards|skills)(\/|$)/.test(pathname)
}
