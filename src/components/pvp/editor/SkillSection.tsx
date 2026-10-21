/**
 * One style's recommended skills, editable: the reader's chips by category
 * and tier (the order the site shows them), drag to reorder within a tier
 * group, a dialog per chip (tier, category, note, remove, move by keyboard),
 * and "+ Add skill" under each category, which opens the skill picker on
 * that category. With style "everyone" it is the Guide tab's general skills.
 */

import { useState } from "react"
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react"
import { SkillChip } from "../PvpTiles"
import { GalleryModal } from "../gallery/GalleryModal"
import { useFieldErrors, useGuideEditor } from "./GuideEditorContext"
import { MentionField } from "./MentionField"
import { PvpSkillPicker } from "./PvpSkillPicker"
import { SortableGroup, SortableItem } from "./Sortable"
import { ADD_BUTTON, DANGER_BUTTON, FIELD_ERROR, ICON_BUTTON, SECONDARY_BUTTON, SECTION_HEADING, SELECT, SUBTLE } from "./editorStyles"
import { addSkill, moveSkill, removeSkill, updateSkill } from "../../../utils/guideDocumentEdits"
import { CATEGORY_CHOICES, MAX_LENGTH, TIER_CHOICES } from "../../../utils/guideDocument"
import { SKILL_CATEGORY_LABELS, STYLE_LABELS } from "../../../utils/pvpGuide"
import type { GuideSkillRow } from "../../../types/guideDocument"
import type { PvpSkillCategory, PvpSkillRef, PvpStyle } from "../../../types/pvpGuide"

const tierRank = (tier: number | null) => (tier === null ? Number.MAX_SAFE_INTEGER : tier)

export function SkillSection({ style, title, hint }: { style: PvpStyle; title: string; hint?: string }) {
	const { document, update, index, hydrated } = useGuideEditor()
	const [picking, setPicking] = useState<PvpSkillCategory | null>(null)
	const [editing, setEditing] = useState<number | null>(null)

	const rows = document.skill_recommendations
		.map((row, i) => ({ row, i }))
		.filter(({ row }) => row.style === style)
	// The server's refs for this guide, for the chips' versions and uniques.
	const refs = new Map<number, PvpSkillRef>(hydrated.skill_recommendations.map((row) => [row.skill.id, row.skill]))
	const held = new Set(rows.map(({ row }) => `${row.category}:${row.skill}`))

	const categories = CATEGORY_CHOICES.map((category) => {
		const entries = rows.filter(({ row }) => row.category === category).sort((a, b) => tierRank(a.row.tier) - tierRank(b.row.tier) || a.i - b.i)
		const tiers: Array<{ tier: number | null; entries: typeof entries }> = []
		for (const entry of entries) {
			const last = tiers[tiers.length - 1]
			if (last && last.tier === entry.row.tier) last.entries.push(entry)
			else tiers.push({ tier: entry.row.tier, entries: [entry] })
		}
		return { category, tiers, count: entries.length }
	})
	const tab = style === "everyone" ? "guide" : style

	return (
		<section id={`editor-${tab}-skill_recommendations`} aria-label={title} className="flex flex-col gap-3">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h4 className={SECTION_HEADING}>{title}</h4>
				<span className={SUBTLE}>{hint ?? "By category, then tier. Drag within a tier to reorder."}</span>
			</div>
			<div className="flex flex-col gap-3 border-l-2 border-gray-700 pl-3">
				{categories.map(({ category, tiers, count }) => (
					<div key={category}>
						<h5 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
							{SKILL_CATEGORY_LABELS[category]}
							{count > 0 && <span className="ml-1 font-normal normal-case tracking-normal text-gray-500">({count})</span>}
						</h5>
						<div className="mt-1.5 flex flex-col gap-1.5">
							{tiers.map((group, position) => (
								<SortableGroup key={`${group.tier ?? "none"}-${position}`} ids={group.entries.map(({ i }) => i)} onMove={(from, to) => update((doc) => moveSkill(doc, from, to))}>
									<div className="flex flex-wrap items-center gap-1.5" role="list" aria-label={`${SKILL_CATEGORY_LABELS[category]} ${group.tier === null ? "skills" : `tier ${group.tier}`}`}>
										{group.tier !== null && (
											<span className="rounded border border-gray-600 bg-gray-900 px-1.5 py-0.5 text-xs font-bold text-gray-300">T{group.tier}</span>
										)}
										{group.entries.map(({ row, i }) => (
											<SkillItem key={`${row.skill}`} row={row} index={i} skillRef={refs.get(row.skill) ?? fallbackRef(row.skill, index.skillsById.get(row.skill)?.name)} onEdit={() => setEditing(i)} />
										))}
									</div>
								</SortableGroup>
							))}
							<button type="button" className={`${ADD_BUTTON} w-fit px-2 py-1`} onClick={() => setPicking(category)}>
								<Plus className="h-3.5 w-3.5" />
								Add skill
							</button>
						</div>
					</div>
				))}
			</div>

			{picking && (
				<PvpSkillPicker
					title={`Add a skill to ${style === "everyone" ? "every position" : STYLE_LABELS[style]}`}
					skills={index.catalogue.skills}
					category={picking}
					tier={null}
					blockReason={(id, category) => (held.has(`${category}:${id}`) ? `Already in ${SKILL_CATEGORY_LABELS[category]}` : null)}
					onPick={(id, category, tier) => {
						update((doc) => addSkill(doc, style, category, id, tier))
						setPicking(null)
					}}
					onClose={() => setPicking(null)}
				/>
			)}
			{editing !== null && document.skill_recommendations[editing] && <SkillDialog index={editing} onClose={() => setEditing(null)} />}
		</section>
	)
}

function fallbackRef(id: number, name?: string): PvpSkillRef {
	return { id, name: name ?? `Skill ${id}`, description: "", image: null, rarity: 1, unique_of: null, version: "", tier: 1, is_evolved: false, versions: [] }
}

function SkillItem({ row, index: i, skillRef, onEdit }: { row: GuideSkillRow; index: number; skillRef: PvpSkillRef; onEdit: () => void }) {
	const errors = useFieldErrors(`skill_recommendations[${i}].skill`)
	return (
		<SortableItem id={i} label={`Move ${skillRef.name}`} className="flex max-w-full flex-col">
			{(handle) => (
				<>
					<div className="flex max-w-full items-center gap-0.5">
						{handle}
						<SkillChip skill={skillRef} note={row.note} />
						<button type="button" className={ICON_BUTTON} aria-label={`Edit ${skillRef.name}`} title="Tier, category, note, remove" onClick={onEdit}>
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

function SkillDialog({ index: i, onClose }: { index: number; onClose: () => void }) {
	const { document, update, index } = useGuideEditor()
	const row = document.skill_recommendations[i]
	const name = index.skillsById.get(row.skill)?.name ?? `Skill ${row.skill}`
	const noteErrors = useFieldErrors(`skill_recommendations[${i}].note`)
	const siblings = document.skill_recommendations
		.map((candidate, position) => ({ candidate, position }))
		.filter(({ candidate }) => candidate.style === row.style && candidate.category === row.category && candidate.tier === row.tier)
		.map(({ position }) => position)
	const at = siblings.indexOf(i)
	const earlier = at > 0 ? siblings[at - 1] : null
	const later = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : null
	const taken = (category: PvpSkillCategory) =>
		document.skill_recommendations.some((other, position) => position !== i && other.style === row.style && other.category === category && other.skill === row.skill)

	return (
		<GalleryModal title={name} onClose={onClose}>
			<div className="flex flex-col gap-4">
				<div className="flex flex-wrap gap-4 text-sm text-gray-300">
					<label className="flex items-center gap-2">
						Category
						<select aria-label="Category" value={row.category} onChange={(change) => update((doc) => updateSkill(doc, i, { category: change.target.value as PvpSkillCategory }))} className={SELECT}>
							{CATEGORY_CHOICES.map((choice) => (
								<option key={choice} value={choice} disabled={choice !== row.category && taken(choice)}>
									{SKILL_CATEGORY_LABELS[choice]}
								</option>
							))}
						</select>
					</label>
					<label className="flex items-center gap-2">
						Tier
						<select aria-label="Tier" value={row.tier === null ? "" : String(row.tier)} onChange={(change) => update((doc) => updateSkill(doc, i, { tier: change.target.value === "" ? null : Number(change.target.value) }))} className={SELECT}>
							{TIER_CHOICES.map((choice) => (
								<option key={choice.label} value={choice.value === null ? "" : String(choice.value)}>
									{choice.label}
								</option>
							))}
						</select>
					</label>
				</div>
				<MentionField
					label="Note"
					value={row.note}
					maxLength={MAX_LENGTH.skill_note}
					placeholder="Why this skill: shown on the chip. ==red== and [[Skill]] work here."
					errors={noteErrors}
					onChange={(note) => update((doc) => updateSkill(doc, i, { note }))}
				/>
				<div className="flex flex-wrap items-center gap-2">
					<button type="button" className={SECONDARY_BUTTON} disabled={earlier === null} onClick={() => earlier !== null && update((doc) => moveSkill(doc, i, earlier))}>
						<ChevronUp className="h-4 w-4" />
						Move earlier
					</button>
					<button type="button" className={SECONDARY_BUTTON} disabled={later === null} onClick={() => later !== null && update((doc) => moveSkill(doc, i, later))}>
						<ChevronDown className="h-4 w-4" />
						Move later
					</button>
					<button
						type="button"
						className={`${DANGER_BUTTON} ml-auto flex items-center gap-1.5`}
						onClick={() => {
							update((doc) => removeSkill(doc, i))
							onClose()
						}}
					>
						<Trash2 className="h-4 w-4" />
						Remove
					</button>
				</div>
			</div>
		</GalleryModal>
	)
}
