/**
 * What every part of the guide editor reads: the document, how to change
 * it, the catalogue, the event, the problems to show, and the document as
 * the reader would draw it (for the tiles and chips).
 *
 * A context rather than props: the deck editor sits four components under
 * the editor's root and needs all of it.
 */

import { createContext, useContext } from "react"
import type { PvpCatalogueIndex } from "../../../hooks/usePvpCatalogue"
import type { ReleaseCheck } from "../../../hooks/useCardReleases"
import type { EditorError, GuideDocument } from "../../../types/guideDocument"
import type { PvpGuide } from "../../../types/pvpGuide"
import type { RaceEvent } from "../../../types"

export interface GuideEditorContextType {
	document: GuideDocument
	update: (change: (document: GuideDocument) => GuideDocument) => void
	index: PvpCatalogueIndex
	event: RaceEvent
	errors: EditorError[]
	/** The document hydrated from the catalogue: what the reader would draw now. */
	hydrated: PvpGuide
	/** Whether a card is out by the event (utils/cardRelease.ts), for the pickers' notes. */
	releaseFor: ReleaseCheck
}

export const GuideEditorContext = createContext<GuideEditorContextType | undefined>(undefined)

export function useGuideEditor(): GuideEditorContextType {
	const context = useContext(GuideEditorContext)
	if (context === undefined) throw new Error("useGuideEditor must be used inside GuideEditor")
	return context
}

/** The messages for one document path (exact), for drawing beside a field. */
export function useFieldErrors(path: string): string[] {
	const { errors } = useGuideEditor()
	return errors.filter((error) => error.path === path).map((error) => error.message)
}
