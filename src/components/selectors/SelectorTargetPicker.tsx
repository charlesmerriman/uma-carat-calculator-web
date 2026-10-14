import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ImagePlus, Pencil, Search, X } from "lucide-react"
import { useEligibleCardCatalogue } from "../../hooks/useEligibleCardCatalogue"
import { formatUsd } from "../../utils/formatCurrency"
import type { EligibleCard } from "../../hooks/useEligibleCardCatalogue"
import type {
	AnniversaryEventProduct,
	BannerUma,
	BannerSupport
} from "../../types"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"

interface SelectorTargetPickerProps {
	product: AnniversaryEventProduct
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	targetUma: number | null
	targetSupport: number | null
	disabled: boolean
	onChange: (target: { uma: number | null; support: number | null }) => void
}

/**
 * An image-library picker for selector tickets. It deliberately mirrors the
 * admin's browse-and-search flow. Its catalogue is limited to cards on the
 * calculator's real gacha banners (past and upcoming), then filtered to this
 * ticket's JP cutoff.
 *
 * THE TILE *IS* THE CONTROL. There is no name dropdown beside it any more: a
 * button repeating the card's name cost a whole row of width per ticket for
 * information the art already carries, and on a phone that row was most of the
 * screen. Everything that used to justify the text button now hangs off the
 * tile — the price chip says which ticket it is, the caption says which card,
 * the pencil says it can be changed.
 *
 * The affordance is therefore drawn, never hovered: a dashed frame while empty,
 * a persistent pencil badge once filled. Hover-only cues would leave a touch
 * user with no way to tell a picture from a button.
 */
export const SelectorTargetPicker = ({
	product,
	umaBannerData,
	supportBannerData,
	targetUma,
	targetSupport,
	disabled,
	onChange,
}: SelectorTargetPickerProps) => {
	const [isOpen, setIsOpen] = useState(false)
	const [search, setSearch] = useState("")
	const isUma = product.product_type === "uma_selector"
	// The person's favourite umas get the rainbow frame (FramedUma).
	const oshiIds = useOshiIds()

	// The catalogue rules — "(All)" exclusion, inclusive cutoff, newest-first
	// ordering — live in the hook, shared with the step-up selection picker.
	const options = useEligibleCardCatalogue({
		pool: isUma ? "uma" : "support",
		jpCutoffDate: product.jp_cutoff_date,
		umaBannerData,
		supportBannerData,
	})

	const selectedId = isUma ? targetUma : targetSupport
	const selected = options.find((option) => option.value === selectedId) ?? null
	const matchingOptions = options.filter((option) =>
		option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())
	)

	useEffect(() => {
		if (!isOpen) return undefined

		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setIsOpen(false)
		}
		window.addEventListener("keydown", closeOnEscape)
		return () => window.removeEventListener("keydown", closeOnEscape)
	}, [isOpen])

	const choose = (option: EligibleCard) => {
		onChange({
			uma: isUma ? option.value : null,
			support: isUma ? null : option.value,
		})
		setIsOpen(false)
	}

	const clear = () =>
		onChange({ uma: null, support: null })

	const open = () => {
		setSearch("")
		setIsOpen(true)
	}

	const canPick = !disabled && options.length > 0

	// Grid tile size inside the modal.
	const cardSizeClass = isUma ? "h-28 w-28" : "h-28 w-[5.25rem]"
	// The two pools keep their own aspect ratios at a shared height, and the
	// width is on the WRAPPER so the caption can never widen the tile past its
	// art. Fixed, and shrink-0: five tickets in one strip must look exactly like
	// one ticket in one strip — squeezing five cards to fit the row is the thing
	// this layout exists to avoid. They wrap instead.
	const tileWidthClass = isUma ? "w-32" : "w-24"
	// "Free" rather than "$0" — the ticket is free, not priced at nothing.
	const priceLabel = product.usd_cost > 0 ? formatUsd(product.usd_cost) : "Free"
	const poolNoun = isUma ? "an uma" : "a support card"
	const label = selected
		? `${product.name}: ${selected.label}. Choose a different card.`
		: options.length === 0
			? `${product.name}: no eligible cards`
			: `Choose ${poolNoun} for ${product.name}`

	return (
		<div className={`relative ${tileWidthClass} shrink-0`}>
			<button
				type="button"
				disabled={!canPick}
				aria-haspopup="dialog"
				aria-expanded={isOpen}
				aria-label={label}
				title={label}
				className="group block w-full disabled:cursor-not-allowed"
				onClick={open}
			>
				<span
					className={`relative flex h-32 w-full items-center justify-center overflow-hidden rounded-md border-2 bg-gray-900/40 transition ${
						selected
							? "border-gray-600"
							: "border-dashed border-gray-500 text-gray-500"
					} ${canPick ? "group-hover:border-brand group-hover:bg-gray-900/70" : ""}`}
				>
					{selected?.portrait ? (
						<FramedUma src={selected.portrait} oshi={oshiIds.has(selected.value)} className="h-28" />
					) : selected ? (
						<img
							src={selected.image}
							alt=""
							loading="lazy"
							decoding="async"
							className="h-full w-full object-contain"
						/>
					) : (
						<ImagePlus className="h-7 w-7" />
					)}

					{/* Which ticket this tile belongs to. Overlaid rather than given
					    its own line: the tiles sit in the same order as the checkbox
					    column beside them, so this is a confirmation, not the label. */}
					<span className="pointer-events-none absolute left-0 top-0 rounded-br-md bg-gray-950/85 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-gray-200">
						{priceLabel}
					</span>

					{/* The "this is a button" cue for anyone who cannot hover. Only
					    on a filled tile — an empty one already says so with its
					    dashed frame and its plus. */}
					{selected && canPick && (
						<span className="pointer-events-none absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-tl-md bg-gray-950/85 text-gray-300 group-hover:text-brand">
							<Pencil className="h-3 w-3" />
						</span>
					)}
				</span>

				<span
					className={`mt-1 block truncate text-center text-[0.65rem] leading-tight ${
						selected ? "text-gray-300" : "text-gray-500"
					}`}
				>
					{selected?.label ??
						(options.length === 0 ? "No eligible cards" : `Choose ${poolNoun}`)}
				</span>
			</button>

			{/* A sibling of the tile, not a child — a button inside a button is
			    invalid, and the tile is the button now. */}
			{selected && !disabled && (
				<button
					type="button"
					aria-label={`Clear ${selected.label}`}
					className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-gray-600 bg-gray-800 text-gray-400 transition hover:border-gray-500 hover:text-gray-100"
					onClick={clear}
				>
					<X className="h-3 w-3" />
				</button>
			)}

			{isOpen && createPortal(
				<div
					className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/75 p-4"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) setIsOpen(false)
					}}
				>
					<section
						role="dialog"
						aria-modal="true"
						aria-label={`Choose ${isUma ? "an uma" : "a support card"}`}
						className="flex max-h-[min(44rem,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-600 bg-gray-800 shadow-2xl"
					>
						<header className="flex flex-wrap items-center gap-3 border-b border-gray-700 bg-gray-800/80 px-4 py-3">
							<div className="min-w-0 flex-1">
								<h5 className="text-base font-semibold text-gray-100">
									Choose {isUma ? "an Uma" : "a support card"}
								</h5>
								<p className="text-xs text-gray-400">{options.length} eligible cards</p>
							</div>
							<label className="relative w-full sm:w-64">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
								<input
									autoFocus
									type="search"
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search cards…"
									className="w-full rounded border border-gray-600 bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand"
								/>
							</label>
							<button
								type="button"
								aria-label="Close card picker"
								className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
								onClick={() => setIsOpen(false)}
							>
								<X className="h-5 w-5" />
							</button>
						</header>

						<div className="min-h-0 overflow-y-auto p-4">
							{matchingOptions.length === 0 ? (
								<p className="py-12 text-center text-sm text-gray-400">
									No eligible cards match that search.
								</p>
							) : (
								<div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
									{matchingOptions.map((option) => {
										const isSelected = option.value === selectedId
										return (
											<button
												key={option.value}
												type="button"
												aria-pressed={isSelected}
												className={`group flex min-w-0 flex-col items-center rounded-lg border p-2 text-center transition ${
													isSelected
														? "border-brand bg-brand/10"
														: "border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700"
												}`}
												onClick={() => choose(option)}
											>
												{option.portrait ? (
													<FramedUma src={option.portrait} oshi={oshiIds.has(option.value)} className="w-28" />
												) : (
													<img
														src={option.image}
														alt=""
														loading="lazy"
														decoding="async"
														className={`${cardSizeClass} object-contain`}
													/>
												)}
												<span className="mt-2 line-clamp-2 min-h-9 text-xs font-medium leading-tight text-gray-100">
													{option.label}
												</span>
											</button>
										)
									})}
								</div>
							)}
						</div>
					</section>
				</div>,
				document.body
			)}
		</div>
	)
}
