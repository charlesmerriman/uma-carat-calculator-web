/**
 * A distribution as one stacked bar with a legend (mock 11-players.png:
 * Team Trials class, Club rank): each part's share of the people who set
 * one, in order. The colours are a ramp from the brand down to the gray
 * ramp, mixed from theme tokens, so they follow every theme and read as
 * "more" to "less" without a hue per rank. The legend carries the words and
 * the shares, so the colour is never the only cue.
 */

import { formatShare } from "../../../utils/guideRankings"

/** The ramp's step for the `index`th part: brand, fading towards gray-700. */
function rampColor(index: number): string {
	const brand = Math.max(12, 100 - index * 16)
	return `color-mix(in srgb, var(--color-brand) ${brand}%, var(--color-gray-700))`
}

/** `rows`: each part's share (0 to 1) of the people who set one, from the server. */
export function DistBar({ label, rows }: { label: string; rows: Array<{ name: string; share: number }> }) {
	return (
		<div className="flex flex-col gap-1.5">
			<span
				role="img"
				aria-label={`${label}: ${rows.map((row) => `${row.name} ${formatShare(row.share)}`).join(", ")}`}
				className="flex h-[22px] overflow-hidden rounded-md bg-gray-900/70"
			>
				{rows.map((row, index) => (
					<span key={row.name} className="h-full" style={{ width: `${row.share * 100}%`, background: rampColor(index) }} />
				))}
			</span>
			<span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400" aria-hidden="true">
				{rows.map((row, index) => (
					<span key={row.name} className="inline-flex items-center gap-1">
						<i className="inline-block h-2 w-2 rounded-sm" style={{ background: rampColor(index) }} />
						{row.name} <b className="font-semibold tabular-nums text-gray-100">{formatShare(row.share)}</b>
					</span>
				))}
			</span>
		</div>
	)
}
