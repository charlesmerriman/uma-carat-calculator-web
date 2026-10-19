/**
 * The one card recipe every panel on the home page shares — hero, video, steps,
 * coverage, FAQ teasers and the supporters block — so they cannot drift apart
 * again. Before this the page carried three different border/radius/shadow
 * combinations for what reads as a single kind of box.
 *
 * Since 2026-10-18 that box is the site's one card, `.card-panel` (App.css),
 * the same as the planner's and the Timeline's. It used to be a plain
 * gray-700-edged recipe of its own: the theme blocks re-skinned cards by
 * matching `.shadow-md` literally, and the planner's card wore a heavier
 * gray-600 edge. Both went with the surface tokens (SURFACES in index.css).
 * Kept as a constant so the home page's call sites read the same as before.
 */
export const HOME_CARD = "card-panel"

/**
 * A small link tile: a card's fill (--card-fill), no shadow, tighter radius,
 * and the hover lift that every clickable tile on the page shares.
 */
export const HOME_TILE =
	"rounded-lg border border-gray-700 bg-(--card-fill) transition hover:border-gray-500 hover:bg-gray-700"

/**
 * The square icon chip that leads a tile or a step. Brand-tinted through a
 * slash opacity rather than a stock palette class so it follows all seven
 * themes (only --color-brand and the gray ramp are re-themed).
 */
export const HOME_ICON_CHIP =
	"flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand"
