/**
 * A support card's type under its name in a ranked row (mock
 * 02-kit-row.png): the type's hue as a dot, the word beside it. The mock
 * draws white text on the hue; the site's type colours are fills only
 * (utils/cardTypes.ts: yellow-ish hues on a light theme fail as a
 * background for white), so the chip keeps the theme's ink on a neutral
 * fill and lets the dot carry the colour.
 */

import { CARD_TYPE_COLORS, CARD_TYPE_LABELS } from "../../../utils/cardTypes"

export function CardTypeChip({ type }: { type: string | null | undefined }) {
	if (!type) return null
	return (
		<span className="inline-flex shrink-0 items-center gap-1 rounded bg-gray-700 px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-wider text-gray-200">
			<span className="h-1.5 w-1.5 rounded-full" style={{ background: CARD_TYPE_COLORS[type] ?? "var(--color-gray-400)" }} aria-hidden="true" />
			{CARD_TYPE_LABELS[type] ?? type}
		</span>
	)
}
