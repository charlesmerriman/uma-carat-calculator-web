/**
 * The /app loading gate's deadline and retry.
 *
 * On 2026-09-23 and 2026-10-14 a banner launch queued the API, and because
 * the initial fetch had no deadline, /app showed a spinner until Cloudflare
 * cut the request about 100 s later. To a visitor that is the site being down.
 * Pinned here: the gate gives up at CALCULATOR_DATA_TIMEOUT_MS and shows the
 * error page, a slow answer inside the deadline still loads, and "Try again"
 * runs the fetch again in place.
 */

import { useEffect } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalculatorProvider } from '../services/CalculatorProvider'
import { useCalculatorData } from '../services/CalculatorContext'
import {
	CALCULATOR_DATA_TIMEOUT_MS,
	CalculatorDataTimeout,
	initialCalculatorDataFetch,
	resetCalculatorDataPrefetch,
	withDeadline,
} from '../services/calculatorFetchCalls'
import type { CalculatorContextType, CalculatorData } from '../types'

vi.mock('../services/calculatorFetchCalls', async (importOriginal) => ({
	...(await importOriginal<typeof import('../services/calculatorFetchCalls')>()),
	initialCalculatorDataFetch: vi.fn(),
	resetCalculatorDataPrefetch: vi.fn(),
	userCalculatorDataPatch: vi.fn(),
}))
vi.mock('../services/planFetchCalls', () => ({
	planActivate: vi.fn(),
	planCreate: vi.fn(),
	planDelete: vi.fn(),
	planFetch: vi.fn(),
	planRename: vi.fn(),
	planSetSeparateIncome: vi.fn(),
}))
vi.mock('../services/reloadPage', () => ({ reloadPage: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockedInitialFetch = vi.mocked(initialCalculatorDataFetch)
const mockedResetPrefetch = vi.mocked(resetCalculatorDataPrefetch)

const json = (body: unknown): Response =>
	({ ok: true, status: 200, json: async () => body }) as unknown as Response

/** What the server sends someone with no token, cut down to what loading reads. */
const guestPayload = (): CalculatorData =>
	({
		club_rank_data: [],
		team_trials_rank_data: [],
		champions_meeting_rank_data: [],
		league_of_heroes_rank_data: [],
		banner_uma_data: [],
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
		user_stats_data: null,
		user_planned_banner_data: [],
		user_plans: [],
		active_plan_id: null,
	}) as unknown as CalculatorData

/** A request the server never answers. */
const hanging = (): Promise<Response> => new Promise<Response>(() => {})

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

/** Move the fake clock and let every promise it releases settle. */
const advance = async (ms: number): Promise<void> => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms)
	})
}

const mount = (): void => {
	render(
		<CalculatorProvider>
			<Probe />
		</CalculatorProvider>
	)
}

beforeEach(() => {
	vi.useFakeTimers()
	latest.current = null
	localStorage.clear()
	mockedInitialFetch.mockReset()
	mockedResetPrefetch.mockReset()
	// The provider logs the failure; keep the test output readable.
	vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	vi.restoreAllMocks()
})

describe('the /app loading gate', () => {
	it('gives up at the deadline and shows the error page', async () => {
		mockedInitialFetch.mockReturnValue(hanging())
		mount()

		await advance(CALCULATOR_DATA_TIMEOUT_MS - 1)
		expect(ctx().isLoading).toBe(true)
		expect(ctx().fetchError).toBe(false)

		await advance(1)
		expect(ctx().isLoading).toBe(false)
		expect(ctx().fetchError).toBe(true)
		// The request itself is cancelled, not left running unseen.
		expect(mockedInitialFetch.mock.calls[0][0]?.aborted).toBe(true)
	})

	it('still loads an answer that is slow but inside the deadline', async () => {
		mockedInitialFetch.mockReturnValue(
			new Promise((resolve) => setTimeout(() => resolve(json(guestPayload())), 15_000))
		)
		mount()

		await advance(15_000)
		expect(ctx().isLoading).toBe(false)
		expect(ctx().fetchError).toBe(false)

		// The deadline is cleared once the data is here, so it cannot fire later.
		await advance(CALCULATOR_DATA_TIMEOUT_MS)
		expect(ctx().fetchError).toBe(false)
	})

	it('"Try again" runs the fetch again in place and recovers', async () => {
		mockedInitialFetch
			.mockReturnValueOnce(hanging())
			.mockResolvedValueOnce(json(guestPayload()))
		mount()
		await advance(CALCULATOR_DATA_TIMEOUT_MS)
		expect(ctx().fetchError).toBe(true)

		await act(async () => {
			ctx().retryLoad()
		})
		// Back to the spinner while the second request is out...
		expect(ctx().fetchError).toBe(false)
		// ...with any failed prefetch dropped first, so it is not handed back.
		expect(mockedResetPrefetch).toHaveBeenCalledTimes(1)

		await advance(0)
		expect(mockedInitialFetch).toHaveBeenCalledTimes(2)
		expect(ctx().isLoading).toBe(false)
		expect(ctx().fetchError).toBe(false)
	})
})

describe('withDeadline', () => {
	it('settles on the timeout, not on the abort it triggers', async () => {
		// A real fetch rejects with AbortError the moment its controller aborts.
		// The provider ignores AbortError (Strict Mode cleanup), so if the race
		// settled on that instead, a timeout would leave the spinner up forever.
		const controller = new AbortController()
		const work = new Promise<never>((_resolve, reject) => {
			controller.signal.addEventListener('abort', () =>
				reject(new DOMException('aborted', 'AbortError'))
			)
		})
		const result = withDeadline(work, 1000, controller)
		const settled = expect(result).rejects.toBeInstanceOf(CalculatorDataTimeout)

		await vi.advanceTimersByTimeAsync(1000)
		await settled
		expect(controller.signal.aborted).toBe(true)
	})
})
