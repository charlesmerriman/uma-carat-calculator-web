/**
 * The Collection page (/app/collection): everything confirmed about the
 * player's own game account, kept on their site account. Today: Veterans,
 * the umas they finished training. The umas and support cards they own join
 * later as tabs of their own (notes/pvp-planner-plan.md, R2, "The Collection").
 *
 * Account only (owner, 2026-10-26): a guest gets a sign-in card. Not in the
 * navbar: reached from the profile menu and a card on the Account page, and
 * not prerendered or in the sitemap (AppRouteMeta marks it noindex), like
 * /account itself.
 *
 * Manage here, pick elsewhere: adding, editing and deleting veterans happens
 * only on this page; My team and CM Runs only choose from the list.
 *
 * Inside the /app loading gate, so it may read the clock during render.
 */

import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { FileUp, Library, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { useCreateVeteran, useDeleteVeteran, useTrainedUmas, useUpdateVeteran } from "../../services/trainedUmaQueries"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useSignInPrompt } from "../../hooks/useSignInPrompt"
import { failureText } from "../../services/galleryQueries"
import { FramedUma } from "../FramedUma"
import { ACTION_BUTTON, PRIMARY_BUTTON } from "../pvp/gallery/galleryStyles"
import { VeteranForm } from "./VeteranForm"
import { ImportPanel } from "./ImportPanel"
import {
	STAT_KEYS,
	aptitudeSummary,
	draftFromVeteran,
	draftToInput,
	emptyDraft,
	type VeteranDraft,
} from "../../utils/trainedUmas"
import type { TrainedUma } from "../../types/trainedUma"

/** The API's cap (TRAINED_UMA_CAP). */
const VETERAN_CAP = 200

const STAT_SHORT: Record<(typeof STAT_KEYS)[number], string> = {
	speed: "Spd",
	stamina: "Sta",
	power: "Pow",
	guts: "Gut",
	wit: "Wit",
}

export function CollectionPage() {
	const { isLoggedIn } = useAccount()
	const { signInState } = useSignInPrompt()
	return (
		<div className="mx-auto my-3 flex w-[calc(100%-1rem)] max-w-4xl flex-col gap-4 sm:w-[calc(100%-2rem)]">
			<header>
				<h1 className="font-display flex items-center gap-2 text-xl font-bold text-brand">
					<Library className="h-5 w-5 shrink-0" />
					Collection
				</h1>
				<p className="mt-1 text-sm text-gray-400">
					What you have in the game, kept on your account. Link your veterans to your teams and CM runs.
				</p>
			</header>
			{isLoggedIn ? (
				<Veterans />
			) : (
				<div className="card-panel flex flex-wrap items-center gap-3 p-4 text-sm text-gray-300">
					<span className="min-w-0 flex-1">Sign in to keep your veterans on your account.</span>
					<Link to="/login" state={signInState} className={ACTION_BUTTON}>
						Sign in
					</Link>
				</div>
			)}
		</div>
	)
}

/** What the panel above the list is doing: nothing, adding, editing one veteran, or an import. */
type Editing = null | "new" | "import" | TrainedUma

function Veterans() {
	const list = useTrainedUmas(true)
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	const create = useCreateVeteran()
	const update = useUpdateVeteran()
	const remove = useDeleteVeteran()
	const [editing, setEditing] = useState<Editing>(null)

	if (list.isError || catalogue.status === "error") {
		return <Notice>Your veterans didn't load. Reload the page to try again.</Notice>
	}
	if (list.isPending || catalogue.status !== "ready") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading your veterans…
			</div>
		)
	}

	const veterans = list.data
	const atCap = veterans.length >= VETERAN_CAP
	const saving = create.isPending || update.isPending
	const saveError = create.error ?? update.error
	const close = () => {
		create.reset()
		update.reset()
		setEditing(null)
	}
	const save = (draft: VeteranDraft) => {
		const input = draftToInput(draft)
		if (editing === "new") {
			create.mutate(input, { onSuccess: close })
		} else if (editing && editing !== "import") {
			// A veteran from the game takes its label only (the API refuses the rest).
			const changes = editing.source === "import" ? { label: input.label } : { ...input, uma: undefined }
			update.mutate({ id: editing.id, changes }, { onSuccess: close })
		}
	}

	return (
		<section className="flex flex-col gap-3" aria-labelledby="veterans">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="veterans" className="text-base font-semibold text-gray-100">
					Veterans <span className="text-sm font-normal text-gray-400">{veterans.length} of {VETERAN_CAP}</span>
				</h2>
				{editing === null && (
					<div className="flex flex-wrap gap-2">
						<button type="button" className={ACTION_BUTTON} onClick={() => setEditing("import")}>
							<FileUp className="h-4 w-4" />
							Import from the game
						</button>
						<button
							type="button"
							className={PRIMARY_BUTTON}
							disabled={atCap}
							title={atCap ? `You can keep up to ${VETERAN_CAP} veterans.` : undefined}
							onClick={() => setEditing("new")}
						>
							<Plus className="h-4 w-4" />
							Add a veteran
						</button>
					</div>
				)}
			</div>

			{editing === "import" && (
				<ImportPanel
					index={catalogue}
					// Hand-entered veterans are never replaced by an import, so they take room first.
					room={VETERAN_CAP - veterans.filter((veteran) => veteran.source === "manual").length}
					onDone={() => setEditing(null)}
				/>
			)}
			{editing !== null && editing !== "import" && (
				<VeteranForm
					// A fresh form per veteran, so switching from one edit to another resets it.
					key={editing === "new" ? "new" : editing.id}
					title={editing === "new" ? "Add a veteran" : `Edit ${veteranName(editing, catalogue)}`}
					initial={editing === "new" ? emptyDraft() : draftFromVeteran(editing)}
					fromGame={editing !== "new" && editing.source === "import"}
					index={catalogue}
					oshiIds={oshiIds}
					saving={saving}
					error={saveError ? failureText(saveError, "That veteran wasn't saved.") : null}
					onSave={save}
					onCancel={close}
				/>
			)}

			{veterans.length === 0 ? (
				editing === null && (
					<Notice>
						No veterans yet. Add the umas you've finished training, with their stats and skills, to link them
						to your teams and CM runs.
					</Notice>
				)
			) : (
				<ul className="flex flex-col gap-2">
					{veterans.map((veteran) => (
						<VeteranRow
							key={veteran.id}
							veteran={veteran}
							index={catalogue}
							oshi={oshiIds.has(veteran.uma)}
							onEdit={() => setEditing(veteran)}
							onDelete={() => remove.mutate(veteran.id)}
						/>
					))}
				</ul>
			)}
		</section>
	)
}

/** Her label, else the uma's name. */
function veteranName(veteran: TrainedUma, index: PvpCatalogueIndex): string {
	return veteran.label || index.umasById.get(veteran.uma)?.name || "Unknown uma"
}

function VeteranRow({ veteran, index, oshi, onEdit, onDelete }: {
	veteran: TrainedUma
	index: PvpCatalogueIndex
	oshi: boolean
	onEdit: () => void
	onDelete: () => void
}) {
	const [confirming, setConfirming] = useState(false)
	const uma = index.umasById.get(veteran.uma)
	const name = veteranName(veteran, index)
	const strong = aptitudeSummary(veteran.apt)
	return (
		<li className="card-panel flex flex-wrap items-center gap-3 p-3">
			<FramedUma src={uma?.portrait ?? uma?.image ?? null} oshi={oshi} alt="" className="w-12 shrink-0" />
			<div className="min-w-0 flex-1">
				<p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-gray-100">
					{name}
					{veteran.label && uma && <span className="text-xs font-normal text-gray-400">{uma.name}</span>}
					<span className="rounded-full border border-gray-600 px-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
						{veteran.source === "import" ? "From the game" : "By hand"}
					</span>
					{veteran.missing_from_import && (
						<span
							className="rounded-full border border-highlight/50 px-1.5 text-[10px] font-medium text-highlight"
							title="Kept because a CM run you logged used her."
						>
							Not in your latest import
						</span>
					)}
				</p>
				<p className="text-xs text-gray-300">
					{STAT_KEYS.map((key) => `${STAT_SHORT[key]} ${veteran[key]}`).join(" · ")}
				</p>
				<p className="text-xs text-gray-400">
					{[strong, `${veteran.skills.length} ${veteran.skills.length === 1 ? "skill" : "skills"}`].filter(Boolean).join(" · ")}
				</p>
			</div>
			<div className="flex items-center gap-1.5">
				<button type="button" className={ACTION_BUTTON} onClick={onEdit} aria-label={`Edit ${name}`}>
					<Pencil className="h-4 w-4" />
				</button>
				{confirming ? (
					<button
						type="button"
						className={`${ACTION_BUTTON} border-highlight/60 text-highlight`}
						onClick={onDelete}
						onBlur={() => setConfirming(false)}
					>
						Delete her?
					</button>
				) : (
					<button type="button" className={ACTION_BUTTON} onClick={() => setConfirming(true)} aria-label={`Delete ${name}`}>
						<Trash2 className="h-4 w-4" />
					</button>
				)}
			</div>
		</li>
	)
}

function Notice({ children }: { children: ReactNode }) {
	return <p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">{children}</p>
}
