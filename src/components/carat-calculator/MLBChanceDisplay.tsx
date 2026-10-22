import type { ReactNode } from "react"
import type { UserPlannedBanner } from "../../types"
import { oddsLabels } from "../../utils/oddsDisplay"

interface MLBChanceDisplayProps {
	plannedBanner: UserPlannedBanner
	/**
	 * The six percentages to show, FINAL: the row has already applied pity,
	 * reserved copies and, on a two-card row, the second card. Worked out by
	 * the row because every version needs the API's calculation constants and
	 * the row's funded reserved copies, and the row has both.
	 */
	values: number[]
	/**
	 * An optional first line inside the strip's frame, spanning all six cells:
	 * which card the odds are for, on a banner with more than one. With it the
	 * cells give up 4px of padding, which is what lets strip and caption share
	 * the desktop table's fixed-height row.
	 */
	header?: ReactNode
	/**
	 * On a two-card row, the cell the first card is taken to ("MLB" for a
	 * support, "1x" for an uma: oddsTarget). The strip then shows joint odds,
	 * so every label carries it: "MLB & None" ... "MLB & MLB" says in the cell
	 * what the caption says above it, that the first card is at its target in
	 * every column and only the second card varies.
	 */
	pairedWith?: string
}

export const MLBChanceDisplay = ({
	plannedBanner,
	values,
	header,
	pairedWith,
}: MLBChanceDisplayProps) => {
	const labels = oddsLabels(plannedBanner).map((label) =>
		pairedWith ? `${pairedWith} & ${label}` : label
	)

	// Bars use an absolute 0-100% scale, so a 33.5% cell is a third full. They
	// used to be scaled against the tallest cell in the row, which kept small
	// values visible but meant the most likely outcome always drew a full bar
	// even at 30%. Players read the bar as the percentage, so it has to match.
	// Slivers on a spread-out distribution are the honest picture.

	return (
		// Six across at every width, phones included. Wrapping to 3x2 below `sm`
		// doubled the strip's height for six cells that each need ~30px — a 320px
		// card gives every one of them ~53px, which is roomier than the desktop
		// table's own 14rem track manages.
		//
		// The framing is on `@banner-table:`, the SAME container query that decides
		// card vs table, not on a viewport `sm:`. In a card the strip is a full-bleed
		// band of that card and must not draw its own box; in the table it sits in a
		// padded cell and needs one. Keyed to the viewport those two states drifted
		// apart in the band where the viewport is wide but the container isn't.
		<div className="w-full grid grid-cols-6 bg-gray-700 border-gray-600 @banner-table:rounded-lg @banner-table:border overflow-hidden">
			{header && (
				<div className="col-span-6 min-w-0 border-b border-gray-600">{header}</div>
			)}
			{labels.map((label, i) => (
				<div
					key={label}
					// Note the space before `${`: Tailwind extracts class names from the
					// raw source text, and a token welded to an interpolation isn't
					// recognised as one — the old `text-center${…}` meant `sm:px-1` was
					// never actually generated. Keep interpolations space-separated.
					className={`flex flex-col items-center justify-center px-0.5 ${header ? "py-1" : "py-1.5"} text-[10px] leading-tight text-center @banner-table:px-1 ${i < labels.length - 1 ? "border-r border-gray-600" : ""}`}
				>
					<div className="mlb-label">{label}</div>
					<div className="mlb-value">{values[i].toFixed(1)}%</div>
					<div className="h-1 bg-gray-500 rounded-full overflow-hidden mt-0.5 w-full">
						<div
							className="h-full bg-blue-400 rounded-full"
							style={{ width: `${values[i]}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	)
}
