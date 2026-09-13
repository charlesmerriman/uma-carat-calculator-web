/**
 * AuthProvider — the seam every later account feature attaches to.
 *
 * The cases here are the ones whose failure modes are silent rather than loud:
 * a guest paying for a request they never needed, a revoked token leaving a
 * signed-in shell on screen, or a token dropped in one place going unnoticed in
 * another. None of those throw; they just quietly behave wrongly, which is
 * exactly what makes them worth pinning down now rather than after Phases 1-3
 * are built on top.
 */

import { render, screen, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../services/AuthProvider'
import { useAccount } from '../services/AuthContext'
import { accountFetch } from '../services/accountFetchCalls'
import { userLogout } from '../services/userServices'
import { getAuthToken, setAuthToken } from '../services/authToken'
import type { Account } from '../types/account'

vi.mock('../services/accountFetchCalls', () => ({ accountFetch: vi.fn() }))
vi.mock('../services/userServices', () => ({ userLogout: vi.fn() }))

const mockedFetch = vi.mocked(accountFetch)
const mockedLogout = vi.mocked(userLogout)

function accountResponse(overrides: Partial<Account> = {}, status = 200): Response {
	const body: Account = {
		username: 'user_a3f9c1',
		display_name: '',
		avatar_url: null,
		avatar_uma: null,
		linked_providers: [],
		supporter: { is_supporter: false },
		...overrides,
	}
	return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

/** Renders the context values as text so assertions can read them off screen. */
const Probe = () => {
	const { isLoggedIn, status, account, isSupporter, signOut } = useAccount()
	return (
		<div>
			<span data-testid="logged-in">{String(isLoggedIn)}</span>
			<span data-testid="status">{status}</span>
			<span data-testid="username">{account?.username ?? '-'}</span>
			<span data-testid="supporter">{String(isSupporter)}</span>
			<button onClick={() => void signOut()}>sign out</button>
		</div>
	)
}

const renderProvider = () =>
	render(
		<AuthProvider>
			<Probe />
		</AuthProvider>
	)

beforeEach(() => {
	localStorage.clear()
	mockedFetch.mockReset()
	mockedLogout.mockReset()
	mockedLogout.mockResolvedValue({ message: 'ok' })
})

describe('AuthProvider', () => {
	it('makes no request at all for a guest', async () => {
		renderProvider()

		expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
		expect(screen.getByTestId('logged-in')).toHaveTextContent('false')
		// The guarantee that matters: most traffic is anonymous and must not pay
		// a round trip for a feature aimed at supporters.
		expect(mockedFetch).not.toHaveBeenCalled()
	})

	it('reports being signed in immediately, before the account arrives', () => {
		localStorage.setItem('authToken', 'a-real-token')
		// Never resolves, so this asserts the state on the very first render.
		mockedFetch.mockReturnValue(new Promise<Response>(() => {}))

		renderProvider()

		expect(screen.getByTestId('logged-in')).toHaveTextContent('true')
		expect(screen.getByTestId('status')).toHaveTextContent('loading')
	})

	it('loads the account when a token is present', async () => {
		localStorage.setItem('authToken', 'a-real-token')
		mockedFetch.mockResolvedValue(accountResponse())

		renderProvider()

		await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
		expect(screen.getByTestId('username')).toHaveTextContent('user_a3f9c1')
	})

	it('exposes supporter status from the response', async () => {
		localStorage.setItem('authToken', 'a-real-token')
		mockedFetch.mockResolvedValue(
			accountResponse({ supporter: { is_supporter: true, tier: 'Classic Class', benefits: ['ad_free'] } })
		)

		renderProvider()

		await waitFor(() => expect(screen.getByTestId('supporter')).toHaveTextContent('true'))
	})

	it('drops a token the server rejects', async () => {
		localStorage.setItem('authToken', 'a-revoked-token')
		mockedFetch.mockResolvedValue(accountResponse({}, 401))

		renderProvider()

		// The point of /account being the source of truth: a token that has
		// stopped meaning anything must not keep rendering a signed-in shell.
		await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
		expect(screen.getByTestId('logged-in')).toHaveTextContent('false')
		expect(getAuthToken()).toBeNull()
	})

	it('keeps the token when the lookup merely fails', async () => {
		localStorage.setItem('authToken', 'a-real-token')
		mockedFetch.mockRejectedValue(new Error('network down'))

		renderProvider()

		await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
		// A flaky network is not a sign-out. Discarding the token here would
		// silently log people out whenever the API hiccuped.
		expect(getAuthToken()).toBe('a-real-token')
		expect(screen.getByTestId('logged-in')).toHaveTextContent('true')
		expect(screen.getByTestId('supporter')).toHaveTextContent('false')
	})

	it('picks up a token stored after mount', async () => {
		mockedFetch.mockResolvedValue(accountResponse())
		renderProvider()

		expect(mockedFetch).not.toHaveBeenCalled()

		// What happens on the real sign-in path: socialAuth stores the token
		// through the same module, and the provider must notice without a reload.
		act(() => setAuthToken('a-real-token'))

		await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
	})

	it('signs out locally even when the logout request fails', async () => {
		localStorage.setItem('authToken', 'a-real-token')
		mockedFetch.mockResolvedValue(accountResponse())
		mockedLogout.mockRejectedValue(new Error('offline'))

		renderProvider()
		await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))

		act(() => screen.getByRole('button', { name: 'sign out' }).click())

		// Refusing to sign out because the server could not be reached would
		// strand the user signed in on a shared machine.
		await waitFor(() => expect(screen.getByTestId('logged-in')).toHaveTextContent('false'))
		expect(getAuthToken()).toBeNull()
	})
})
