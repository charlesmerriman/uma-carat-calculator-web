import type {
	UserPlannedBanner,
	BannerUma,
	BannerSupport,
	BannerStepUp
} from "../../types"
import { Link } from "react-router-dom"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { toast } from "sonner"
import { MobileBannerCard } from "./MobileBannerCard"
import { RecommendedMark } from "./RecommendedMark"
import { NumberField } from "../NumberField"
import { CountStepper } from "./CountStepper"
import { buildCountChips } from "../../utils/countChips"
import {
	compactSelectStyles,
	mobileBannerSelectStyles,
	withRecommendedOption,
} from "../../utils/reactSelectStyles"
import { formatDate } from "../../utils/dateFormat"
import { timelineFocusHref } from "../../utils/timelineFocus"
import {
	bannerKey,
	bannerTargetFields,
	bannersForRowType,
	getPullCountStatus,
	getStepCountStatus,
	isRecommendedBanner,
	isSelectableBanner,
	plannedBannerKey,
	plannedBannerRowType,
	plannedBannerTarget,
	plannedBannerTimeline,
} from "../../utils/bannerHelpers"
import type {
	BannerKey,
	BannerRowType,
	PlannableBanner,
} from "../../utils/bannerHelpers"
import { STEPS_PER_ROUND } from "../../utils/stepUpLadder"
import { PULLS_PER_PITY_COPY } from "../../utils/probabilityCalculations"
import { ExtraCardsBadge } from "./ExtraCardsBadge"
import { BannerTypeBadge } from "./BannerTypeBadge"

interface StagedBannerRowProps {
	stagedBanner: UserPlannedBanner
	setStagedBanner: (banner: UserPlannedBanner) => void
	onConfirm: () => void
	onDiscard: () => void
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	stepUpBannerData: BannerStepUp[]
	userPlannedBannerData: UserPlannedBanner[]
	/** Every staged row, this one included — it filters itself out by tempId. */
	stagedBanners: UserPlannedBanner[]
}

interface BannerOption {
	value: PlannableBanner
	label: string
	key: number
}

export const StagedBannerRow = ({
	stagedBanner,
	setStagedBanner,
	onConfirm,
	onDiscard,
	umaBannerData,
	supportBannerData,
	stepUpBannerData,
	userPlannedBannerData,
	stagedBanners
}: StagedBannerRowProps) => {
	const target = plannedBannerTarget(stagedBanner)
	const bannerType: BannerRowType = plannedBannerRowType(stagedBanner)

	const isStepUp = bannerType === "StepUp"

	const targetBannerData = bannersForRowType(bannerType, {
		umaBannerData,
		supportBannerData,
		stepUpBannerData,
	})

	const currentDate = new Date()

	// Match within the type namespace only. targetBannerData is already scoped to
	// bannerType, and uma/support ids are independent — comparing against the
	// other type's id could resolve to an unrelated banner of the same number.
	const selectedBannerId = target.type === "Empty" ? undefined : target.banner.id
	const currentBanner = targetBannerData.find((banner) => banner.id === selectedBannerId)

	// Banners this row can't take, and why: those already confirmed on the sheet,
	// plus those claimed by a *different* staged row. Without the second group,
	// two staged rows could hold the same banner all the way to the confirm
	// button, where the second one is rejected — the conflict is worth surfacing
	// in the select instead, while it's still cheap to fix.
	//
	// Keyed by type+id, never by bare id — uma and support banners have independent
	// primary keys, so a bare id would make an uma banner block its same-date
	// support counterpart (see plannedBannerKey).
	const unavailableBanners = new Map<BannerKey, "sheet" | "staged">()
	for (const planned of userPlannedBannerData) {
		const key = plannedBannerKey(planned)
		if (key) unavailableBanners.set(key, "sheet")
	}
	for (const staged of stagedBanners) {
		// This row's own selection is never a conflict with itself.
		if (staged.tempId === stagedBanner.tempId) continue
		const key = plannedBannerKey(staged)
		// "sheet" wins a tie — it's the more actionable of the two messages.
		if (key && !unavailableBanners.has(key)) unavailableBanners.set(key, "staged")
	}

	/** This row's select only ever offers banners of its own type. */
	const optionKey = (option: BannerOption): BannerKey =>
		bannerKey(bannerType, option.value.id)

	const handleBannerSelect = (option: SingleValue<BannerOption>): void => {
		if (!option) return
		const conflict = unavailableBanners.get(optionKey(option))
		if (conflict) {
			toast.error(
				conflict === "sheet"
					? "This banner is already in your calculator."
					: "This banner is already staged in another row."
			)
			return
		}
		// Setting one target clears the other two — exactly one may ever be set.
		setStagedBanner({
			...stagedBanner,
			...bannerTargetFields(bannerType, option.value),
		})
	}

	const handlePullCountChange = (count: number): void => {
		setStagedBanner({ ...stagedBanner, number_of_pulls: count })
	}

	const handleReservedChange = (copies: number): void => {
		// Whole and non-negative via NumberField. It matters on this field in
		// particular: the value carries onto the sheet on confirm, where a
		// decimal would reach getExactProbability — which assumes integer trials.
		setStagedBanner({ ...stagedBanner, reserved_copies: copies })
	}

	const hasBanner = target.type !== "Empty"

	// A staged banner isn't on the sheet yet, so useBannerResources hasn't
	// projected an affordability bound for it. Infinity opts out of the "over"
	// state rather than inventing a limit — the field still flags on/off pity,
	// and the real red signal appears once the banner is added to the sheet.
	const countStatus = isStepUp
		? getStepCountStatus(stagedBanner.number_of_pulls, Infinity)
		: getPullCountStatus(stagedBanner.number_of_pulls, Infinity)
	const countStatusHint = isStepUp
		? countStatus === "ok"
			? "A completed ladder — every carat bought a full banner, guarantee included"
			: `Stops part-way up a ladder (${STEPS_PER_ROUND} steps complete one)`
		: countStatus === "ok"
		? "On a pity threshold — no carats stranded in a partial counter"
		: `Not on a pity threshold (a multiple of ${PULLS_PER_PITY_COPY} pulls)`
	const countLabel = isStepUp ? "Number of steps" : "Number of pulls"

	const images =
		target.type === "Uma"
			? target.banner.umas
			: target.type === "Support"
			? target.banner.support_cards
			: []

	// A staged step-up has no campaign lookup (no anniversaryEventData here) and
	// so no cutoff line — that arrives with the row once it is on the sheet. The
	// pool chip still stands in for the missing thumbnails.
	const stepUpChip =
		target.type === "StepUp"
			? target.banner.card_type === "support"
				? "SSR"
				: "★3"
			: null

	// Same link as a confirmed row's — a staged row shows identical thumbnails
	// right above the sheet, and having only one of the two respond to a click
	// would read as a broken link rather than a deliberate distinction.
	const timelineHref = target.timeline
		? timelineFocusHref({ kind: "banner", id: target.timeline.id })
		: null

	const imagesCell =
		target.type === "StepUp" ? (
			target.banner.image ? (
				<img src={target.banner.image} alt={target.banner.name} className="thumb-banner" />
			) : (
				<span className="step-up-pool-chip text-sm font-bold leading-none text-purple-300">{stepUpChip}</span>
			)
		) : (
			<>
				{images.slice(0, 2).map((img) => (
					<img
						key={img.name}
						src={img.image}
						alt={img.name}
						className={`thumb-banner ${bannerType === "Uma" ? "thumb-banner--uma" : ""}`}
					/>
				))}
				<ExtraCardsBadge hidden={images.length - 2} />
			</>
		)

	const bannerTimeline = plannedBannerTimeline(stagedBanner)

	// See BannerRow: an option that is unavailable here (in the calculator, or
	// staged in another row) keeps its greying and gets no gold wash.
	const isWashedOption = (option: BannerOption): boolean =>
		isRecommendedBanner(option.value, bannerType) &&
		!unavailableBanners.has(optionKey(option))

	const renderBannerSelect = (styles: import("react-select").StylesConfig<BannerOption, false>) => (
		<Select<BannerOption>
			className="w-full"
			styles={withRecommendedOption<BannerOption>(
				{
					...styles,
					menuPortal: (base) => ({ ...base, zIndex: 9999 })
				},
				isWashedOption
			)}
			menuPortalTarget={document.body}
			menuPosition="fixed"
			// Phrased as the action, not as a heading. "Target Support Banner" is a
			// noun phrase and read as this card's title rather than as an empty
			// field waiting to be filled — the same thing the transparent control
			// styling was doing (see mobileBannerSelectStyles).
			placeholder={isStepUp ? "Select a step-up campaign…" : `Select a ${bannerType.toLowerCase()} banner…`}
			value={
				currentBanner
					? { value: currentBanner, label: currentBanner.name, key: currentBanner.id }
					: null
			}
			onChange={handleBannerSelect}
			formatOptionLabel={(option) => {
				const conflict = unavailableBanners.get(optionKey(option))
				return (
					<span className={conflict ? "text-gray-500" : ""}>
						{/* The same mark in the open menu and on the chosen value. */}
						{isRecommendedBanner(option.value, bannerType) && (
							<RecommendedMark muted={!!conflict} />
						)}
						{option.label}
						{conflict && (
							<span className="ml-1 text-xs">
								{conflict === "sheet" ? "(in calculator)" : "(staged)"}
							</span>
						)}
					</span>
				)
			}}
			options={targetBannerData
				.filter((banner) => isSelectableBanner(banner, currentDate))
				.map((banner) => ({
					value: banner,
					label: banner.name,
					key: banner.id
				}))}
		/>
	)

	const bannerSelect = renderBannerSelect(
		compactSelectStyles as import("react-select").StylesConfig<BannerOption, false>
	)
	const mobileBannerSelect = renderBannerSelect(
		mobileBannerSelectStyles as import("react-select").StylesConfig<BannerOption, false>
	)

	const dateDisplay = bannerTimeline ? (
		// Always one per line, at every card width — same reason as BannerRow's.
		<div className="flex flex-col text-xs leading-snug text-gray-400 @max-[18rem]:text-[11px]">
			<div>Start: <span className="text-gray-100">{formatDate(bannerTimeline.start_date)}</span></div>
			<div>End: <span className="text-gray-100">{formatDate(bannerTimeline.end_date)}</span></div>
		</div>
	) : (
		<span className="text-xs text-gray-600">—</span>
	)

	// Wrapped rather than bare: MobileBannerCard's summary slot is edge-to-edge
	// now, and a button welded to the card's sides reads as a footer bar rather
	// than an action. The stats strip that fills this slot on a saved row wants
	// exactly the opposite, which is why the padding belongs to the caller.
	//
	// A full `p-3`, not `p-3 pb-0`: with no odds band under it this is the card's
	// last band, so the bottom gutter it used to borrow from `chanceDisplay` has
	// to come from here.
	const confirmButton = (
		<div className="p-3">
		<button
			onClick={onConfirm}
			disabled={!hasBanner}
			className="add-to-calculator-button flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-40"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
				<polyline points="20 6 9 17 4 12" />
			</svg>
			Add to calculator
		</button>
		</div>
	)

	// ONE node, rendered by both the phone card and the desktop cell below —
	// same rule as BannerRow's pullsInput. This row used to declare the field
	// twice, which is how it came to be missing the pad and the keyboard steps
	// in both copies at once.
	//
	// Infinity, not a number: a staged banner has no projection, so there is no
	// affordable ceiling for a "Max" chip to jump to. buildCountChips drops the
	// chip; the ruler and "Next pity" are the same as on the sheet.
	const pullsInput = (
		<CountStepper
			value={stagedBanner.number_of_pulls}
			onChange={handlePullCountChange}
			chips={buildCountChips({
				isStepUp,
				upperBound: Infinity,
				pullsPerPity: PULLS_PER_PITY_COPY,
				stepsPerRound: STEPS_PER_ROUND,
			})}
			label={isStepUp ? "Steps" : "Pulls"}
		>
			<NumberField
				value={stagedBanner.number_of_pulls}
				className={`pull-input pull-input--${countStatus} w-14`}
				title={countStatusHint}
				ariaLabel={countLabel}
				// The keyboard mirror of the pad's delta row, matching BannerRow
				// so a value typed while staged behaves as it will on the sheet.
				mediumStep={isStepUp ? STEPS_PER_ROUND : 10}
				largeStep={isStepUp ? undefined : PULLS_PER_PITY_COPY}
				onChange={handlePullCountChange}
			/>
		</CountStepper>
	)
	// Always neutral, never ok/over. A staged banner isn't on the sheet, so
	// useBannerResources hasn't projected which of these copies a selector or a
	// crystal could actually pay for — the same reason pullStatus opts out of
	// "over" above. Colouring it here would be inventing a funding split. The
	// real one, and the "2s 1c" hint, appear once the banner is added.
	const renderReservedInput = (widthClass: string) => (
		<NumberField
			value={stagedBanner.reserved_copies}
			className={`pull-input pull-input--neutral ${widthClass}`}
			title="Copies you'll take with a selector ticket or an SSR crystal instead of pulling. Whether you can afford them is shown once the banner is added to the calculator."
			ariaLabel="Copies obtained without pulling"
			disabled={!hasBanner}
			onChange={handleReservedChange}
		/>
	)

	return (
		<>
		<MobileBannerCard
			bannerType={bannerType}
			images={images}
			imagesSlot={isStepUp ? imagesCell : undefined}
			imagesHref={timelineHref}
			bannerSelect={mobileBannerSelect}
			dates={dateDisplay}
			summary={confirmButton}
			pullsInput={pullsInput}
			reservedInput={renderReservedInput("w-14")}
			onRemove={onDiscard}
			removeLabel="Discard staged banner"
			removeIcon="discard"
			staged
		/>

		{/* Column widths come from .banner-grid + .banner-grid--staged (App.css),
		    shared with the staging header row — never re-declare a width on a cell
		    here. The staged variant drops the MLB column and gives its width to the
		    select, so this row has EIGHT cells where BannerRow has nine. */}
		<div className="banner-grid banner-grid--staged staged-surface hidden w-full items-stretch h-16 @banner-table:grid">
			{/* === Type badge === */}
			<BannerTypeBadge type={bannerType} />

			{/* === Images section === */}
			<div className="relative flex items-center justify-center gap-1.5 py-1 px-1">
				{timelineHref ? (
					<Link
						to={timelineHref}
						title={`View ${target.timeline?.name ?? "this banner"} on the timeline`}
						className="flex items-center justify-center gap-1.5"
					>
						{imagesCell}
					</Link>
				) : (
					imagesCell
				)}
			</div>

			{/* === Banner select === */}
			<div className="flex items-center justify-center py-2 px-2">
				{bannerSelect}
			</div>

			{/* === Start / End Date === */}
			<div className="flex min-w-0 flex-col items-start justify-center gap-0.5 py-2 px-1 text-xs text-gray-400 relative">
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{bannerTimeline ? (
					<>
						<span>Start: <span className="text-gray-100">{formatDate(bannerTimeline.start_date)}</span></span>
						<span>End: <span className="text-gray-100">{formatDate(bannerTimeline.end_date)}</span></span>
					</>
				) : (
					<span className="text-gray-600">—</span>
				)}
			</div>

			{/* === Add to calculator button (replaces Derived Stats) === */}
			<div className="flex min-w-0 items-center justify-center px-3 py-2">
				<button
					onClick={onConfirm}
					disabled={!hasBanner}
					className="add-to-calculator-button w-full h-full rounded-lg bg-green-700 hover:bg-green-600 text-white font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
						<polyline points="20 6 9 17 4 12" />
					</svg>
					Add to calculator
				</button>
			</div>

			{/* === # Pulls section === */}
			<div className="flex items-center justify-center py-2 px-1 relative">
				<div className="absolute left-0 top-3 bottom-3 w-px bg-gray-700" />
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{pullsInput}
			</div>

			{/* === Reserved copies === */}
			{/* Keeps py-2, unlike BannerRow's cell: with no funding hint beneath
			    it there is nothing here that needs the extra 8px. */}
			<div className="flex items-center justify-center py-2 px-1 relative">
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{renderReservedInput("w-14")}
			</div>

			{/* === Discard button === */}
			<button onClick={onDiscard} className="banner-delete-btn">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
		</>
	)
}
