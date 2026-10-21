/**
 * One running style's tab: what the reader's tab of that name shows, in
 * the same order, each section editable: umas, the advice paragraph,
 * skills, the example decks.
 */

import { useFieldErrors, useGuideEditor } from "./GuideEditorContext"
import { DeckSection } from "./DeckSection"
import { MentionField } from "./MentionField"
import { SkillSection } from "./SkillSection"
import { UmaSection } from "./UmaSection"
import { SECTION } from "./editorStyles"
import { setStyleNote } from "../../../utils/guideDocumentEdits"
import { STYLE_LABELS } from "../../../utils/pvpGuide"
import type { MemberStyle } from "../../../types/pvpTeam"

export function StyleTab({ style }: { style: MemberStyle }) {
	const { document, update } = useGuideEditor()
	const noteIndex = document.style_notes.findIndex((row) => row.style === style)
	const note = noteIndex === -1 ? "" : document.style_notes[noteIndex].body
	const noteErrors = useFieldErrors(`style_notes[${noteIndex}].body`)

	return (
		<div className="flex flex-col gap-4">
			<div className={SECTION}>
				<UmaSection style={style} />
			</div>
			<section id={`editor-${style}-style_notes`} className={SECTION} aria-label={`Advice for ${STYLE_LABELS[style]}`}>
				<MentionField
					label={`Advice for ${STYLE_LABELS[style]}`}
					value={note}
					multiline
					markdown
					rows={5}
					placeholder="The paragraph under the umas: how to build and run this style. Leave it empty for no box."
					errors={noteErrors}
					onChange={(body) => update((doc) => setStyleNote(doc, style, body))}
				/>
			</section>
			<div className={SECTION}>
				<SkillSection style={style} title="Recommended skills" />
			</div>
			<div className={SECTION}>
				<DeckSection style={style} />
			</div>
		</div>
	)
}
