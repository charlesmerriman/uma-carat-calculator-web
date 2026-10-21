/**
 * What the guide still lacks and what the last check refused, as chips that
 * jump to the place: the tab opens and the section scrolls into view.
 */

import { AlertCircle, CircleDashed } from "lucide-react"
import type { ChecklistItem, EditorTab } from "../../../utils/guideDocument"
import { STYLE_LABELS } from "../../../utils/pvpGuide"

export function Checklist({ missing, errors, onJump }: {
	missing: ChecklistItem[]
	/** Problems per tab. */
	errors: Map<EditorTab, number>
	onJump: (tab: EditorTab, section: ChecklistItem["section"]) => void
}) {
	const problemTabs = [...errors.entries()].filter(([, count]) => count > 0)
	if (missing.length === 0 && problemTabs.length === 0) {
		return <p className="text-xs text-gray-500">Every section has something. Nothing refused.</p>
	}
	return (
		<ul className="flex flex-wrap gap-1.5" aria-label="What the guide still needs">
			{problemTabs.map(([tab, count]) => (
				<li key={`problem-${tab}`}>
					<button
						type="button"
						onClick={() => onJump(tab, "any")}
						className="flex items-center gap-1 rounded-full border border-highlight/60 bg-highlight/10 px-2.5 py-0.5 text-xs font-medium text-highlight transition hover:bg-highlight/20"
					>
						<AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
						{count} {count === 1 ? "problem" : "problems"} on {tab === "guide" ? "Guide" : STYLE_LABELS[tab]}
					</button>
				</li>
			))}
			{missing.map((item) => (
				<li key={item.text}>
					<button
						type="button"
						onClick={() => onJump(item.tab, item.section)}
						className="flex items-center gap-1 rounded-full border border-gray-600 px-2.5 py-0.5 text-xs text-gray-300 transition hover:border-brand hover:text-brand"
					>
						<CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
						{item.text}
					</button>
				</li>
			))}
		</ul>
	)
}
