/**
 * The guide editor's state: one event's guide as a document, edited in
 * memory, saved whole after a short pause, with undo, the server's refusals
 * beside the fields, and the other editor's version when a save collides.
 *
 * HOW A SAVE GOES. An edit replaces the document (pure functions in
 * utils/guideDocumentEdits.ts), pushes the old one on the undo stack and
 * starts the autosave timer (hooks/useAutoSave.ts). The save PUTs the whole
 * document with the version it started from and gets back the saved
 * document and the reader's shape of it, which primes the Recommendations
 * view's cache (hooks/usePvpGuide.ts). If nothing was typed while the save
 * was out, the server's copy replaces ours (new decks gain their ids); if
 * something was, only the version is taken and the next save carries the
 * rest.
 *
 * WHAT A REFUSAL MEANS. 400: the document is kept, its problems shown by
 * path, and the next change tries again. 409: someone else saved first; the
 * editor stops saving until the person chooses "Load theirs" or "Keep mine"
 * (keep = save again over their version; theirs stays in the history).
 * Anything else: "Not saved", the next change tries again.
 *
 * Undo carries the CURRENT version with it: an undone document is older
 * content, not an older version, or every undo would collide with itself.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAutoSave } from "./useAutoSave"
import { forgetPvpGuide, primePvpGuide } from "./usePvpGuide"
import {
	guideAction,
	guideCreate,
	guideDelete,
	guideDocumentFetch,
	guideDocumentPut,
	guideEditableFetch,
	guidePublish,
	guideRefusalText,
	type GuideActionName,
} from "../services/guideEditorFetchCalls"
import { toPayload } from "../utils/guideDocument"
import { refForRaceEvent, sameEvent, type PvpEventRef } from "../utils/pvpEvent"
import type { EditableGuideRow, EditableList, EditorError, GuideDocument } from "../types/guideDocument"
import type { PvpGuide } from "../types/pvpGuide"
import type { RaceEvent } from "../types"

/** How long after the last edit the document is saved. */
export const GUIDE_AUTOSAVE_MS = 2000
/** How many documents the undo stack keeps. */
const UNDO_DEPTH = 100

export type GuideSaveState = "saved" | "pending" | "saving" | "invalid" | "conflict" | "error"

export type GuideEditorStatus =
	| { status: "loading" }
	/** The account may not edit (the API said 403) or the list failed. */
	| { status: "error"; message: string }
	/** No guide for this event yet; `guides` is what "Start from" offers. */
	| { status: "none" }
	| { status: "ready" }

export interface GuideActionResult {
	ok: boolean
	status: number
	body: Record<string, unknown>
}

export interface GuideEditor {
	state: GuideEditorStatus
	document: GuideDocument | null
	/** The last answer the server gave in the reader's shape, for chips' versions. */
	serverGuide: PvpGuide | null
	saveState: GuideSaveState
	/** The sentence behind an "error" save state, when the API gave one. */
	saveError: string | null
	errors: EditorError[]
	/** The other person's document, while a 409 is unresolved. */
	conflict: GuideDocument | null
	canUndo: boolean
	canRedo: boolean
	/** Every guide the account may edit (for "Start from" and "Copy from"). */
	guides: EditableGuideRow[]
	update: (change: (document: GuideDocument) => GuideDocument) => void
	undo: () => void
	redo: () => void
	saveNow: () => Promise<void>
	/** 409: take the other person's document. */
	loadTheirs: () => void
	/** 409: save mine over theirs. */
	keepMine: () => Promise<void>
	create: (options: { scenario: number | null; copyFrom: number | null }) => Promise<string | null>
	publish: (isPublished: boolean) => Promise<string | null>
	remove: () => Promise<string | null>
	/** Flushes the autosave, runs the action, and takes the document it answers with. */
	runAction: (name: GuideActionName, body: Record<string, unknown>) => Promise<GuideActionResult>
	/** Replace the document with an earlier revision's (a save follows). */
	restore: (document: GuideDocument) => void
}

const FAILED = "The guide couldn't be saved. Your next change will try again."
const NOT_AN_EDITOR = "This account can't edit guides."

type SaveAnswer = { document: GuideDocument; guide: PvpGuide }

function refOf(document: GuideDocument): PvpEventRef {
	return { kind: document.event_type === "champions_meeting" ? "cm" : "loh", id: document.event }
}

export function useGuideDocument(event: RaceEvent, options: { autosaveMs?: number } = {}): GuideEditor {
	const autosaveMs = options.autosaveMs ?? GUIDE_AUTOSAVE_MS
	const ref = useMemo(() => refForRaceEvent(event), [event])

	const [state, setState] = useState<GuideEditorStatus>({ status: "loading" })
	const [document, setDocument] = useState<GuideDocument | null>(null)
	const [serverGuide, setServerGuide] = useState<PvpGuide | null>(null)
	const [saveState, setSaveState] = useState<GuideSaveState>("saved")
	const [saveError, setSaveError] = useState<string | null>(null)
	const [errors, setErrors] = useState<EditorError[]>([])
	const [conflict, setConflict] = useState<GuideDocument | null>(null)
	const [guides, setGuides] = useState<EditableGuideRow[]>([])
	// The undo stack lives in a ref (undo and redo read and write it in one
	// step); `depth` is the two lengths as state, which is what the buttons
	// render from (a ref is not read during render).
	const history = useRef<{ past: GuideDocument[]; future: GuideDocument[] }>({ past: [], future: [] })
	const [depth, setDepth] = useState({ past: 0, future: 0 })
	const syncDepth = useCallback(() => {
		setDepth({ past: history.current.past.length, future: history.current.future.length })
	}, [])
	const resetHistory = useCallback(() => {
		history.current = { past: [], future: [] }
		syncDepth()
	}, [syncDepth])

	// The live document for callbacks that run after a pause (the save), kept
	// in step by `place`, the one way the document is set; and how many edits
	// landed since the save in flight started.
	const documentRef = useRef<GuideDocument | null>(null)
	const place = useCallback((next: GuideDocument | null) => {
		documentRef.current = next
		setDocument(next)
	}, [])
	const editsSinceSave = useRef(0)
	const dirty = useRef(false)

	// ── Loading ──
	// Once per mount: the editor is keyed by the event (PvpGuidePage), so a
	// change of event is a fresh hook with fresh state, never a reset here.
	useEffect(() => {
		const controller = new AbortController()
		let live = true
		;(async () => {
			const listResponse = await guideEditableFetch(controller.signal)
			if (!live) return
			if (listResponse.status === 403) {
				setState({ status: "error", message: NOT_AN_EDITOR })
				return
			}
			if (!listResponse.ok) throw new Error(`GET /pvp-guides/editable failed: ${listResponse.status}`)
			const list = (await listResponse.json()) as EditableList
			if (!live) return
			setGuides(list.guides)
			const row = list.guides.find((candidate) => sameEvent({ kind: candidate.kind, id: candidate.event }, ref))
			if (!row) {
				setState({ status: "none" })
				return
			}
			const response = await guideDocumentFetch(row.id, controller.signal)
			if (!live) return
			if (!response.ok) throw new Error(`GET /pvp-guides/${row.id}/document failed: ${response.status}`)
			const loaded = (await response.json()) as GuideDocument
			if (!live) return
			place(loaded)
			setState({ status: "ready" })
		})().catch((error: unknown) => {
			if (controller.signal.aborted || !live) return
			console.error(error)
			setState({ status: "error", message: "The guide didn't load. Reload the page to try again." })
		})
		return () => {
			live = false
			controller.abort()
		}
	}, [place, ref])

	// ── Saving ──
	const save = useCallback(async () => {
		const current = documentRef.current
		if (!current || !dirty.current) return
		editsSinceSave.current = 0
		dirty.current = false
		setSaveState("saving")
		try {
			const response = await guideDocumentPut(current.id, toPayload(current))
			if (response.status === 200) {
				const answer = (await response.json()) as SaveAnswer
				setServerGuide(answer.guide)
				primePvpGuide(refOf(answer.document), answer.guide)
				setErrors([])
				const latest = documentRef.current
				if (editsSinceSave.current === 0 || !latest) {
					place(answer.document)
				} else {
					// Typed meanwhile: keep what is on screen, take the version.
					place({ ...latest, version: answer.document.version })
				}
				setSaveState(dirty.current ? "pending" : "saved")
				setSaveError(null)
				return
			}
			if (response.status === 400) {
				const body = (await response.json()) as { errors?: EditorError[]; error?: string }
				setErrors(body.errors ?? [{ path: "", message: body.error ?? FAILED }])
				setSaveState("invalid")
				dirty.current = true
				return
			}
			if (response.status === 409) {
				const body = (await response.json()) as { current: GuideDocument }
				setConflict(body.current)
				setSaveState("conflict")
				dirty.current = true
				return
			}
			setSaveError(await guideRefusalText(response, FAILED))
			setSaveState("error")
			dirty.current = true
		} catch (error) {
			console.error(error)
			setSaveError(FAILED)
			setSaveState("error")
			dirty.current = true
		}
	}, [place])

	const { startTimer, saveNow: flush, cancelTimer } = useAutoSave({ saveFn: save, delayMs: autosaveMs })

	const update = useCallback(
		(change: (document: GuideDocument) => GuideDocument) => {
			const current = documentRef.current
			if (!current) return
			const next = change(current)
			if (next === current) return
			history.current = { past: [...history.current.past.slice(-(UNDO_DEPTH - 1)), current], future: [] }
			syncDepth()
			place(next)
			editsSinceSave.current += 1
			dirty.current = true
			// A conflict waits for the person's choice; everything else saves.
			if (!conflict) {
				setSaveState("pending")
				startTimer()
			}
		},
		[conflict, place, startTimer, syncDepth]
	)

	/** Swap the document for one off the stack, keeping the current version. */
	const step = useCallback(
		(direction: "undo" | "redo") => {
			const current = documentRef.current
			if (!current) return
			const { past, future } = history.current
			const target = direction === "undo" ? past[past.length - 1] : future[future.length - 1]
			if (!target) return
			history.current =
				direction === "undo"
					? { past: past.slice(0, -1), future: [...future, current] }
					: { past: [...past, current], future: future.slice(0, -1) }
			syncDepth()
			const restored = { ...target, version: current.version }
			place(restored)
			editsSinceSave.current += 1
			dirty.current = true
			if (!conflict) {
				setSaveState("pending")
				startTimer()
			}
		},
		[conflict, place, startTimer, syncDepth]
	)
	const undo = useCallback(() => step("undo"), [step])
	const redo = useCallback(() => step("redo"), [step])

	const saveNow = useCallback(async () => {
		if (!dirty.current) return
		await flush()
	}, [flush])

	const loadTheirs = useCallback(() => {
		if (!conflict) return
		place(conflict)
		setConflict(null)
		resetHistory()
		dirty.current = false
		setSaveState("saved")
		setErrors([])
	}, [conflict, place, resetHistory])

	const keepMine = useCallback(async () => {
		const current = documentRef.current
		if (!conflict || !current) return
		place({ ...current, version: conflict.version })
		setConflict(null)
		dirty.current = true
		await flush()
	}, [conflict, flush, place])

	// ── Create, publish, delete, actions, restore ──
	const adopt = useCallback(
		(loaded: GuideDocument) => {
			place(loaded)
			resetHistory()
			setErrors([])
			setConflict(null)
			dirty.current = false
			setSaveState("saved")
		},
		[place, resetHistory]
	)

	const refreshList = useCallback(async () => {
		const response = await guideEditableFetch()
		if (response.ok) setGuides(((await response.json()) as EditableList).guides)
	}, [])

	const create = useCallback(
		async ({ scenario, copyFrom }: { scenario: number | null; copyFrom: number | null }) => {
			try {
				const response = await guideCreate({ kind: ref.kind, event: ref.id, scenario, copy_from: copyFrom })
				if (response.status !== 201) return guideRefusalText(response, "The guide couldn't be started. Try again in a moment.")
				adopt((await response.json()) as GuideDocument)
				setState({ status: "ready" })
				void refreshList()
				return null
			} catch (error) {
				console.error(error)
				return "The guide couldn't be started. Try again in a moment."
			}
		},
		[adopt, ref, refreshList]
	)

	const publish = useCallback(
		async (isPublished: boolean) => {
			const current = documentRef.current
			if (!current) return null
			await saveNow()
			try {
				const response = await guidePublish(current.id, isPublished)
				if (!response.ok) return guideRefusalText(response, "That didn't go through. Try again in a moment.")
				const loaded = (await response.json()) as GuideDocument
				// Keep local edits that landed meanwhile; take the switch and the version.
				const latest = documentRef.current ?? loaded
				place({ ...latest, is_published: loaded.is_published, version: loaded.version })
				// The reader's copy carries is_published: let it refetch.
				forgetPvpGuide(refOf(loaded))
				void refreshList()
				return null
			} catch (error) {
				console.error(error)
				return "That didn't go through. Try again in a moment."
			}
		},
		[place, refreshList, saveNow]
	)

	const remove = useCallback(async () => {
		const current = documentRef.current
		if (!current) return null
		cancelTimer()
		try {
			const response = await guideDelete(current.id)
			if (response.status !== 204) return guideRefusalText(response, "The guide couldn't be deleted.")
			forgetPvpGuide(refOf(current))
			place(null)
			resetHistory()
			dirty.current = false
			setState({ status: "none" })
			void refreshList()
			return null
		} catch (error) {
			console.error(error)
			return "The guide couldn't be deleted."
		}
	}, [cancelTimer, place, refreshList, resetHistory])

	const runAction = useCallback(
		async (name: GuideActionName, body: Record<string, unknown>): Promise<GuideActionResult> => {
			const current = documentRef.current
			if (!current) return { ok: false, status: 0, body: { error: "No guide to work on." } }
			await saveNow()
			try {
				const response = await guideAction(current.id, name, body)
				const answer = (await response.json().catch(() => ({}))) as Record<string, unknown>
				if (response.ok && answer.document && answer.guide) {
					adopt(answer.document as GuideDocument)
					setServerGuide(answer.guide as PvpGuide)
					primePvpGuide(refOf(answer.document as GuideDocument), answer.guide as PvpGuide)
				}
				return { ok: response.ok, status: response.status, body: answer }
			} catch (error) {
				console.error(error)
				return { ok: false, status: 0, body: { error: "That didn't go through. Try again in a moment." } }
			}
		},
		[adopt, saveNow]
	)

	const restore = useCallback(
		(old: GuideDocument) => {
			update((current) => ({
				...old,
				id: current.id,
				version: current.version,
				event_type: current.event_type,
				event: current.event,
				is_published: current.is_published,
				updated_at: current.updated_at,
			}))
		},
		[update]
	)

	return {
		state,
		document,
		serverGuide,
		saveState,
		saveError,
		errors,
		conflict,
		canUndo: depth.past > 0,
		canRedo: depth.future > 0,
		guides,
		update,
		undo,
		redo,
		saveNow,
		loadTheirs,
		keepMine,
		create,
		publish,
		remove,
		runAction,
		restore,
	}
}
