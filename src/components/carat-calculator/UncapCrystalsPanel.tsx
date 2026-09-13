import { useState } from "react"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { Gem } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useUncapCrystals } from "../../hooks/useUncapCrystals"
import { compactSelectStyles } from "../../utils/reactSelectStyles"
import { isSelectableBanner } from "../../utils/bannerHelpers"

interface BannerOption {
	/** The support banner's id, not its end date — two banners can share an end
	 *  date, and a duplicated value would make the second one select as the
	 *  first. */
	value: string
	label: string
	endDate: string
}

const iconCls = "w-4 h-4 shrink-0 text-brand"

// Cell showing a value (or placeholder when no date selected) with optional colored background.
// `unit` is the singular noun; it pluralises on anything but exactly 1, so the
// cell reads "1 Crystal" / "0 Crystals" rather than relying on the column header
// to say what the number counts.
const CrystalCell = ({ value, selected, green, unit, className = "" }: { value: number; selected: boolean; green: boolean; unit: string; className?: string }) => (
	<div
		className={[
			"flex items-center justify-center px-2 py-1.5 text-sm font-bold",
			green ? "crystal-cell--available" : "bg-gray-700 text-gray-300",
			className,
		].join(" ")}
	>
		{selected ? `${value.toLocaleString()} ${unit}${value === 1 ? "" : "s"}` : "–"}
	</div>
)

export const UncapCrystalsPanel = () => {
	const { userStatsData, gameEventsData, incomeLedger, championsMeetingRankData, leagueOfHeroesRankData, supportBannerData, calculationConstants } =
		useCalculatorData()
	const [selectedOption, setSelectedOption] = useState<BannerOption | null>(null)
	// The estimate is still purely a function of the end date; the option only
	// exists so the control can be labelled with the banner's name.
	const selectedEndDate = selectedOption?.endDate ?? null

	// Race payouts come from incomeLedger, not championsMeetingData /
	// leagueOfHeroesData: the ledger is where a race event's reward instant is
	// decided (a CM settles 24h before its listed end), so reading the raw event
	// lists here would put this panel a day out of step with the banner rows.
	const crystals = useUncapCrystals(
		userStatsData,
		gameEventsData,
		incomeLedger,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		selectedEndDate,
		calculationConstants,
	)

	const now = new Date()

	// Uncap crystals are a SUPPORT-CARD currency (SSR/SR are support rarities),
	// so the list is the support banner catalogue rather than the whole
	// timeline — a timeline window is named for the uma banner running in it,
	// which made half the options meaningless here.
	//
	// supportBannerData arrives already sorted by effective date, and
	// isSelectableBanner is the same still-open rule the planner's dropdowns
	// use, so the two lists can't disagree about what's still pullable.
	const bannerOptions: BannerOption[] = supportBannerData
		.filter((b) => isSelectableBanner(b, now))
		.map((b) => ({
			value: String(b.id),
			label: b.name,
			endDate: b.banner_timeline.end_date,
		}))

	return (
		// Capped and centred while the income panel is compact, matching the
		// blocks above it — see the rank grid in IncomeForm.
		<div className="mx-auto max-w-[34rem] p-4 @income-wide:max-w-none @income-wide:p-5">
			<h3 className="font-semibold text-sm text-brand mb-2 flex items-center justify-center gap-1.5">
				<Gem className={iconCls} />
				Uncap Crystals
			</h3>

			<Select<BannerOption>
				styles={compactSelectStyles}
				menuPortalTarget={document.body}
				menuPosition="fixed"
				placeholder="Select Banner for Estimate"
				options={bannerOptions}
				value={selectedOption}
				onChange={(opt: SingleValue<BannerOption>) => setSelectedOption(opt ?? null)}
			/>

			<div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-gray-700">
				{/* Column headers */}
				<div className="border-b border-r border-gray-700 px-2 py-1.5 text-center text-xs font-semibold text-gray-400">SSR</div>
				<div className="border-b border-gray-700 px-2 py-1.5 text-center text-xs font-semibold text-gray-400">SR</div>

				{/* Crystal rows (green) */}
				<CrystalCell value={crystals.ssrCrystals} selected={!!selectedEndDate} green unit="Crystal" className="border-r border-b border-gray-700" />
				<CrystalCell value={crystals.srCrystals} selected={!!selectedEndDate} green unit="Crystal" className="border-b border-gray-700" />

				{/* Shard rows (neutral) — each cell names its own unit now, so the
				    header only has to carry the rarity */}
				<CrystalCell value={crystals.ssrShards} selected={!!selectedEndDate} green={false} unit="Shard" className="border-r border-gray-700" />
				<CrystalCell value={crystals.srShards} selected={!!selectedEndDate} green={false} unit="Shard" />
			</div>
		</div>
	)
}
