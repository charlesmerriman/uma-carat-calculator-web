import React, { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CalculatorContext } from "./CalculatorContext"
import { clearAuthToken, getAuthToken, subscribeToAuthToken } from "./authToken"
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
	DailyLegendRaceRelease,
	UserPlannedPurchase,
	UserStepUpSelection,
	IncomeLedgerRow,
	Plan,
	PlanSharingChanges,
	PlanWithRows,
	SharedPlanCopy,
	SharedPlanCopyOptions,
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
import { DEFAULT_GUEST_STATS } from "./guestMigration"
import {
	guestPlanToState,
	readGuestPlan,
	subscribeToGuestPlan,
	writeGuestPlan
} from "./guestPlanStore"
import { importGuestPlan } from "./guestPlanImport"
import { reloadPage } from "./reloadPage"
import {
	planActivate,
	planCreate,
	planDelete,
	planFetch,
	planResetLink,
	planSetSeparateIncome,
	planSetSharing,
	planRename,
	sharedPlanCopy
} from "./planFetchCalls"
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
	// The account's plans, and which one userPlannedBannerData belongs to. A
	// guest keeps [] and null: one unnamed plan on this device, no switcher.
	// activePlanId and userPlannedBannerData are ALWAYS set in the same tick
	// (applyPlan below), so a save can never pair one plan's id with another
	// plan's rows.
	const [plans, setPlans] = useState<Plan[]>([])
	const [activePlanId, setActivePlanId] = useState<number | null>(null)
	const [isPlanBusy, setIsPlanBusy] = useState(false)
	// Deliberately NOT persisted — not to localStorage, not to sessionStorage,
	// and never PATCHed. Staging is scratch space, and a reload clearing it is
	// correct rather than a bug to fix.
	//
	// The reason is what staging is for: trying a row before it counts. A plan
	// that came back from a reload with half-decided rows still queued beside
	// it would blur the one line the staging area draws, between "in my plan"
	// and "thinking about it". Confirmed rows persist (the account for a
	// signed-in user, guestPlanStore for a guest); staged ones never do.
	//
	// The impermanence is stated in the UI instead: see the hint under the
	// "Staging" heading in CaratCalculator.
	const [stagedBanners, setStagedBanners] = useState<UserPlannedBanner[]>([])
	const [gameEventsData, setGameEventsData] = useState<GameEvent[]>([])
	const [championsMeetingData, setChampionsMeetingData] = useState<ChampionsMeeting[]>([])
	const [leagueOfHeroesData, setLeagueOfHeroesData] = useState<LeagueOfHeroes[]>([])
	const [anniversaryEventData, setAnniversaryEventData] = useState<AnniversaryEvent[]>([])
	const [scenarioData, setScenarioData] = useState<Scenario[]>([])
	const [dailyLegendRaceData, setDailyLegendRaceData] = useState<DailyLegendRaceRelease[]>([])
	const [userPlannedPurchaseData, setUserPlannedPurchaseData] = useState<UserPlannedPurchase[]>([])
	const [userStepUpSelectionData, setUserStepUpSelectionData] = useState<UserStepUpSelection[]>([])
	const [organizedTimelineData, setOrganizedTimelineData] = useState<OrganizedTimelineData>([])
	const [incomeLedger, setIncomeLedger] = useState<IncomeLedgerRow[]>([])
	const [calculationConstants, setCalculationConstants] =
		useState<CalculationConstants>(DEFAULT_CONSTANTS)
	const [isLoading, setIsLoading] = useState(true)
	const [fetchError, setFetchError] = useState(false)
	// Whether the guest's last write to this device landed. True until one
	// fails, so the navbar never claims "saved" in a browser that refused.
	const [isGuestPlanStored, setIsGuestPlanStored] = useState(true)

	// HOW THIS TAB LOADED, AND THEREFORE HOW IT SAVES. Decided once, when the
	// payload arrives, and never re-asked. null until then.
	//
	// The save path used to ask "is there a token?" at the moment of each
	// edit. The token is shared by every tab, so that question can change its
	// answer underneath data that has not changed:
	//
	//   tab loaded as | then, in another tab | the next edit here would
	//   --------------|----------------------|-------------------------------
	//   guest         | they sign in         | PATCH the guest's rows with no
	//                 |                      | plan id. The server reads that
	//                 |                      | as the active plan and DELETES
	//                 |                      | every account row not in it.
	//   account       | they sign out        | write the account's rows into
	//                 |                      | the guest store, left behind on
	//                 |                      | what may be a shared computer.
	//
	// With the mode latched, neither can happen: a guest tab only ever writes
	// the device store and an account tab only ever PATCHes. A tab whose mode
	// no longer matches the token reloads (the effect below), which is the
	// same answer ProfileMenu gives for a sign-out.
	const loadedAsRef = useRef<"guest" | "account" | null>(null)
	// The payload the page was built from. Kept so a guest plan changed in
	// ANOTHER tab can be rebuilt against the same catalogue without a refetch.
	const catalogueRef = useRef<CalculatorData | null>(null)

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

	// Whether the most recent performSave landed. useAutoSave's saveFn returns
	// nothing, so the plan actions read the outcome here after `await saveNow()`
	// to decide whether it is safe to replace the rows on screen.
	const lastSaveOkRef = useRef(true)

	const performSave = useCallback(async (): Promise<void> => {
		// Guests never PATCH: their plan is kept on the device (guestPlanStore).
		// The auto-save timer is already gated, but saveNow could still land
		// here. Both halves matter. See loadedAsRef for the first.
		if (loadedAsRef.current !== "account" || !getAuthToken()) return
		try {
			const response = await userCalculatorDataPatch(
					// The plan these rows were loaded from. It comes from the same
					// render as the rows beside it, so the pair is always consistent
					// even if the timer fires mid-switch. See userCalculatorDataPatch.
					activePlanId,
					userStatsData,
					prepareBannerData(),
					preparePurchaseData(),
					prepareStepUpSelectionData()
				)
			lastSaveOkRef.current = response.ok
			if (!response.ok) {
				toast.error("Save failed. Your changes may not have been saved.")
			} else {
				toast.success("Saved")
			}
		} catch {
			lastSaveOkRef.current = false
			toast.error("Save failed. Check your connection.")
		}
	}, [activePlanId, userStatsData, prepareBannerData, preparePurchaseData,
		prepareStepUpSelectionData])

	const { timerIsGoing, startTimer, saveNow, cancelTimer } = useAutoSave({
		saveFn: performSave,
		delayMs: 5000
	})

	// Guards the guest-plan import against firing twice when React
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
				// Defaulted: an API from before plans existed sends neither key.
				// [] and null is also the guest value, and it hides the switcher,
				// which is the right way to degrade. Saves then omit plan_id and
				// the server falls back to the account's only plan.
				setPlans(data.user_plans ?? [])
				setActivePlanId(data.active_plan_id ?? null)
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
				// Defaulted for the same reason again. The web deploy can land
				// before the API one, and the Legend Races page must show its
				// empty state then, not crash on undefined.
				setDailyLegendRaceData(data.daily_legend_race_data ?? [])
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

			// Latched here and never re-asked. See loadedAsRef.
			const loadedAs = getAuthToken() ? "account" : "guest"
			if (loadedAs === "account") {
				// A plan built on this device while signed out moves into the
				// account. Before any state is set, so the auto-save effect
				// (which skips while prevStatsRef is null) can't race it.
				if (!didMigrateRef.current) {
					didMigrateRef.current = true
					data = await importGuestPlan(data, controller.signal)
				}
			} else {
				// The server sends a guest null stats and empty collections.
				// The device's plan takes their place, rebuilt against the
				// catalogue that just arrived (ids in storage, never objects).
				const guestPlan = guestPlanToState(readGuestPlan(), data)
				data = {
					...data,
					user_stats_data: guestPlan.stats,
					user_planned_banner_data: guestPlan.banners,
					user_planned_purchase_data: guestPlan.purchases,
					user_step_up_selection_data: guestPlan.stepUpSelections
				}
			}

			catalogueRef.current = data
			loadedAsRef.current = loadedAs
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
	// Set by applyPlan just before it swaps in another plan's rows. Those rows
	// came FROM the server, so the change they cause below is not an edit and
	// must not arm a save that would PATCH a plan straight back to itself.
	const suppressAutoSaveRef = useRef(false)
	const guestWriteOkRef = useRef(true)
	useEffect(() => {
		const wasEmpty = prevStatsRef.current === null
		prevStatsRef.current = userStatsData
		if (wasEmpty) return
		if (suppressAutoSaveRef.current) {
			suppressAutoSaveRef.current = false
			return
		}
		if (loadedAsRef.current === "guest") {
			// A token here means they signed in from another tab and this one
			// is about to reload. Writing now would put the plan back on the
			// device AFTER the other tab imported it, and the next sign-in
			// would import it a second time.
			if (getAuthToken()) return
			// Straight to the device, no timer. A write this size is
			// synchronous and takes well under a millisecond, so there is no
			// window in which a closed tab loses work, and nothing pending for
			// a save icon or a beforeunload warning to report.
			const stored = writeGuestPlan(
				userStatsData,
				toBannerPayload(userPlannedBannerData),
				toPurchasePayload(userPlannedPurchaseData),
				toStepUpSelectionPayload(userStepUpSelectionData)
			)
			// Said once, on the write that first fails: the calculator still
			// works, it just will not be here after a reload.
			if (!stored && guestWriteOkRef.current) {
				toast.error("This browser isn't letting us save your plan. It will be gone when you close the page.")
			}
			guestWriteOkRef.current = stored
			setIsGuestPlanStored(stored)
			return
		}
		if (loadedAsRef.current !== "account" || !getAuthToken()) return
		startTimer()
		// activePlanId is here so this effect is GUARANTEED to run after
		// applyPlan and clear suppressAutoSaveRef. Every applyPlan changes the id;
		// without it, a flag left set would swallow the user's next real edit.
	}, [startTimer, userStatsData, userPlannedBannerData, userPlannedPurchaseData,
		userStepUpSelectionData, activePlanId])

	// The token changed under this tab: a sign-in or sign-out here or in
	// another tab. If the mode this tab loaded in no longer matches, what is
	// on screen belongs to the other mode and must not be saved in this one.
	// A reload is the honest fix. See loadedAsRef.
	useEffect(
		() =>
			subscribeToAuthToken(() => {
				const loadedAs = loadedAsRef.current
				if (loadedAs === null) return
				if ((loadedAs === "account") !== !!getAuthToken()) reloadPage()
			}),
		[]
	)

	// Another guest tab changed the plan on this device. Take its version, so
	// this tab is never behind when the person comes back to it:
	//
	//   12:00  tab A adds ten rows            store: A's ten rows
	//   12:05  tab B (open since yesterday)   without this, B's next edit
	//          changes one stat               writes yesterday's plan over them
	//
	// The rows came from storage, not from the person, so they are flagged the
	// way applyPlan flags rows from the server. Every setter gets a fresh
	// object, which guarantees the auto-save effect runs and clears the flag.
	useEffect(
		() =>
			subscribeToGuestPlan(() => {
				const catalogue = catalogueRef.current
				if (loadedAsRef.current !== "guest" || !catalogue || getAuthToken()) return
				const guestPlan = guestPlanToState(readGuestPlan(), catalogue)
				suppressAutoSaveRef.current = true
				setUserStatsData(guestPlan.stats)
				setUserPlannedBannerData(guestPlan.banners)
				setUserPlannedPurchaseData(guestPlan.purchases)
				setUserStepUpSelectionData(guestPlan.stepUpSelections)
			}),
		[]
	)

	/**
	 * Guest only: empty the plan and put the stats back to their defaults.
	 * Reloading used to be how a guest started over; now that a reload keeps
	 * the plan, this is. The auto-save effect sees the empty plan and removes
	 * it from the device, so there is no second code path that clears storage.
	 */
	const resetGuestPlan = useCallback((): void => {
		if (loadedAsRef.current !== "guest") return
		setUserStatsData({ ...DEFAULT_GUEST_STATS })
		setUserPlannedBannerData([])
		setUserPlannedPurchaseData([])
		setUserStepUpSelectionData([])
		setStagedBanners([])
	}, [])

	// ── Plans ────────────────────────────────────────────────────────────────
	//
	// Every action below follows one rule: SAVE WHAT IS ON SCREEN BEFORE
	// REPLACING IT. The rows in state are the only copy of an unsaved edit, so a
	// switch that swapped them out first would lose up to five seconds of work.
	// If that save fails the action stops and the user stays where they are.

	/** Flush a pending auto-save. False means it failed and nothing should move. */
	const flushPendingSave = useCallback(async (): Promise<boolean> => {
		if (!timerIsGoing) return true
		await saveNow()
		return lastSaveOkRef.current
	}, [timerIsGoing, saveNow])

	/**
	 * Put another plan on screen: its id, its rows, its stats and its purchases
	 * move together. The stats and purchases are the plan's own block's or the
	 * account's, whichever the server sent; an API from before separate
	 * resources sends no stats, and one from before purchases followed the
	 * profile sends no purchases. In either case what is on screen (the
	 * account's) is kept.
	 */
	const applyPlan = useCallback((
		planId: number,
		rows: UserPlannedBanner[],
		stats?: UserStats,
		purchases?: UserPlannedPurchase[]
	): void => {
		suppressAutoSaveRef.current = true
		setActivePlanId(planId)
		setUserPlannedBannerData(rows)
		if (stats) setUserStatsData(stats)
		if (purchases) setUserPlannedPurchaseData(purchases)
		// Staged rows were being composed for the plan just left; carrying them
		// across would let "Add" drop them into a different plan.
		setStagedBanners([])
		setPlans((prev) => prev.map((plan) => ({ ...plan, is_active: plan.id === planId })))
	}, [])

	/**
	 * Shared wrapper: one action at a time, the switcher disabled meanwhile, and
	 * a thrown fetch (offline) reported once instead of in every action.
	 */
	const runPlanAction = useCallback(
		async (action: () => Promise<boolean>): Promise<boolean> => {
			if (isPlanBusy) return false
			setIsPlanBusy(true)
			try {
				return await action()
			} catch {
				toast.error("Couldn't reach the server. Check your connection.")
				return false
			} finally {
				setIsPlanBusy(false)
			}
		},
		[isPlanBusy]
	)

	const switchPlan = useCallback(
		(planId: number): Promise<boolean> =>
			runPlanAction(async () => {
				if (planId === activePlanId) return true
				if (!(await flushPendingSave())) {
					toast.error("Your changes didn't save, so we stayed on this plan.")
					return false
				}
				// In parallel: one marks it active for the next visit, the other
				// fetches its rows. Neither depends on the other's answer.
				const [activated, fetched] = await Promise.all([
					planActivate(planId),
					planFetch(planId)
				])
				if (!activated.ok || !fetched.ok) {
					toast.error("Couldn't open that plan. Try again.")
					return false
				}
				const data = (await fetched.json()) as PlanWithRows
				applyPlan(
					planId,
					data.user_planned_banner_data,
					data.user_stats_data,
					data.user_planned_purchase_data
				)
				return true
			}),
		[runPlanAction, activePlanId, flushPendingSave, applyPlan]
	)

	const createPlan = useCallback(
		(name: string, copyFromId?: number): Promise<boolean> =>
			runPlanAction(async () => {
				// Before the POST, not just before the switch: a copy of the open
				// plan has to include the edit made two seconds ago.
				if (!(await flushPendingSave())) {
					toast.error("Your changes didn't save, so the plan wasn't created.")
					return false
				}
				const created = await planCreate(name, copyFromId)
				if (!created.ok) {
					// The server words the two refusals a person can cause (the cap,
					// a blank name). Anything else gets the generic line.
					const body = (await created.json().catch(() => null)) as
						| { error?: string; name?: string[] }
						| null
					toast.error(body?.error ?? body?.name?.[0] ?? "Couldn't create the plan. Try again.")
					return false
				}
				const data = (await created.json()) as PlanWithRows
				setPlans((prev) => [...prev, data.plan])
				// Created inactive on the server. If this fails the plan still
				// exists and is in the list; the user just is not on it yet.
				const activated = await planActivate(data.plan.id)
				if (!activated.ok) {
					toast.error("The plan was created, but we couldn't open it. Pick it from the list.")
					return false
				}
				applyPlan(
					data.plan.id,
					data.user_planned_banner_data,
					data.user_stats_data,
					data.user_planned_purchase_data
				)
				toast.success(copyFromId === undefined ? "Plan created" : "Plan copied")
				return true
			}),
		[runPlanAction, flushPendingSave, applyPlan]
	)

	const renamePlan = useCallback(
		(planId: number, name: string): Promise<boolean> =>
			runPlanAction(async () => {
				const response = await planRename(planId, name)
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as
						| { name?: string[] }
						| null
					toast.error(body?.name?.[0] ?? "Couldn't rename the plan. Try again.")
					return false
				}
				// Take the server's copy: it collapses runs of spaces in the name.
				const renamed = (await response.json()) as Plan
				setPlans((prev) => prev.map((plan) => (plan.id === planId ? renamed : plan)))
				return true
			}),
		[runPlanAction]
	)

	const deletePlan = useCallback(
		(planId: number): Promise<boolean> =>
			runPlanAction(async () => {
				const deletingOpenPlan = planId === activePlanId
				// A pending save for a DIFFERENT plan's rows is still wanted, so it
				// is flushed. One for the plan being deleted is dropped instead:
				// left alone it would fire at a plan id that no longer exists.
				if (deletingOpenPlan) {
					cancelTimer()
				} else if (!(await flushPendingSave())) {
					toast.error("Your changes didn't save, so the plan wasn't deleted.")
					return false
				}
				const response = await planDelete(planId)
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as
						| { error?: string }
						| null
					toast.error(body?.error ?? "Couldn't delete the plan. Try again.")
					return false
				}
				const { active_plan_id: landedOn } = (await response.json()) as {
					active_plan_id: number
				}
				setPlans((prev) => prev.filter((plan) => plan.id !== planId))
				if (deletingOpenPlan) {
					// The server promoted another plan. Its rows are not on screen yet.
					const fetched = await planFetch(landedOn)
					if (!fetched.ok) {
						// The delete is done and cannot be undone from here, and the
						// rows on screen belong to nothing. A reload is the honest fix.
						window.location.reload()
						return true
					}
					const data = (await fetched.json()) as PlanWithRows
					applyPlan(
						landedOn,
						data.user_planned_banner_data,
						data.user_stats_data,
						data.user_planned_purchase_data
					)
				}
				toast.success("Plan deleted")
				return true
			}),
		[runPlanAction, activePlanId, cancelTimer, flushPendingSave, applyPlan]
	)

	const setSeparateIncome = useCallback(
		(planId: number, on: boolean): Promise<boolean> =>
			runPlanAction(async () => {
				// Flush FIRST, and not only for the rows: the stats on screen may be
				// an unsaved edit that belongs to the block this plan reads today,
				// and the server seeds the new copy from the database. Without the
				// flush the copy would start from numbers the person no longer sees.
				if (!(await flushPendingSave())) {
					toast.error("Your changes didn't save, so nothing was changed.")
					return false
				}
				const response = await planSetSeparateIncome(planId, on)
				if (!response.ok) {
					toast.error("Couldn't change that. Try again.")
					return false
				}
				const updated = (await response.json()) as Plan
				setPlans((prev) => prev.map((plan) => (plan.id === planId ? updated : plan)))
				// The stats and purchases the plan now reads are not in that
				// answer. Fetch them the way a switch does, so they land through
				// the same code path (and are not mistaken for an edit).
				if (planId === activePlanId) {
					const fetched = await planFetch(planId)
					if (!fetched.ok) {
						toast.error("Changed, but couldn't load the new numbers. Reload the page.")
						return false
					}
					const data = (await fetched.json()) as PlanWithRows
					applyPlan(
						planId,
						data.user_planned_banner_data,
						data.user_stats_data,
						data.user_planned_purchase_data
					)
				}
				toast.success(
					on
						? "This plan now has its own resources."
						: "This plan uses your account's resources again."
				)
				return true
			}),
		[runPlanAction, activePlanId, flushPendingSave, applyPlan]
	)

	// ── Sharing ──────────────────────────────────────────────────────────────
	//
	// A shared plan is COPIED, never opened: nobody but its owner ever has it on
	// screen. The owner's two actions below change settings and touch no rows,
	// so they flush nothing. The copier's action creates a new plan (account)
	// or replaces the device's plan (guest), and saves first like createPlan.

	const setPlanSharing = useCallback(
		(planId: number, changes: PlanSharingChanges): Promise<boolean> =>
			runPlanAction(async () => {
				const response = await planSetSharing(planId, changes)
				if (!response.ok) {
					toast.error("Couldn't change sharing. Try again.")
					return false
				}
				const updated = (await response.json()) as Plan
				setPlans((prev) => prev.map((plan) => (plan.id === planId ? updated : plan)))
				return true
			}),
		[runPlanAction]
	)

	const resetPlanLink = useCallback(
		(planId: number): Promise<boolean> =>
			runPlanAction(async () => {
				const response = await planResetLink(planId)
				if (!response.ok) {
					toast.error("Couldn't reset the link. Try again.")
					return false
				}
				// The new id rides on the plan, so the share face shows the new
				// link as soon as this lands.
				const updated = (await response.json()) as Plan
				setPlans((prev) => prev.map((plan) => (plan.id === planId ? updated : plan)))
				toast.success("Link reset. The old one no longer works.")
				return true
			}),
		[runPlanAction]
	)

	/**
	 * Take a copy of somebody's shared plan. The path is the one this tab
	 * LOADED in, like every save (loadedAsRef). The server picks its own path
	 * from the token on the request, so a tab whose token changed since loading
	 * is refused here: a guest tab whose person signed in elsewhere would get
	 * an account copy it cannot show. That tab is about to reload anyway.
	 *
	 * Account: the new plan is created inactive, then switched to, exactly as
	 * createPlan does it, so it lands with its rows, its stats (its own seeded
	 * block when the owner shared theirs, else the account's) and its purchases
	 * through applyPlan.
	 *
	 * Guest: the device holds one plan, and the copy replaces its ROWS. The
	 * resources (stats AND planned purchases, one block: purchases fund the
	 * stats beside them) are replaced only when the GUEST chose to take them
	 * (`includeStats`, off by default) and the owner shared them: the device
	 * holds one set, so taking the owner's costs the guest their own, and the
	 * owner sharing is not the guest asking. An account copy's seeded block
	 * gets the owner's purchases the same way. Step-up picks stay:
	 * they are the person's, keyed to the banner. Nothing writes storage here;
	 * the auto-save effect sees the new rows and writes them, the same single
	 * path resetGuestPlan relies on. Asking before replacing a plan is the
	 * landing card's job.
	 */
	const copySharedPlan = useCallback(
		(publicId: string, { name = "", includeStats = false }: SharedPlanCopyOptions): Promise<boolean> =>
			runPlanAction(async () => {
				const loadedAs = loadedAsRef.current
				if (loadedAs === null || (loadedAs === "account") !== !!getAuthToken()) return false
				const asAccount = loadedAs === "account"
				if (asAccount && !(await flushPendingSave())) {
					toast.error("Your changes didn't save, so the plan wasn't copied.")
					return false
				}
				const response = await sharedPlanCopy(
					publicId,
					asAccount ? { name } : { include_stats: includeStats }
				)
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as
						| { error?: string; name?: string[] }
						| null
					toast.error(
						response.status === 404
							? "This plan isn't shared any more."
							: response.status === 429
								? "That's a lot of copies in a short time. Try again later."
								// The cap and a blank name, worded by the server.
								: (body?.error ?? body?.name?.[0] ?? "Couldn't copy the plan. Try again.")
					)
					return false
				}

				if (asAccount) {
					const data = (await response.json()) as PlanWithRows
					setPlans((prev) => [...prev, data.plan])
					const activated = await planActivate(data.plan.id)
					if (!activated.ok) {
						// The copy exists and is in the list, so the landing card has
						// done its job and should move on; the person picks it from there.
						toast.error("The plan was copied, but we couldn't open it. Pick it from the list.")
						return true
					}
					applyPlan(
						data.plan.id,
						data.user_planned_banner_data,
						data.user_stats_data,
						data.user_planned_purchase_data
					)
					toast.success("Plan copied")
					return true
				}

				const catalogue = catalogueRef.current
				if (!catalogue) return false
				const copy = (await response.json()) as SharedPlanCopy
				// Rebuilt against the catalogue exactly as a stored guest plan is:
				// ids become banners, and a row whose banner has left the
				// catalogue is dropped instead of kept as a dangling id.
				const rebuilt = guestPlanToState(
					{
						version: 1,
						savedAt: Date.now(),
						stats: copy.user_stats_data,
						banners: copy.user_planned_banner_data,
						purchases: copy.user_planned_purchase_data ?? [],
						stepUpSelections: []
					},
					catalogue
				)
				setUserPlannedBannerData(rebuilt.banners)
				// Both checks: the server only sends resources that were asked
				// for, and a server that sent them anyway still does not get to
				// overwrite the guest's own. Stats and purchases move together;
				// a purchase whose product has left the catalogue was dropped above.
				if (includeStats && copy.user_stats_data) {
					setUserStatsData(rebuilt.stats)
					setUserPlannedPurchaseData(rebuilt.purchases)
				}
				setStagedBanners([])
				toast.success("Plan copied to this device")
				return true
			}),
		[runPlanAction, flushPendingSave, applyPlan]
	)

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
		dailyLegendRaceData,
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
		plans,
		activePlanId,
		isPlanBusy,
		switchPlan,
		createPlan,
		renamePlan,
		deletePlan,
		setSeparateIncome,
		setPlanSharing,
		resetPlanLink,
		copySharedPlan,
		isGuestPlanStored,
		resetGuestPlan,
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