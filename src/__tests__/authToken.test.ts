/**
 * authToken — the module that owns the stored token.
 *
 * Small surface, but everything else trusts it: if a write stops notifying,
 * AuthProvider caches a stale answer and the UI goes on claiming someone is
 * signed in. That failure is invisible in the module itself, so it is pinned
 * here rather than left to the consumers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	authHeaders,
	clearAuthToken,
	getAuthToken,
	setAuthToken,
	subscribeToAuthToken,
} from '../services/authToken'

beforeEach(() => {
	localStorage.clear()
})

describe('authToken', () => {
	it('round-trips a token', () => {
		expect(getAuthToken()).toBeNull()
		setAuthToken('abc123')
		expect(getAuthToken()).toBe('abc123')
		clearAuthToken()
		expect(getAuthToken()).toBeNull()
	})

	it('sends no Authorization header for a guest', () => {
		// An empty object, not `Token null` — the latter makes the backend
		// reject requests that would otherwise be valid guest requests.
		expect(authHeaders()).toEqual({})
		setAuthToken('abc123')
		expect(authHeaders()).toEqual({ Authorization: 'Token abc123' })
	})

	it('notifies subscribers on both writes', () => {
		const listener = vi.fn()
		const unsubscribe = subscribeToAuthToken(listener)

		setAuthToken('abc123')
		expect(listener).toHaveBeenCalledTimes(1)

		clearAuthToken()
		expect(listener).toHaveBeenCalledTimes(2)

		unsubscribe()
		setAuthToken('def456')
		expect(listener).toHaveBeenCalledTimes(2)
	})

	it('notifies when another tab changes the token', () => {
		const listener = vi.fn()
		subscribeToAuthToken(listener)

		// A `storage` event is what the browser delivers to the OTHER tabs. Its
		// absence is why signing out in one tab used to leave every other tab
		// showing a signed-in navbar that could no longer save.
		window.dispatchEvent(new StorageEvent('storage', { key: 'authToken' }))
		expect(listener).toHaveBeenCalledTimes(1)

		// localStorage.clear() reports a null key, and must count too.
		window.dispatchEvent(new StorageEvent('storage', { key: null }))
		expect(listener).toHaveBeenCalledTimes(2)

		// An unrelated key must not wake anything up.
		window.dispatchEvent(new StorageEvent('storage', { key: 'uma-planner-theme' }))
		expect(listener).toHaveBeenCalledTimes(2)
	})
})
