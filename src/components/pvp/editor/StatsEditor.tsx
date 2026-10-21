/**
 * The recommended stats table, editable in place: a row per style (and per
 * variant), the five stats as the sheet writes them ("1100+", "578*"), a
 * footnote per row. Blank shows as a dash on the site.
 */

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { useFieldErrors, useGuideEditor } from "./GuideEditorContext"
import { MentionField } from "./MentionField"
import { ADD_BUTTON, FIELD_ERROR, ICON_BUTTON, INPUT, SECTION_HEADING, SELECT, SUBTLE } from "./editorStyles"
import { addStat, moveStat, removeStat, updateStat } from "../../../utils/guideDocumentEdits"
import { MAX_LENGTH } from "../../../utils/guideDocument"
import { STYLE_LABELS, STYLE_ORDER } from "../../../utils/pvpGuide"
import type { PvpStyle } from "../../../types/pvpGuide"

const STATS = ["speed", "stamina", "power", "guts", "wit"] as const

export function StatsEditor() {
	const { document, update } = useGuideEditor()
	const rows = document.stat_configs
	return (
		<section id="editor-guide-stat_configs" aria-label="Recommended stats" className="flex flex-col gap-2">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h4 className={SECTION_HEADING}>Recommended stats</h4>
				<span className={SUBTLE}>As the sheet writes them: 1200, 1100+, 578*. Blank shows as a dash.</span>
			</div>
			{rows.length > 0 && (
				<div className="overflow-x-auto">
					<table className="w-full min-w-[40rem] border-collapse text-left text-sm">
						<thead>
							<tr className="text-xs uppercase tracking-wide text-gray-400">
								<th className="pb-1 pr-2 font-semibold">Style</th>
								<th className="pb-1 pr-2 font-semibold">Variant</th>
								{STATS.map((stat) => (
									<th key={stat} className="pb-1 pr-2 font-semibold capitalize">
										{stat}
									</th>
								))}
								<th className="pb-1 pr-2 font-semibold">Footnote</th>
								<th className="pb-1" />
							</tr>
						</thead>
						<tbody>
							{rows.map((_, i) => (
								<StatRow key={i} index={i} count={rows.length} />
							))}
						</tbody>
					</table>
				</div>
			)}
			<button type="button" className={`${ADD_BUTTON} w-fit`} onClick={() => update((doc) => addStat(doc))}>
				<Plus className="h-4 w-4" />
				Add a row
			</button>
		</section>
	)
}

function StatRow({ index: i, count }: { index: number; count: number }) {
	const { document, update } = useGuideEditor()
	const row = document.stat_configs[i]
	const footnoteErrors = useFieldErrors(`stat_configs[${i}].footnote`)
	const labelErrors = useFieldErrors(`stat_configs[${i}].label`)
	return (
		<tr className="align-top">
			<td className="py-1 pr-2">
				<select aria-label={`Style for row ${i + 1}`} value={row.style} onChange={(change) => update((doc) => updateStat(doc, i, { style: change.target.value as PvpStyle }))} className={SELECT}>
					{STYLE_ORDER.map((style) => (
						<option key={style} value={style}>
							{STYLE_LABELS[style]}
						</option>
					))}
				</select>
			</td>
			<td className="py-1 pr-2">
				<input type="text" aria-label={`Variant for row ${i + 1}`} value={row.label} maxLength={MAX_LENGTH.stat_label} placeholder="Minimum" onChange={(change) => update((doc) => updateStat(doc, i, { label: change.target.value }))} className={`${INPUT} w-28`} />
				{labelErrors.map((message) => (
					<p key={message} className={FIELD_ERROR} role="alert">
						{message}
					</p>
				))}
			</td>
			{STATS.map((stat) => (
				<td key={stat} className="py-1 pr-2">
					<input
						type="text"
						aria-label={`${stat} for row ${i + 1}`}
						value={row[stat]}
						maxLength={MAX_LENGTH.stat_value}
						placeholder="–"
						onChange={(change) => update((doc) => updateStat(doc, i, { [stat]: change.target.value }))}
						className={`${INPUT} w-20 tabular-nums`}
					/>
				</td>
			))}
			<td className="py-1 pr-2">
				<MentionField label={`Footnote for row ${i + 1}`} value={row.footnote} maxLength={MAX_LENGTH.stat_footnote} placeholder="*Bonus Speed every 300 Power" errors={footnoteErrors} onChange={(footnote) => update((doc) => updateStat(doc, i, { footnote }))} className="w-56">
					<span />
				</MentionField>
			</td>
			<td className="py-1">
				<div className="flex items-center">
					<button type="button" className={ICON_BUTTON} aria-label="Move row up" disabled={i === 0} onClick={() => update((doc) => moveStat(doc, i, i - 1))}>
						<ChevronUp className="h-4 w-4" />
					</button>
					<button type="button" className={ICON_BUTTON} aria-label="Move row down" disabled={i >= count - 1} onClick={() => update((doc) => moveStat(doc, i, i + 1))}>
						<ChevronDown className="h-4 w-4" />
					</button>
					<button type="button" className={ICON_BUTTON} aria-label="Remove row" onClick={() => update((doc) => removeStat(doc, i))}>
						<Trash2 className="h-4 w-4" />
					</button>
				</div>
			</td>
		</tr>
	)
}
