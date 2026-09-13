/**
 * The one card recipe every panel on the home page shares — hero, video, steps,
 * coverage, FAQ teasers and the supporters block — so they cannot drift apart
 * again. Before this the page carried three different border/radius/shadow
 * combinations for what reads as a single kind of box.
 *
 * Plain class strings rather than a class in App.css: the seven theme blocks in
 * index.css re-skin cards by matching `.shadow-md` LITERALLY, so the utility has
 * to stay on the element. An `@apply` would inline the shadow and every theme's
 * override would silently stop matching.
 *
 * Not `.card-panel` either: that is the planner's box, with a stronger gray-600
 * edge for a busy surface. Here the cards sit alone on the gray-900 canvas and
 * the quieter gray-700 border is enough.
 */
export const HOME_CARD = "rounded-xl border border-gray-700 bg-gray-800 shadow-md"

/**
 * A small link tile: same edge as a card, no shadow, tighter radius, and the
 * hover lift that every clickable tile on the page shares.
 */
export const HOME_TILE =
	"rounded-lg border border-gray-700 bg-gray-800 transition hover:border-gray-500 hover:bg-gray-700"

/**
 * The square icon chip that leads a tile or a step. Brand-tinted through a
 * slash opacity rather than a stock palette class so it follows all seven
 * themes (only --color-brand and the gray ramp are re-themed).
 */
export const HOME_ICON_CHIP =
	"flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand"
