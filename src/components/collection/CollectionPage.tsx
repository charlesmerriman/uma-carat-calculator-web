/**
 * The Collection page (/app/collection): everything confirmed about the
 * player's own game account, kept on their site account, in three tabs:
 * Veterans (the umas they finished training), Umas and Support cards (what
 * they own; RosterGrids.tsx). notes/pvp-planner-plan.md, R2, "The Collection".
 *
 * The tab is `?tab=` (veterans by default), so a link can open one. `?veteran=`
 * scrolls to that veteran and rings her row: CM Runs' win rates link here.
 * "Import from the game" sits above the tabs: one import fills all three.
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

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
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
import { veteranTag } from "../../utils/veteranGrade"
import { ImportPanel } from "./ImportPanel"
import { OwnedCardsGrid, OwnedUmasGrid } from "./RosterGrids"
import { SaveStatus } from "../pvp/SaveStatus"
import { useClearRoster, useEditRoster, useRoster, useRosterSaving } from "../../services/rosterQueries"
import { useCalculatorData } from "../../services/CalculatorContext"
import { cardReleases } from "../../utils/cardRelease"
import type { RosterChanges } from "../../types/roster"
import {
	STAT_KEYS,
	aptitudeSummary,
	draftFromVeteran,
	draftToInput,
	emptyDraft,
	type VeteranDraft,
} from "../../utils/trainedUmas"
import type { TrainedUma } from "../../types/trainedUma"

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
				<SignedInCollection />
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

type CollectionTab = "veterans" | "umas" | "cards"
const TABS: Array<{ id: CollectionTab; label: string }> = [
	{ id: "veterans", label: "Veterans" },
	{ id: "umas", label: "Umas" },
	{ id: "cards", label: "Support cards" },
]

function SignedInCollection() {
	const [params, setParams] = useSearchParams()
	const tab: CollectionTab = TABS.find((entry) => entry.id === params.get("tab"))?.id ?? "veterans"
	const catalogue = usePvpCatalogue()
	const [importing, setImporting] = useState(false)
	const choose = (next: CollectionTab) =>
		setParams(next === "veterans" ? {} : { tab: next }, { replace: true })

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<div role="tablist" aria-label="Collection" className="flex flex-1 gap-1 border-b border-gray-700">
					{TABS.map((entry) => (
						<button
							key={entry.id}
							type="button"
							role="tab"
							aria-selected={tab === entry.id}
							onClick={() => choose(entry.id)}
							className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
								tab === entry.id ? "border-brand text-brand" : "border-transparent text-gray-400 hover:text-gray-100"
							}`}
						>
							{entry.label}
						</button>
					))}
				</div>
				{!importing && (
					<button type="button" className={ACTION_BUTTON} onClick={() => setImporting(true)}>
						<FileUp className="h-4 w-4" />
						Import from the game
					</button>
				)}
			</div>
			{importing && catalogue.status === "ready" && <ImportPanel index={catalogue} onDone={() => setImporting(false)} />}
			{tab === "veterans" && <Veterans highlight={Number(params.get("veteran")) || null} />}
			{tab !== "veterans" && <RosterTab tab={tab} />}
		</>
	)
}

/** The Umas or Support cards grid, with the roster's save line. */
function RosterTab({ tab }: { tab: "umas" | "cards" }) {
	const roster = useRoster(true)
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	const saving = useRosterSaving()
	const [failed, setFailed] = useState(false)
	const edit = useEditRoster((message) => {
		setFailed(true)
		toast.error(message)
	})
	const clear = useClearRoster()
	// First Global banner start per uma and card: the grids' "Release date" sort.
	const { umaBannerData, supportBannerData } = useCalculatorData()
	const releases = useMemo(() => cardReleases(umaBannerData ?? [], supportBannerData ?? []), [umaBannerData, supportBannerData])
	if (roster.isError || catalogue.status === "error") {
		return <Notice>Your collection didn't load. Reload the page to try again.</Notice>
	}
	if (roster.isPending || catalogue.status !== "ready") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading your collection…
			</div>
		)
	}
	const onEdit = (changes: RosterChanges) => {
		setFailed(false)
		edit(changes)
	}
	return (
		<div className="flex flex-col gap-2">
			<div className="flex justify-end">
				<SaveStatus mode="account" saveState={failed ? "error" : saving ? "saving" : "saved"} hasTeam />
			</div>
			{tab === "umas" ? (
				<OwnedUmasGrid
					umas={catalogue.catalogue.umas}
					owned={roster.data.umas}
					releases={releases.umas}
					oshiIds={oshiIds}
					onEdit={onEdit}
					onClear={() => clear.mutate("umas", { onError: (error) => toast.error(failureText(error, "That list wasn't cleared.")) })}
				/>
			) : (
				<OwnedCardsGrid
					cards={catalogue.catalogue.support_cards}
					owned={roster.data.support_cards}
					releases={releases.supports}
					onEdit={onEdit}
					onClear={() => clear.mutate("support_cards", { onError: (error) => toast.error(failureText(error, "That list wasn't cleared.")) })}
				/>
			)}
		</div>
	)
}

/** What the panel above the list is doing: nothing, adding, or editing one veteran. */
type Editing = null | "new" | TrainedUma

function Veterans({ highlight }: { highlight: number | null }) {
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
		} else if (editing) {
			// A veteran from the game takes its label only (the API refuses the rest).
			const changes = editing.source === "import" ? { label: input.label } : { ...input, uma: undefined }
			update.mutate({ id: editing.id, changes }, { onSuccess: close })
		}
	}

	return (
		<section className="flex flex-col gap-3" aria-labelledby="veterans">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="veterans" className="text-base font-semibold text-gray-100">
					Veterans <span className="text-sm font-normal text-gray-400">{veterans.length}</span>
				</h2>
				{editing === null && (
					<button type="button" className={PRIMARY_BUTTON} onClick={() => setEditing("new")}>
						<Plus className="h-4 w-4" />
						Add a veteran
					</button>
				)}
			</div>

			{editing !== null && (
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
							highlighted={veteran.id === highlight}
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

function VeteranRow({ veteran, index, oshi, highlighted, onEdit, onDelete }: {
	veteran: TrainedUma
	index: PvpCatalogueIndex
	oshi: boolean
	/** Opened by a link to her (`?veteran=`): scrolled to and ringed. */
	highlighted: boolean
	onEdit: () => void
	onDelete: () => void
}) {
	const [confirming, setConfirming] = useState(false)
	const rowRef = useRef<HTMLLIElement>(null)
	useEffect(() => {
		if (highlighted) rowRef.current?.scrollIntoView({ block: "center" })
	}, [highlighted])
	const uma = index.umasById.get(veteran.uma)
	const name = veteranName(veteran, index)
	const strong = aptitudeSummary(veteran.apt)
	return (
		<li
			ref={rowRef}
			id={`veteran-${veteran.id}`}
			className={`card-panel flex flex-wrap items-center gap-3 p-3 ${highlighted ? "border-brand ring-1 ring-brand" : ""}`}
		>
			<FramedUma src={uma?.portrait ?? uma?.image ?? null} oshi={oshi} alt="" className="w-12 shrink-0" />
			<div className="min-w-0 flex-1">
				<p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-gray-100">
					{name}
					{veteran.label && uma && <span className="text-xs font-normal text-gray-400">{uma.name}</span>}
					{veteranTag(veteran) && (
						<span className="rounded bg-brand/15 px-1.5 text-xs font-semibold text-brand">{veteranTag(veteran)}</span>
					)}
					<span className="rounded-full border border-gray-600 px-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
						{veteran.source === "import" ? "From the game" : "By hand"}
					</span>
					{veteran.is_borrowed && (
						<span
							className="rounded-full border border-gray-600 px-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400"
							title="Another player's veteran you had on loan in the game."
						>
							Borrowed
						</span>
					)}
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
				{veteran.memo && <p className="text-xs italic text-gray-400">“{veteran.memo}”</p>}
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
