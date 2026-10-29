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
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseApiDate(dateStr: string): Date | null {
	if (typeof dateStr !== "string") return null

	const dateOnly = DATE_ONLY.exec(dateStr.trim())
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

/*
 * Times of day: the one place the site follows the VIEWER'S conventions
 * instead of a fixed format (owner, 2026-10-28). Their time zone, like
 * formatDate's dates, and their locale's clock: "3:00 PM" in the US, "15:00"
 * in Germany or Japan. A fixed 24-hour clock would read wrong to half the
 * players, and a time exists to be acted on at a glance.
 *
 * A formatter is built per call, not kept: one built once would hold the
 * zone it was built in, which a test (or a laptop crossing a border) can
 * change, and the Timeline reveals ten cards at a time, so the cost is small.
 * Nothing here reads the clock, but the output depends on where the code runs,
 * so like formatDate it belongs behind the /app loading gate, never in
 * prerendered text.
 */

/**
 * Format an API instant as the viewer's clock time, e.g. "3:00 PM" or "15:00".
 *
 * Seconds are dropped, never rounded: a banner ending at 21:59:59 UTC reads
 * "2:59 PM" in Los Angeles, which is how the game itself writes an end time.
 * A date-only string has no time and gives "", as does anything unparseable.
 */
export function formatTime(dateStr: string | null | undefined): string {
	if (dateStr == null || DATE_ONLY.test(dateStr.trim())) return ""
	const date = parseApiDate(dateStr)
	if (!date) return ""
	return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)
}

/**
 * The viewer's time zone as a name that holds across a clock change: "PT",
 * "Japan Time", "United Kingdom Time".
 *
 * Generic on purpose. A line of times is labelled ONCE, and an event can
 * straddle a daylight-saving switch (CM 21 crosses the US one): "PDT" would
 * then be wrong for its last times, while "PT" is right for all of them.
 * `dateStr` picks the instant the name is read at; any of the times shown will
 * do. "" when it can't be read.
 */
export function localZoneName(dateStr: string | null | undefined): string {
	if (dateStr == null) return ""
	const date = parseApiDate(dateStr)
	if (!date) return ""
	return (
		new Intl.DateTimeFormat(undefined, { timeZoneName: "shortGeneric" })
			.formatToParts(date)
			.find((part) => part.type === "timeZoneName")?.value ?? ""
	)
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
