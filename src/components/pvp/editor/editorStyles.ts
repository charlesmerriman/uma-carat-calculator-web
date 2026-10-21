/**
 * The guide editor's looks, in one place. The buttons are the gallery's
 * (galleryStyles.ts), so a dialog here reads like a dialog there.
 */

export {
	ACTION_BUTTON,
	DANGER_BUTTON,
	FIELD,
	PRIMARY_BUTTON,
	PRIMARY_BUTTON_SMALL,
	SECONDARY_BUTTON,
	SECONDARY_BUTTON_SMALL,
	SMALL_BUTTON,
} from "../gallery/galleryStyles"

/** A section of a tab: the reader's panel look, so the editor is the page. */
export const SECTION = "rounded-xl border border-edge bg-gray-800/60 p-3"
export const SECTION_HEADING = "text-sm font-semibold text-brand"
export const SUBTLE = "text-xs text-gray-400"
/** A small text input in a row (a label, a note). */
export const INPUT =
	"min-w-0 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand"
export const SELECT = `${INPUT} pr-7`
/** The red line under a field the save refused. */
export const FIELD_ERROR = "mt-0.5 text-xs text-highlight"
/** A dashed "add" button that sits where the next tile would. */
export const ADD_BUTTON =
	"flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-600 px-3 py-2 text-xs font-medium text-gray-300 transition hover:border-brand hover:text-brand"
/** An icon-only control in a row. */
export const ICON_BUTTON =
	"flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
