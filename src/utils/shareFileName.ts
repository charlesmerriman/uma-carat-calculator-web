/**
 * Share picture file names (notes/v2-10-feedback-plan.md, item 5).
 *
 * Two pictures made on one day used to get one name ("uma-plan-2026-10-29.png"),
 * and a browser or extension that overwrites a file instead of adding "(1)"
 * lost the first (Daptrius, 2026-10-29). Each name now says what the picture
 * is of (the plan's or team's name, and the player's name only when "Show my
 * name" is ticked: Discord shows a file's name) and the minute it was made.
 *
 * Kept apart from utils/shareImage.ts, which the share tests stub whole.
 */

/** `2026-10-29-1615`: the viewer's own date and time, to the minute. */
export function fileStamp(now: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0")
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

/** The longest a name part may be, so a long plan name can't make an unwieldy file name. */
const MAX_PART = 40

/**
 * "Main plan!" becomes "main-plan": lower case, every run of characters that
 * isn't a letter or digit (in any script, so a Japanese name survives) becomes
 * one dash, none at either end.
 */
export function fileSlug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.slice(0, MAX_PART)
		.replace(/^-+|-+$/g, "")
}

/** `uma-plan-main-plan-2026-10-29-1615.png`: the prefix, each part that has
 *  something in it, and the stamp. */
export function shareFileName(prefix: string, parts: Array<string | null | undefined>, stamp: string): string {
	const named = parts.map((part) => (part ? fileSlug(part) : "")).filter(Boolean)
	return `${[prefix, ...named, stamp].join("-")}.png`
}
