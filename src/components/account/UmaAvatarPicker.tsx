import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Search, X } from "lucide-react"
import { OguriSpinner } from "../OguriSpinner"
import { umasFetch } from "../../services/umasFetchCalls"
import type { AvatarUmaOption } from "../../types/account"

/**
 * The modal for choosing an uma as the account picture: a search box over a
 * grid of art tiles, the same browse-and-search shape as the Selectors page's
 * card pickers (SelectorTargetPicker, StepUpSelectionPicker). Those two are
 * bound to the calculator's banner catalogue and to a ticket; this one is
 * bound to GET /umas and to nothing else, which is why it is its own
 * component rather than a third caller of theirs.
 *
 * The catalogue is fetched when the dialog first opens, not when the page
 * mounts: most visits to /account never open it, and a few hundred rows are
 * not worth loading on the chance. It is kept for the life of the page, so a
 * second open is instant.
 *
 * The parent owns the write. `onChoose` resolves to whether the PATCH
 * succeeded, and the dialog closes only on true, so a refused pick (the parent
 * has already shown why) leaves the grid open rather than closing on a picture
 * that did not change. A boolean rather than a rejection, because "the server
 * said no" is an outcome here, not an exception.
 *
 * Portaled to document.body and only ever rendered from a click handler, so
 * nothing here runs during a prerender (the page is not prerendered anyway).
 */

interface UmaAvatarPickerProps {
	open: boolean
	/** The uma currently in use, to mark its tile. */
	currentId: number | null
	onClose: () => void
	onChoose: (uma: AvatarUmaOption) => Promise<boolean>
}

type Catalogue =
	| { state: "idle" }
	| { state: "loading" }
	| { state: "error" }
	| { state: "ready"; options: AvatarUmaOption[] }

export const UmaAvatarPicker: React.FC<UmaAvatarPickerProps> = ({ open, currentId, onClose, onChoose }) => {
	const [catalogue, setCatalogue] = useState<Catalogue>({ state: "idle" })
	const [search, setSearch] = useState("")
	const [saving, setSaving] = useState<number | null>(null)

	// Load once, on first open. A failed load is retried from the button in the
	// error state rather than on every open, so a dead API is not hammered.
	useEffect(() => {
		if (!open || catalogue.state !== "idle") return undefined
		const controller = new AbortController()
		setCatalogue({ state: "loading" })
		const load = async (): Promise<void> => {
			try {
				const response = await umasFetch(controller.signal)
				if (!response.ok) throw new Error(`GET /umas failed: ${response.status}`)
				setCatalogue({ state: "ready", options: (await response.json()) as AvatarUmaOption[] })
			} catch {
				if (!controller.signal.aborted) setCatalogue({ state: "error" })
			}
		}
		void load()
		return () => controller.abort()
	}, [open, catalogue.state])

	useEffect(() => {
		if (!open) return undefined
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose()
		}
		window.addEventListener("keydown", closeOnEscape)
		return () => window.removeEventListener("keydown", closeOnEscape)
	}, [open, onClose])

	if (!open) return null

	const choose = async (option: AvatarUmaOption): Promise<void> => {
		setSaving(option.id)
		try {
			if (await onChoose(option)) onClose()
		} finally {
			setSaving(null)
		}
	}

	const options = catalogue.state === "ready" ? catalogue.options : []
	const needle = search.trim().toLocaleLowerCase()
	const matching = needle ? options.filter((option) => option.name.toLocaleLowerCase().includes(needle)) : options

	let body: React.ReactNode
	if (catalogue.state === "loading" || catalogue.state === "idle") {
		body = (
			<div className="flex min-h-[16rem] items-center justify-center" role="status" aria-live="polite">
				<OguriSpinner />
				<span className="sr-only">Loading umas…</span>
			</div>
		)
	} else if (catalogue.state === "error") {
		body = (
			<div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 text-sm text-gray-400">
				<p>Couldn't load the umas. The server may be down.</p>
				<button
					type="button"
					onClick={() => setCatalogue({ state: "idle" })}
					className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100"
				>
					Retry
				</button>
			</div>
		)
	} else if (matching.length === 0) {
		body = <p className="py-12 text-center text-sm text-gray-400">No umas match that search.</p>
	} else {
		body = (
			<div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
				{matching.map((option) => {
					const isCurrent = option.id === currentId
					const isSaving = option.id === saving
					return (
						<button
							key={option.id}
							type="button"
							aria-pressed={isCurrent}
							disabled={saving !== null}
							onClick={() => void choose(option)}
							className={`group flex min-w-0 flex-col items-center rounded-lg border p-2 text-center transition disabled:cursor-wait ${
								isCurrent
									? "border-brand bg-brand/10"
									: "border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700"
							}`}
						>
							{/* Round, like the avatar it becomes, so the person sees the crop they will get. */}
							<img
								src={option.image}
								alt=""
								loading="lazy"
								decoding="async"
								className={`h-20 w-20 rounded-full bg-gray-800 object-cover ${isSaving ? "opacity-50" : ""}`}
							/>
							<span className="mt-2 line-clamp-2 min-h-8 text-xs font-medium leading-tight text-gray-100">
								{option.name}
							</span>
						</button>
					)
				})}
			</div>
		)
	}

	return createPortal(
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/75 p-4"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose()
			}}
		>
			<section
				role="dialog"
				aria-modal="true"
				aria-label="Choose an uma as your picture"
				className="flex max-h-[min(44rem,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-600 bg-gray-800 shadow-2xl"
			>
				<header className="flex flex-wrap items-center gap-3 border-b border-gray-700 bg-gray-800/80 px-4 py-3">
					<div className="min-w-0 flex-1">
						<h2 className="text-base font-semibold text-gray-100">Choose an uma</h2>
						<p className="text-xs text-gray-400">
							{catalogue.state === "ready" ? `${options.length} umas` : "Your picture in the menu and on this page"}
						</p>
					</div>
					<label className="relative w-full sm:w-64">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
						<input
							autoFocus
							type="search"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search umas…"
							aria-label="Search umas"
							className="w-full rounded border border-gray-600 bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand"
						/>
					</label>
					<button
						type="button"
						aria-label="Close uma picker"
						onClick={onClose}
						className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
					>
						<X className="h-5 w-5" />
					</button>
				</header>
				<div className="min-h-0 overflow-y-auto p-4">{body}</div>
			</section>
		</div>,
		document.body
	)
}
