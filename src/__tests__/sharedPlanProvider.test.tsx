/**
 * CalculatorProvider and shared plans: the owner's two settings actions, and
 * taking a copy of someone else's plan.
 *
 * What is pinned is where a copy LANDS, because both wrong answers are silent:
 *
 *   - signed in, the copy is a new plan in the account, switched to the way a
 *     new plan is, after any pending edit to the open plan has been saved;
 *   - as a guest, it replaces the device's plan through the device store and
 *     never reaches the server as a save;
 *   - a tab copies the way it LOADED. A guest tab whose person signed in
 *     elsewhere must not take an account copy it cannot show.
 */

import { useEffect } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { CalculatorProvider } from '../services/CalculatorProvider'
import { useCalculatorData } from '../services/CalculatorContext'
import {
	initialCalculatorDataFetch,
	userCalculatorDataPatch,
} from '../services/calculatorFetchCalls'
import {
	planActivate,
	planResetLink,
	planSetSharing,
	sharedPlanCopy,
} from '../services/planFetchCalls'
import { clearAuthToken, setAuthToken } from '../services/authToken'
import { DEFAULT_GUEST_STATS } from '../services/guestMigration'
import { readGuestPlan, writeGuestPlan } from '../services/guestPlanStore'
import type {
	BannerUma,
	CalculatorContextType,
	CalculatorData,
	Plan,
	SharedPlanCopyOptions,
	UserPlannedBanner,
} from '../types'

vi.mock('../services/calculatorFetchCalls', async (importOriginal) => ({
	...(await importOriginal<typeof import('../services/calculatorFetchCalls')>()),
	initialCalculatorDataFetch: vi.fn(),
	userCalculatorDataPatch: vi.fn(),
}))
vi.mock('../services/planFetchCalls', () => ({
	planActivate: vi.fn(),
	planCreate: vi.fn(),
	planDelete: vi.fn(),
	planFetch: vi.fn(),
	planRename: vi.fn(),
	planSetSeparateIncome: vi.fn(),
	planSetSharing: vi.fn(),
	planResetLink: vi.fn(),
	sharedPlanCopy: vi.fn(),
	sharedPlanSummaryFetch: vi.fn(),
}))
vi.mock('../services/reloadPage', () => ({ reloadPage: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockedInitialFetch = vi.mocked(initialCalculatorDataFetch)
const mockedPatch = vi.mocked(userCalculatorDataPatch)
const mockedActivate = vi.mocked(planActivate)
const mockedSetSharing = vi.mocked(planSetSharing)
const mockedResetLink = vi.mocked(planResetLink)
const mockedCopy = vi.mocked(sharedPlanCopy)

const json = (body: unknown, status = 200): Response =>
	({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

const LINK = 'AbCd1234'

const BANNERS = [
	{ id: 100, name: 'Kitasan' },
	{ id: 200, name: 'Satono' },
] as unknown as BannerUma[]

const MAIN: Plan = {
	id: 1,
	public_id: 'MainPlan',
	name: 'Main plan',
	is_active: true,
	is_shared: false,
	share_stats: false,
	share_notes: false,
	copy_count: 0,
	updated_at: '2026-10-12T00:00:00Z',
}
const COPY: Plan = { ...MAIN, id: 9, public_id: 'CopyPlan', name: 'Their plan', is_active: false }

const ACCOUNT_ROW = {
	id: 10,
	user: 1,
	plan: 1,
	number_of_pulls: 75,
	reserved_copies: 0,
	banner_uma: BANNERS[1],
	banner_support: null,
	banner_step_up: null,
} as UserPlannedBanner
const COPIED_ROW = { ...ACCOUNT_ROW, id: 90, plan: 9, number_of_pulls: 40, banner_uma: BANNERS[0] }

/** A shared row as the guest copy route sends it: ids, no row id. */
const SHARED_ROW = {
	number_of_pulls: 40,
	reserved_copies: 1,
	note: 'pity here',
	primary_card: null,
	second_card: null,
	primary_target: null,
	banner_uma: 100,
	banner_support: null,
	banner_step_up: null,
}

const basePayload = {
	club_rank_data: [],
	team_trials_rank_data: [],
	champions_meeting_rank_data: [],
	league_of_heroes_rank_data: [],
	banner_uma_data: BANNERS,
	banner_support_data: [],
	banner_step_up_data: [],
	events_data: [],
	champions_meeting_data: [],
	league_of_heroes_event_data: [],
	banner_timeline_data: [],
	anniversary_event_data: [],
	scenario_data: [],
	user_planned_purchase_data: [],
	user_step_up_selection_data: [],
	income_ledger: [],
}

const accountPayload = (): CalculatorData =>
	({
		...basePayload,
		user_stats_data: { ...DEFAULT_GUEST_STATS, current_carat: 100 },
		user_planned_banner_data: [ACCOUNT_ROW],
		user_plans: [MAIN],
		active_plan_id: MAIN.id,
	}) as unknown as CalculatorData

const guestPayload = (): CalculatorData =>
	({
		...basePayload,
		user_stats_data: null,
		user_planned_banner_data: [],
	}) as unknown as CalculatorData

const latest: { current: CalculatorContextType | null } = { current: null }
const Probe = () => {
	const value = useCalculatorData()
	useEffect(() => {
		latest.current = value
	})
	return null
}
const ctx = (): CalculatorContextType => {
	if (!latest.current) throw new Error('Probe has not rendered yet')
	return latest.current
}

const renderLoaded = async (): Promise<void> => {
	render(
		<CalculatorProvider>
			<Probe />
		</CalculatorProvider>
	)
	await waitFor(() => expect(latest.current?.isLoading).toBe(false))
}

const copy = async (options: SharedPlanCopyOptions = {}): Promise<boolean> => {
	let result = false
	await act(async () => {
		result = await ctx().copySharedPlan(LINK, options)
	})
	return result
}

beforeEach(() => {
	latest.current = null
	localStorage.clear()
	sessionStorage.clear()
	vi.clearAllMocks()
	clearAuthToken()
	mockedPatch.mockResolvedValue(json({ message: 'ok' }))
	mockedActivate.mockResolvedValue(json({ ...COPY, is_active: true }))
})

describe('a signed-in copy', () => {
	beforeEach(() => {
		setAuthToken('token')
		mockedInitialFetch.mockResolvedValue(json(accountPayload()))
		mockedCopy.mockResolvedValue(
			json(
				{
					plan: COPY,
					user_stats_data: { ...DEFAULT_GUEST_STATS, current_carat: 4321 },
					user_planned_banner_data: [COPIED_ROW],
					user_planned_purchase_data: [],
				},
				201
			)
		)
	})

	it('creates the plan in the account and opens it like a new plan', async () => {
		await renderLoaded()

		expect(await copy({ name: 'Their plan' })).toBe(true)

		expect(mockedCopy).toHaveBeenCalledWith(LINK, { name: 'Their plan' })
		expect(mockedActivate).toHaveBeenCalledWith(COPY.id)
		expect(ctx().activePlanId).toBe(COPY.id)
		expect(ctx().plans.map((plan) => plan.id)).toEqual([MAIN.id, COPY.id])
		expect(ctx().userPlannedBannerData).toEqual([COPIED_ROW])
		// The copy's own stats (the sharer's, seeded server-side) came with it.
		expect(ctx().userStatsData?.current_carat).toBe(4321)
		expect(toast.success).toHaveBeenCalledWith('Plan copied')
	})

	it('saves a pending edit to the open plan first, and never saves the copy back', async () => {
		await renderLoaded()
		await act(async () => {
			ctx().setUserPlannedBannerData((prev) => prev.map((row) => ({ ...row, number_of_pulls: 999 })))
		})

		await copy({ name: 'Their plan' })

		// One PATCH: the edit, to the plan it was made in, before the copy.
		expect(mockedPatch).toHaveBeenCalledTimes(1)
		expect(mockedPatch.mock.calls[0][0]).toBe(MAIN.id)
		expect(mockedPatch.mock.invocationCallOrder[0]).toBeLessThan(
			mockedCopy.mock.invocationCallOrder[0]
		)
		// Rows that arrived from the server are not an edit.
		expect(ctx().timerIsGoing).toBe(false)
	})

	it('stays put and says why when the server refuses', async () => {
		mockedCopy.mockResolvedValue(json({ error: 'You can keep up to 5 plans.' }, 400))
		await renderLoaded()

		expect(await copy({ name: 'Their plan' })).toBe(false)

		expect(toast.error).toHaveBeenCalledWith('You can keep up to 5 plans.')
		expect(ctx().activePlanId).toBe(MAIN.id)
		expect(mockedActivate).not.toHaveBeenCalled()
	})

	it('reports a link that stopped being shared', async () => {
		mockedCopy.mockResolvedValue(json({ error: 'Plan not found' }, 404))
		await renderLoaded()

		expect(await copy({ name: 'Their plan' })).toBe(false)

		expect(toast.error).toHaveBeenCalledWith("This plan isn't shared any more.")
	})
})

describe("the owner's share settings", () => {
	beforeEach(() => {
		setAuthToken('token')
		mockedInitialFetch.mockResolvedValue(json(accountPayload()))
	})

	it('turns sharing on and keeps the server copy of the plan', async () => {
		mockedSetSharing.mockResolvedValue(json({ ...MAIN, is_shared: true }))
		await renderLoaded()

		await act(async () => {
			await ctx().setPlanSharing(MAIN.id, { is_shared: true })
		})

		expect(mockedSetSharing).toHaveBeenCalledWith(MAIN.id, { is_shared: true })
		expect(ctx().plans[0].is_shared).toBe(true)
		// A setting, not an edit: the rows are untouched and no save is armed.
		expect(ctx().timerIsGoing).toBe(false)
		expect(mockedPatch).not.toHaveBeenCalled()
	})

	it('takes the new id from a link reset', async () => {
		mockedResetLink.mockResolvedValue(json({ ...MAIN, public_id: 'NewLink1' }))
		await renderLoaded()

		await act(async () => {
			await ctx().resetPlanLink(MAIN.id)
		})

		expect(ctx().plans[0].public_id).toBe('NewLink1')
	})
})

describe('a guest copy', () => {
	beforeEach(() => {
		mockedInitialFetch.mockResolvedValue(json(guestPayload()))
		mockedCopy.mockResolvedValue(
			json({ user_planned_banner_data: [SHARED_ROW], user_stats_data: null })
		)
	})

	it('replaces the rows on the device and sends nothing to save', async () => {
		writeGuestPlan(
			{ ...DEFAULT_GUEST_STATS, current_carat: 1500 },
			[{ number_of_pulls: 10, reserved_copies: 0, banner_uma: 200, banner_support: null, banner_step_up: null }],
			[],
			[]
		)
		await renderLoaded()

		expect(await copy()).toBe(true)

		// No name and no token: the server's guest path, stats not asked for.
		expect(mockedCopy).toHaveBeenCalledWith(LINK, { include_stats: false })
		// Rebuilt from the catalogue, like any stored guest plan.
		expect(ctx().userPlannedBannerData).toHaveLength(1)
		expect(ctx().userPlannedBannerData[0].banner_uma?.name).toBe('Kitasan')
		expect(ctx().userPlannedBannerData[0].note).toBe('pity here')
		// The owner shared no stats, so the guest's own are kept.
		expect(ctx().userStatsData?.current_carat).toBe(1500)
		// And the device holds the copy.
		const stored = readGuestPlan()
		expect(stored?.banners.map((row) => row.banner_uma)).toEqual([100])
		expect(stored?.stats?.current_carat).toBe(1500)
		expect(mockedPatch).not.toHaveBeenCalled()
		expect(toast.success).toHaveBeenCalledWith('Plan copied to this device')
	})

	it("takes the owner's stats only when the guest asks for them", async () => {
		mockedCopy.mockResolvedValue(
			json({
				user_planned_banner_data: [SHARED_ROW],
				user_stats_data: { ...DEFAULT_GUEST_STATS, current_carat: 9999 },
			})
		)
		await renderLoaded()

		await copy({ includeStats: true })

		expect(mockedCopy).toHaveBeenCalledWith(LINK, { include_stats: true })
		expect(ctx().userStatsData?.current_carat).toBe(9999)
		expect(readGuestPlan()?.stats?.current_carat).toBe(9999)
	})

	it("keeps the guest's own stats when they did not ask, whatever the server sends", async () => {
		writeGuestPlan({ ...DEFAULT_GUEST_STATS, current_carat: 1500 }, [], [], [])
		// A server that sent stats nobody asked for still does not get to
		// overwrite the guest's own.
		mockedCopy.mockResolvedValue(
			json({
				user_planned_banner_data: [SHARED_ROW],
				user_stats_data: { ...DEFAULT_GUEST_STATS, current_carat: 9999 },
			})
		)
		await renderLoaded()

		await copy()

		expect(ctx().userStatsData?.current_carat).toBe(1500)
		expect(readGuestPlan()?.stats?.current_carat).toBe(1500)
	})

	it('drops a row whose banner has left the catalogue', async () => {
		mockedCopy.mockResolvedValue(
			json({
				user_planned_banner_data: [SHARED_ROW, { ...SHARED_ROW, banner_uma: 555 }],
				user_stats_data: null,
			})
		)
		await renderLoaded()

		await copy()

		expect(ctx().userPlannedBannerData.map((row) => row.banner_uma?.id)).toEqual([100])
	})

	it('refuses in a guest tab whose person signed in elsewhere', async () => {
		await renderLoaded()
		setAuthToken('token')

		expect(await copy()).toBe(false)

		expect(mockedCopy).not.toHaveBeenCalled()
	})
})
