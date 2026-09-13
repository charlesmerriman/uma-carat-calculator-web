/**
 * accountLinking — the client half of attaching a provider to a signed-in account.
 *
 * The cases that matter are the ones that would fail silently: a link pending
 * under the sign-in key (or vice versa), a state accepted twice, a 409 whose
 * useful message is thrown away, and a request sent without the token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	startAccountLink,
	completeAccountLink,
	unlinkProvider,
	peekPendingLinkProvider,
} from '../services/accountLinking'
import { peekPendingLoginProvider } from '../services/socialAuth'
import { setAuthToken } from '../services/authToken'
import { ApiError } from '../services/userServices'

const LINK_KEY = 'accountLinkState.v1'
const LOGIN_KEY = 'oauthState.v1'

function jsonResponse(data: unknown, ok = true, status = 200): Response {
	return { ok, status, json: async () => data } as unknown as Response
}

let assignMock: ReturnType<typeof vi.fn>

beforeEach(() => {
	sessionStorage.clear()
	localStorage.clear()
	setAuthToken('T0K3N')
	assignMock = vi.fn()
	vi.stubGlobal('fetch', vi.fn())
	Object.defineProperty(window, 'location', {
		configurable: true,
		value: { ...window.location, origin: 'http://localhost:5173', assign: assignMock },
	})
})

afterEach(() => {
	vi.unstubAllGlobals()
})

function pendingLink(overrides: Record<string, unknown> = {}): void {
	sessionStorage.setItem(
		LINK_KEY,
		JSON.stringify({ provider: 'patreon', state: 'LINK-ST8', createdAt: Date.now(), ...overrides }),
	)
}

function lastRequest(): { url: string; init: RequestInit } {
	const [url, init] = vi.mocked(fetch).mock.calls.at(-1) as [string, RequestInit]
	return { url, init }
}

describe('startAccountLink', () => {
	it('saves the pending link under its OWN key and redirects', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse({ authorize_url: 'https://www.patreon.com/oauth2/authorize?x=1', state: 'LINK-ST8' }),
		)

		await startAccountLink('patreon')

		expect(JSON.parse(sessionStorage.getItem(LINK_KEY) ?? '{}')).toMatchObject({
			provider: 'patreon',
			state: 'LINK-ST8',
		})
		// The separation that mirrors the server's two salts.
		expect(sessionStorage.getItem(LOGIN_KEY)).toBeNull()
		expect(assignMock).toHaveBeenCalledWith('https://www.patreon.com/oauth2/authorize?x=1')
	})

	it('is an authenticated request to the link route, naming this origin', async () => {
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ authorize_url: 'https://p', state: 'S' }))

		await startAccountLink('patreon')

		const { url, init } = lastRequest()
		expect(url).toContain('/account/link/patreon/start?')
		expect(url).toContain(`redirect_uri=${encodeURIComponent('http://localhost:5173/auth/callback')}`)
		expect((init.headers as Record<string, string>).Authorization).toBe('Token T0K3N')
	})

	it.each([
		[401, /signed out/i],
		[429, /too many/i],
		[503, /unavailable/i],
		[400, /not approved/i],
	])('explains a %i without redirecting', async (status, message) => {
		vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, status))

		await expect(startAccountLink('patreon')).rejects.toThrow(message)
		expect(assignMock).not.toHaveBeenCalled()
		expect(sessionStorage.getItem(LINK_KEY)).toBeNull()
	})
})

describe('peekPendingLinkProvider', () => {
	it('reports the pending provider without consuming it', () => {
		pendingLink()

		expect(peekPendingLinkProvider()).toBe('patreon')
		expect(peekPendingLinkProvider()).toBe('patreon')
		expect(sessionStorage.getItem(LINK_KEY)).not.toBeNull()
	})

	it('does not see a pending SIGN-IN, and sign-in does not see a pending link', () => {
		sessionStorage.setItem(
			LOGIN_KEY,
			JSON.stringify({ provider: 'google', state: 'S', createdAt: Date.now() }),
		)
		pendingLink()

		expect(peekPendingLinkProvider()).toBe('patreon')
		expect(peekPendingLoginProvider()).toBe('google')
		sessionStorage.removeItem(LINK_KEY)
		expect(peekPendingLinkProvider()).toBeNull()
		expect(peekPendingLoginProvider()).toBe('google')
	})

	it('treats a stale or malformed entry as nothing pending', () => {
		pendingLink({ createdAt: Date.now() - 11 * 60 * 1000 })
		expect(peekPendingLinkProvider()).toBeNull()

		sessionStorage.setItem(LINK_KEY, '{not json')
		expect(peekPendingLinkProvider()).toBeNull()

		pendingLink({ provider: 'myspace' })
		expect(peekPendingLinkProvider()).toBeNull()
	})
})

describe('completeAccountLink', () => {
	const row = { provider: 'patreon', linked_at: '2026-09-12' }

	it('posts the code with the token and resolves to the linked row', async () => {
		pendingLink()
		vi.mocked(fetch).mockResolvedValue(jsonResponse(row, true, 201))

		const result = await completeAccountLink('patreon', 'CODE', 'LINK-ST8')

		expect(result).toEqual(row)
		const { url, init } = lastRequest()
		expect(url).toContain('/account/link/patreon/complete')
		expect(init.method).toBe('POST')
		expect(JSON.parse(init.body as string)).toEqual({ code: 'CODE', state: 'LINK-ST8' })
		expect((init.headers as Record<string, string>).Authorization).toBe('Token T0K3N')
	})

	it('consumes the pending link so a state cannot be used twice', async () => {
		pendingLink()
		vi.mocked(fetch).mockResolvedValue(jsonResponse(row, true, 201))

		await completeAccountLink('patreon', 'CODE', 'LINK-ST8')

		expect(sessionStorage.getItem(LINK_KEY)).toBeNull()
		await expect(completeAccountLink('patreon', 'CODE', 'LINK-ST8')).rejects.toThrow(/no longer valid/i)
	})

	it('rejects a state that does not match what was parked', async () => {
		pendingLink()

		await expect(completeAccountLink('patreon', 'CODE', 'FORGED')).rejects.toThrow(/no longer valid/i)
		expect(fetch).not.toHaveBeenCalled()
	})

	it('rejects a callback for a different provider than the pending one', async () => {
		pendingLink()

		await expect(completeAccountLink('google', 'CODE', 'LINK-ST8')).rejects.toThrow(/no longer valid/i)
		expect(fetch).not.toHaveBeenCalled()
	})

	it('surfaces the server message on a 409, which says WHICH conflict it was', async () => {
		pendingLink()
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse({ error: 'That patreon account is already linked to a different account.' }, false, 409),
		)

		await expect(completeAccountLink('patreon', 'CODE', 'LINK-ST8')).rejects.toThrow(
			/already linked to a different account/,
		)
	})

	it('uses one generic message for every other failure', async () => {
		pendingLink()
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'state was bad' }, false, 400))

		const failure = completeAccountLink('patreon', 'CODE', 'LINK-ST8')

		await expect(failure).rejects.toBeInstanceOf(ApiError)
		await expect(failure).rejects.toThrow(/could not connect/i)
	})
})

describe('unlinkProvider', () => {
	it('sends an authenticated DELETE and resolves on 204', async () => {
		vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204 } as unknown as Response)

		await expect(unlinkProvider('google')).resolves.toBeUndefined()

		const { url, init } = lastRequest()
		expect(url).toContain('/account/link/google')
		expect(init.method).toBe('DELETE')
		expect((init.headers as Record<string, string>).Authorization).toBe('Token T0K3N')
	})

	it('passes through the lockout refusal, which tells the user what to do', async () => {
		vi.mocked(fetch).mockResolvedValue(
			jsonResponse(
				{ error: 'That is the only way to sign in to this account. Link another provider first.' },
				false,
				400,
			),
		)

		await expect(unlinkProvider('google')).rejects.toThrow(/only way to sign in/)
	})

	it('explains a 404 as not connected', async () => {
		vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 404))

		await expect(unlinkProvider('discord')).rejects.toThrow(/isn't connected/)
	})
})
