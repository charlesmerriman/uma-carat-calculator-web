import React, { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CalculatorContext } from "./CalculatorContext"
import { clearAuthToken, getAuthToken } from "./authToken"
import type {
	CalculatorData,
	UserStats,
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank,
	UserPlannedBanner,
	BannerUma,
	BannerSupport,
	BannerStepUp,
	GameEvent,
	ChampionsMeeting,
	LeagueOfHeroes,
	OrganizedTimelineData,
	AnniversaryEvent,
	Scenario,
	UserPlannedPurchase,
	UserStepUpSelection,
	IncomeLedgerRow,
	CalculationConstants
} from "../types"
import { DEFAULT_CONSTANTS } from "../constants/gameConstants"
import {
	initialCalculatorDataFetch,
	userCalculatorDataPatch,
	toBannerPayload,
	toPurchasePayload,
	toStepUpSelectionPayload
} from "./calculatorFetchCalls"
import {
	DEFAULT_GUEST_STATS,
	readGuestPlanStash,
	clearGuestPlanStash,
	mergeStepUpSelections
} from "./guestMigration"
import { useAutoSave } from "../hooks/useAutoSave"

interface CalculatorProviderProps {
	children: React.ReactNode
}

export const CalculatorProvider = ({ children }: CalculatorProviderProps) => {
	/**
	 * TYPESCRIPT CONCEPT: useState Generic Parameter
	 *
	 * useState<UserStats | null>(null) tells TypeScript the state can be
	 * either a UserStats object or null. Without the generic, TypeScript
	 * would infer the type from the initial value alone — useState(null)
	 * would be typed as `null` forever, and you couldn't set it to UserStats later.
	 *
	 * For arrays, useState<ClubRank[]>([]) works because TypeScript can't infer
	 * the element type from an empty array — [] would become `never[]`.
	 *
	 * NOTE: We no longer use `ClubRank[] | []` — an empty ClubRank[] already
	 * covers the empty case. The `| []` was redundant and added noise.
	 */
	const [userStatsData, setUserStatsData] = useState<UserStats | null>(null)
	const [clubRankData, setClubRankData] = useState<ClubRank[]>([])
	const [teamTrialsRankData, setTeamTrialsRankData] = useState<TeamTrialsRank[]>([])
	const [championsMeetingRankData, setChampionsMeetingRankData] = useState<ChampionsMeetingRank[]>([])
	const [leagueOfHeroesRankData, setLeagueOfHeroesRankData] = useState<LeagueOfHeroesRank[]>([])
	const [umaBannerData, setUmaBannerData] = useState<BannerUma[]>([])
	const [supportBannerData, setSupportBannerData] = useState<BannerSupport[]>([])
	const [stepUpBannerData, setStepUpBannerData] = useState<BannerStepUp[]>([])
	const [userPlannedBannerData, setUserPlannedBannerData] = useState<UserPlannedBanner[]>([])
	// Deliberately NOT persisted — not to localStorage, not to sessionStorage,
	// and never PATCHed. Staging is scratch space, and a reload clearing it is
	// correct rather than a bug to fix.
	//
	// The reason is that persisting it would make scratch rows outlive the real
	// plan. A guest's CONFIRMED banners are in-memory only and a refresh discards
	// them by design (frontend/docs/state-and-guest-mode.md), so a staged row
	// surviving a reload that wiped the calculator underneath it would be
	// incoherent — the provisional half of the screen would be the durable half.
	//
	// The impermanence is stated in the UI instead: see the hint under the
	// "Staging" heading in CaratCalculator.
	const [stagedBanners, setStagedBanners] = useState<UserPlannedBanner[]>([])
	const [gameEventsData, setGameEventsData] = useState<GameEvent[]>([])
	const [championsMeetingData, setChampionsMeetingData] = useState<ChampionsMeeting[]>([])
	const [leagueOfHeroesData, setLeagueOfHeroesData] = useState<LeagueOfHeroes[]>([])
	const [anniversaryEventData, setAnniversaryEventData] = useState<AnniversaryEvent[]>([])
	const [scenarioData, setScenarioData] = useState<Scenario[]>([])
	const [userPlannedPurchaseData, setUserPlannedPurchaseData] = useState<UserPlannedPurchase[]>([])
	const [userStepUpSelectionData, setUserStepUpSelectionData] = useState<UserStepUpSelection[]>([])
	const [organizedTimelineData, setOrganizedTimelineData] = useState<OrganizedTimelineData>([])
	const [incomeLedger, setIncomeLedger] = useState<IncomeLedgerRow[]>([])
	const [calculationConstants, setCalculationConstants] =
		useState<CalculationConstants>(DEFAULT_CONSTANTS)
	const [isLoading, setIsLoading] = useState(true)
	const [fetchError, setFetchError] = useState(false)

	// The response→request shape conversion lives in toBannerPayload (a pure
	// function) so the guest-migration flow can also run it on data that
	// isn't in React state yet.
	const prepareBannerData = useCallback(
		() => toBannerPayload(userPlannedBannerData),
		[userPlannedBannerData]
	)

	const preparePurchaseData = useCallback(
		() => toPurchasePayload(userPlannedPurchaseData),
		[userPlannedPurchaseData]
	)

	const prepareStepUpSelectionData = useCallback(
		() => toStepUpSelectionPayload(userStepUpSelectionData),
		[userStepUpSelectionData]
	)

	const performSave = useCallback(async (): Promise<void> => {
		// Guests never PATCH — their plan is in-memory only. The auto-save
		// timer is already gated, but saveNow could still land here.
		if (!getAuthToken()) return
		try {
			const response = await userCalculatorDataPatch(
					userStatsData,
					prepareBannerData(),
					preparePurchaseData(),
					prepareStepUpSelectionData()
				)
			if (!response.ok) {
				toast.error("Save failed. Your changes may not have been saved.")
			} else {
				toast.success("Saved")
			}
		} catch {
			toast.error("Save failed. Check your connection.")
		}
	}, [userStatsData, prepareBannerData, preparePurchaseData,
		prepareStepUpSelectionData])

	const { timerIsGoing, startTimer, saveNow } = useAutoSave({
		saveFn: performSave,
		delayMs: 5000
	})

	// Guards the guest-plan migration against firing twice when React
	// StrictMode double-runs the mount effect in dev.
	const didMigrateRef = useRef(false)

	useEffect(() => {
		const controller = new AbortController()

		const applyData = (data: CalculatorData): void => {
				/**
				 * TYPESCRIPT CONCEPT: Extending Objects with Extra Fields
				 *
				 * We add `_source` to each event for sorting purposes.
				 * By defining these as inline objects with `as const` on the _source
				 * value, TypeScript infers the literal types "banner" | "champions"
				 * rather than just `string`. This helps with type narrowing later.
				 */
				const mergedEvents = [
					...data.banner_timeline_data.map((event) => ({
						...event,
						_source: "banner" as const
					})),
					...data.champions_meeting_data.map((event) => ({
						...event,
						_source: "champions" as const
					})),
					...data.league_of_heroes_event_data.map((event) => ({
						...event,
						_source: "leagueofheroes" as const
					}))
				]

				const sortedMergedEvents = mergedEvents.sort((a, b) => {
					const timeDiff =
						new Date(a.start_date).getTime() -
						new Date(b.start_date).getTime()

					if (timeDiff !== 0) return timeDiff

					if (a._source === "champions" && b._source === "banner") return -1
					if (a._source === "banner" && b._source === "champions") return 1

					return 0
				})

				// Guests get null stats from the server — seed local defaults so
				// downstream components never have to care who they're rendering for.
				setUserStatsData(data.user_stats_data ?? DEFAULT_GUEST_STATS)
				// These three rank types climb monotonically with income, so
				// sorting by income descending puts the best rank first — the
				// natural dropdown order.
				setClubRankData([...data.club_rank_data].sort((a, b) => b.income_amount - a.income_amount))
				setTeamTrialsRankData([...data.team_trials_rank_data].sort((a, b) => b.income_amount - a.income_amount))
				setLeagueOfHeroesRankData([...data.league_of_heroes_rank_data].sort((a, b) => b.income_amount - a.income_amount))
				// Champions Meeting placements DON'T sort logically by income (a
				// top-league Third pays fewer carats than a Group B 1st), so the
				// backend orders them by an explicit sort_order field. Trust that
				// order as-is rather than re-sorting here.
				setChampionsMeetingRankData(data.champions_meeting_rank_data)
				setUmaBannerData(data.banner_uma_data)
				setSupportBannerData(data.banner_support_data)
				// ?? [] because an older API predates this key — the same tolerance
				// calculation_constants gets. A missing catalogue must not blank the page.
				setStepUpBannerData(data.banner_step_up_data ?? [])
				setUserPlannedBannerData(data.user_planned_banner_data)
				// Defaulted, unlike the keys above, because these two arrived later
				// than the rest of the payload. A backend running a build from
				// before the selector planner omits them entirely, and an
				// undefined here reaches useBannerResources' flatMap and takes
				// down /app and /app/selectors together. Degrade to "no campaigns
				// planned" instead — the rest of the calculator is still correct
				// without them.
				setAnniversaryEventData(data.anniversary_event_data ?? [])
				// Defaulted for the same reason as the campaign keys above: this
				// arrived later than the rest of the payload, so a backend build
				// that predates it must degrade to "no scenarios" rather than
				// putting undefined where the planner expects an array.
				setScenarioData(data.scenario_data ?? [])
				setUserPlannedPurchaseData(data.user_planned_purchase_data ?? [])
				// Defaulted for the same reason as the two above: an API predating
				// step-up selections omits the key entirely.
				setUserStepUpSelectionData(data.user_step_up_selection_data ?? [])
				setGameEventsData(data.events_data)
				setChampionsMeetingData(data.champions_meeting_data)
				setLeagueOfHeroesData(data.league_of_heroes_event_data)
				// Defaulted like the campaign keys above: an older API (or a
				// deploy where the two sides are briefly out of step) should
				// degrade to an empty projection, not crash the calculator.
				setIncomeLedger(data.income_ledger ?? [])
				// Overlaid rather than replaced: a constant the API doesn't know
				// about yet keeps its built-in default instead of arriving
				// undefined and turning every downstream total into NaN.
				setCalculationConstants({
					...DEFAULT_CONSTANTS,
					...(data.calculation_constants ?? {}),
				})
				setOrganizedTimelineData(sortedMergedEvents)
				setIsLoading(false)
		}

		const load = async (): Promise<void> => {
			// A present-but-invalid token makes the backend 401 even on the
			// now-public GET (DRF authenticates before checking permissions).
			// Drop the stale token and retry as a guest instead of stranding
			// the user on the error screen.
			let response = await initialCalculatorDataFetch(controller.signal)
			if (response.status === 401 && getAuthToken()) {
				clearAuthToken()
				response = await initialCalculatorDataFetch(controller.signal)
			}
			if (!response.ok) {
				throw new Error(`calculator-data fetch failed: ${response.status}`)
			}
			let data = (await response.json()) as CalculatorData

			// Guest-plan migration: a stash in sessionStorage + a token means
			// the user just logged in after building a plan as a guest.
			// This runs BEFORE any state is set, so the auto-save effect
			// (which skips while prevStatsRef is null) can't race it.
			const stash = readGuestPlanStash()
			if (
				stash &&
				getAuthToken() &&
				!didMigrateRef.current
			) {
				didMigrateRef.current = true
				try {
					// Conflict rule: keep the account's saved rows (sending them
					// WITH ids preserves them — the PATCH deletes anything absent)
					// and append the guest's rows (no ids → created). Stats are in
					// the stash only if the guest actually edited them.
					const patchResponse = await userCalculatorDataPatch(
						stash.stats,
						[
							...toBannerPayload(data.user_planned_banner_data),
							...stash.banners
						],
						[
							// Same defaulting as the setter below — this runs on the
							// raw payload, before the state above is populated.
							...toPurchasePayload(data.user_planned_purchase_data ?? []),
							...(stash.purchases ?? [])
						],
						// The account's own rows must be resent, not just the guest's:
						// the PATCH deletes anything absent from the body, so sending
						// only the stash would wipe selections the account already had.
						// mergeStepUpSelections resolves the overlap per step-up —
						// concatenating would collide on the unique slot index and 400
						// the entire migration.
						mergeStepUpSelections(
							toStepUpSelectionPayload(data.user_step_up_selection_data ?? []),
							stash.stepUpSelections ?? []
						)
					)
					if (patchResponse.ok) {
						clearGuestPlanStash()
						// Re-fetch so the migrated banners come back with real
						// database ids in canonical order.
						const refreshed = await initialCalculatorDataFetch(controller.signal)
						if (refreshed.ok) {
							data = (await refreshed.json()) as CalculatorData
						}
						toast.success("Your guest plan was saved to your account")
					} else if (patchResponse.status < 500) {
						// 4xx — retrying the same payload would fail forever.
						clearGuestPlanStash()
						toast.error("Couldn't import your guest plan. Loaded your saved data instead.")
					} else {
						// 5xx — keep the stash so the next page load retries.
						toast.error("Couldn't import your guest plan right now. It will retry on your next visit.")
					}
				} catch (error: unknown) {
					if (error instanceof Error && error.name === "AbortError") throw error
					// Network failure — keep the stash for a retry on next load.
					toast.error("Couldn't import your guest plan right now. It will retry on your next visit.")
				}
			}

			applyData(data)
		}

		load().catch((error: unknown) => {
			// AbortError is expected when Strict Mode cleanup cancels the first fetch
			if (error instanceof Error && error.name === "AbortError") return
			console.error("Error fetching calculator data:", error)
			setIsLoading(false)
			setFetchError(true)
		})

		return () => controller.abort()
	}, [])

	// prevStatsRef tracks what userStatsData was on the last effect run.
	// When it's null, this is either the initial mount or the initial data load — both should
	// be skipped. Only start the timer once real user edits happen (prevStatsRef is non-null).
	const prevStatsRef = useRef<UserStats | null>(null)
	useEffect(() => {
		const wasEmpty = prevStatsRef.current === null
		prevStatsRef.current = userStatsData
		if (wasEmpty) return
		// Guests have nothing to save to the server. Never arming the timer
		// also suppresses the pending-save icon and the beforeunload warning.
		if (!getAuthToken()) return
		startTimer()
	}, [startTimer, userStatsData, userPlannedBannerData, userPlannedPurchaseData,
		userStepUpSelectionData])

	const value = {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		umaBannerData,
		supportBannerData,
		stepUpBannerData,
		userPlannedBannerData,
		stagedBanners,
		anniversaryEventData,
		scenarioData,
		userPlannedPurchaseData,
		userStepUpSelectionData,
		gameEventsData,
		championsMeetingData,
		leagueOfHeroesData,
		incomeLedger,
		calculationConstants,
		timerIsGoing,
		isLoading,
		fetchError,
		organizedTimelineData,
		saveNow,
		setUserPlannedBannerData,
		setStagedBanners,
		setUserPlannedPurchaseData,
		setUserStepUpSelectionData,
		setUserStatsData
	}

	// Children render straight away, loading or not.
	//
	// This used to return a bare spinner on an empty page until the fetch
	// landed, which threw away the navbar and footer as well — the whole of
	// /app was blank for as long as the request took. The wait itself is
	// unchanged, but ApplicationViews now paints the shell immediately and
	// gates only the page area, which is where the data is actually needed.
	//
	// The routed pages stay behind that gate: CaratCalculator, Timeline and
	// Selectors are all written assuming their collections are populated, and
	// letting them mount early would mean auditing all three for empty data.
	return (
		<CalculatorContext.Provider value={value}>
			{children}
		</CalculatorContext.Provider>
	)
}