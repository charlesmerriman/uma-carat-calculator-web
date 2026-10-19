import type React from "react"
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowDownToLine, ArrowUpToLine, ChevronDown } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import type { BannerResources } from "../../hooks/bannerResources"
import { createIncomeProjection, projectionWalkOrder } from "../../utils/incomeProjection"
import {
	buildCaratForecast,
	buildPullBars,
	buildPullSeries,
	buildSkipMarkers,
	formatCarats,
} from "../../utils/caratForecast"
import type { ForecastMarker } from "../../utils/caratForecast"
import { plannedBannerTarget, plannedBannerTimeline } from "../../utils/bannerHelpers"
import { upcomingSkippedRaces } from "../../utils/raceParticipation"
import { PULLS_PER_PITY_COPY } from "../../utils/probabilityCalculations"
import { loadForecastPlot } from "./loadForecastPlot"
import type { ForecastUnit } from "./ForecastPlot"
import type { ForecastPosition } from "../../hooks/useForecastPosition"

/**
 * THE CARAT FORECAST: free carats from today to past the last planned banner,
 * dropping at each banner by what its pulls spend.
 *
 * The data is utils/caratForecast, built from the engine's own `incomeTo` and
 * the rows' own results, so every dot on the line is the number its row shows.
 * This file only draws it.
 *
 * TWO FILES, ONE CHART
 * --------------------
 * This file is the chart's frame: the data, the heading and headline, the
 * fold, the move button. The plot (ForecastPlot.tsx) is drawn with Recharts
 * and loaded lazily, in a chunk of its own, so no other page downloads the
 * library. See loadForecastPlot for the why and the early start.
 *
 * FORM, PER THE DATAVIZ RULES
 * ---------------------------
 * - One series, so no legend; the heading names it.
 * - 2px line, a 10% wash under it, hairline solid gridlines.
 * - Selective direct labels: only the line's last value. Every other figure is
 *   in the crosshair tooltip, and in the screen-reader list below the chart
 *   (the "table view"); the planner rows under it are the visible table.
 * - Below zero the line turns the over-budget status colour, the same token the
 *   pull field uses, and the headline says "Short by" with an icon, so the
 *   warning never rides on colour alone.
 */

/** localStorage: whether the viewer folded the chart away. Absent means open. */
const OPEN_STORAGE_KEY = "uma-planner-forecast-open"
/** localStorage: the view, "carats" or "pulls". Absent means carats. */
const UNIT_STORAGE_KEY = "uma-planner-forecast-unit"

const UNITS: { value: ForecastUnit; label: string }[] = [
	{ value: "carats", label: "Carats" },
	{ value: "pulls", label: "Pulls" },
]

/**
 * The plot itself, in its own chunk with Recharts. See loadForecastPlot for
 * why: Recharts is ~108 kB gzipped, and only this chart uses it, so no other
 * page should download it. Everything above the plot (the heading, the
 * headline, the move button) stays in the main bundle and renders at once.
 */
const ForecastPlot = lazy(loadForecastPlot)

interface CaratForecastChartProps {
	resources: BannerResources[]
	/** Which slot the page put it in; names the move button's direction. */
	position: ForecastPosition
	onMove: () => void
	/** Scroll into view on mount: true when it just moved here. */
	scrollIntoViewOnMount: boolean
	/** Scroll to the banner at this index of userPlannedBannerData and flash it. */
	onSelectBanner: (index: number) => void
	className?: string
}

export const CaratForecastChart: React.FC<CaratForecastChartProps> = ({
	resources,
	position,
	onMove,
	scrollIntoViewOnMount,
	onSelectBanner,
	className = "",
}) => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		userPlannedBannerData,
		anniversaryEventData,
		userPlannedPurchaseData,
		incomeLedger,
		fullIncomeLedger,
		calculationConstants,
	} = useCalculatorData()

	const forecast = useMemo(() => {
		if (!userStatsData) return null
		return buildCaratForecast({
			projection: createIncomeProjection({
				userStatsData,
				clubRankData,
				teamTrialsRankData,
				championsMeetingRankData,
				leagueOfHeroesRankData,
				anniversaryEventData,
				userPlannedPurchaseData,
				incomeLedger,
				constants: calculationConstants,
			}),
			walkOrder: projectionWalkOrder(userPlannedBannerData),
			resources,
			currentFreeCarats: userStatsData.current_carat || 0,
			currentPaidCarats: userStatsData.current_paid_carat || 0,
			currentUmaTickets: userStatsData.uma_ticket || 0,
			currentSupportTickets: userStatsData.support_ticket || 0,
		})
	}, [
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		anniversaryEventData,
		userPlannedPurchaseData,
		incomeLedger,
		calculationConstants,
		userPlannedBannerData,
		resources,
	])

	const endDateLookup = useCallback(
		(marker: ForecastMarker) => {
			const banner = userPlannedBannerData[marker.index]
			return banner ? plannedBannerTimeline(banner)?.end_date ?? null : null
		},
		[userPlannedBannerData]
	)

	// Each banner's Max Pulls without free pulls, read off its row: the pulls
	// lines' dots (buildPullSeries puts each on its own kind's line).
	const pullBars = useMemo(
		() => (forecast ? buildPullBars(forecast.markers, resources, userPlannedBannerData) : []),
		[forecast, resources, userPlannedBannerData]
	)

	// The pulls view's two lines, day by day, counted the way the player's
	// settings say (owner, 2026-10-19). A missing switch (an older API) means
	// the default the engine also assumes: spend tickets, full-price paid off.
	const pullSeries = useMemo(
		() =>
			forecast && userStatsData
				? buildPullSeries(forecast, pullBars, userPlannedBannerData, {
						pullCost: calculationConstants.pull_cost_carats,
						fullPricePaidPulls: userStatsData.full_price_paid_pulls === true,
						spendTickets: userStatsData.spend_tickets_on_banners !== false,
				  })
				: [],
		[forecast, pullBars, userPlannedBannerData, userStatsData, calculationConstants]
	)

	// A red dot for each skipped Champions Meeting or League of Heroes still
	// ahead. From the FULL ledger: the one the engine reads has skipped races
	// removed, which is how a skip works (utils/raceParticipation).
	const skipMarkers = useMemo(
		() =>
			forecast
				? buildSkipMarkers(
						forecast,
						upcomingSkippedRaces(fullIncomeLedger, userStatsData?.skipped_race_events, new Date())
				  )
				: [],
		[forecast, fullIncomeLedger, userStatsData]
	)

	// Carats or pulls, remembered per device, read in an effect like the rest.
	const [unit, setUnit] = useState<ForecastUnit>("carats")
	useEffect(() => {
		try {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- storage only exists after mount, as in TeamDrawerProvider
			if (localStorage.getItem(UNIT_STORAGE_KEY) === "pulls") setUnit("pulls")
		} catch {
			// Storage blocked: the carats view.
		}
	}, [])
	const chooseUnit = (next: ForecastUnit) => {
		setUnit(next)
		try {
			localStorage.setItem(UNIT_STORAGE_KEY, next)
		} catch {
			// Not remembered this time.
		}
	}

	// Folded or open, remembered per device. Read in an effect, never in the
	// initialiser: the calculator route is prerendered (frontend-ui.md).
	const [open, setOpen] = useState(true)
	useEffect(() => {
		try {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- storage only exists after mount, as in TeamDrawerProvider
			if (localStorage.getItem(OPEN_STORAGE_KEY) === "false") setOpen(false)
		} catch {
			// Storage blocked: stay open, which is the default anyway.
		}
	}, [])
	const toggleOpen = () => {
		setOpen((was) => {
			try {
				localStorage.setItem(OPEN_STORAGE_KEY, String(!was))
			} catch {
				// Not remembered this time; the toggle itself still works.
			}
			return !was
		})
	}

	const sectionRef = useRef<HTMLElement>(null)
	useEffect(() => {
		if (!scrollIntoViewOnMount) return
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		sectionRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
	}, [scrollIntoViewOnMount])

	if (!forecast) return null

	// The headline: the plan's tightest moment, after the banner that causes it.
	const charged = forecast.markers.filter((m) => !m.excluded)
	const lowest = charged.reduce<ForecastMarker | null>(
		(low, m) => (!low || m.after < low.after ? m : low),
		null
	)
	const moveLabel = position === "top" ? "Move below banners" : "Move above banners"
	// Stable across renders, so memos keyed on it keep their cache.
	const endDateOf = endDateLookup
	const bannerName = (marker: ForecastMarker) => {
		const banner = userPlannedBannerData[marker.index]
		const target = banner ? plannedBannerTarget(banner) : null
		return target?.banner?.name ?? "a banner"
	}

	return (
		<section
			ref={sectionRef}
			className={`card-panel overflow-hidden ${className}`}
			aria-labelledby="carat-forecast-heading"
		>
			{/* Two buttons side by side, never one inside the other: the heading
			    folds the chart, the button on the right moves it. */}
			<div className="flex items-start gap-2 pr-3">
				<button
					type="button"
					onClick={toggleOpen}
					aria-expanded={open}
					className="flex min-w-0 flex-1 items-start gap-2 py-3 pl-4 text-left transition hover:opacity-80"
				>
					<ChevronDown
						className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}
						aria-hidden="true"
					/>
					<div className="min-w-0 flex-1">
						<h2 id="carat-forecast-heading" className="font-display text-sm font-semibold text-gray-100">
							Carat forecast
						</h2>
						{lowest && (
							<p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
								{lowest.after < 0 ? (
									<>
										<AlertTriangle
											className="h-3.5 w-3.5 shrink-0 text-(--color-pull-over)"
											aria-hidden="true"
										/>
										<span className="truncate">
											Short by <span className="font-semibold text-gray-200">{formatCarats(-lowest.after)}</span>{" "}
											carats after {bannerName(lowest)}
										</span>
									</>
								) : (
									<span className="truncate">
										Lowest point:{" "}
										<span className="font-semibold text-gray-200">{formatCarats(lowest.after)}</span>{" "}
										carats, after {bannerName(lowest)}
									</span>
								)}
							</p>
						)}
					</div>
				</button>
				<button
					type="button"
					onClick={onMove}
					title={moveLabel}
					aria-label={moveLabel}
					className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-edge px-2 py-1 text-xs font-medium text-gray-300 transition hover:bg-gray-700/40 hover:text-gray-100"
				>
					{position === "top" ? (
						<ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
					) : (
						<ArrowUpToLine className="h-3.5 w-3.5" aria-hidden="true" />
					)}
					{/* The icon alone on a phone, where the headline needs the room. */}
					<span className="hidden sm:inline" aria-hidden="true">
						{moveLabel}
					</span>
				</button>
			</div>
			{open && (
				<>
					{/* The view switch. Its own row under the heading, so on a phone
					    it never fights the headline for room. */}
					<div className="flex items-center gap-3 px-4 pb-1">
						<div role="group" aria-label="Chart shows" className="inline-flex rounded-md border border-edge p-0.5 text-xs">
							{UNITS.map((option) => (
								<button
									key={option.value}
									type="button"
									aria-pressed={unit === option.value}
									onClick={() => chooseUnit(option.value)}
									className={`rounded px-2.5 py-1 font-medium transition ${
										unit === option.value
											? "bg-gray-700 text-gray-100"
											: "text-gray-400 hover:text-gray-200"
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
						{unit === "carats" ? (
							<p className="min-w-0 text-xs text-gray-500">Free carats over time</p>
						) : (
							// The legend: two series always get one. Line keys, not boxes,
							// to mirror the marks. Wraps on a phone rather than truncating.
							<p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
								<span className="inline-flex items-center gap-1.5">
									<span className="h-0.5 w-3 rounded-full bg-(--color-series-uma)" aria-hidden="true" />
									Uma pulls
								</span>
								<span className="inline-flex items-center gap-1.5">
									<span className="h-0.5 w-3 rounded-full bg-(--color-series-support)" aria-hidden="true" />
									Support pulls
								</span>
								<span className="text-gray-500">Free pulls not counted</span>
							</p>
						)}
					</div>
					{/* While the plot's chunk is still on its way, a box of the plot's
					    own height holds its place, so nothing below the chart jumps
					    when it lands. Usually it is already loaded (see loadForecastPlot). */}
					<Suspense
						fallback={<div className="h-[198px] sm:h-[248px]" aria-busy="true" aria-label="Loading the chart" />}
					>
						<ForecastPlot
							forecast={forecast}
							unit={unit}
							pullSeries={pullSeries}
							skipMarkers={skipMarkers}
							pityPulls={PULLS_PER_PITY_COPY}
							pullCost={calculationConstants.pull_cost_carats}
							bannerName={bannerName}
							endDateOf={endDateOf}
							onSelectMarker={(marker) => onSelectBanner(marker.index)}
						/>
					</Suspense>
				</>
			)}
		</section>
	)
}

