/**
 * The editor's dialogs, all on the gallery's native <dialog> (GalleryModal):
 * publish and unpublish, the three actions (copy from another guide, load
 * from the sheet, fill track greens), the revision history, delete, and the
 * choice when a save collided with someone else's.
 *
 * An action previews first and applies second, the admin's two-step shape;
 * the answer's document replaces the editor's (useGuideDocument.runAction).
 * Errors show inside the dialog: toasts sit below the top layer.
 */

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { GalleryModal } from "../gallery/GalleryModal"
import { Checklist } from "./Checklist"
import { DANGER_BUTTON, FIELD_ERROR, PRIMARY_BUTTON, SECONDARY_BUTTON, SELECT, SUBTLE } from "./editorStyles"
import { guideRevisionFetch, guideRevisionsFetch } from "../../../services/guideEditorFetchCalls"
import { formatDate } from "../../../utils/dateFormat"
import { formatTimeAgo } from "../../../utils/relativeDate"
import type { GuideActionResult, GuideEditor } from "../../../hooks/useGuideDocument"
import type { EditableGuideRow, GuideDocument, RevisionRow, RevisionSource } from "../../../types/guideDocument"
import type { ChecklistItem, EditorTab } from "../../../utils/guideDocument"

const SECTION_LABELS: Array<[string, string]> = [
	["overview", "Overview text and style ranking"],
	["stat_configs", "Recommended stats"],
	["team_comps", "Team comps"],
	["uma_recommendations", "Recommended umas"],
	["style_notes", "Advice per style"],
	["skill_recommendations", "Recommended skills"],
	["decks", "Example decks and their cards"],
]

const SOURCE_LABELS: Record<RevisionSource, string> = {
	site: "the site",
	admin: "the admin",
	sheet: "the sheet",
	copy: "a copy",
	track_greens: "track greens",
	restore: "a restore",
	publish: "published",
	unpublish: "unpublished",
}

function errorOf(result: GuideActionResult, fallback: string): string {
	return typeof result.body.error === "string" ? result.body.error : fallback
}

// ── Publish ──────────────────────────────────────────────────────────────────

export function PublishDialog({ isPublished, missing, errors, onConfirm, onClose }: {
	isPublished: boolean
	missing: ChecklistItem[]
	errors: Map<EditorTab, number>
	onConfirm: () => Promise<string | null>
	onClose: () => void
}) {
	const [busy, setBusy] = useState(false)
	const [problem, setProblem] = useState<string | null>(null)
	const hasErrors = [...errors.values()].some((count) => count > 0)
	const confirm = async () => {
		setBusy(true)
		const refused = await onConfirm()
		setBusy(false)
		if (refused) setProblem(refused)
		else onClose()
	}
	return (
		<GalleryModal title={isPublished ? "Unpublish this guide?" : "Publish this guide?"} onClose={onClose}>
			<div className="flex flex-col gap-4 text-sm text-gray-300">
				{isPublished ? (
					<p>Visitors stop seeing it at once. The Timeline card loses its guide link. Editors still see it as a draft.</p>
				) : (
					<>
						<p>Everyone sees it at once, and the event's Timeline card gets a guide link. Edits after this go live as you make them.</p>
						<Checklist missing={missing} errors={errors} onJump={onClose} />
						{hasErrors && <p className={FIELD_ERROR}>The last save was refused. Fix the problems first, or the guide stays as it was last saved.</p>}
					</>
				)}
				{problem && (
					<p className={FIELD_ERROR} role="alert">
						{problem}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
						Not now
					</button>
					<button type="button" className={PRIMARY_BUTTON} disabled={busy || hasErrors} onClick={confirm}>
						{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
						{isPublished ? "Unpublish" : "Publish"}
					</button>
				</div>
			</div>
		</GalleryModal>
	)
}

// ── Conflict ─────────────────────────────────────────────────────────────────

export function ConflictDialog({ onLoadTheirs, onKeepMine }: { onLoadTheirs: () => void; onKeepMine: () => Promise<void> }) {
	const [busy, setBusy] = useState(false)
	return (
		<GalleryModal title="Someone saved this guide since you opened it" onClose={onLoadTheirs}>
			<div className="flex flex-col gap-4 text-sm text-gray-300">
				<p>Another editor's save landed first. Load theirs to start from it (your unsaved changes are dropped), or keep yours to save over it. Theirs stays in the revision history either way.</p>
				<div className="flex justify-end gap-2">
					<button type="button" className={SECONDARY_BUTTON} onClick={onLoadTheirs}>
						Load theirs
					</button>
					<button
						type="button"
						className={PRIMARY_BUTTON}
						disabled={busy}
						onClick={async () => {
							setBusy(true)
							await onKeepMine()
							setBusy(false)
						}}
					>
						Keep mine
					</button>
				</div>
			</div>
		</GalleryModal>
	)
}

// ── Copy from another guide ──────────────────────────────────────────────────

export function CopyFromDialog({ guides, currentId, runAction, onClose }: {
	guides: EditableGuideRow[]
	currentId: number
	runAction: GuideEditor["runAction"]
	onClose: () => void
}) {
	const choices = guides.filter((guide) => guide.id !== currentId)
	const [source, setSource] = useState<number | null>(choices[0]?.id ?? null)
	const [sections, setSections] = useState<string[]>(SECTION_LABELS.map(([key]) => key))
	const [preview, setPreview] = useState<Record<string, number> | null>(null)
	const [busy, setBusy] = useState(false)
	const [problem, setProblem] = useState<string | null>(null)
	const [done, setDone] = useState(false)

	const run = async (apply: boolean) => {
		if (source === null) return
		setBusy(true)
		setProblem(null)
		const result = await runAction("copy-from", { source, sections, preview: !apply })
		setBusy(false)
		if (!result.ok) {
			setProblem(errorOf(result, "The copy didn't go through."))
			return
		}
		setPreview(result.body.counts as Record<string, number>)
		if (apply) setDone(true)
	}

	return (
		<GalleryModal title="Copy from another guide" onClose={onClose}>
			<div className="flex flex-col gap-4 text-sm text-gray-300">
				<p>Rows are added to what this guide already has; nothing is overwritten. A row that is already here (the same uma for a style, say) is skipped. Overview text fills only blank fields.</p>
				<label className="flex flex-col gap-1">
					<span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Copy from</span>
					<select value={source ?? ""} onChange={(change) => setSource(Number(change.target.value))} className={SELECT} disabled={choices.length === 0}>
						{choices.map((guide) => (
							<option key={guide.id} value={guide.id}>
								{guide.name}
								{guide.is_published ? "" : " (draft)"}
							</option>
						))}
					</select>
				</label>
				<fieldset className="flex flex-col gap-1">
					<legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">Sections</legend>
					{SECTION_LABELS.map(([key, label]) => (
						<label key={key} className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={sections.includes(key)}
								onChange={(change) => setSections(change.target.checked ? [...sections, key] : sections.filter((kept) => kept !== key))}
							/>
							{label}
						</label>
					))}
				</fieldset>
				{preview && (
					<div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{done ? "Copied" : "Would copy"}</p>
						<ul className="mt-1 grid grid-cols-2 gap-x-4 text-gray-200">
							{SECTION_LABELS.filter(([key]) => key in preview).map(([key, label]) => (
								<li key={key}>
									{preview[key]} · {label}
								</li>
							))}
						</ul>
					</div>
				)}
				{problem && (
					<p className={FIELD_ERROR} role="alert">
						{problem}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
						{done ? "Done" : "Cancel"}
					</button>
					{!done && (
						<>
							<button type="button" className={SECONDARY_BUTTON} disabled={busy || source === null} onClick={() => run(false)}>
								Preview
							</button>
							<button type="button" className={PRIMARY_BUTTON} disabled={busy || source === null} onClick={() => run(true)}>
								{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
								Copy
							</button>
						</>
					)}
				</div>
			</div>
		</GalleryModal>
	)
}

// ── Load from the sheet ──────────────────────────────────────────────────────

interface SheetSummary {
	source: string
	counts: Record<string, number>
	unmatched: Array<[string, string[]]>
	accel_picks: number
	preview: boolean
}

export function SheetDialog({ runAction, onClose }: { runAction: GuideEditor["runAction"]; onClose: () => void }) {
	const [summary, setSummary] = useState<SheetSummary | null>(null)
	const [busy, setBusy] = useState(false)
	const [problem, setProblem] = useState<string | null>(null)

	const run = async (apply: boolean) => {
		setBusy(true)
		setProblem(null)
		const result = await runAction("sheet", { preview: !apply })
		setBusy(false)
		if (!result.ok) {
			setProblem(errorOf(result, "The sheet couldn't be read."))
			return
		}
		setSummary(result.body.summary as SheetSummary)
	}
	const done = summary !== null && !summary.preview

	return (
		<GalleryModal title="Load from the community sheet" onClose={onClose}>
			<div className="flex flex-col gap-4 text-sm text-gray-300">
				<p>Reads the sheet's guide for this event (the cup tab if there is one, else the ImportRange block) into this guide. Applying replaces every section with the sheet's; Published stays as it is. Preview first.</p>
				{summary && (
					<div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
							{done ? "Loaded" : "Would load"} from "{summary.source}"
						</p>
						<ul className="mt-1 grid grid-cols-2 gap-x-4 text-gray-200">
							{Object.entries(summary.counts).map(([key, count]) => (
								<li key={key}>
									{count} · {key}
								</li>
							))}
						</ul>
						{summary.accel_picks > 0 && <p className={`${SUBTLE} mt-1`}>{summary.accel_picks} acceleration picks read from the prose.</p>}
						{summary.unmatched.map(([label, names]) => (
							<p key={label} className="mt-2 text-xs text-highlight">
								{label}: {names.join(", ")}
							</p>
						))}
					</div>
				)}
				{problem && (
					<p className={FIELD_ERROR} role="alert">
						{problem}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
						{done ? "Done" : "Cancel"}
					</button>
					{!done && (
						<>
							<button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => run(false)}>
								{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
								Preview
							</button>
							<button type="button" className={PRIMARY_BUTTON} disabled={busy || summary === null} onClick={() => run(true)}>
								Replace the guide with the sheet's
							</button>
						</>
					)}
				</div>
			</div>
		</GalleryModal>
	)
}

// ── Fill track green skills ──────────────────────────────────────────────────

interface TrackSkill {
	id: number
	name: string
	version: string
	image: string | null
}

export function TrackGreensDialog({ runAction, onClose }: { runAction: GuideEditor["runAction"]; onClose: () => void }) {
	const [preview, setPreview] = useState<{ add: TrackSkill[]; already: TrackSkill[]; problems: string[] } | null>(null)
	const [added, setAdded] = useState<TrackSkill[] | null>(null)
	const [busy, setBusy] = useState(false)
	const [problem, setProblem] = useState<string | null>(null)

	useEffect(() => {
		let live = true
		;(async () => {
			const result = await runAction("track-greens", { preview: true })
			if (!live) return
			if (!result.ok) setProblem(errorOf(result, "The track couldn't be read."))
			else setPreview(result.body as { add: TrackSkill[]; already: TrackSkill[]; problems: string[] })
		})()
		return () => {
			live = false
		}
	}, [runAction])

	const apply = async () => {
		setBusy(true)
		const result = await runAction("track-greens", { preview: false })
		setBusy(false)
		if (!result.ok) {
			setProblem(errorOf(result, "That didn't go through."))
			return
		}
		setAdded(result.body.added as TrackSkill[])
	}

	const list = (skills: TrackSkill[]) => (
		<ul className="mt-1 flex flex-wrap gap-1.5">
			{skills.map((skill) => (
				<li key={skill.id} className="flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800 py-0.5 pl-0.5 pr-2 text-sm text-gray-100">
					{skill.image ? <img src={skill.image} alt="" className="h-5 w-5" /> : <span className="h-5 w-5 rounded-full bg-gray-700" aria-hidden="true" />}
					{skill.name}
				</li>
			))}
		</ul>
	)

	return (
		<GalleryModal title="Fill track green skills" onClose={onClose}>
			<div className="flex flex-col gap-4 text-sm text-gray-300">
				<p>Adds the green skills this event's track calls for (racecourse, direction, ground, season, weather, distance) to the general skills. Skills the guide already has, in any version, are left alone.</p>
				{!preview && !problem && (
					<p className="flex items-center gap-2 text-gray-400">
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						Reading the track…
					</p>
				)}
				{added ? (
					<div>
						<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Added</p>
						{added.length > 0 ? list(added) : <p className={SUBTLE}>Nothing to add: the guide already has them all.</p>}
					</div>
				) : (
					preview && (
						<>
							<div>
								<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Would add</p>
								{preview.add.length > 0 ? list(preview.add) : <p className={SUBTLE}>Nothing: the guide already has every track skill.</p>}
							</div>
							{preview.already.length > 0 && (
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Already in the guide</p>
									{list(preview.already)}
								</div>
							)}
							{preview.problems.map((text) => (
								<p key={text} className="text-xs text-highlight">
									{text}
								</p>
							))}
						</>
					)
				)}
				{problem && (
					<p className={FIELD_ERROR} role="alert">
						{problem}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
						{added ? "Done" : "Cancel"}
					</button>
					{!added && (
						<button type="button" className={PRIMARY_BUTTON} disabled={busy || !preview || preview.add.length === 0} onClick={apply}>
							{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
							Add {preview ? preview.add.length : ""} skills
						</button>
					)}
				</div>
			</div>
		</GalleryModal>
	)
}

// ── Revisions ────────────────────────────────────────────────────────────────

export function RevisionsDialog({ guideId, onRestore, onClose }: {
	guideId: number
	onRestore: (document: GuideDocument) => void
	onClose: () => void
}) {
	const [rows, setRows] = useState<RevisionRow[] | null>(null)
	const [problem, setProblem] = useState<string | null>(null)
	const [restoring, setRestoring] = useState<number | null>(null)

	useEffect(() => {
		let live = true
		guideRevisionsFetch(guideId)
			.then(async (response) => {
				if (!response.ok) throw new Error(`revisions ${response.status}`)
				const list = (await response.json()) as RevisionRow[]
				if (live) setRows(list)
			})
			.catch(() => {
				if (live) setProblem("The history didn't load.")
			})
		return () => {
			live = false
		}
	}, [guideId])

	const restore = async (number: number) => {
		setRestoring(number)
		try {
			const response = await guideRevisionFetch(guideId, number)
			if (!response.ok) throw new Error(`revision ${response.status}`)
			const body = (await response.json()) as { document: GuideDocument }
			onRestore(body.document)
			onClose()
		} catch {
			setProblem("That revision couldn't be loaded.")
			setRestoring(null)
		}
	}

	const countLine = (row: RevisionRow) => {
		const parts: string[] = []
		if (row.counts.uma_recommendations) parts.push(`${row.counts.uma_recommendations} umas`)
		if (row.counts.skill_recommendations) parts.push(`${row.counts.skill_recommendations} skills`)
		if (row.counts.decks) parts.push(`${row.counts.decks} decks`)
		return parts.join(", ")
	}

	return (
		<GalleryModal title="Revision history" onClose={onClose}>
			<div className="flex flex-col gap-3 text-sm text-gray-300">
				<p>Every save, newest first. Restore puts that version back as a new save; nothing is lost.</p>
				{rows === null && !problem && (
					<p className="flex items-center gap-2 text-gray-400">
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						Loading…
					</p>
				)}
				{rows && rows.length === 0 && <p className={SUBTLE}>No saves yet.</p>}
				{rows && rows.length > 0 && (
					<ol className="flex flex-col divide-y divide-gray-700">
						{rows.map((row, position) => (
							<li key={row.number} className="flex items-center gap-3 py-2">
								<div className="min-w-0 flex-1">
									<p className="text-gray-100">
										#{row.number} · {row.is_you ? "you" : (row.by ?? "someone")} · {SOURCE_LABELS[row.source]}
									</p>
									<p className={SUBTLE} title={formatDate(row.saved_at)}>
										{formatTimeAgo(row.saved_at)}
										{countLine(row) && ` · ${countLine(row)}`}
									</p>
								</div>
								{position > 0 && (
									<button type="button" className={SECONDARY_BUTTON} disabled={restoring !== null} onClick={() => restore(row.number)}>
										{restoring === row.number ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Restore"}
									</button>
								)}
							</li>
						))}
					</ol>
				)}
				{problem && (
					<p className={FIELD_ERROR} role="alert">
						{problem}
					</p>
				)}
			</div>
		</GalleryModal>
	)
}

// ── Delete ───────────────────────────────────────────────────────────────────

export function DeleteDialog({ isPublished, onConfirm, onClose }: { isPublished: boolean; onConfirm: () => Promise<string | null>; onClose: () => void }) {
	const [busy, setBusy] = useState(false)
	const [problem, setProblem] = useState<string | null>(null)
	return (
		<GalleryModal title="Delete this guide?" onClose={onClose}>
			<div className="flex flex-col gap-4 text-sm text-gray-300">
				{isPublished ? (
					<p>A published guide can't be deleted. Unpublish it first.</p>
				) : (
					<p>Every section and its history go. There is no undo past this point.</p>
				)}
				{problem && (
					<p className={FIELD_ERROR} role="alert">
						{problem}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
						Keep it
					</button>
					{!isPublished && (
						<button
							type="button"
							className={`${DANGER_BUTTON} px-3 py-1.5`}
							disabled={busy}
							onClick={async () => {
								setBusy(true)
								const refused = await onConfirm()
								setBusy(false)
								if (refused) setProblem(refused)
								else onClose()
							}}
						>
							Delete the guide
						</button>
					)}
				</div>
			</div>
		</GalleryModal>
	)
}
