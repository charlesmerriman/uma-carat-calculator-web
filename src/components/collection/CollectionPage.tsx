/**
 * The Collection page (/app/collection): everything confirmed about the
 * player's own game account, kept on their site account, in three tabs:
 * Veterans (the umas they finished training), Umas and Support cards (what
 * they own; RosterGrids.tsx). notes/pvp-planner-plan.md, R2, "The Collection".
 *
 * The tab is `?tab=` (veterans by default), so a link can open one, and each
 * tab is a card with its count (owner, 2026-10-27, the redesign:
 * notes/collection-redesign-plan.md). `?veteran=` opens that veteran's card
 * (VeteransTab.tsx): CM Runs' win rates link here. "Import from the game"
 * sits in the header: one import fills all three.
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

import { useMemo, useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { FileUp, Library, Loader2, Plus } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { useTrainedUmas } from "../../services/trainedUmaQueries"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useSignInPrompt } from "../../hooks/useSignInPrompt"
import { failureText } from "../../services/galleryQueries"
import { ACTION_BUTTON, PRIMARY_BUTTON } from "../pvp/gallery/galleryStyles"
import { ImportPanel } from "./ImportPanel"
import { OwnedCardsGrid, OwnedUmasGrid } from "./RosterGrids"
import { VeteransTab, type Editing } from "./VeteransTab"
import { SaveStatus } from "../pvp/SaveStatus"
import { useClearRoster, useEditRoster, useRoster, useRosterSaving } from "../../services/rosterQueries"
import { useCalculatorData } from "../../services/CalculatorContext"
import { cardReleases } from "../../utils/cardRelease"
import { formatDate } from "../../utils/dateFormat"
import type { RosterChanges } from "../../types/roster"

const PAGE = "mx-auto my-3 flex w-[calc(100%-1rem)] max-w-7xl flex-col gap-5 sm:w-[calc(100%-2rem)]"

function PageHeader({ actions }: { actions?: ReactNode }) {
	return (
		<header className="flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				<h1 className="font-display flex items-center gap-2 text-2xl font-bold text-brand">
					<Library className="h-6 w-6 shrink-0" />
					Collection
				</h1>
				<p className="mt-1 text-sm text-gray-400">
					What you have in the game, kept on your account. Link your veterans to your teams and CM runs.
				</p>
			</div>
			{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
		</header>
	)
}

export function CollectionPage() {
	const { isLoggedIn } = useAccount()
	const { signInState } = useSignInPrompt()
	if (isLoggedIn) return <SignedInCollection />
	return (
		<div className={PAGE}>
			<PageHeader />
			<div className="card-panel flex flex-wrap items-center gap-3 p-4 text-sm text-gray-300">
				<span className="min-w-0 flex-1">Sign in to keep your veterans on your account.</span>
				<Link to="/login" state={signInState} className={ACTION_BUTTON}>
					Sign in
				</Link>
			</div>
		</div>
	)
}

type CollectionTab = "veterans" | "umas" | "cards"
const TAB_IDS: CollectionTab[] = ["veterans", "umas", "cards"]

function SignedInCollection() {
	const [params, setParams] = useSearchParams()
	const tab: CollectionTab = TAB_IDS.find((id) => id === params.get("tab")) ?? "veterans"
	const catalogue = usePvpCatalogue()
	const [importing, setImporting] = useState(false)
	const [editing, setEditing] = useState<Editing>(null)
	const choose = (next: CollectionTab) => {
		setEditing(null)
		setParams(next === "veterans" ? {} : { tab: next }, { replace: true })
	}
	const openImport = () => {
		setImporting(true)
		window.scrollTo({ top: 0 })
	}

	return (
		<div className={PAGE}>
			<PageHeader
				actions={
					<>
						{tab === "veterans" && editing === null && (
							<button type="button" className={ACTION_BUTTON} onClick={() => setEditing("new")}>
								<Plus className="h-4 w-4" />
								Add a veteran
							</button>
						)}
						{!importing && (
							<button type="button" className={PRIMARY_BUTTON} onClick={() => setImporting(true)}>
								<FileUp className="h-4 w-4" />
								Import from the game
							</button>
						)}
					</>
				}
			/>
			<TabCards tab={tab} onChoose={choose} />
			{importing && catalogue.status === "ready" && <ImportPanel index={catalogue} onDone={() => setImporting(false)} />}
			<div role="tabpanel" aria-labelledby={`collection-tab-${tab}`}>
				{tab === "veterans" ? (
					<VeteransTab editing={editing} onEditing={setEditing} onImport={openImport} />
				) : (
					<RosterTab tab={tab} />
				)}
			</div>
		</div>
	)
}

/**
 * The three tabs as cards, each with its count: how many veterans, and how
 * many of the umas and cards on Global the player owns, with a bar. The counts
 * fill in as the lists load (one cached request each, shared with the tabs).
 */
function TabCards({ tab, onChoose }: { tab: CollectionTab; onChoose: (tab: CollectionTab) => void }) {
	const veterans = useTrainedUmas(true).data
	const roster = useRoster(true).data
	const catalogue = usePvpCatalogue()
	const ready = catalogue.status === "ready" ? catalogue.catalogue : null
	const owned = (ids: Set<number>, rows: Array<{ id: number; on_global?: boolean }>) => {
		const offered = rows.filter((row) => row.on_global !== false)
		return { count: offered.filter((row) => ids.has(row.id)).length, total: offered.length }
	}
	const umas = ready && roster ? owned(new Set(roster.umas.map((row) => row.uma)), ready.umas) : null
	const cards = ready && roster ? owned(new Set(roster.support_cards.map((row) => row.support_card)), ready.support_cards) : null
	const newest = veterans?.find((veteran) => veteran.trained_at)?.trained_at

	return (
		<div role="tablist" aria-label="Collection" className="grid gap-3 sm:grid-cols-3">
			<TabCard id="veterans" tab={tab} onChoose={onChoose} label="Veterans" hint="umas you trained" count={veterans?.length}>
				{newest && <span className="text-xs text-gray-300">Newest trained {formatDate(newest)}</span>}
			</TabCard>
			<TabCard id="umas" tab={tab} onChoose={onChoose} label="Umas" hint="outfits unlocked" count={umas?.count} total={umas?.total} />
			<TabCard id="cards" tab={tab} onChoose={onChoose} label="Support cards" hint="owned, with limit breaks" count={cards?.count} total={cards?.total} />
		</div>
	)
}

function TabCard({ id, tab, onChoose, label, hint, count, total, children }: {
	id: CollectionTab
	tab: CollectionTab
	onChoose: (tab: CollectionTab) => void
	label: string
	hint: string
	count: number | undefined
	/** "of N", with a bar, for a list the catalogue bounds. */
	total?: number
	children?: ReactNode
}) {
	const current = tab === id
	return (
		<button
			type="button"
			role="tab"
			id={`collection-tab-${id}`}
			aria-selected={current}
			onClick={() => onChoose(id)}
			className={`flex flex-col gap-1.5 rounded-2xl border px-4 py-3.5 text-left transition ${
				current ? "border-brand bg-brand/10 ring-1 ring-brand" : "border-edge bg-(--card-fill) hover:border-gray-500"
			}`}
		>
			<span className="flex items-baseline justify-between gap-2">
				<span className={`text-sm font-bold ${current ? "text-brand" : "text-gray-200"}`}>{label}</span>
				<span className="text-xs text-gray-400">{hint}</span>
			</span>
			<span className="font-display text-2xl font-bold leading-none text-gray-100">
				{count ?? <Loader2 className="h-5 w-5 animate-spin text-gray-500" aria-label="Loading" />}
				{total !== undefined && <span className="ml-1.5 text-sm font-medium text-gray-400">of {total}</span>}
			</span>
			{total !== undefined ? (
				<span className="block h-1.5 overflow-hidden rounded-full bg-gray-700" aria-hidden="true">
					<span className="block h-full rounded-full bg-brand" style={{ width: `${total ? ((count ?? 0) / total) * 100 : 0}%` }} />
				</span>
			) : (
				children
			)}
		</button>
	)
}

/** The Umas or Support cards grid, with the roster's save line. */
function RosterTab({ tab }: { tab: "umas" | "cards" }) {
	const roster = useRoster(true)
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	// How many veterans of each outfit: an uma tile links to them.
	const veterans = useTrainedUmas(true).data
	const veteranCounts = useMemo(() => {
		const counts = new Map<number, number>()
		for (const veteran of veterans ?? []) counts.set(veteran.uma, (counts.get(veteran.uma) ?? 0) + 1)
		return counts
	}, [veterans])
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
	const status = <SaveStatus mode="account" saveState={failed ? "error" : saving ? "saving" : "saved"} hasTeam />
	return (
		<div className="flex flex-col gap-2">
			{tab === "umas" ? (
				<OwnedUmasGrid
					umas={catalogue.catalogue.umas}
					owned={roster.data.umas}
					releases={releases.umas}
					oshiIds={oshiIds}
					veteranCounts={veteranCounts}
					status={status}
					onEdit={onEdit}
					onClear={() => clear.mutate("umas", { onError: (error) => toast.error(failureText(error, "That list wasn't cleared.")) })}
				/>
			) : (
				<OwnedCardsGrid
					cards={catalogue.catalogue.support_cards}
					owned={roster.data.support_cards}
					releases={releases.supports}
					status={status}
					onEdit={onEdit}
					onClear={() => clear.mutate("support_cards", { onError: (error) => toast.error(failureText(error, "That list wasn't cleared.")) })}
				/>
			)}
		</div>
	)
}

function Notice({ children }: { children: ReactNode }) {
	return <p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">{children}</p>
}
