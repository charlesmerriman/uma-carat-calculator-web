/**
 * Running styles as swatches with their names (and a count when given): the
 * legend under a stacked style bar (mocks 04-guides-row-open.png,
 * 09-pvp.png). The swatches are the site's `--color-style-*` (Hakuraku's,
 * index.css :root), fills only, so the words carry the meaning on every
 * theme. `stylePart` builds the matching Bar part.
 */

import type { PvpStyle } from "../../../types/pvpGuide"
import { STYLE_LABELS } from "../../../utils/pvpGuide"

export function StyleLegend({ entries, className = "" }: { entries: Array<[PvpStyle, number | null]>; className?: string }) {
	return (
		<span className={`flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] tabular-nums text-gray-400 ${className}`}>
			{entries.map(([style, count]) => (
				<span key={style} className="inline-flex items-center gap-1">
					<i className="inline-block h-2 w-2 rounded-sm" style={{ background: `var(--color-style-${style})` }} aria-hidden="true" />
					{STYLE_LABELS[style]}
					{count !== null && ` ${count.toLocaleString()}`}
				</span>
			))}
		</span>
	)
}
