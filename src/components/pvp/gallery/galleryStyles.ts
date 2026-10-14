/**
 * The gallery's button looks, in one place, so the feed, the post, the
 * comments and the dialogs stop carrying their own copies of the same class
 * strings.
 */

const PRIMARY =
	"flex items-center justify-center gap-1.5 rounded-md bg-brand font-semibold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
const SECONDARY =
	"flex items-center justify-center gap-1.5 rounded-md border border-gray-600 text-gray-200 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
const DANGER = "rounded-md border border-highlight/60 text-highlight transition hover:bg-highlight/10 disabled:opacity-50"

// Each look comes in two sizes rather than taking a text-xs on top: two
// font-size utilities on one element are settled by stylesheet order, not by
// which was written last.

/** The main action of a dialog or form: Post team, Send report, Comment. */
export const PRIMARY_BUTTON = `${PRIMARY} px-3 py-1.5 text-sm`
export const PRIMARY_BUTTON_SMALL = `${PRIMARY} px-2.5 py-1 text-xs`

/** Cancel, Keep, Not now, Try again. */
export const SECONDARY_BUTTON = `${SECONDARY} px-3 py-1.5 text-sm`
export const SECONDARY_BUTTON_SMALL = `${SECONDARY} px-2.5 py-1 text-xs`

/** The confirming half of a two-step destructive action (Take down, Delete). */
export const DANGER_BUTTON = `${DANGER} px-2 py-1 text-sm`
export const DANGER_BUTTON_SMALL = `${DANGER} px-1.5 py-0.5 text-xs`

/**
 * An action on a post: Copy to My team, Copy link, Report. Also drawn on
 * links (Open, Sign in), hence `not-disabled:` rather than `enabled:`, which
 * only matches form controls.
 */
export const ACTION_BUTTON =
	"flex items-center gap-1.5 rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 transition not-disabled:hover:border-brand not-disabled:hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"

/** The small buttons under a comment. */
export const SMALL_BUTTON =
	"flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"

/** A text input or textarea. */
export const FIELD =
	"rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand"
