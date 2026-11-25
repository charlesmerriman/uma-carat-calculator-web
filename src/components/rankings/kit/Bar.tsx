/**
 * A ranking's bar (mock 02-kit-row.png in notes/rankings-redesign/mocks/;
 * the 2026-11-25 polish in notes/rankings-polish-plan.md).
 *
 * SCALED TO THE LEADER, NOT TO 100%: shares are small (29% at the top of
 * Overall), so a bar out of 100% would flatten the whole list. The caller
 * passes `fill` = count / the list's first count, so the first row's bar is
 * full and every other row reads against it. The share stays as text beside
 * the count.
 *
 * SOLID, IN A COLOUR THAT MEANS SOMETHING: a card's type hue (`color`, the
 * chip's dot), the running green for a win rate, the loss red, else the
 * theme's accent. No tinted fills (the old brand/35 read as muddy khaki).
 * Three shapes: the plain bar on the inset track, a stacked bar (`parts`,
 * e.g. an uma's running styles, each part a share of the WHOLE track) and the
 * hairline (`hairline`, 4 px, for the window's compact rows and phones,
 * where the bar column goes).
 */

export interface BarPart {
	key: string
	value: number
	/** A CSS colour, usually a token: "var(--color-style-pace)". */
	color: string
	/** Read out with the value, so the bar isn't colour only. */
	label: string
}

export type BarTone = "win" | "loss"

/** Each tone's fill. Whole class names, so Tailwind sees them. */
const TONES: Record<BarTone, string> = {
	win: "bg-status-running",
	loss: "bg-highlight",
}

export function Bar({ fill = 0, parts, tone, color, hairline = false, className = "" }: {
	/** 0 to 1 of the track. Ignored when `parts` is given. */
	fill?: number
	/** A stacked bar: values are summed and each part takes its share of `fill`'s width. */
	parts?: BarPart[]
	/** "win": the running green, for a win rate. "loss": the highlight red, for what beats players. */
	tone?: BarTone
	/** A plain bar's colour (a card type's hue). Without it, and without a tone, the theme's accent. */
	color?: string
	hairline?: boolean
	className?: string
}) {
	const width = `${Math.max(0, Math.min(1, fill)) * 100}%`
	const track = `relative block min-w-0 overflow-hidden rounded-full bg-(--enc-inset) ${hairline ? "h-1" : "h-3.5"}`
	if (parts) {
		const total = parts.reduce((sum, part) => sum + part.value, 0)
		return (
			<span role="img" aria-label={parts.map((part) => `${part.label} ${part.value}`).join(", ")} className={`${track} ${className}`}>
				<span className="absolute inset-y-0 left-0 flex overflow-hidden rounded-full" style={{ width }}>
					{total > 0 &&
						parts.map((part) => (
							<span key={part.key} className="h-full" style={{ width: `${(part.value / total) * 100}%`, background: part.color }} />
						))}
				</span>
			</span>
		)
	}
	return (
		<span aria-hidden="true" className={`${track} ${className}`}>
			<span
				data-bar-fill={hairline ? "hairline" : "bar"}
				className={`absolute inset-y-0 left-0 rounded-full ${tone ? TONES[tone] : color ? "" : "bg-brand"}`}
				style={{ width, ...(color && !tone ? { background: color } : {}) }}
			/>
		</span>
	)
}
