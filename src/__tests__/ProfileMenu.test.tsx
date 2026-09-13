/**
 * ProfileMenu — the signed-in trigger and its menu.
 *
 * What is worth pinning: the trigger says WHO is signed in (the chosen name,
 * else the handle), the handle is still reachable from the menu when a chosen
 * name is shown, and the popover idiom (aria-expanded, Escape) holds.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileMenu } from '../components/navbar/ProfileMenu'
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
vi.mock('../services/CalculatorContext', () => ({ useCalculatorDataSafe: () => null }))

function account(overrides: Partial<Account> = {}): Account {
	return {
		username: 'user_a3f9c1',
		display_name: '',
		avatar_url: null,
		oshis: [],
		oshi_slots: 0,
		linked_providers: [{ provider: 'google', linked_at: '2026-07-02' }],
		supporter: { is_supporter: false },
		...overrides,
	}
}

function renderMenu() {
	return render(
		<MemoryRouter>
			<ProfileMenu />
		</MemoryRouter>,
	)
}

const trigger = () => screen.getByRole('button', { name: /account menu/i })

beforeEach(() => {
	auth.status = 'ready'
	auth.account = null
	auth.signOut.mockReset().mockResolvedValue(undefined)
})

describe('ProfileMenu trigger', () => {
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

describe('ProfileMenu popover', () => {
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
