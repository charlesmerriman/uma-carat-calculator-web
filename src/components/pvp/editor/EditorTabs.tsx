/**
 * The editor's tab strip: Guide, then the five styles, each with how many
 * rows it holds and, in red, how many problems the last check found there.
 * The same shape as the reader's style tabs, so the editor reads as the page.
 */

import type { EditorTab } from "../../../utils/guideDocument"
import { EDITOR_TABS } from "../../../utils/guideDocument"
import { STYLE_LABELS } from "../../../utils/pvpGuide"

export function EditorTabs({ tab, rows, errors, onChange }: {
	tab: EditorTab
	rows: Map<EditorTab, number>
	errors: Map<EditorTab, number>
	onChange: (tab: EditorTab) => void
}) {
	return (
		<div role="tablist" aria-label="Guide section" className="flex flex-wrap gap-1 rounded-xl border border-gray-700 bg-gray-800/60 p-1">
			{EDITOR_TABS.map((candidate) => {
				const active = candidate === tab
				const count = rows.get(candidate) ?? 0
				const problems = errors.get(candidate) ?? 0
				return (
					<button
						key={candidate}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(candidate)}
						className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
							active ? "border-brand/50 bg-brand/10 text-brand" : "border-transparent text-gray-400 hover:bg-gray-700/70 hover:text-gray-100"
						}`}
					>
						{candidate === "guide" ? "Guide" : STYLE_LABELS[candidate]}
						{count > 0 && <span className="rounded-full bg-gray-900/70 px-1.5 text-[11px] text-gray-400">{count}</span>}
						{problems > 0 && (
							<span className="rounded-full bg-highlight/20 px-1.5 text-[11px] font-semibold text-highlight" aria-label={`${problems} problems`}>
								{problems}
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}
