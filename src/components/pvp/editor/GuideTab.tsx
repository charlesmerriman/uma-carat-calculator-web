/**
 * The editor's Guide tab: what applies to the whole team, in the order the
 * reader's side column shows it. Overview (scenario, style ranking, the two
 * markdown boxes), the stats table, team comps, the general skills, and the
 * editors' private notes.
 */

import { useState } from "react"
import { ChevronDown, Lock } from "lucide-react"
import { useCalculatorData } from "../../../services/CalculatorContext"
import { useFieldErrors, useGuideEditor } from "./GuideEditorContext"
import { MentionField } from "./MentionField"
import { SkillSection } from "./SkillSection"
import { StatsEditor } from "./StatsEditor"
import { TeamCompsEditor } from "./TeamCompsEditor"
import { INPUT, SECTION, SECTION_HEADING, SELECT, SUBTLE } from "./editorStyles"
import { setField, setScenario } from "../../../utils/guideDocumentEdits"
import { MAX_LENGTH } from "../../../utils/guideDocument"

export function GuideTab() {
	const { document, update } = useGuideEditor()
	const { scenarioData } = useCalculatorData()
	const rankingErrors = useFieldErrors("style_ranking")
	const descriptionErrors = useFieldErrors("short_description")
	const metaErrors = useFieldErrors("meta_analysis")
	const notesErrors = useFieldErrors("admin_comments")
	const [notesOpen, setNotesOpen] = useState(Boolean(document.admin_comments))

	return (
		<div className="flex flex-col gap-4">
			<section id="editor-guide-overview" aria-label="Overview" className={`${SECTION} flex flex-col gap-3`}>
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h3 className={SECTION_HEADING}>Overview</h3>
					<span className={SUBTLE}>Shown first, for the whole team.</span>
				</div>
				<label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400 sm:w-72">
					Scenario
					<select
						value={document.scenario ?? ""}
						onChange={(change) => update((doc) => setScenario(doc, change.target.value === "" ? null : Number(change.target.value)))}
						className={`${SELECT} normal-case tracking-normal`}
					>
						<option value="">Not set</option>
						{scenarioData.map((scenario) => (
							<option key={scenario.id} value={scenario.id}>
								{scenario.name}
							</option>
						))}
					</select>
				</label>
				<MentionField
					label="Style ranking"
					value={document.style_ranking}
					maxLength={MAX_LENGTH.style_ranking}
					placeholder="Front >> Runaway >= End > Late > Pace"
					errors={rankingErrors}
					onChange={(value) => update((doc) => setField(doc, "style_ranking", value))}
				/>
				<MentionField
					label="Short description"
					value={document.short_description}
					multiline
					markdown
					rows={4}
					placeholder="Mile on turf. ==Stamina 500 is enough==. Take [[Groundwork]] first."
					errors={descriptionErrors}
					onChange={(value) => update((doc) => setField(doc, "short_description", value))}
				/>
				<MentionField
					label="Meta analysis"
					value={document.meta_analysis}
					multiline
					markdown
					rows={6}
					placeholder="What wins this cup and why."
					errors={metaErrors}
					onChange={(value) => update((doc) => setField(doc, "meta_analysis", value))}
				/>
			</section>

			<div className={SECTION}>
				<StatsEditor />
			</div>
			<div className={SECTION}>
				<TeamCompsEditor />
			</div>
			<div className={SECTION}>
				<SkillSection style="everyone" title="General skills (every position)" hint="Shown once, under the overview. A position's own picks go on its tab." />
			</div>

			<section className={SECTION} aria-label="Notes for editors">
				<button type="button" aria-expanded={notesOpen} onClick={() => setNotesOpen(!notesOpen)} className="flex items-center gap-1.5 text-sm font-semibold text-gray-300 transition hover:text-brand">
					<ChevronDown className={`h-4 w-4 transition-transform ${notesOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
					<Lock className="h-3.5 w-3.5" aria-hidden="true" />
					Notes for editors
					<span className="font-normal text-gray-500">(never shown on the site)</span>
				</button>
				{notesOpen && (
					<textarea
						aria-label="Notes for editors"
						value={document.admin_comments}
						rows={3}
						onChange={(change) => update((doc) => setField(doc, "admin_comments", change.target.value))}
						className={`${INPUT} mt-2 w-full resize-y`}
					/>
				)}
				{notesErrors.map((message) => (
					<p key={message} className="mt-0.5 text-xs text-highlight" role="alert">
						{message}
					</p>
				))}
			</section>
		</div>
	)
}
