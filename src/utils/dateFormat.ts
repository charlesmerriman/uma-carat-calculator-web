/**
 * The app's single user-facing date formatter.
 *
 * Output is `YYYY/M/D` (e.g. "2026/7/5") — no zero padding and no locale
 * dependence, so every user sees the same string. Every date the UI renders
 * goes through here, which means the format only ever has to change in one
 * place. Before this existed the same logic was copy-pasted into BannerRow,
 * StagedBannerRow, UncapCrystalsPanel and the changelog helper, and the four
 * copies had already drifted apart (two locales and two timezone bases).
 */

/**
 * Parse a date string from the API into a Date.
 *
 * Two different shapes arrive from DRF and they must be parsed differently:
 *
 * - **Date-only** — `"2026-07-16"`, e.g. `ChangelogEntry.date` (a DateField).
 *   Handing these to `new Date()` parses them as UTC midnight, which renders as
 *   the *previous* calendar day in any negative-offset timezone. We split the
 *   parts by hand and build a local-midnight Date instead.
 * - **Full instants** — `"2025-06-26T22:00:00Z"`, every banner/event date
 *   (DateTimeFields). These carry a real time and offset, so `new Date()` is
 *   both correct and necessary.
 *
 * Returns null when the string is neither.
 */
export function parseApiDate(dateStr: string): Date | null {
	if (typeof dateStr !== "string") return null

	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
	if (dateOnly) {
		const [, year, month, day] = dateOnly
		return new Date(Number(year), Number(month) - 1, Number(day))
	}

	const parsed = new Date(dateStr)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Format an API date string as `YYYY/M/D`.
 *
 * Unparseable input is returned unchanged rather than rendering "Invalid Date"
 * or an empty cell — a visibly odd string is easier to trace back to bad data
 * than a blank one. Null/undefined render as an empty string.
 */
export function formatDate(dateStr: string | null | undefined): string {
	if (dateStr == null) return ""

	const date = parseApiDate(dateStr)
	if (!date) return dateStr

	return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

/**
 * Format a UTC month as `YYYY/M`, the month-only sibling of `formatDate`.
 *
 * For chart axes, whose ticks are UTC month starts produced by the projection
 * (utils/utcDates). Read in UTC on purpose: a tick at 2026-11-01T00:00Z is
 * November everywhere, where a local reading would call it October west of
 * Greenwich.
 */
export function formatMonth(date: Date): string {
	return `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}`
}

/**
 * Format a UTC calendar day as `YYYY/M/D`, the day-level sibling of
 * `formatMonth`.
 *
 * For instants that ARE a UTC day rather than a moment in one: the forecast
 * chart's daily samples (UTC midnights, each holding that UTC day's income).
 * `formatDate` would read 2029-11-02T00:00Z as Nov 1 anywhere west of
 * Greenwich. A real event or banner instant still goes through `formatDate`.
 */
export function formatUtcDay(date: Date): string {
	return `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`
}
