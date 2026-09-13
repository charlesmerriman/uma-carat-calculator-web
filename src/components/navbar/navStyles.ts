/**
 * The navbar's control recipes, shared by Navbar, SettingsMenu and ThemePicker.
 *
 * Four copies of the same text-button string and three of the icon-button one
 * used to live inline across those files, and they drifted a `rounded` at a
 * time. One definition each keeps every control in the bar the same height,
 * radius and hover, whichever file renders it.
 *
 * A separate module rather than exports from Navbar.tsx because Navbar imports
 * the two popovers — exporting from it would make the import graph circular.
 */

/** A text button or link in the bar: Login, Logout, Sign in to save. */
export const NAV_BUTTON =
	"flex h-9 items-center gap-1.5 rounded-lg border border-gray-600 px-3 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-600 disabled:hover:bg-transparent disabled:hover:text-gray-300"

/** A square icon button: settings gear, theme palette, mobile logout. */
export const NAV_ICON_BUTTON =
	"flex h-9 w-9 items-center justify-center rounded-lg border border-gray-600 text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100"

/**
 * The "save now" button, in brand so it reads as a pending action rather than a
 * setting. Its own recipe instead of NAV_ICON_BUTTON plus overrides: two
 * text-colour utilities on one element resolve by stylesheet order, not by
 * their order in the class string.
 */
export const NAV_SAVE_BUTTON =
	"flex h-9 w-9 items-center justify-center rounded-lg border border-gray-600 text-brand transition hover:border-brand/70 hover:bg-gray-700"

/** A popover panel anchored under one of the buttons above. */
export const NAV_POPOVER = "rounded-xl border border-gray-700 bg-gray-800 shadow-lg"
