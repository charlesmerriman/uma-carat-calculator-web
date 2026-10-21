/**
 * An event with no guide yet: pick a scenario, start empty or from another
 * guide (every section copied in), and the editor opens on the new draft.
 */

import { useState } from "react"
import { Loader2, PenLine } from "lucide-react"
import { useCalculatorData } from "../../../services/CalculatorContext"
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SECTION, SELECT } from "./editorStyles"
import type { EditableGuideRow } from "../../../types/guideDocument"
import type { RaceEvent } from "../../../types"

export function StartGuide({ event, guides, onCreate }: {
	event: RaceEvent
	guides: EditableGuideRow[]
	onCreate: (options: { scenario: number | null; copyFrom: number | null }) => Promise<string | null>
}) {
	const { scenarioData } = useCalculatorData()
	const [scenario, setScenario] = useState<number | null>(null)
	const [copyFrom, setCopyFrom] = useState<number | null>(guides[0]?.id ?? null)
	const [busy, setBusy] = useState<"empty" | "copy" | null>(null)
	const [problem, setProblem] = useState<string | null>(null)

	const start = async (mode: "empty" | "copy") => {
		setBusy(mode)
		setProblem(null)
		const refused = await onCreate({ scenario, copyFrom: mode === "copy" ? copyFrom : null })
		setBusy(null)
		if (refused) setProblem(refused)
	}

	return (
		<section className={`${SECTION} flex flex-col gap-4`} aria-labelledby="start-guide">
			<div>
				<h3 id="start-guide" className="flex items-center gap-2 text-base font-semibold text-gray-100">
					<PenLine className="h-4 w-4 text-brand" aria-hidden="true" />
					No guide for {event.name} yet
				</h3>
				<p className="mt-1 text-sm text-gray-400">Start one as a draft. Only editors see it until you publish.</p>
			</div>
			<label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400 sm:w-72">
				Scenario
				<select value={scenario ?? ""} onChange={(change) => setScenario(change.target.value === "" ? null : Number(change.target.value))} className={`${SELECT} normal-case tracking-normal`}>
					<option value="">Not set</option>
					{scenarioData.map((row) => (
						<option key={row.id} value={row.id}>
							{row.name}
						</option>
					))}
				</select>
			</label>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
				<button type="button" className={`${PRIMARY_BUTTON} sm:w-auto`} disabled={busy !== null} onClick={() => start("empty")}>
					{busy === "empty" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
					Start empty
				</button>
				{guides.length > 0 && (
					<div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-2">
						<label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
							Or start from
							<select value={copyFrom ?? ""} onChange={(change) => setCopyFrom(Number(change.target.value))} className={`${SELECT} normal-case tracking-normal sm:w-72`}>
								{guides.map((guide) => (
									<option key={guide.id} value={guide.id}>
										{guide.name}
										{guide.is_published ? "" : " (draft)"}
									</option>
								))}
							</select>
						</label>
						<button type="button" className={SECONDARY_BUTTON} disabled={busy !== null || copyFrom === null} onClick={() => start("copy")}>
							{busy === "copy" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
							Copy it in
						</button>
					</div>
				)}
			</div>
			{problem && (
				<p className="text-xs text-highlight" role="alert">
					{problem}
				</p>
			)}
		</section>
	)
}
