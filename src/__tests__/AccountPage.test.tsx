/**
 * AccountPage — the four states it can be in, and the two things it can DO.
 *
 * The disconnect guard is the case worth pinning: the server refuses to remove
 * the last sign-in method, and the page should make that refusal unsurprising
 * rather than let someone click into a 400.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '../components/account/AccountPage'
import { startAccountLink, unlinkProvider } from '../services/accountLinking'
import { accountDelete, accountPatch } from '../services/accountFetchCalls'
import { umasFetch } from '../services/umasFetchCalls'
import { getAuthToken, setAuthToken } from '../services/authToken'
import type { Account, AccountStatus } from '../types/account'

vi.mock('../services/accountLinking', () => ({
	startAccountLink: vi.fn(),
	unlinkProvider: vi.fn(),
}))
vi.mock('../services/accountFetchCalls', () => ({ accountDelete: vi.fn(), accountPatch: vi.fn() }))
vi.mock('../services/umasFetchCalls', () => ({ umasFetch: vi.fn() }))
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
const mockedPatch = vi.mocked(accountPatch)
const mockedUmas = vi.mocked(umasFetch)
const mockedToast = vi.mocked(toast)

function account(overrides: Partial<Account> = {}): Account {
	return {
		username: 'user_a3f9c1',
		display_name: '',
		avatar_url: null,
		avatar_uma: null,
		linked_providers: [{ provider: 'google', linked_at: '2026-07-02', avatar_url: '' }],
		supporter: { is_supporter: false },
		...overrides,
	}
}

/** A Response-shaped stub: the fetch modules hand back the raw Response. */
function response(status: number, body: unknown = {}): Response {
	return { ok: status < 400, status, json: async () => body } as unknown as Response
}

const UMAS = [
	{ id: 7, name: 'Special Week', image: 'https://cdn.example/umas/special-week.png' },
	{ id: 9, name: 'Gold Ship', image: 'https://cdn.example/umas/gold-ship.png' },
]

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
	mockedPatch.mockReset()
	mockedUmas.mockReset()
	mockedToast.success.mockReset()
	mockedToast.error.mockReset()
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

describe('AccountPage display name', () => {
	it('shows the chosen name in the header with the handle beneath it', () => {
		signedIn(account({ display_name: 'Rhondal' }))

		renderPage()

		expect(screen.getByText('Rhondal')).toBeInTheDocument()
		// Once in the header, once in the display-name blurb.
		expect(screen.getAllByText('user_a3f9c1').length).toBeGreaterThanOrEqual(2)
	})

	it('saves a trimmed name and re-reads the account', async () => {
		signedIn(account())
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		const save = screen.getByRole('button', { name: /^save$/i })
		expect(save).toBeDisabled()
		fireEvent.change(screen.getByRole('textbox', { name: /display name/i }), {
			target: { value: '  Rhondal  ' },
		})
		expect(save).toBeEnabled()
		fireEvent.click(save)

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ display_name: 'Rhondal' }))
		await waitFor(() => expect(auth.refresh).toHaveBeenCalled())
		expect(mockedToast.success).toHaveBeenCalledWith('Display name saved.')
	})

	it('clears the name by saving it blank', async () => {
		signedIn(account({ display_name: 'Rhondal' }))
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		fireEvent.change(screen.getByRole('textbox', { name: /display name/i }), { target: { value: '' } })
		fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ display_name: '' }))
		expect(mockedToast.success).toHaveBeenCalledWith('Display name cleared.')
	})

	it("shows the server's reason when the name is refused, and does not re-read", async () => {
		signedIn(account())
		const reason = "That name has characters that can't be shown."
		mockedPatch.mockResolvedValue(response(400, { display_name: [reason] }))

		renderPage()
		fireEvent.change(screen.getByRole('textbox', { name: /display name/i }), { target: { value: 'bad' } })
		fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

		await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith(reason))
		expect(auth.refresh).not.toHaveBeenCalled()
	})
})

describe('AccountPage uma avatar', () => {
	it('opens the picker, lists umas from /umas and saves the pick', async () => {
		signedIn(account())
		mockedUmas.mockResolvedValue(response(200, UMAS))
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /pick an uma/i }))
		const dialog = await screen.findByRole('dialog')
		fireEvent.click(await within(dialog).findByRole('button', { name: /gold ship/i }))

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ avatar_uma: 9 }))
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(auth.refresh).toHaveBeenCalled()
	})

	it('filters the grid by the search box and marks the current pick', async () => {
		signedIn(account({ avatar_uma: 7 }))
		mockedUmas.mockResolvedValue(response(200, UMAS))

		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /change uma/i }))
		const dialog = await screen.findByRole('dialog')
		expect(await within(dialog).findByRole('button', { name: /special week/i })).toHaveAttribute(
			'aria-pressed',
			'true',
		)

		fireEvent.change(within(dialog).getByRole('searchbox'), { target: { value: 'gold' } })
		expect(within(dialog).queryByRole('button', { name: /special week/i })).toBeNull()
		expect(within(dialog).getByRole('button', { name: /gold ship/i })).toBeInTheDocument()
	})

	it('keeps the picker open when the server refuses the pick', async () => {
		signedIn(account())
		mockedUmas.mockResolvedValue(response(200, UMAS))
		mockedPatch.mockResolvedValue(response(400, { avatar_uma: ['Invalid pk "9" - object does not exist.'] }))

		renderPage()
		fireEvent.click(screen.getByRole('button', { name: /pick an uma/i }))
		const dialog = await screen.findByRole('dialog')
		fireEvent.click(await within(dialog).findByRole('button', { name: /gold ship/i }))

		await waitFor(() => expect(mockedToast.error).toHaveBeenCalled())
		expect(screen.getByRole('dialog')).toBeInTheDocument()
		expect(auth.refresh).not.toHaveBeenCalled()
	})

	it('offers the provider picture as the way back once an uma is chosen', async () => {
		signedIn(account({ avatar_uma: 7, avatar_url: UMAS[0].image }))
		mockedPatch.mockResolvedValue(response(200))

		renderPage()
		expect(screen.getByText(/the uma you picked/i)).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: /use my provider picture/i }))

		await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith({ avatar_uma: null }))
		await waitFor(() => expect(auth.refresh).toHaveBeenCalled())
	})

	it('has no way back while the provider picture is in use', () => {
		signedIn(account())

		renderPage()

		expect(screen.queryByRole('button', { name: /use my provider picture/i })).toBeNull()
		expect(screen.getByText(/provider you last signed in with/i)).toBeInTheDocument()
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

		fireEvent.change(screen.getByRole('textbox', { name: /to confirm/i }), { target: { value: 'delet' } })
		expect(button).toBeDisabled()

		fireEvent.change(screen.getByRole('textbox', { name: /to confirm/i }), { target: { value: ' Delete ' } })
		expect(button).toBeEnabled()
	})

	it('deletes, forgets the token and leaves for the home page', async () => {
		signedIn(account())
		setAuthToken('T0K3N')
		mockedDelete.mockResolvedValue({ ok: true, status: 204 } as unknown as Response)
		const assign = stubLocation()

		renderPage()
		fireEvent.change(screen.getByRole('textbox', { name: /to confirm/i }), { target: { value: 'delete' } })
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
		fireEvent.change(screen.getByRole('textbox', { name: /to confirm/i }), { target: { value: 'delete' } })
		fireEvent.click(screen.getByRole('button', { name: /delete my account/i }))

		await waitFor(() => expect(mockedDelete).toHaveBeenCalled())
		expect(assign).not.toHaveBeenCalled()
		expect(getAuthToken()).toBe('T0K3N')
	})
})
