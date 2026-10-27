/**
 * The Collection's Veterans tab: the list (VeteranList.tsx) and the open
 * veteran's card (VeteranCard.tsx), or the add/edit form in their place.
 *
 * WHICH VETERAN IS OPEN is `?veteran=<id>`, the link CM Runs' win rates
 * already use. From `lg` up the card sits beside the list, and with no
 * `?veteran=` the first veteran shown is open without writing the param. Below
 * `lg` there is room for one: the list until a tile is tapped, then her card
 * with a way back. Pure CSS decides which shows, so nothing reads the screen
 * size; the one effect that does only scrolls.
 *
 * `?uma=<id>` starts the list on one uma (the Umas tab links a tile's
 * veterans that way).
 *
 * Adding and editing happen here only; My team and CM Runs pick from the
 * list (notes/pvp-planner-plan.md, "Manage in the Collection").
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { VeteranForm } from "./VeteranForm"
import { VeteranList } from "./VeteranList"
import { VeteranCard, type GameIdIndex } from "./VeteranCard"
import { useCreateVeteran, useDeleteVeteran, useTrainedUmas, useUpdateVeteran } from "../../services/trainedUmaQueries"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { failureText } from "../../services/galleryQueries"
import { NO_FILTER, shownVeterans, type VeteranFilter } from "../../utils/veteranList"
import { draftFromVeteran, draftToInput, emptyDraft, type VeteranDraft } from "../../utils/trainedUmas"
import type { TrainedUma } from "../../types/trainedUma"

/** What the panel is doing: nothing, adding, or editing one veteran. */
export type Editing = null | "new" | TrainedUma

/** Wide enough for the list and her card side by side: Tailwind's `lg`. */
const SIDE_BY_SIDE = "(min-width: 1024px)"

export function VeteransTab({ editing, onEditing, onImport }: {
	editing: Editing
	onEditing: (editing: Editing) => void
	/** Open the import panel (a hand entry's card offers it). */
	onImport: () => void
}) {
	const list = useTrainedUmas(true)
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	const create = useCreateVeteran()
	const update = useUpdateVeteran()
	const remove = useDeleteVeteran()
	const [params, setParams] = useSearchParams()
	const [filter, setFilter] = useState<VeteranFilter>(() => ({ ...NO_FILTER, uma: Number(params.get("uma")) || null }))
	const cardRef = useRef<HTMLDivElement>(null)

	const index = catalogue.status === "ready" ? catalogue : null
	const byGameId = useMemo<GameIdIndex | null>(() => {
		if (!index) return null
		const byGame = <T extends { game_id?: number | null }>(rows: T[]) =>
			new Map(rows.flatMap((row) => (row.game_id ? [[row.game_id, row] as const] : [])))
		return { umas: byGame(index.catalogue.umas), cards: byGame(index.catalogue.support_cards) }
	}, [index])

	const veterans = list.data ?? []
	const umaName = (uma: number) => index?.umasById.get(uma)?.name ?? ""
	const shown = shownVeterans(veterans, filter, umaName)
	const asked = Number(params.get("veteran")) || null
	// The one a link or a tap opened, else (side by side only) the first shown.
	const chosen = veterans.find((veteran) => veteran.id === asked)
	const open = chosen ?? shown[0]

	// On a phone her card replaces the list, wherever the page was scrolled
	// to: bring its top into view. Side by side, keep the list where it is.
	const chosenId = chosen?.id ?? null
	useEffect(() => {
		if (chosenId !== null && !window.matchMedia(SIDE_BY_SIDE).matches) cardRef.current?.scrollIntoView({ block: "start" })
	}, [chosenId])
	// A link to her (CM Runs) lands with her tile in view in the list.
	useEffect(() => {
		if (asked !== null) document.getElementById(`veteran-${asked}`)?.scrollIntoView({ block: "nearest" })
		// Only on arrival: a tap has its tile in view already.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [list.isSuccess])

	if (list.isError || catalogue.status === "error") {
		return <Notice>Your veterans didn&apos;t load. Reload the page to try again.</Notice>
	}
	if (list.isPending || !index || !byGameId) {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading your veterans…
			</div>
		)
	}

	const choose = (id: number | null) => setParams(id === null ? {} : { veteran: String(id) })
	const back = () => {
		const id = chosen?.id
		choose(null)
		// Back on the list, at her tile.
		requestAnimationFrame(() => document.getElementById(`veteran-${id}`)?.scrollIntoView({ block: "center" }))
	}

	if (editing !== null) {
		return <Form editing={editing} index={index} oshiIds={oshiIds} create={create} update={update} onClose={() => onEditing(null)} />
	}
	if (veterans.length === 0) {
		return (
			<Notice>
				No veterans yet. Import them from the game, or add the umas you&apos;ve finished training by hand, to link them to
				your teams and CM runs.
			</Notice>
		)
	}

	return (
		<div className="flex flex-col gap-5 lg:flex-row lg:items-start">
			<div className={`min-w-0 flex-1 ${chosen ? "hidden lg:block" : ""}`}>
				<VeteranList
					veterans={veterans}
					shown={shown}
					filter={filter}
					onFilter={setFilter}
					index={index}
					oshiIds={oshiIds}
					openId={open?.id ?? null}
					onOpen={(veteran) => choose(veteran.id)}
				/>
			</div>
			{open && (
				<div
					ref={cardRef}
					className={`min-w-0 scroll-mt-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-lg lg:shrink-0 lg:overflow-y-auto ${
						chosen ? "" : "hidden lg:block"
					}`}
				>
					<VeteranCard
						veteran={open}
						index={index}
						byGameId={byGameId}
						oshiIds={oshiIds}
						onBack={back}
						onEdit={() => onEditing(open)}
						onDelete={() => remove.mutate(open.id, { onSuccess: () => choose(null) })}
						onImport={onImport}
					/>
				</div>
			)}
		</div>
	)
}

/** The add or edit form, in the list's place. */
function Form({ editing, index, oshiIds, create, update, onClose }: {
	editing: "new" | TrainedUma
	index: PvpCatalogueIndex
	oshiIds: ReadonlySet<number>
	create: ReturnType<typeof useCreateVeteran>
	update: ReturnType<typeof useUpdateVeteran>
	onClose: () => void
}) {
	const close = () => {
		create.reset()
		update.reset()
		onClose()
	}
	const save = (draft: VeteranDraft) => {
		const input = draftToInput(draft)
		if (editing === "new") {
			create.mutate(input, { onSuccess: close })
		} else {
			// A veteran from the game takes its label only (the API refuses the rest).
			const changes = editing.source === "import" ? { label: input.label } : { ...input, uma: undefined }
			update.mutate({ id: editing.id, changes }, { onSuccess: close })
		}
	}
	const saveError = create.error ?? update.error
	const name = editing === "new" ? "" : editing.label || index.umasById.get(editing.uma)?.name || "Unknown uma"
	return (
		<VeteranForm
			// A fresh form per veteran, so switching from one edit to another resets it.
			key={editing === "new" ? "new" : editing.id}
			title={editing === "new" ? "Add a veteran" : `Edit ${name}`}
			initial={editing === "new" ? emptyDraft() : draftFromVeteran(editing)}
			fromGame={editing !== "new" && editing.source === "import"}
			index={index}
			oshiIds={oshiIds}
			saving={create.isPending || update.isPending}
			error={saveError ? failureText(saveError, "That veteran wasn't saved.") : null}
			onSave={save}
			onCancel={close}
		/>
	)
}

function Notice({ children }: { children: ReactNode }) {
	return <p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">{children}</p>
}
