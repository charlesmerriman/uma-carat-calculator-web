/**
 * Labels shared by the Pull plans tab and its lazily loaded chart, in a
 * plain module so the chart's chunk doesn't drag the tab in (or the reverse).
 */

import { formatMonth } from "../../utils/dateFormat"

/** "2026-11" as the site writes a month ("2026/11"); "Later" stays "Later". */
export function monthLabel(month: string): string {
	const date = new Date(`${month}-01T00:00:00Z`)
	return Number.isNaN(date.getTime()) ? month : formatMonth(date)
}
