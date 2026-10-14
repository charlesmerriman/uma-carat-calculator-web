/**
 * Relative ("3 days ago") date formatting: by whole days for the changelog
 * (formatRelativeDate), and down to the minute for the gallery's posts and
 * comments (formatTimeAgo).
 *
 * Parsing lives in `dateFormat.ts` alongside the absolute formatter, so both
 * agree on how a given API string maps to a calendar day. See `parseApiDate`
 * for why date-only strings can't just go through `new Date()`.
 */

import { formatDate, parseApiDate } from "./dateFormat"

/** Whole-day difference (target − today); negative = in the past. */
function daysFromToday(date: Date): number {
	const now = new Date()
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const msPerDay = 1000 * 60 * 60 * 24
	return Math.round((date.getTime() - today.getTime()) / msPerDay)
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

/**
 * Human-friendly relative date, e.g. "today", "yesterday", "3 days ago",
 * "2 weeks ago", "5 months ago". Buckets by the largest sensible unit.
 * Falls back to an empty string if the input can't be parsed.
 */
export function formatRelativeDate(dateStr: string): string {
	const date = parseApiDate(dateStr)
	if (!date) return ""

	const days = daysFromToday(date)
	const abs = Math.abs(days)

	if (abs === 0) return "today"
	if (abs < 7) return rtf.format(days, "day")
	if (abs < 30) return rtf.format(Math.round(days / 7), "week")
	if (abs < 365) return rtf.format(Math.round(days / 30), "month")
	return rtf.format(Math.round(days / 365), "year")
}

/** Past this, "N days ago" stops helping and the calendar date is clearer. */
const TIME_AGO_LIMIT_DAYS = 30

/**
 * How long ago an API instant was, for feeds that are read top to bottom:
 * "just now", "5 minutes ago", "2 days ago". Older than a month it falls
 * back to formatDate, as does anything unparseable. Pair it with the
 * formatDate string in a `title` so the exact day is one hover away.
 *
 * Unlike formatRelativeDate it counts elapsed time, not calendar days, and
 * is fixed English like formatDate rather than the browser's locale.
 *
 * Reads the clock, so call it only where a render may differ from the
 * prerendered one (behind the /app loading gate, or on a page that is never
 * prerendered); `now` is for tests.
 */
export function formatTimeAgo(dateStr: string | null | undefined, now: number = Date.now()): string {
	if (dateStr == null) return ""
	const date = parseApiDate(dateStr)
	if (!date) return dateStr

	const seconds = Math.max(Math.round((now - date.getTime()) / 1000), 0)
	if (seconds < 60) return "just now"
	const steps: Array<[limit: number, size: number, unit: string]> = [
		[60 * 60, 60, "minute"],
		[24 * 60 * 60, 60 * 60, "hour"],
		[TIME_AGO_LIMIT_DAYS * 24 * 60 * 60, 24 * 60 * 60, "day"],
	]
	for (const [limit, size, unit] of steps) {
		if (seconds < limit) {
			const count = Math.floor(seconds / size)
			return `${count} ${unit}${count === 1 ? "" : "s"} ago`
		}
	}
	return formatDate(dateStr)
}
