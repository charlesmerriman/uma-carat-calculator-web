/**
 * One style's recommended umas, editable: the reader's tiles grouped by
 * stars (the order the site shows them), drag to reorder within a star
 * group, a star stepper under each tile, and a dialog for the rest (role,
 * note, remove, move by keyboard). "+ Add uma" opens the team builder's
 * picker, which already shows aptitude letters for this course and style.
 */

import { useState } from "react"
import { ChevronDown, ChevronUp, Minus, Pencil, Plus, Trash2 } from "lucide-react"
import { PvpCardPicker } from "../PvpCardPicker"
import { UmaTile } from "../PvpTiles"
import { GalleryModal } from "../gallery/GalleryModal"
import { useFieldErrors, useGuideEditor } from "./GuideEditorContext"
import { MentionField } from "./MentionField"
import { SortableGroup, SortableItem } from "./Sortable"
import { ADD_BUTTON, DANGER_BUTTON, FIELD_ERROR, ICON_BUTTON, SECONDARY_BUTTON, SECTION_HEADING, SUBTLE } from "./editorStyles"
import { addUma, moveUma, removeUma, updateUma } from "../../../utils/guideDocumentEdits"
import { MAX_LENGTH } from "../../../utils/guideDocument"
import { STYLE_LABELS } from "../../../utils/pvpGuide"
import { releaseNote } from "../../../utils/cardRelease"
import type { MemberStyle } from "../../../types/pvpTeam"
import type { GuideUmaRow } from "../../../types/guideDocument"

const EMPTY_SET = new Set<number>()
const STAR_GROUPS = [5, 4, 3, 2, 1]

export function UmaSection({ style }: { style: MemberStyle }) {
	const { document, update, index, event, releaseFor } = useGuideEditor()
	const [picking, setPicking] = useState(false)
	const [editing, setEditing] = useState<number | null>(null)

	const rows = document.uma_recommendations
		.map((row, i) => ({ row, i }))
		.filter(({ row }) => row.style === style)
	const held = new Set(rows.map(({ row }) => row.uma))
	const groups = STAR_GROUPS.map((stars) => ({ stars, entries: rows.filter(({ row }) => row.stars === stars) })).filter(
		(group) => group.entries.length > 0
	)

	return (
		<section id={`editor-${style}-uma_recommendations`} aria-label="Recommended umas" className="flex flex-col gap-2">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h4 className={SECTION_HEADING}>Recommended umas</h4>
				<span className={SUBTLE}>Most stars first. Drag within a star group to reorder.</span>
			</div>
			{groups.map((group) => (
				<SortableGroup key={group.stars} ids={group.entries.map(({ i }) => i)} onMove={(from, to) => update((doc) => moveUma(doc, from, to))}>
					<div className="flex flex-wrap gap-2" role="list" aria-label={`${group.stars} star umas`}>
						{group.entries.map(({ row, i }) => (
							<UmaItem key={`${row.uma}`} row={row} index={i} onEdit={() => setEditing(i)} />
						))}
					</div>
				</SortableGroup>
			))}
			<button type="button" className={`${ADD_BUTTON} w-fit`} onClick={() => setPicking(true)}>
				<Plus className="h-4 w-4" />
				Add uma
			</button>

			{picking && (
				<PvpCardPicker
					pool="uma"
					items={index.catalogue.umas}
					title={`Add an uma to ${STYLE_LABELS[style]}`}
					skillsById={index.skillsById}
					event={event}
					style={style}
					recommended={EMPTY_SET}
					blockReason={(id) => (held.has(id) ? `Already in ${STYLE_LABELS[style]}` : null)}
					noteFor={(id) => releaseNote(releaseFor("uma", id))}
					selectedId={null}
					onPick={(id) => {
						update((doc) => addUma(doc, style, id))
						setPicking(false)
					}}
					onClose={() => setPicking(false)}
				/>
			)}
			{editing !== null && document.uma_recommendations[editing] && (
				<UmaDialog index={editing} onClose={() => setEditing(null)} />
			)}
		</section>
	)
}

function UmaItem({ row, index: i, onEdit }: { row: GuideUmaRow; index: number; onEdit: () => void }) {
	const { update, index } = useGuideEditor()
	const errors = [...useFieldErrors(`uma_recommendations[${i}].uma`), ...useFieldErrors(`uma_recommendations[${i}].stars`)]
	const uma = index.umasById.get(row.uma)
	const ref = uma
		? { id: uma.id, name: uma.name, image: uma.image, portrait: uma.portrait }
		: { id: row.uma, name: `Uma ${row.uma}`, image: null, portrait: null }
	const setStars = (stars: number) => update((doc) => updateUma(doc, i, { stars: Math.min(5, Math.max(1, stars)) }))
	return (
		<SortableItem id={i} label={`Move ${ref.name}`} className="flex w-[7.5rem] flex-col gap-1">
			{(handle) => (
				<>
					<UmaTile uma={ref} stars={row.stars} role={row.role} note={row.note} className="w-full" />
					<div className="flex items-center justify-between">
						{handle}
						<span className="flex items-center" role="group" aria-label={`Stars for ${ref.name}`}>
							<button type="button" className={ICON_BUTTON} aria-label="One star fewer" disabled={row.stars <= 1} onClick={() => setStars(row.stars - 1)}>
								<Minus className="h-3.5 w-3.5" />
							</button>
							<button type="button" className={ICON_BUTTON} aria-label="One star more" disabled={row.stars >= 5} onClick={() => setStars(row.stars + 1)}>
								<Plus className="h-3.5 w-3.5" />
							</button>
						</span>
						<button type="button" className={ICON_BUTTON} aria-label={`Edit ${ref.name}`} title="Role, note, remove" onClick={onEdit}>
							<Pencil className="h-3.5 w-3.5" />
						</button>
					</div>
					{errors.map((message) => (
						<p key={message} className={FIELD_ERROR} role="alert">
							{message}
						</p>
					))}
				</>
			)}
		</SortableItem>
	)
}

/** Role, note, stars, position and removal for one uma row. */
function UmaDialog({ index: i, onClose }: { index: number; onClose: () => void }) {
	const { document, update, index } = useGuideEditor()
	const row = document.uma_recommendations[i]
	const name = index.umasById.get(row.uma)?.name ?? `Uma ${row.uma}`
	const roleErrors = useFieldErrors(`uma_recommendations[${i}].role`)
	const noteErrors = useFieldErrors(`uma_recommendations[${i}].note`)
	// The neighbours in the same style and star group, for the keyboard moves.
	const siblings = document.uma_recommendations
		.map((candidate, position) => ({ candidate, position }))
		.filter(({ candidate }) => candidate.style === row.style && candidate.stars === row.stars)
		.map(({ position }) => position)
	const at = siblings.indexOf(i)
	const earlier = at > 0 ? siblings[at - 1] : null
	const later = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : null

	return (
		<GalleryModal title={name} onClose={onClose}>
			<div className="flex flex-col gap-4">
				<label className="flex items-center gap-3 text-sm text-gray-300">
					Stars
					<select
						aria-label="Stars"
						value={row.stars}
						onChange={(change) => update((doc) => updateUma(doc, i, { stars: Number(change.target.value) }))}
						className="rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100"
					>
						{[5, 4, 3, 2, 1].map((stars) => (
							<option key={stars} value={stars}>
								{"★".repeat(stars)}
							</option>
						))}
					</select>
				</label>
				<MentionField
					label="Role"
					value={row.role}
					maxLength={MAX_LENGTH.uma_role}
					placeholder="A short tag on the picture, like Runaway blocker"
					errors={roleErrors}
					onChange={(role) => update((doc) => updateUma(doc, i, { role }))}
				/>
				<MentionField
					label="Note"
					value={row.note}
					maxLength={MAX_LENGTH.uma_note}
					placeholder="Shown on hover. ==red== and [[Skill]] work here."
					errors={noteErrors}
					onChange={(note) => update((doc) => updateUma(doc, i, { note }))}
				/>
				<div className="flex flex-wrap items-center gap-2">
					<button type="button" className={SECONDARY_BUTTON} disabled={earlier === null} onClick={() => earlier !== null && update((doc) => moveUma(doc, i, earlier))}>
						<ChevronUp className="h-4 w-4" />
						Move earlier
					</button>
					<button type="button" className={SECONDARY_BUTTON} disabled={later === null} onClick={() => later !== null && update((doc) => moveUma(doc, i, later))}>
						<ChevronDown className="h-4 w-4" />
						Move later
					</button>
					<button
						type="button"
						className={`${DANGER_BUTTON} ml-auto flex items-center gap-1.5`}
						onClick={() => {
							update((doc) => removeUma(doc, i))
							onClose()
						}}
					>
						<Trash2 className="h-4 w-4" />
						Remove from {STYLE_LABELS[row.style]}
					</button>
				</div>
			</div>
		</GalleryModal>
	)
}
