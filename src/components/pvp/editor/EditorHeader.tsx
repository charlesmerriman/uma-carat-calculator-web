/**
 * The strip over the editor: Draft or Published, the save line, undo and
 * redo, Save now, View as visitor, Publish, and the Actions menu (copy
 * from another guide, load from the sheet, fill track greens, the revision
 * history, delete).
 */

import { useRef } from "react"
import { CloudAlert, CloudCheck, Eye, Loader2, MoreHorizontal, Redo2, TriangleAlert, Undo2 } from "lucide-react"
import type { GuideSaveState } from "../../../hooks/useGuideDocument"
import { ACTION_BUTTON, ICON_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./editorStyles"

export type EditorDialog = "publish" | "copy" | "sheet" | "greens" | "revisions" | "delete"

export function SaveLine({ saveState, saveError, problems }: { saveState: GuideSaveState; saveError: string | null; problems: number }) {
	let icon = <CloudCheck className="h-4 w-4" />
	let text = "Saved"
	let tone = "text-gray-400"
	if (saveState === "pending") {
		icon = <Loader2 className="h-4 w-4 animate-spin" />
		text = "Saving soon…"
	} else if (saveState === "saving") {
		icon = <Loader2 className="h-4 w-4 animate-spin" />
		text = "Saving…"
	} else if (saveState === "invalid") {
		icon = <TriangleAlert className="h-4 w-4" />
		text = `Not saved: ${problems} ${problems === 1 ? "problem" : "problems"} to fix`
		tone = "text-highlight"
	} else if (saveState === "conflict") {
		icon = <TriangleAlert className="h-4 w-4" />
		text = "Not saved: someone else saved first"
		tone = "text-highlight"
	} else if (saveState === "error") {
		icon = <CloudAlert className="h-4 w-4" />
		text = "Not saved"
		tone = "text-highlight"
	}
	return (
		<span className={`flex items-center gap-1.5 text-xs font-medium ${tone}`} role="status" aria-live="polite" title={saveState === "error" ? (saveError ?? undefined) : undefined}>
			{icon}
			{text}
		</span>
	)
}

export function EditorHeader({ isPublished, saveState, saveError, problems, canUndo, canRedo, onUndo, onRedo, onSaveNow, onViewAsVisitor, onOpen }: {
	isPublished: boolean
	saveState: GuideSaveState
	saveError: string | null
	problems: number
	canUndo: boolean
	canRedo: boolean
	onUndo: () => void
	onRedo: () => void
	onSaveNow: () => void
	onViewAsVisitor: () => void
	onOpen: (dialog: EditorDialog) => void
}) {
	const menu = useRef<HTMLDetailsElement>(null)
	const choose = (dialog: EditorDialog) => {
		if (menu.current) menu.current.open = false
		onOpen(dialog)
	}
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-gray-800/60 px-3 py-2">
			<span
				className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
					isPublished ? "border-brand/50 bg-brand/10 text-brand" : "border-staging/60 bg-staging/10 text-gray-100"
				}`}
			>
				{isPublished ? "Published" : "Draft"}
			</span>
			<SaveLine saveState={saveState} saveError={saveError} problems={problems} />
			<span className="ml-auto flex flex-wrap items-center gap-1.5">
				<button type="button" className={ICON_BUTTON} aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
					<Undo2 className="h-4 w-4" />
				</button>
				<button type="button" className={ICON_BUTTON} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
					<Redo2 className="h-4 w-4" />
				</button>
				{(saveState === "pending" || saveState === "error") && (
					<button type="button" className={SECONDARY_BUTTON} onClick={onSaveNow}>
						Save now
					</button>
				)}
				<button type="button" className={ACTION_BUTTON} onClick={onViewAsVisitor}>
					<Eye className="h-4 w-4" aria-hidden="true" />
					View as visitor
				</button>
				<button type="button" className={isPublished ? SECONDARY_BUTTON : PRIMARY_BUTTON} onClick={() => onOpen("publish")}>
					{isPublished ? "Unpublish" : "Publish"}
				</button>
				<details ref={menu} className="relative">
					<summary className={`${ACTION_BUTTON} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label="More actions">
						<MoreHorizontal className="h-4 w-4" aria-hidden="true" />
						Actions
					</summary>
					<ul className="absolute right-0 top-full z-30 mt-1 w-60 rounded-lg border border-gray-600 bg-gray-900 py-1 text-sm shadow-lg" role="menu">
						{(
							[
								["copy", "Copy from another guide"],
								["sheet", "Load from the sheet"],
								["greens", "Fill track green skills"],
								["revisions", "Revision history"],
								["delete", "Delete this guide"],
							] as Array<[EditorDialog, string]>
						).map(([dialog, label]) => (
							<li key={dialog} role="none">
								<button
									type="button"
									role="menuitem"
									onClick={() => choose(dialog)}
									className={`block w-full px-3 py-1.5 text-left transition hover:bg-gray-800 ${dialog === "delete" ? "text-highlight" : "text-gray-200"}`}
								>
									{label}
								</button>
							</li>
						))}
					</ul>
				</details>
			</span>
		</div>
	)
}
