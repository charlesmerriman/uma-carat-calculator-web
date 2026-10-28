/** "All", "3 of 12" or "None": a tick box filter's state, for its pill (FilterToolbar.tsx). */
export function tickSummary(ticked: number, total: number, all = "All"): string {
	if (ticked >= total) return all
	if (ticked === 0) return "None"
	return `${ticked} of ${total}`
}
