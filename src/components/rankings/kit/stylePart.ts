import type { PvpStyle } from "../../../types/pvpGuide"
import { STYLE_LABELS } from "../../../utils/pvpGuide"
import type { BarPart } from "./Bar"

/** One running style's slice of a stacked Bar, in the style's colour (StyleLegend.tsx). */
export function stylePart(style: PvpStyle, value: number): BarPart {
	return { key: style, value, color: `var(--color-style-${style})`, label: STYLE_LABELS[style] }
}
