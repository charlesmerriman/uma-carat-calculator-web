/**
 * A ranking's bar (mock 02-kit-row.png in notes/rankings-redesign/mocks/).
 *
 * SCALED TO THE LEADER, NOT TO 100%: shares are small (29% at the top of
 * Overall), so a bar out of 100% would flatten the whole list. The caller
 * passes `fill` = count / the list's first count, so the first row's bar is
 * full and every other row reads against it. The share stays as text beside
 * the count.
 *
 * Three looks: the plain bar (a brand/35 fill with a 2 px brand edge where it
 * stops), a stacked bar (`parts`, e.g. an uma's running styles, each part a
 * share of the WHOLE track) and the hairline (`hairline`, 3 px, for the
 * window's compact rows and phones, where the bar column goes).
 */

export interface BarPart {
	key: string
	value: number
	/** A CSS colour, usually a token: "var(--color-style-pace)". */
	color: string
	/** Read out with the value, so the bar isn't colour only. */
	label: string
}

export function Bar({ fill = 0, parts, tone, hairline = false, className = "" }: {
	/** 0 to 1 of the track. Ignored when `parts` is given. */
	fill?: number
	/** A stacked bar: values are summed and each part takes its share of `fill`'s width. */
	parts?: BarPart[]
	/** "win": the running green, for a win rate. */
	tone?: "win"
	hairline?: boolean
	className?: string
}) {
	const width = `${Math.max(0, Math.min(1, fill)) * 100}%`
	const track = hairline ? "h-[3px] rounded-full" : "h-[18px] rounded-[5px]"
	if (parts) {
		const total = parts.reduce((sum, part) => sum + part.value, 0)
		return (
			<span
				role="img"
				aria-label={parts.map((part) => `${part.label} ${part.value}`).join(", ")}
				className={`relative block min-w-0 overflow-hidden bg-gray-900/70 ${track} ${className}`}
			>
				<span className="absolute inset-y-0 left-0 flex" style={{ width }}>
					{total > 0 &&
						parts.map((part) => (
							<span key={part.key} className="h-full" style={{ width: `${(part.value / total) * 100}%`, background: part.color }} />
						))}
				</span>
			</span>
		)
	}
	const ink = tone === "win" ? "bg-status-running/35 border-status-running" : "bg-brand/35 border-brand"
	return (
		<span aria-hidden="true" className={`relative block min-w-0 overflow-hidden bg-gray-900/70 ${track} ${className}`}>
			<span
				className={`absolute inset-y-0 left-0 ${hairline ? (tone === "win" ? "bg-status-running" : "bg-brand") : `rounded-l-[5px] border-r-2 ${ink}`}`}
				style={{ width }}
			/>
		</span>
	)
}
