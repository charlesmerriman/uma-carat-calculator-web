/**
 * The feed's uma filter: a field that shows the uma applied (framed, the
 * way every uma on the site is drawn) and opens a picker in the site's
 * search-and-grid shape (OshiPicker, PvpCardPicker) to change it. It
 * replaced a native <select>, which could only print names.
 *
 * The picker offers what the API's `umas` tally offers: only umas on this
 * event's posted teams, most used first, each with its team count, so every
 * tile finds something. An uma applied from a link that nobody uses any more
 * arrives from the caller at 0 and still shows, so the picker shows what is
 * applied. "Any uma" is the first tile, and the field's X clears it too.
 *
 * Only rendered once the catalogue is ready (the caller checks), and the
 * dialog only after a click, so nothing here touches `document` during a
 * prerender.
 */

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Search, Users, X } from "lucide-react"
import { UmaPortrait } from "./GalleryBits"
import { countLabel } from "../../../utils/plural"
import type { PvpCatalogueIndex } from "../../../hooks/usePvpCatalogue"

type TallyEntry = { uma: number; count: number }

export function GalleryUmaFilter({ uma, options, index, onFilter }: {
	uma: number | null
	/** The tally to offer, most used first (the applied uma included). */
	options: TallyEntry[]
	index: Pick<PvpCatalogueIndex, "umasById">
	onFilter: (uma: number | null) => void
}) {
	const [open, setOpen] = useState(false)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const nameOf = (id: number) => index.umasById.get(id)?.name ?? "Unknown uma"
	const applied = uma === null ? null : options.find((entry) => entry.uma === uma) ?? { uma, count: 0 }

	// Focus goes back to the field on close, so a keyboard user carries on
	// from where they opened it rather than from the top of the page.
	const close = () => {
		setOpen(false)
		triggerRef.current?.focus({ preventScroll: true })
	}
	const pick = (next: number | null) => {
		if (next !== uma) onFilter(next)
		close()
	}

	return (
		<>
			{/* The border is on the wrapper so the X can sit inside the field as
			    a sibling of the trigger: a button inside a button is invalid. */}
			<div className="flex min-w-0 flex-1 items-center rounded-md border border-gray-600 bg-gray-900 transition focus-within:border-brand hover:border-gray-500">
				<button
					ref={triggerRef}
					type="button"
					aria-haspopup="dialog"
					aria-label={`Filter by uma: ${applied ? nameOf(applied.uma) : "any uma"}`}
					onClick={() => setOpen(true)}
					className="flex min-w-0 flex-1 items-center gap-2 py-1 pl-1.5 pr-2 text-left text-sm text-gray-100 outline-none"
				>
					{applied ? (
						<>
							<UmaPortrait uma={index.umasById.get(applied.uma)} className="w-7 shrink-0" />
							<span className="min-w-0 truncate">{nameOf(applied.uma)}</span>
							<span className="shrink-0 text-gray-400">({applied.count})</span>
						</>
					) : (
						<>
							<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-gray-800 text-gray-400">
								<Users className="h-4 w-4" aria-hidden="true" />
							</span>
							<span className="min-w-0 truncate">Any uma</span>
						</>
					)}
					{/* Only when there is no X: the X already marks the right edge. */}
					{!applied && <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />}
				</button>
				{applied && (
					<button
						type="button"
						aria-label="Show every uma"
						title="Show every uma"
						onClick={() => onFilter(null)}
						className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 transition hover:bg-gray-800 hover:text-gray-100"
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>
			{open && <UmaFilterDialog uma={uma} options={options} nameOf={nameOf} index={index} onPick={pick} onClose={close} />}
		</>
	)
}

function UmaFilterDialog({ uma, options, nameOf, index, onPick, onClose }: {
	uma: number | null
	options: TallyEntry[]
	nameOf: (id: number) => string
	index: Pick<PvpCatalogueIndex, "umasById">
	onPick: (uma: number | null) => void
	onClose: () => void
}) {
	const [search, setSearch] = useState("")

	useEffect(() => {
		const closeOnEscape = (keydown: KeyboardEvent) => {
			if (keydown.key === "Escape") onClose()
		}
		window.addEventListener("keydown", closeOnEscape)
		return () => window.removeEventListener("keydown", closeOnEscape)
	}, [onClose])

	const needle = search.trim().toLocaleLowerCase()
	const matching = needle ? options.filter((entry) => nameOf(entry.uma).toLocaleLowerCase().includes(needle)) : options

	// Shared by the "Any uma" tile and the uma tiles: the applied one wears
	// the brand border, the way OshiPicker marks the uma already in a slot.
	const tileClass = (current: boolean) =>
		`flex min-w-0 flex-col items-center rounded-lg border p-2 text-center transition ${
			current ? "border-brand bg-brand/10" : "border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700"
		}`

	return createPortal(
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/75 p-4"
			onMouseDown={(mouse) => {
				if (mouse.target === mouse.currentTarget) onClose()
			}}
		>
			<section
				role="dialog"
				aria-modal="true"
				aria-label="Filter by uma"
				className="flex max-h-[min(44rem,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-edge bg-gray-800 shadow-2xl"
			>
				<header className="flex flex-wrap items-center gap-3 border-b border-gray-700 px-4 py-3">
					<div className="min-w-0 flex-1">
						<h2 className="text-base font-semibold text-gray-100">Show teams with</h2>
						<p className="text-xs text-gray-400">The umas on this event's posted teams, most used first.</p>
					</div>
					<label className="relative w-full sm:w-64">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
						<input
							autoFocus
							type="search"
							value={search}
							onChange={(change) => setSearch(change.target.value)}
							placeholder="Search umas…"
							aria-label="Search umas"
							className="w-full rounded border border-gray-600 bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand"
						/>
					</label>
					<button
						type="button"
						aria-label="Close picker"
						onClick={onClose}
						className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
					>
						<X className="h-5 w-5" />
					</button>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto p-4">
					{/* "Any uma" leads the grid while nothing is searched; a search
					    is a hunt for one uma, so the reset would only be in the way. */}
					{matching.length === 0 && needle ? (
						<p className="py-12 text-center text-sm text-gray-400">No umas match that search.</p>
					) : (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
							{!needle && (
								<button type="button" aria-pressed={uma === null} onClick={() => onPick(null)} className={tileClass(uma === null)}>
									{/* The size of a framed tile, so the row lines up. */}
									<span className="flex aspect-square w-20 items-center justify-center rounded-lg bg-gray-800 text-gray-400">
										<Users className="h-8 w-8" aria-hidden="true" />
									</span>
									<span className="mt-2 line-clamp-2 min-h-8 text-xs font-medium leading-tight text-gray-100">Any uma</span>
									<span className="text-[10px] text-gray-400">Every team</span>
								</button>
							)}
							{matching.map((entry) => (
								<button
									key={entry.uma}
									type="button"
									aria-pressed={entry.uma === uma}
									onClick={() => onPick(entry.uma)}
									className={tileClass(entry.uma === uma)}
								>
									<UmaPortrait uma={index.umasById.get(entry.uma)} className="w-20" />
									<span className="mt-2 line-clamp-2 min-h-8 text-xs font-medium leading-tight text-gray-100">
										{nameOf(entry.uma)}
									</span>
									<span className="text-[10px] text-gray-400">{countLabel(entry.count, "team")}</span>
								</button>
							))}
						</div>
					)}
				</div>
			</section>
		</div>,
		document.body
	)
}
