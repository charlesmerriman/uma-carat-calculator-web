/**
 * "+N" over a truncated row of banner thumbnails.
 *
 * The planner's rows show at most two featured cards, which is the right cap
 * for a table row — but a Golden Week revival features up to eleven, and a row
 * showing two of them with nothing to say so reads as a two-uma banner. The cap
 * stays; it just stops lying about the count.
 *
 * Positioned absolutely rather than sitting beside the thumbnails on purpose.
 * The desktop table's images track is a fixed 144px against two thumbnails that
 * need 126, so there is no room for another inline element — and widening the
 * track means raising --container-banner-table, which is the minimum width at
 * which cards become the spreadsheet and must not move for a badge. Overlaying
 * costs no width at all. The caller's container needs `relative`.
 */
export function ExtraCardsBadge({ hidden }: { hidden: number }) {
	if (hidden < 1) return null

	return (
		<span
			className="absolute bottom-0 right-0 rounded-md bg-gray-950/85 px-1 text-[0.6875rem] font-semibold leading-snug text-brand ring-1 ring-gray-600"
			title={`${hidden} more featured card${hidden === 1 ? "" : "s"} on this banner`}
		>
			+{hidden}
			{/* The hidden cards aren't in the DOM at all, so their alt text can't
			    carry this — the badge has to say it. */}
			<span className="sr-only"> more featured cards not shown</span>
		</span>
	)
}

export default ExtraCardsBadge
