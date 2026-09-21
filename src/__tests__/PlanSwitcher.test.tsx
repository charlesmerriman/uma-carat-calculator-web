/**
 * PlanSwitcher: the PLANS bar above the banner sheet.
 *
 * The plan LOGIC is the provider's and is tested in
 * calculatorProviderPlans.test.tsx. These cover what only the component
 * decides: who sees it at all, which controls are offered, and that it hands
 * the right arguments to the right action.
 *
 * Both layouts (the tabs, and the narrow dropdown) are always in the DOM and a
 * container query shows one of them. jsdom applies no CSS, so both are
 * reachable here, which is what lets one file cover the two. They are told
 * apart the way a person would: the tabs live in the "Plans" navigation, the
 * dropdown is the button that says it opens the plan menu.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlanSwitcher } from '../components/carat-calculator/PlanSwitcher'
import { CalculatorContext } from '../services/CalculatorContext'
import { PLAN_CAP } from '../types'
import type { CalculatorContextType, Plan } from '../types'

const plan = (id: number, name: string, isActive = false): Plan => ({
	id,
	name,
	is_active: isActive,
	updated_at: '2026-09-17T00:00:00Z',
})

const actions = () => ({
	switchPlan: vi.fn().mockResolvedValue(true),
	createPlan: vi.fn().mockResolvedValue(true),
	renamePlan: vi.fn().mockResolvedValue(true),
	deletePlan: vi.fn().mockResolvedValue(true),
	setSeparateIncome: vi.fn().mockResolvedValue(true),
})

const renderSwitcher = (overrides: Partial<CalculatorContextType> = {}) => {
	const value = {
		plans: [plan(1, 'Main plan', true), plan(2, 'What if')],
		activePlanId: 1,
		isPlanBusy: false,
		...actions(),
		...overrides,
	} as unknown as CalculatorContextType
	render(
		<CalculatorContext.Provider value={value}>
			<PlanSwitcher />
		</CalculatorContext.Provider>
	)
	return value
}

/** The wide layout: one tab per plan, plus "New". */
const tabs = () => within(screen.getByRole('navigation', { name: 'Plans' }))
/** The "..." beside the tabs. */
const openOptions = () => userEvent.click(screen.getByRole('button', { name: /^Options for / }))
/** The narrow layout's single dropdown. */
const openDropdown = () => userEvent.click(screen.getByRole('button', { name: /open the plan menu/i }))

describe('PlanSwitcher', () => {
	it('renders nothing for a guest, bar included', () => {
		const { container } = render(
			<CalculatorContext.Provider
				value={{ plans: [], activePlanId: null } as unknown as CalculatorContextType}
			>
				<PlanSwitcher />
			</CalculatorContext.Provider>
		)
		expect(container).toBeEmptyDOMElement()
	})

	describe('tabs', () => {
		it('shows a tab per plan and marks the open one', () => {
			renderSwitcher()
			expect(tabs().getByRole('button', { name: 'Main plan' })).toHaveAttribute('aria-current', 'true')
			expect(tabs().getByRole('button', { name: 'What if' })).not.toHaveAttribute('aria-current')
		})

		it('switches in one click', async () => {
			const value = renderSwitcher()
			await userEvent.click(tabs().getByRole('button', { name: 'What if' }))
			expect(value.switchPlan).toHaveBeenCalledWith(2)
		})

		it('keeps the open tab enabled while another plan loads, and locks the rest', () => {
			renderSwitcher({ isPlanBusy: true })
			expect(tabs().getByRole('button', { name: 'Main plan' })).toBeEnabled()
			expect(tabs().getByRole('button', { name: 'What if' })).toBeDisabled()
		})

		it('"New" goes straight to the name form, with nothing behind it to go back to', async () => {
			const value = renderSwitcher()
			await userEvent.click(tabs().getByRole('button', { name: 'New' }))
			expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
			await userEvent.type(screen.getByPlaceholderText('Plan name'), '  Anniversary  ')
			await userEvent.click(screen.getByRole('button', { name: 'Create' }))
			expect(value.createPlan).toHaveBeenCalledWith('Anniversary', undefined)
		})

		it('stops offering new plans at the cap, and says why', async () => {
			const full = Array.from({ length: PLAN_CAP }, (_, index) =>
				plan(index + 1, `Plan ${index + 1}`, index === 0)
			)
			renderSwitcher({ plans: full })
			expect(tabs().getByRole('button', { name: 'New' })).toBeDisabled()
			await openOptions()
			expect(screen.getByRole('menuitem', { name: 'Duplicate this plan' })).toBeDisabled()
			expect(screen.getByText(new RegExp(`up to ${PLAN_CAP} plans`))).toBeInTheDocument()
		})
	})

	describe('the options menu beside the tabs', () => {
		it('offers the actions without repeating the plan list', async () => {
			renderSwitcher()
			await openOptions()
			expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
			expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument()
			expect(screen.queryByRole('menuitem', { name: 'New plan' })).not.toBeInTheDocument()
		})

		it('duplicates the OPEN plan, suggesting a name', async () => {
			const value = renderSwitcher()
			await openOptions()
			await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate this plan' }))
			expect(screen.getByPlaceholderText('Plan name')).toHaveValue('Main plan copy')
			await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
			expect(value.createPlan).toHaveBeenCalledWith('Main plan copy', 1)
		})

		it('renames the open plan', async () => {
			const value = renderSwitcher()
			await openOptions()
			await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
			const input = screen.getByPlaceholderText('Plan name')
			expect(input).toHaveValue('Main plan')
			await userEvent.clear(input)
			await userEvent.type(input, 'F2P')
			await userEvent.click(screen.getByRole('button', { name: 'Save' }))
			expect(value.renamePlan).toHaveBeenCalledWith(1, 'F2P')
		})

		it('"Back" from a form returns to the menu it came from', async () => {
			renderSwitcher()
			await openOptions()
			await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
			await userEvent.click(screen.getByRole('button', { name: 'Back' }))
			expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
		})

		it('asks before deleting, and deletes the open plan', async () => {
			const value = renderSwitcher()
			await openOptions()
			await userEvent.click(screen.getByRole('menuitem', { name: 'Delete this plan' }))
			expect(value.deletePlan).not.toHaveBeenCalled()
			await userEvent.click(screen.getByRole('button', { name: 'Delete plan' }))
			expect(value.deletePlan).toHaveBeenCalledWith(1)
		})

		it('will not offer to delete the only plan', async () => {
			renderSwitcher({ plans: [plan(1, 'Main plan', true)] })
			await openOptions()
			expect(screen.getByRole('menuitem', { name: 'Delete this plan' })).toBeDisabled()
		})

		it('closes when its own button is clicked again', async () => {
			renderSwitcher()
			await openOptions()
			await openOptions()
			expect(screen.queryByRole('menu')).not.toBeInTheDocument()
		})
	})

	describe('separate resources', () => {
		it('offers it unchecked for a plan on the account\'s stats, and turns it on in one click', async () => {
			const value = renderSwitcher()
			await openOptions()
			const item = screen.getByRole('menuitemcheckbox', { name: /separate resources/i })
			expect(item).toHaveAttribute('aria-checked', 'false')
			await userEvent.click(item)
			expect(value.setSeparateIncome).toHaveBeenCalledWith(1, true)
		})

		it('shows it checked for a plan with its own stats, and asks before turning it off', async () => {
			const value = renderSwitcher({
				plans: [{ ...plan(1, 'Alt account', true), income_profile_id: 7 }, plan(2, 'What if')],
			})
			await openOptions()
			const item = screen.getByRole('menuitemcheckbox', { name: /separate resources/i })
			expect(item).toHaveAttribute('aria-checked', 'true')
			await userEvent.click(item)
			// Nothing yet: the confirmation is showing.
			expect(value.setSeparateIncome).not.toHaveBeenCalled()
			await userEvent.click(screen.getByRole('button', { name: 'Use account resources' }))
			expect(value.setSeparateIncome).toHaveBeenCalledWith(1, false)
		})

		it('marks the tab of a plan that has its own resources, and says so on hover', () => {
			renderSwitcher({
				plans: [plan(1, 'Main plan', true), { ...plan(2, 'Alt account'), income_profile_id: 7 }],
			})
			const alt = tabs().getByRole('button', { name: 'Alt account' })
			expect(within(alt).getByTestId('own-resources-marker')).toBeInTheDocument()
			expect(alt).toHaveAttribute('title', expect.stringMatching(/its own resources/))
			expect(
				within(tabs().getByRole('button', { name: 'Main plan' })).queryByTestId('own-resources-marker')
			).not.toBeInTheDocument()
		})
	})

	describe('the narrow dropdown', () => {
		it('names the open plan and lists every plan with the open one ticked', async () => {
			renderSwitcher()
			expect(screen.getByRole('button', { name: /Plan: Main plan/ })).toBeInTheDocument()
			await openDropdown()
			expect(screen.getByRole('menuitemradio', { name: 'Main plan' })).toHaveAttribute('aria-checked', 'true')
			expect(screen.getByRole('menuitemradio', { name: 'What if' })).toHaveAttribute('aria-checked', 'false')
		})

		it('switches to the plan that was picked', async () => {
			const value = renderSwitcher()
			await openDropdown()
			await userEvent.click(screen.getByRole('menuitemradio', { name: 'What if' }))
			expect(value.switchPlan).toHaveBeenCalledWith(2)
		})

		it('has "New plan" in the menu, since there is no New button at this width', async () => {
			const value = renderSwitcher()
			await openDropdown()
			await userEvent.click(screen.getByRole('menuitem', { name: 'New plan' }))
			await userEvent.type(screen.getByPlaceholderText('Plan name'), 'Whale')
			await userEvent.click(screen.getByRole('button', { name: 'Create' }))
			expect(value.createPlan).toHaveBeenCalledWith('Whale', undefined)
		})
	})
})
