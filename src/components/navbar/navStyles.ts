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
 * The "save now" button. Its content is the spinning Oguri image, not an icon,
 * so it carries no border (a box around a spinning head looked like a cage)
 * and no text colour; the hover fill is what says it is clickable. Its own
 * recipe rather than NAV_ICON_BUTTON minus overrides, because there is no
 * "un-border" utility — the recipe has to be written without it.
 */
export const NAV_SAVE_BUTTON =
	"flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-gray-700"

/**
 * The signed-in trigger: the avatar as the left cap of a pill, with the name
 * and a chevron beside it on desktop. One step taller than the other controls
 * (h-10 against their h-9) because it holds a picture rather than text, and
 * still inside the 56px mobile bar with the breathing room the rest get.
 * `p-px` plus the 1px border leaves exactly 36px inside, which is the `md`
 * Avatar. Below `desktop-nav:` the tail is hidden and this is the ring alone
 * (see ProfileMenu.tsx for why the pill is desktop-only).
 */
export const NAV_PROFILE_TRIGGER =
	"flex h-10 items-center rounded-full border p-px transition desktop-nav:gap-2 desktop-nav:pr-2.5"

/** A popover panel anchored under one of the buttons above. */
export const NAV_POPOVER = "rounded-xl border border-gray-700 bg-gray-800 shadow-lg"
