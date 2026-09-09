import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  startSocialLogin,
  completeSocialLogin,
  isSocialProvider,
} from '../services/socialAuth'

const STATE_KEY = 'oauthState.v1'

/** Build a Response-like object matching what the service consumes. */
function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as unknown as Response
}

/** Stand in for window.location.assign, which jsdom won't navigate. */
let assignMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  assignMock = vi.fn()
  vi.stubGlobal('fetch', vi.fn())
  // location is read-only in jsdom; replace just the method we call.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, origin: 'http://localhost:5173', assign: assignMock },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function readPending(): { provider?: string; state?: string; createdAt?: number } | null {
  const raw = sessionStorage.getItem(STATE_KEY)
  return raw ? JSON.parse(raw) : null
}

describe('isSocialProvider', () => {
  it('accepts only the supported providers', () => {
    expect(isSocialProvider('google')).toBe(true)
    expect(isSocialProvider('discord')).toBe(true)
    expect(isSocialProvider('patreon')).toBe(true)
    expect(isSocialProvider('facebook')).toBe(false)
    expect(isSocialProvider(null)).toBe(false)
  })
})

describe('startSocialLogin', () => {
  it('saves the state and redirects to the provider', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ authorize_url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1', state: 'ST8' }),
    )

    await startSocialLogin('google')

    expect(readPending()?.state).toBe('ST8')
    expect(readPending()?.provider).toBe('google')
    expect(assignMock).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1')
  })

  /**
   * Under `npm run dev:live` the backend is the DEPLOYED one, whose own default
   * redirect is the deployed site. Without this parameter a login started on
   * localhost finishes on production and never returns a token here.
   */
  it('asks the backend to return the browser to this origin', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ authorize_url: 'https://accounts.google.com/x', state: 'ST8' }),
    )

    await startSocialLogin('google')

    const requested = String(vi.mocked(fetch).mock.calls[0][0])
    expect(requested).toContain(
      `redirect_uri=${encodeURIComponent('http://localhost:5173/auth/callback')}`,
    )
  })

  it('explains a 400 as this origin not being approved', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 400))

    await expect(startSocialLogin('google')).rejects.toThrow(/not approved/i)
    expect(assignMock).not.toHaveBeenCalled()
  })

  it('still reports non-400 failures as a generic outage', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 503))

    await expect(startSocialLogin('google')).rejects.toThrow(/unavailable right now/i)
  })

  it('does not redirect when the API call fails', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false, 503))

    await expect(startSocialLogin('google')).rejects.toThrow()
    expect(assignMock).not.toHaveBeenCalled()
    expect(readPending()).toBeNull()
  })

  it('does not redirect when the response is missing a state', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ authorize_url: 'https://x.test' }))

    await expect(startSocialLogin('google')).rejects.toThrow()
    expect(assignMock).not.toHaveBeenCalled()
  })
})

describe('completeSocialLogin', () => {
  /** Put a valid pending login in place, as startSocialLogin would have. */
  function seedPending(provider = 'google', state = 'ST8', createdAt = Date.now()) {
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ provider, state, createdAt }))
  }

  it('stores the token returned by the API', async () => {
    seedPending()
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ token: 'abc123' }))

    await completeSocialLogin('google', 'CODE', 'ST8')

    expect(localStorage.getItem('authToken')).toBe('abc123')
  })

  it('clears the pending state so a code cannot be replayed', async () => {
    seedPending()
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ token: 'abc123' }))

    await completeSocialLogin('google', 'CODE', 'ST8')
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull()

    // A second attempt with the same values now has nothing to match against.
    await expect(completeSocialLogin('google', 'CODE', 'ST8')).rejects.toThrow()
  })

  it('rejects a state that does not match the saved one (login CSRF)', async () => {
    seedPending('google', 'REAL-STATE')

    await expect(completeSocialLogin('google', 'CODE', 'ATTACKER-STATE')).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
    expect(localStorage.getItem('authToken')).toBeNull()
  })

  it('rejects when no login was started in this tab', async () => {
    await expect(completeSocialLogin('google', 'CODE', 'ST8')).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects when the provider does not match the one the login started with', async () => {
    seedPending('google', 'ST8')

    await expect(completeSocialLogin('discord', 'CODE', 'ST8')).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an expired pending login', async () => {
    seedPending('google', 'ST8', Date.now() - 11 * 60 * 1000)

    await expect(completeSocialLogin('google', 'CODE', 'ST8')).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('stores no token when the API rejects the exchange', async () => {
    seedPending()
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'nope' }, false, 400))

    await expect(completeSocialLogin('google', 'CODE', 'ST8')).rejects.toThrow()
    expect(localStorage.getItem('authToken')).toBeNull()
  })

  it('stores no token when the API responds without one', async () => {
    seedPending()
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}))

    await expect(completeSocialLogin('google', 'CODE', 'ST8')).rejects.toThrow()
    expect(localStorage.getItem('authToken')).toBeNull()
  })
})
