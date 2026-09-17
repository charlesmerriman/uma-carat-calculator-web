/**
 * PlanSwitcher: the menu above the banner sheet.
 *
 * The plan LOGIC is the provider's and is tested in
 * calculatorProviderPlans.test.tsx. These cover what only the component
 * decides: who sees it at all, which items are offered, and that it hands the
 * right arguments to the right action.
 */

import { render, screen } from '@testing-library/react'
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
})

const renderSwitcher = (overrides: Partial<CalculatorContextType>) => {
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

const openMenu = () => userEvent.click(screen.getByRole('button', { name: /open the plan menu/i }))

describe('PlanSwitcher', () => {
	it('renders nothing for a guest', () => {
		const { container } = render(
			<CalculatorContext.Provider
				value={{ plans: [], activePlanId: null } as unknown as CalculatorContextType}
			>
				<PlanSwitcher />
			</CalculatorContext.Provider>
		)
		expect(container).toBeEmptyDOMElement()
	})

	it('names the open plan on the trigger and ticks it in the list', async () => {
		renderSwitcher({})
		expect(screen.getByRole('button', { name: /Plan: Main plan/ })).toBeInTheDocument()

		await openMenu()

		expect(screen.getByRole('menuitemradio', { name: 'Main plan' })).toHaveAttribute('aria-checked', 'true')
		expect(screen.getByRole('menuitemradio', { name: 'What if' })).toHaveAttribute('aria-checked', 'false')
	})

	it('switches to the plan that was picked', async () => {
		const value = renderSwitcher({})
		await openMenu()
		await userEvent.click(screen.getByRole('menuitemradio', { name: 'What if' }))
		expect(value.switchPlan).toHaveBeenCalledWith(2)
	})

	it('creates a blank plan with the typed name', async () => {
		const value = renderSwitcher({})
		await openMenu()
		await userEvent.click(screen.getByRole('menuitem', { name: 'New plan' }))
		await userEvent.type(screen.getByPlaceholderText('Plan name'), '  Anniversary  ')
		await userEvent.click(screen.getByRole('button', { name: 'Create' }))
		expect(value.createPlan).toHaveBeenCalledWith('Anniversary', undefined)
	})

	it('duplicates the OPEN plan, suggesting a name', async () => {
		const value = renderSwitcher({})
		await openMenu()
		await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate this plan' }))
		expect(screen.getByPlaceholderText('Plan name')).toHaveValue('Main plan copy')
		await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
		expect(value.createPlan).toHaveBeenCalledWith('Main plan copy', 1)
	})

	it('asks before deleting, and deletes the open plan', async () => {
		const value = renderSwitcher({})
		await openMenu()
		await userEvent.click(screen.getByRole('menuitem', { name: 'Delete this plan' }))
		expect(value.deletePlan).not.toHaveBeenCalled()
		await userEvent.click(screen.getByRole('button', { name: 'Delete plan' }))
		expect(value.deletePlan).toHaveBeenCalledWith(1)
	})

	it('will not offer to delete the only plan', async () => {
		renderSwitcher({ plans: [plan(1, 'Main plan', true)] })
		await openMenu()
		expect(screen.getByRole('menuitem', { name: 'Delete this plan' })).toBeDisabled()
	})

	it('stops offering new plans at the cap, and says why', async () => {
		const full = Array.from({ length: PLAN_CAP }, (_, index) =>
			plan(index + 1, `Plan ${index + 1}`, index === 0)
		)
		renderSwitcher({ plans: full })
		await openMenu()
		expect(screen.getByRole('menuitem', { name: 'New plan' })).toBeDisabled()
		expect(screen.getByRole('menuitem', { name: 'Duplicate this plan' })).toBeDisabled()
		expect(screen.getByText(new RegExp(`up to ${PLAN_CAP} plans`))).toBeInTheDocument()
	})
})
