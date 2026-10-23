/**
 * The PvP page's Edit view: one event's guide, edited where the reader sees
 * it. Loaded lazily (loadGuideEditor.ts) and drawn only for an account whose
 * `guide_editor` flag is on; every write is checked again by the API.
 *
 * The pieces: the document and its saves (hooks/useGuideDocument.ts), the
 * catalogue (hooks/usePvpCatalogue.ts) that every tile, chip and picker
 * draws from, the document hydrated into the reader's shape
 * (utils/guideDocument.ts) so the reader's own components draw it, and the
 * same checks the server runs, shown while typing.
 *
 * The tab strip is the reader's (Guide, then the five styles); the tab is
 * local to the editor, since the reader's ?style= means a tab with content
 * and an editor opens empty ones.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useCalculatorData } from "../../../services/CalculatorContext"
import { usePvpCatalogue } from "../../../hooks/usePvpCatalogue"
import { useSkillList } from "../../../hooks/useSkillList"
import { withShownSkills } from "../../../utils/skillList"
import { useCardReleases } from "../../../hooks/useCardReleases"
import { useGuideDocument } from "../../../hooks/useGuideDocument"
import { SkillMentionsContext } from "../skillMentionsContext"
import { GuideEditorContext, type GuideEditorContextType } from "./GuideEditorContext"
import { Checklist } from "./Checklist"
import { EditorHeader, type EditorDialog } from "./EditorHeader"
import { EditorTabs } from "./EditorTabs"
import { GuideTab } from "./GuideTab"
import { StartGuide } from "./StartGuide"
import { StyleTab } from "./StyleTab"
import { ConflictDialog, CopyFromDialog, DeleteDialog, PublishDialog, RevisionsDialog, SheetDialog, TrackGreensDialog } from "./EditorDialogs"
import { errorsByTab, hydrateGuide, missingSummary, rowsByTab, validateDocument, type ChecklistItem, type EditorTab } from "../../../utils/guideDocument"
import type { EditorError } from "../../../types/guideDocument"
import type { RaceEvent } from "../../../types"

function Notice({ children }: { children: string }) {
	return <p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">{children}</p>
}

export function GuideEditor({ event, onViewAsVisitor, autosaveMs }: {
	event: RaceEvent
	onViewAsVisitor: () => void
	/** For tests: how long after the last edit the save goes. */
	autosaveMs?: number
}) {
	const editor = useGuideDocument(event, { autosaveMs })
	const catalogue = usePvpCatalogue()
	// Every skill with an English name, JP-only ones too, for the picker and
	// [[mentions]]. If it fails the editor still works with global's skills.
	const skillList = useSkillList()
	// Rebuilt only when either changes, so the editor's memos (hydration,
	// validation) don't rerun on every render.
	const index = useMemo(
		() => (catalogue.status === "ready" ? { ...withShownSkills(catalogue, skillList), status: "ready" as const } : null),
		[catalogue, skillList]
	)
	const { scenarioData } = useCalculatorData()
	const [tab, setTab] = useState<EditorTab>("guide")
	const [dialog, setDialog] = useState<EditorDialog | null>(null)

	// Ctrl+Z / Ctrl+Shift+Z anywhere in the editor that is not a text box
	// (a text box keeps the browser's own undo of what was typed).
	useEffect(() => {
		const onKey = (key: KeyboardEvent) => {
			if (!(key.ctrlKey || key.metaKey) || key.key.toLowerCase() !== "z") return
			const target = key.target as HTMLElement | null
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
			key.preventDefault()
			if (key.shiftKey) editor.redo()
			else editor.undo()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [editor])

	if (editor.state.status === "error") return <Notice>{editor.state.message}</Notice>
	if (catalogue.status === "error") return <Notice>The uma and card list didn't load. Reload the page to try again.</Notice>
	if (editor.state.status === "loading" || index === null) {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading the editor…
			</div>
		)
	}
	if (editor.state.status === "none" || !editor.document) {
		return <StartGuide event={event} guides={editor.guides} onCreate={editor.create} />
	}

	return (
		<ReadyEditor
			event={event}
			editor={editor}
			index={index}
			scenarios={scenarioData}
			tab={tab}
			onTab={setTab}
			dialog={dialog}
			onDialog={setDialog}
			onViewAsVisitor={onViewAsVisitor}
		/>
	)
}

type Ready = Extract<ReturnType<typeof useGuideDocument>, { document: unknown }>

function ReadyEditor({ event, editor, index, scenarios, tab, onTab, dialog, onDialog, onViewAsVisitor }: {
	event: RaceEvent
	editor: Ready
	index: Extract<ReturnType<typeof usePvpCatalogue>, { status: "ready" }>
	scenarios: ReturnType<typeof useCalculatorData>["scenarioData"]
	tab: EditorTab
	onTab: (tab: EditorTab) => void
	dialog: EditorDialog | null
	onDialog: (dialog: EditorDialog | null) => void
	onViewAsVisitor: () => void
}) {
	const document = editor.document as NonNullable<Ready["document"]>
	const releaseFor = useCardReleases(event, index)
	const hydrated = useMemo(() => hydrateGuide(document, index, scenarios, editor.serverGuide), [document, index, scenarios, editor.serverGuide])
	// The server's refusal when the last save was refused; the editor's own
	// checks otherwise, so a problem shows while it is typed.
	const errors: EditorError[] = useMemo(
		() => (editor.saveState === "invalid" ? editor.errors : validateDocument(document, index)),
		[document, index, editor.errors, editor.saveState]
	)
	const problemsByTab = useMemo(() => errorsByTab(errors, document), [errors, document])
	const rows = useMemo(() => rowsByTab(document), [document])
	const missing = useMemo(() => missingSummary(document), [document])

	const jump = useCallback(
		(target: EditorTab, section: ChecklistItem["section"]) => {
			onTab(target)
			onDialog(null)
			// After the tab has rendered.
			window.setTimeout(() => {
				const id = section === "any" ? null : `editor-${target}-${section}`
				const element = id ? window.document.getElementById(id) : null
				element?.scrollIntoView({ behavior: "smooth", block: "start" })
			}, 50)
		},
		[onDialog, onTab]
	)

	const context: GuideEditorContextType = useMemo(
		() => ({ document, update: editor.update, index, event, errors, hydrated, releaseFor }),
		[document, editor.update, index, event, errors, hydrated, releaseFor]
	)

	const closeDialog = () => onDialog(null)

	return (
		<GuideEditorContext.Provider value={context}>
			<SkillMentionsContext.Provider value={hydrated.skill_mentions ?? {}}>
				<div className="flex flex-col gap-3">
					<EditorHeader
						isPublished={document.is_published}
						saveState={editor.saveState}
						saveError={editor.saveError}
						problems={errors.length}
						canUndo={editor.canUndo}
						canRedo={editor.canRedo}
						onUndo={editor.undo}
						onRedo={editor.redo}
						onSaveNow={() => void editor.saveNow()}
						onViewAsVisitor={() => {
							void editor.saveNow()
							onViewAsVisitor()
						}}
						onOpen={onDialog}
					/>
					<Checklist missing={missing} errors={problemsByTab} onJump={jump} />
					<EditorTabs tab={tab} rows={rows} errors={problemsByTab} onChange={onTab} />
					<div role="tabpanel" aria-label={tab === "guide" ? "Guide" : tab}>
						{tab === "guide" ? <GuideTab /> : <StyleTab style={tab} />}
					</div>
				</div>

				{editor.conflict && <ConflictDialog onLoadTheirs={editor.loadTheirs} onKeepMine={editor.keepMine} />}
				{dialog === "publish" && (
					<PublishDialog
						isPublished={document.is_published}
						missing={missing}
						errors={problemsByTab}
						onConfirm={async () => {
							const refused = await editor.publish(!document.is_published)
							if (!refused) toast.success(document.is_published ? "Guide unpublished." : "Guide published.")
							return refused
						}}
						onClose={closeDialog}
					/>
				)}
				{dialog === "copy" && <CopyFromDialog guides={editor.guides} currentId={document.id} runAction={editor.runAction} onClose={closeDialog} />}
				{dialog === "sheet" && <SheetDialog runAction={editor.runAction} onClose={closeDialog} />}
				{dialog === "greens" && <TrackGreensDialog runAction={editor.runAction} onClose={closeDialog} />}
				{dialog === "revisions" && (
					<RevisionsDialog
						guideId={document.id}
						onRestore={(old) => {
							editor.restore(old)
							toast.success("Revision restored. It saves in a moment.")
						}}
						onClose={closeDialog}
					/>
				)}
				{dialog === "delete" && (
					<DeleteDialog
						isPublished={document.is_published}
						onConfirm={async () => {
							const refused = await editor.remove()
							if (!refused) toast.success("Guide deleted.")
							return refused
						}}
						onClose={closeDialog}
					/>
				)}
			</SkillMentionsContext.Provider>
		</GuideEditorContext.Provider>
	)
}

export default GuideEditor

