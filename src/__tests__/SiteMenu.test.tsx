/**
 * SiteMenu — the last control in the navbar: the account, the theme and the
 * info pages in one menu, for a guest too (ProfileMenu until 2026-11-24).
 *
 * What is worth pinning: the trigger says WHO is signed in (the chosen name,
 * else the handle), the handle is still reachable from the menu when a chosen
 * name is shown, the popover idiom (aria-expanded, Escape) holds, a guest can
 * reach the theme and the info pages, and the Theme row opens the real picker.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteMenu } from '../components/navbar/SiteMenu'
import { ThemeProvider } from '../services/ThemeProvider'
import type { Account, AccountStatus } from '../types/account'

const auth = vi.hoisted(() => ({
	isLoggedIn: true,
	status: 'ready' as AccountStatus,
	account: null as Account | null,
	isSupporter: false,
	refresh: vi.fn(),
	signOut: vi.fn(),
}))
vi.mock('../services/AuthContext', () => ({ useAccount: () => auth }))
// Outside /app there is no calculator context; the menu must cope with null.
// A test that needs the planner's state sets `calculator.value`.
const calculator = vi.hoisted(() => ({ value: null as { isGuestPlanStored: boolean } | null }))
vi.mock('../services/CalculatorContext', () => ({ useCalculatorDataSafe: () => calculator.value }))

function account(overrides: Partial<Account> = {}): Account {
	return {
		username: 'user_a3f9c1',
		display_name: '',
		show_supporter_badge: true,
		avatar_url: null,
		oshis: [],
		oshi_slots: 0,
		oshi_variants: false,
		early_access: false,
		linked_providers: [{ provider: 'google', linked_at: '2026-07-02' }],
		supporter: { is_supporter: false },
		...overrides,
	}
}

function renderMenu() {
	// The real ThemeProvider, so the Theme row is tested against the real
	// picker and the real list of themes.
	return render(
		<ThemeProvider>
			<MemoryRouter>
				<SiteMenu />
			</MemoryRouter>
		</ThemeProvider>,
	)
}

const trigger = () => screen.getByRole('button', { name: /account menu/i })

beforeEach(() => {
	auth.isLoggedIn = true
	auth.status = 'ready'
	auth.account = null
	calculator.value = null
	auth.signOut.mockReset().mockResolvedValue(undefined)
})

describe('SiteMenu trigger, signed in', () => {
	it('carries the chosen name', () => {
		auth.account = account({ display_name: 'Rhondal' })

		renderMenu()

		expect(trigger()).toHaveAttribute('title', 'Signed in as Rhondal')
		expect(within(trigger()).getByText('Rhondal')).toBeInTheDocument()
	})

	it('falls back to the handle when no name is chosen', () => {
		auth.account = account()

		renderMenu()

		expect(trigger()).toHaveAttribute('title', 'Signed in as user_a3f9c1')
		expect(within(trigger()).getByText('user_a3f9c1')).toBeInTheDocument()
	})

	it('shows no name while the account is still loading', () => {
		auth.status = 'loading'

		renderMenu()

		expect(trigger()).toHaveAttribute('title', 'Account menu')
		expect(trigger()).toHaveTextContent('')
	})
})

describe('SiteMenu popover, signed in', () => {
	it('opens with Account and Sign out, keeps the handle under a chosen name, and closes on Escape', () => {
		auth.account = account({
			display_name: 'Rhondal',
			supporter: { is_supporter: true, tier: 'Junior Class', benefits: ['ad_free'] },
		})

		renderMenu()
		expect(trigger()).toHaveAttribute('aria-expanded', 'false')
		fireEvent.click(trigger())

		expect(trigger()).toHaveAttribute('aria-expanded', 'true')
		const menu = screen.getByRole('menu')
		expect(within(menu).getByText('Rhondal')).toBeInTheDocument()
		expect(within(menu).getByText('user_a3f9c1')).toBeInTheDocument()
		expect(within(menu).getByText('Supporter · Junior Class')).toBeInTheDocument()
		expect(screen.getByRole('menuitem', { name: /^account$/i })).toHaveAttribute('href', '/account')
		expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()

		fireEvent.keyDown(document, { key: 'Escape' })
		expect(screen.queryByRole('menu')).toBeNull()
		expect(trigger()).toHaveAttribute('aria-expanded', 'false')
	})

	it('does not repeat the handle in the menu when it is already the name', () => {
		auth.account = account()

		renderMenu()
		fireEvent.click(trigger())

		expect(within(screen.getByRole('menu')).getAllByText('user_a3f9c1')).toHaveLength(1)
		expect(within(screen.getByRole('menu')).getByText('Signed in')).toBeInTheDocument()
	})
})

describe('SiteMenu, the rows everyone gets', () => {
	it('lists the info pages, which only the footer linked before', () => {
		auth.account = account()

		renderMenu()
		fireEvent.click(trigger())

		for (const [name, href] of [['About', '/about'], ['FAQ', '/faq'], ['Changelog', '/changelog'], ['Feedback', '/feedback']]) {
			expect(screen.getByRole('menuitem', { name })).toHaveAttribute('href', href)
		}
	})

	it('opens the theme picker under the Theme row, and keeps the menu open after a pick', () => {
		auth.account = account()

		renderMenu()
		fireEvent.click(trigger())
		const themeRow = screen.getByRole('menuitem', { name: /^theme/i })
		expect(themeRow).toHaveAttribute('aria-expanded', 'false')
		// Folded away until asked for: the menu opens short.
		expect(screen.queryByRole('button', { name: 'Switch to Dark theme' })).toBeNull()

		fireEvent.click(themeRow)
		expect(themeRow).toHaveAttribute('aria-expanded', 'true')
		fireEvent.click(screen.getByRole('button', { name: 'Switch to Dark theme' }))

		// The row names the theme now in use, and the menu is still there to
		// change it again.
		expect(screen.getByRole('menu')).toBeInTheDocument()
		expect(themeRow).toHaveTextContent('Dark')
		expect(screen.getByRole('button', { name: 'Switch to Dark theme' })).toHaveAttribute('aria-pressed', 'true')
	})
})

describe('SiteMenu for a guest', () => {
	const guestTrigger = () => screen.getByRole('button', { name: 'Menu' })

	beforeEach(() => {
		auth.isLoggedIn = false
	})

	it('is a plain menu button that opens on signing in, the theme and the info pages', () => {
		renderMenu()
		expect(screen.queryByRole('button', { name: /account menu/i })).toBeNull()
		fireEvent.click(guestTrigger())

		expect(screen.getByRole('menuitem', { name: /sign in to sync/i })).toHaveAttribute('href', '/login')
		expect(screen.getByRole('menuitem', { name: /^theme/i })).toBeInTheDocument()
		expect(screen.getByRole('menuitem', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
		// Nothing that belongs to an account.
		expect(screen.queryByRole('menuitem', { name: /^account$/i })).toBeNull()
		expect(screen.queryByRole('menuitem', { name: /collection/i })).toBeNull()
		expect(screen.queryByRole('menuitem', { name: /sign out/i })).toBeNull()
	})

	it('says where the plan is kept, in the words the bar\'s tooltip uses', () => {
		calculator.value = { isGuestPlanStored: true }
		renderMenu()
		fireEvent.click(guestTrigger())
		// "In this browser" is the whole claim: never just "saved".
		expect(screen.getByRole('menuitem', { name: /sign in to sync/i })).toHaveTextContent('Your plan is saved in this browser.')
	})

	it('says so when this browser is not keeping the plan', () => {
		calculator.value = { isGuestPlanStored: false }
		renderMenu()
		fireEvent.click(guestTrigger())
		expect(screen.getByRole('menuitem', { name: /sign in to sync/i })).toHaveTextContent("This browser isn't saving your plan.")
	})

	it('closes on Escape and hands focus back to the button', () => {
		renderMenu()
		fireEvent.click(guestTrigger())
		fireEvent.keyDown(document, { key: 'Escape' })
		expect(screen.queryByRole('menu')).toBeNull()
		expect(guestTrigger()).toHaveFocus()
	})
})
