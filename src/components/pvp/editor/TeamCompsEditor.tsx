/**
 * The team comps list ("2 Front + 1 Pace", with a note), editable in place.
 * Small enough for up / down buttons instead of a drag.
 */

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { useFieldErrors, useGuideEditor } from "./GuideEditorContext"
import { MentionField } from "./MentionField"
import { ADD_BUTTON, ICON_BUTTON, SECTION_HEADING, SUBTLE } from "./editorStyles"
import { addTeamComp, moveTeamComp, removeTeamComp, updateTeamComp } from "../../../utils/guideDocumentEdits"
import { MAX_LENGTH } from "../../../utils/guideDocument"

export function TeamCompsEditor() {
	const { document, update } = useGuideEditor()
	const rows = document.team_comps
	return (
		<section id="editor-guide-team_comps" aria-label="Team comps" className="flex flex-col gap-2">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h4 className={SECTION_HEADING}>Team comps</h4>
				<span className={SUBTLE}>A recommended team shape and why.</span>
			</div>
			{rows.map((_, i) => (
				<TeamCompRow key={i} index={i} count={rows.length} />
			))}
			<button type="button" className={`${ADD_BUTTON} w-fit`} onClick={() => update((doc) => addTeamComp(doc))}>
				<Plus className="h-4 w-4" />
				Add a team comp
			</button>
		</section>
	)
}

function TeamCompRow({ index: i, count }: { index: number; count: number }) {
	const { document, update } = useGuideEditor()
	const row = document.team_comps[i]
	const textErrors = useFieldErrors(`team_comps[${i}].text`)
	const noteErrors = useFieldErrors(`team_comps[${i}].note`)
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-start">
			<MentionField label={`Team comp ${i + 1}`} value={row.text} maxLength={MAX_LENGTH.comp_text} placeholder="2 Front + 1 Pace" errors={textErrors} onChange={(text) => update((doc) => updateTeamComp(doc, i, { text }))} className="sm:w-56">
				<span />
			</MentionField>
			<MentionField label={`Note for team comp ${i + 1}`} value={row.note} maxLength={MAX_LENGTH.comp_note} placeholder="61% in sims" errors={noteErrors} onChange={(note) => update((doc) => updateTeamComp(doc, i, { note }))} className="min-w-0 flex-1">
				<span />
			</MentionField>
			<div className="flex items-center self-end sm:self-start sm:pt-5">
				<button type="button" className={ICON_BUTTON} aria-label="Move team comp up" disabled={i === 0} onClick={() => update((doc) => moveTeamComp(doc, i, i - 1))}>
					<ChevronUp className="h-4 w-4" />
				</button>
				<button type="button" className={ICON_BUTTON} aria-label="Move team comp down" disabled={i >= count - 1} onClick={() => update((doc) => moveTeamComp(doc, i, i + 1))}>
					<ChevronDown className="h-4 w-4" />
				</button>
				<button type="button" className={ICON_BUTTON} aria-label="Remove team comp" onClick={() => update((doc) => removeTeamComp(doc, i))}>
					<Trash2 className="h-4 w-4" />
				</button>
			</div>
		</div>
	)
}
