/**
 * AccountPage — the four states it can be in, and the two things it can DO.
 *
 * The disconnect guard is the case worth pinning: the server refuses to remove
 * the last sign-in method, and the page should make that refusal unsurprising
 * rather than let someone click into a 400.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '../components/account/AccountPage'
import { startAccountLink, unlinkProvider } from '../services/accountLinking'
import { accountDelete } from '../services/accountFetchCalls'
import { getAuthToken, setAuthToken } from '../services/authToken'
import type { Account, AccountStatus } from '../types/account'

vi.mock('../services/accountLinking', () => ({
	startAccountLink: vi.fn(),
	unlinkProvider: vi.fn(),
}))
vi.mock('../services/accountFetchCalls', () => ({ accountDelete: vi.fn() }))
// Navbar and Footer pull in contexts this page does not need under test.
vi.mock('../components/navbar/Navbar', () => ({ Navbar: () => <nav /> }))
vi.mock('../components/footer/Footer', () => ({ Footer: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const auth = vi.hoisted(() => ({
	isLoggedIn: false,
	status: 'anonymous' as AccountStatus,
	account: null as Account | null,
	isSupporter: false,
	refresh: vi.fn(),
	signOut: vi.fn(),
}))
vi.mock('../services/AuthContext', () => ({ useAccount: () => auth }))

const mockedStart = vi.mocked(startAccountLink)
const mockedUnlink = vi.mocked(unlinkProvider)
const mockedDelete = vi.mocked(accountDelete)

function account(overrides: Partial<Account> = {}): Account {
	return {
		username: 'user_a3f9c1',
		avatar_url: null,
		linked_providers: [{ provider: 'google', linked_at: '2026-07-02', avatar_url: '' }],
		supporter: { is_supporter: false },
		...overrides,
	}
}

function signedIn(acct: Account) {
	auth.isLoggedIn = true
	auth.status = 'ready'
	auth.account = acct
}

function renderPage() {
	return render(
		<MemoryRouter initialEntries={['/account']}>
			<AccountPage />
		</MemoryRouter>,
	)
}

beforeEach(() => {
	auth.isLoggedIn = false
	auth.status = 'anonymous'
	auth.account = null
	auth.refresh.mockReset()
	auth.signOut.mockReset().mockResolvedValue(undefined)
	mockedStart.mockReset()
	mockedUnlink.mockReset()
	mockedDelete.mockReset()
	localStorage.clear()
})

describe('AccountPage states', () => {
	it('invites a guest to sign in instead of redirecting', () => {
		renderPage()

		expect(screen.getByText(/not signed in/i)).toBeInTheDocument()
		expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/login')
		expect(screen.queryByText(/sign-in methods/i)).toBeNull()
	})

	it('shows a loading state while the account is in flight', () => {
		auth.isLoggedIn = true
		auth.status = 'loading'

		renderPage()

		expect(screen.getByRole('status')).toBeInTheDocument()
	})

	it('offers a retry when the account failed to load', () => {
		auth.isLoggedIn = true
		auth.status = 'error'

		renderPage()

		fireEvent.click(screen.getByRole('button', { name: /retry/i }))
		expect(auth.refresh).toHaveBeenCalled()
	})
})

describe('AccountPage sign-in methods', () => {
	it('lists every provider, connected or not, with the link date formatted', () => {
		signedIn(account())

		renderPage()

		expect(screen.getByText('Connected 2026/7/2')).toBeInTheDocument()
		expect(screen.getAllByText('Not connected')).toHaveLength(2)
		expect(screen.getAllByRole('button', { name: /^connect$/i })).toHaveLength(2)
	})

	it('disables Disconnect on the only sign-in method', () => {
		signedIn(account())

		renderPage()

		const disconnect = screen.getByRole('button', { name: /disconnect/i })
		expect(disconnect).toBeDisabled()
		expect(disconnect).toHaveAttribute('title', expect.stringMatching(/only way to sign in/i))
	})

	it('starts a link for the provider whose Connect was clicked', () => {
		signedIn(account())
		mockedStart.mockReturnValue(new Promise(() => {}))

		renderPage()
		const [discordConnect] = screen.getAllByRole('button', { name: /^connect$/i })
		fireEvent.click(discordConnect)

		expect(mockedStart).toHaveBeenCalledWith('discord')
	})

	it('unlinks and re-reads the account when a second method is disconnected', async () => {
		signedIn(
			account({
				linked_providers: [
					{ provider: 'google', linked_at: '2026-07-02', avatar_url: '' },
					{ provider: 'patreon', linked_at: '2026-09-08', avatar_url: '' },
				],
			}),
		)
		mockedUnlink.mockResolvedValue(undefined)

		renderPage()
		const [, patreonDisconnect] = screen.getAllByRole('button', { name: /^disconnect$/i })
		fireEvent.click(patreonDisconnect)

		await waitFor(() => expect(mockedUnlink).toHaveBeenCalledWith('patreon'))
		await waitFor(() => expect(auth.refresh).toHaveBeenCalled())
	})
})

describe('AccountPage supporter block', () => {
	it('shows the tier and named benefits for a supporter', () => {
		signedIn(
			account({
				linked_providers: [
					{ provider: 'google', linked_at: '2026-07-02', avatar_url: '' },
					{ provider: 'patreon', linked_at: '2026-09-08', avatar_url: '' },
				],
				supporter: { is_supporter: true, tier: 'Junior Class', benefits: ['ad_free', 'unknown_key'] },
			}),
		)

		renderPage()

		expect(screen.getAllByText('Junior Class').length).toBeGreaterThan(0)
		expect(screen.getByText('Ad-free browsing')).toBeInTheDocument()
		// A key with no label is not shown raw.
		expect(screen.queryByText(/unknown_key/)).toBeNull()
	})

	it('explains the daily sync when Patreon is connected but not pledging', () => {
		signedIn(
			account({
				linked_providers: [
					{ provider: 'google', linked_at: '2026-07-02', avatar_url: '' },
					{ provider: 'patreon', linked_at: '2026-09-08', avatar_url: '' },
				],
			}),
		)

		renderPage()

		expect(screen.getByText(/don't see an active pledge/i)).toBeInTheDocument()
	})

	it('offers to connect Patreon when it is not linked', () => {
		signedIn(account())
		mockedStart.mockReturnValue(new Promise(() => {}))

		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /connect patreon/i }))

		expect(mockedStart).toHaveBeenCalledWith('patreon')
	})
})

describe('AccountPage sign out', () => {
	it('signs out through the provider and leaves for the home page', async () => {
		signedIn(account())
		const assign = vi.fn()
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { ...window.location, assign },
		})

		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

		await waitFor(() => expect(auth.signOut).toHaveBeenCalled())
		await waitFor(() => expect(assign).toHaveBeenCalledWith('/'))
	})
})

describe('AccountPage delete account', () => {
	function stubLocation() {
		const assign = vi.fn()
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { ...window.location, assign },
		})
		return assign
	}

	it('arms the button only once the phrase is typed', () => {
		signedIn(account())

		renderPage()
		const button = screen.getByRole('button', { name: /delete my account/i })
		expect(button).toBeDisabled()

		fireEvent.change(screen.getByRole('textbox'), { target: { value: 'delet' } })
		expect(button).toBeDisabled()

		fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Delete ' } })
		expect(button).toBeEnabled()
	})

	it('deletes, forgets the token and leaves for the home page', async () => {
		signedIn(account())
		setAuthToken('T0K3N')
		mockedDelete.mockResolvedValue({ ok: true, status: 204 } as unknown as Response)
		const assign = stubLocation()

		renderPage()
		fireEvent.change(screen.getByRole('textbox'), { target: { value: 'delete' } })
		fireEvent.click(screen.getByRole('button', { name: /delete my account/i }))

		await waitFor(() => expect(mockedDelete).toHaveBeenCalled())
		await waitFor(() => expect(assign).toHaveBeenCalledWith('/'))
		expect(getAuthToken()).toBeNull()
	})

	it('keeps the token when the server refuses', async () => {
		signedIn(account())
		setAuthToken('T0K3N')
		mockedDelete.mockResolvedValue({ ok: false, status: 403 } as unknown as Response)
		const assign = stubLocation()

		renderPage()
		fireEvent.change(screen.getByRole('textbox'), { target: { value: 'delete' } })
		fireEvent.click(screen.getByRole('button', { name: /delete my account/i }))

		await waitFor(() => expect(mockedDelete).toHaveBeenCalled())
		expect(assign).not.toHaveBeenCalled()
		expect(getAuthToken()).toBe('T0K3N')
	})
})
