import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Search, Star, X } from "lucide-react"
import { useEligibleCardCatalogue } from "../../hooks/useEligibleCardCatalogue"
import { formatDate } from "../../utils/dateFormat"
import {
	SELECTION_SLOTS,
	cardIdOf,
	clearSlot,
	effectiveSelections,
	hasCustomSelection,
	poolFor,
	selectedCardIds,
	setTarget,
	slotView,
	toggleCard,
} from "../../utils/stepUpSelection"
import type { EligibleCard } from "../../hooks/useEligibleCardCatalogue"
import type {
	BannerStepUp,
	BannerSupport,
	BannerUma,
	UserStepUpSelection,
} from "../../types"

interface StepUpSelectionPickerProps {
	stepUp: BannerStepUp
	/**
	 * This step-up's STORED selections only — the caller splices them back.
	 * Empty means untouched, which renders the default; see `effectiveSelections`.
	 */
	selections: UserStepUpSelection[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	onClose: () => void
	onChange: (next: UserStepUpSelection[]) => void
}

/**
 * The ten-slot card picker for a Select Step-Up banner.
 *
 * Lays the source sheet's block out as a dialog: the ten Selection columns
 * across the top, the eligible candidate pool as a searchable grid beneath.
 * A dialog rather than an inline grid because the campaign card is already a
 * dense three-column layout and the 3rd Anniversary cutoff admits hundreds of
 * candidates.
 *
 * It records intent and nothing more — see utils/stepUpSelection.ts.
 */
export const StepUpSelectionPicker = ({
	stepUp,
	selections: storedSelections,
	umaBannerData,
	supportBannerData,
	onClose,
	onChange,
}: StepUpSelectionPickerProps) => {
	const [search, setSearch] = useState("")
	const isUma = poolFor(stepUp) === "uma"

	const options = useEligibleCardCatalogue({
		pool: poolFor(stepUp),
		jpCutoffDate: stepUp.jp_cutoff_date,
		umaBannerData,
		supportBannerData,
	})

	// What the user is actually looking at: their own picks, or the ten newest
	// eligible cards if they have not touched this step-up yet. Every edit below
	// is applied to THIS array, so the first one materialises the default and
	// their choice stops tracking new releases from that point on.
	const isDefault = !hasCustomSelection(storedSelections)
	const selections = effectiveSelections(storedSelections, stepUp, options)

	useEffect(() => {
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose()
		}
		window.addEventListener("keydown", closeOnEscape)
		return () => window.removeEventListener("keydown", closeOnEscape)
	}, [onClose])

	const slots = slotView(selections)
	const chosenIds = selectedCardIds(selections)
	const isFull = selections.length >= SELECTION_SLOTS

	// Cards resolved by id so a slot can show its art. The catalogue is already
	// filtered to the cutoff, so anything missing here is a STALE pick — one an
	// admin's cutoff correction has since put out of reach. Flagged rather than
	// dropped: silently deleting someone's choice because shared reference data
	// moved is worse than showing them it needs revisiting.
	const cardsById = new Map(options.map((option) => [option.value, option]))
	const staleCount = selections.filter(
		(selection) => !cardsById.has(cardIdOf(selection) ?? -1)
	).length

	const matchingOptions = options.filter((option) =>
		option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())
	)

	const cardSizeClass = isUma ? "h-24 w-24" : "h-24 w-[4.5rem]"
	const slotSizeClass = isUma ? "h-16 w-16" : "h-16 w-12"

	const renderSlot = (selection: UserStepUpSelection | null, index: number) => {
		const slotNumber = index + 1
		const card = selection ? cardsById.get(cardIdOf(selection) ?? -1) : undefined
		const isTargetSlot = selection?.is_target ?? false

		return (
			<div key={slotNumber} className="flex min-w-0 flex-col items-center gap-1">
				<span className="flex items-center gap-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500">
					{slotNumber}
					{isTargetSlot && <Star className="h-3 w-3 fill-brand text-brand" />}
				</span>
				<div
					className={`flex ${slotSizeClass} items-center justify-center overflow-hidden rounded border ${
						isTargetSlot
							? "border-brand bg-brand/10"
							: "border-gray-600 bg-gray-900/50"
					}`}
				>
					{card ? (
						<img
							src={card.image}
							alt={card.label}
							loading="lazy"
							decoding="async"
							className="h-full w-full object-contain"
						/>
					) : selection ? (
						// Chosen, but no longer in the eligible catalogue.
						<span className="px-1 text-center text-[0.6rem] leading-tight text-amber-400">
							stale
						</span>
					) : (
						<span className="text-xs text-gray-600">–</span>
					)}
				</div>
				{selection ? (
					<div className="flex gap-0.5">
						<button
							type="button"
							aria-label={`Guarantee slot ${slotNumber} at step 5`}
							aria-pressed={isTargetSlot}
							title="Guarantee this one at step 5"
							className={`flex h-6 w-6 items-center justify-center rounded border text-xs transition ${
								isTargetSlot
									? "border-brand bg-brand/20 text-brand"
									: "border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-200"
							}`}
							onClick={() => onChange(setTarget(selections, slotNumber))}
						>
							<Star className={`h-3 w-3 ${isTargetSlot ? "fill-brand" : ""}`} />
						</button>
						<button
							type="button"
							aria-label={`Clear slot ${slotNumber}`}
							className="flex h-6 w-6 items-center justify-center rounded border border-gray-600 text-gray-400 transition hover:border-gray-500 hover:text-gray-200"
							onClick={() => onChange(clearSlot(selections, slotNumber))}
						>
							<X className="h-3 w-3" />
						</button>
					</div>
				) : (
					<div className="h-6" />
				)}
			</div>
		)
	}

	const renderCandidate = (option: EligibleCard) => {
		const isChosen = chosenIds.has(option.value)
		return (
			<button
				key={option.value}
				type="button"
				aria-pressed={isChosen}
				disabled={!isChosen && isFull}
				// The default fills all ten slots, so "full" is now the state a
				// first-time user meets — the tile being inert needs a reason.
				title={
					!isChosen && isFull
						? `All ${SELECTION_SLOTS} slots are taken. Clear one to pick ${option.label}`
						: undefined
				}
				className={`group flex min-w-0 flex-col items-center rounded-lg border p-2 text-center transition disabled:cursor-not-allowed disabled:opacity-40 ${
					isChosen
						? "border-brand bg-brand/10"
						: "border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700"
				}`}
				onClick={() => onChange(toggleCard(selections, stepUp, option.value))}
			>
				<img
					src={option.image}
					alt=""
					loading="lazy"
					decoding="async"
					className={`${cardSizeClass} object-contain`}
				/>
				<span className="mt-2 line-clamp-2 min-h-9 text-xs font-medium leading-tight text-gray-100">
					{option.label}
				</span>
			</button>
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
				aria-label={`Choose cards for ${stepUp.name}`}
				className="flex max-h-[min(48rem,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-600 bg-gray-800 shadow-2xl"
			>
				<header className="flex flex-wrap items-center gap-3 border-b border-gray-700 bg-gray-800/80 px-4 py-3">
					<div className="min-w-0 flex-1">
						<h5 className="truncate text-base font-semibold text-gray-100">
							{stepUp.name}
						</h5>
						<p className="text-xs text-gray-400">
							{selections.length}/{SELECTION_SLOTS}{" "}
							{isDefault ? "(default)" : "chosen"} · {options.length}{" "}
							eligible {isUma ? "umas" : "support cards"}
							{stepUp.jp_cutoff_date &&
								` · JP cutoff ${formatDate(stepUp.jp_cutoff_date)}`}
						</p>
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
						onClick={onClose}
					>
						<X className="h-5 w-5" />
					</button>
				</header>

				{/* The sheet's Selection 1..10 columns. */}
				<div className="border-b border-gray-700 bg-gray-900/35 px-4 py-3">
					<div className="flex flex-wrap justify-center gap-2 sm:justify-start">
						{slots.map(renderSlot)}
					</div>
					<p className="mt-2 text-xs text-gray-500">
						Steps 3 and 4 guarantee a random one of these. The{" "}
						<Star className="inline h-3 w-3 fill-brand text-brand" /> marks the
						one you'd take at step 5.
					</p>
					{isDefault && (
						<p className="mt-1 text-xs text-gray-500">
							Starting with the {selections.length} most recently available{" "}
							{isUma ? "umas" : "support cards"}. Change anything here and it
							becomes your own selection.
						</p>
					)}
					{staleCount > 0 && (
						<p className="mt-1 text-xs text-amber-400">
							{staleCount} pick{staleCount === 1 ? "" : "s"} no longer eligible
							under this campaign's cutoff. Clear and re-pick{" "}
							{staleCount === 1 ? "it" : "them"}.
						</p>
					)}
				</div>

				<div className="min-h-0 overflow-y-auto p-4">
					{options.length === 0 ? (
						<p className="py-12 text-center text-sm text-gray-400">
							No cards are eligible under this campaign's JP cutoff yet.
						</p>
					) : matchingOptions.length === 0 ? (
						<p className="py-12 text-center text-sm text-gray-400">
							No eligible cards match that search.
						</p>
					) : (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3">
							{matchingOptions.map(renderCandidate)}
						</div>
					)}
				</div>
			</section>
		</div>,
		document.body
	)
}
