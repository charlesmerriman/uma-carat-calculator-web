/**
 * SharedPlanLanding: the card a share link opens.
 *
 * The copy itself is the provider's and is tested in
 * sharedPlanProvider.test.tsx. These cover what only the card decides: what it
 * shows from a summary of catalogue ids, that opening it copies nothing, when a
 * guest is asked before their device plan is replaced, and where it goes after.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SharedPlanLanding } from '../components/shared-plan/SharedPlanLanding'
import { CalculatorContext } from '../services/CalculatorContext'
import { DEFAULT_GUEST_STATS } from '../services/guestMigration'
import { sharedPlanSummaryFetch } from '../services/planFetchCalls'
import { PLAN_CAP } from '../types'
import type {
	BannerSupport,
	BannerUma,
	CalculatorContextType,
	Plan,
	SharedPlanSummary,
	UserPlannedBanner,
} from '../types'

vi.mock('../services/planFetchCalls', () => ({ sharedPlanSummaryFetch: vi.fn() }))

const mockedSummary = vi.mocked(sharedPlanSummaryFetch)

const json = (body: unknown, status = 200): Response =>
	({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

const LINK = 'AbCd1234'

const UMA_BANNER = {
	id: 100,
	name: 'Kitasan Black banner',
	umas: [{ name: 'Kitasan Black', image: '/media/kitasan.png' }],
} as unknown as BannerUma
const SUPPORT_BANNER = {
	id: 300,
	name: 'Satono support banner',
	support_cards: [{ name: 'Satono Diamond', image: '/media/satono.png' }],
} as unknown as BannerSupport

const SUMMARY: SharedPlanSummary = {
	public_id: LINK,
	updated_at: '2026-10-11T09:30:00Z',
	copy_count: 3,
	share_stats: false,
	share_notes: true,
	row_count: 2,
	rows: [
		{ banner_uma: 100, banner_support: null, banner_step_up: null },
		{ banner_uma: null, banner_support: 300, banner_step_up: null },
	],
}

const plan = (id: number, publicId: string): Plan => ({
	id,
	public_id: publicId,
	name: `Plan ${id}`,
	is_active: id === 1,
	updated_at: '2026-10-01T00:00:00Z',
})

const ACCOUNT = {
	plans: [plan(1, 'MainPlan')],
	activePlanId: 1,
}
const GUEST = { plans: [], activePlanId: null }

const renderCard = (overrides: Partial<CalculatorContextType> = {}) => {
	const value = {
		umaBannerData: [UMA_BANNER],
		supportBannerData: [SUPPORT_BANNER],
		stepUpBannerData: [],
		isPlanBusy: false,
		userPlannedBannerData: [],
		userPlannedPurchaseData: [],
		userStatsData: { ...DEFAULT_GUEST_STATS },
		copySharedPlan: vi.fn().mockResolvedValue(true),
		switchPlan: vi.fn().mockResolvedValue(true),
		...ACCOUNT,
		...overrides,
	} as unknown as CalculatorContextType
	render(
		<CalculatorContext.Provider value={value}>
			<MemoryRouter initialEntries={[`/app/${LINK}`]}>
				<Routes>
					<Route path="/app/:publicId" element={<SharedPlanLanding publicId={LINK} />} />
					<Route path="/app" element={<p>The calculator</p>} />
				</Routes>
			</MemoryRouter>
		</CalculatorContext.Provider>
	)
	return value
}

beforeEach(() => {
	vi.clearAllMocks()
	mockedSummary.mockResolvedValue(json(SUMMARY))
})

describe('SharedPlanLanding', () => {
	it("lists the plan's banners from the catalogue, with what a copy carries", async () => {
		renderCard()

		expect(await screen.findByText('Kitasan Black banner')).toBeInTheDocument()
		expect(screen.getByText('Satono support banner')).toBeInTheDocument()
		expect(screen.getByText('Uma banner')).toBeInTheDocument()
		expect(screen.getByText('Support banner')).toBeInTheDocument()
		expect(screen.getByAltText('Kitasan Black')).toHaveAttribute('src', '/media/kitasan.png')
		expect(
			screen.getByText('2 banners · Updated 2026/10/11 · Copied 3 times · Includes their notes')
		).toBeInTheDocument()
		expect(mockedSummary).toHaveBeenCalledWith(LINK)
	})

	it('copies nothing just by being opened', async () => {
		const value = renderCard()

		await screen.findByText('Kitasan Black banner')

		expect(value.copySharedPlan).not.toHaveBeenCalled()
	})

	it('says so when the link is wrong or sharing is off', async () => {
		mockedSummary.mockResolvedValue(json({ error: 'Plan not found' }, 404))
		renderCard()

		expect(await screen.findByText("This plan isn't shared, or the link is wrong.")).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Go to the calculator' })).toHaveAttribute('href', '/app')
	})

	describe('signed in', () => {
		it('copies under the name given and opens the calculator', async () => {
			const value = renderCard()
			const field = await screen.findByLabelText('Name your copy')
			expect(field).toHaveValue('Copied plan')
			await userEvent.clear(field)
			await userEvent.type(field, 'Kitasan route')

			await userEvent.click(screen.getByRole('button', { name: 'Copy to my plans' }))

			expect(value.copySharedPlan).toHaveBeenCalledWith(LINK, { name: 'Kitasan route' })
			expect(await screen.findByText('The calculator')).toBeInTheDocument()
		})

		it('stays on the card when the copy fails', async () => {
			const value = renderCard({ copySharedPlan: vi.fn().mockResolvedValue(false) })

			await userEvent.click(await screen.findByRole('button', { name: 'Copy to my plans' }))

			expect(value.copySharedPlan).toHaveBeenCalled()
			expect(screen.queryByText('The calculator')).not.toBeInTheDocument()
		})

		it('is not offered at the plan cap', async () => {
			renderCard({
				plans: Array.from({ length: PLAN_CAP }, (_, i) => plan(i + 1, `Plan000${i}`)),
			})

			expect(await screen.findByRole('button', { name: 'Copy to my plans' })).toBeDisabled()
			expect(screen.getByText(/5-plan limit/)).toBeInTheDocument()
		})

		it("offers to open the owner's own plan instead", async () => {
			const value = renderCard({ plans: [plan(1, 'MainPlan'), plan(2, LINK)] })

			await userEvent.click(await screen.findByRole('button', { name: 'Open it' }))

			expect(value.switchPlan).toHaveBeenCalledWith(2)
			expect(await screen.findByText('The calculator')).toBeInTheDocument()
		})
	})

	describe('as a guest', () => {
		it('copies straight away onto an empty device', async () => {
			const value = renderCard(GUEST)

			expect(screen.queryByLabelText('Name your copy')).not.toBeInTheDocument()
			await userEvent.click(await screen.findByRole('button', { name: 'Copy to this device' }))

			expect(value.copySharedPlan).toHaveBeenCalledWith(LINK, { includeStats: false })
			expect(await screen.findByText('The calculator')).toBeInTheDocument()
		})

		it('asks before replacing a plan already on the device', async () => {
			const value = renderCard({
				...GUEST,
				userPlannedBannerData: [{ tempId: 1 } as unknown as UserPlannedBanner],
			})

			await userEvent.click(await screen.findByRole('button', { name: 'Copy to this device' }))

			expect(screen.getByText('Replace the plan on this device?')).toBeInTheDocument()
			expect(screen.getByText('Your banners here will be replaced.')).toBeInTheDocument()
			expect(value.copySharedPlan).not.toHaveBeenCalled()

			await userEvent.click(screen.getByRole('button', { name: 'Replace it' }))

			expect(value.copySharedPlan).toHaveBeenCalledWith(LINK, { includeStats: false })
		})

		describe('when the owner shared their stats', () => {
			const ownStats = { ...DEFAULT_GUEST_STATS, current_carat: 1500 }
			beforeEach(() => {
				mockedSummary.mockResolvedValue(json({ ...SUMMARY, share_stats: true }))
			})

			it("keeps the guest's own unless they tick the box", async () => {
				// No rows, and the guest's carats are not touched: nothing to ask.
				const value = renderCard({ ...GUEST, userStatsData: ownStats })

				const box = await screen.findByRole('checkbox', { name: /Use their resources/ })
				expect(box).not.toBeChecked()
				await userEvent.click(screen.getByRole('button', { name: 'Copy to this device' }))

				expect(screen.queryByText('Replace the plan on this device?')).not.toBeInTheDocument()
				expect(value.copySharedPlan).toHaveBeenCalledWith(LINK, { includeStats: false })
			})

			it('takes them when ticked, after asking about the guest\'s own', async () => {
				const value = renderCard({ ...GUEST, userStatsData: ownStats })

				await userEvent.click(await screen.findByRole('checkbox', { name: /Use their resources/ }))
				await userEvent.click(screen.getByRole('button', { name: 'Copy to this device' }))

				expect(screen.getByText('Your banners, carats and purchases here will be replaced.')).toBeInTheDocument()
				expect(value.copySharedPlan).not.toHaveBeenCalled()
				await userEvent.click(screen.getByRole('button', { name: 'Replace it' }))
				expect(value.copySharedPlan).toHaveBeenCalledWith(LINK, { includeStats: true })
			})

			it('offers no box to an account, whose copy keeps them on that plan alone', async () => {
				renderCard()
				// Stated instead, since the account copy takes them.
				expect(await screen.findByText(/Includes their resources and notes/)).toBeInTheDocument()
				expect(screen.queryByRole('checkbox', { name: /Use their resources/ })).not.toBeInTheDocument()
			})
		})
	})
})
