import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OAuthCallback } from '../components/auth/OAuthCallback'
import { completeSocialLogin } from '../services/socialAuth'
import { completeAccountLink } from '../services/accountLinking'
import { ApiError } from '../services/userServices'

// Only the consuming calls are stubbed; the peek helpers run for real against
// sessionStorage, because which flow the page picks IS what is under test.
vi.mock('../services/socialAuth', async () => {
  const actual = await vi.importActual<typeof import('../services/socialAuth')>('../services/socialAuth')
  return { ...actual, completeSocialLogin: vi.fn() }
})
vi.mock('../services/accountLinking', async () => {
  const actual = await vi.importActual<typeof import('../services/accountLinking')>('../services/accountLinking')
  return { ...actual, completeAccountLink: vi.fn() }
})

// Footer pulls in contexts this test doesn't need.
vi.mock('../components/footer/Footer', () => ({ Footer: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Stands in for AuthProvider: who is signed in decides whether a parked link
// is honoured at all.
const auth = vi.hoisted(() => ({ isLoggedIn: false, refresh: vi.fn() }))
vi.mock('../services/AuthContext', () => ({ useAccount: () => auth }))

const mockedComplete = vi.mocked(completeSocialLogin)
const mockedLink = vi.mocked(completeAccountLink)

function renderAt(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${query}`]}>
      <OAuthCallback />
    </MemoryRouter>,
  )
}

function parkLink() {
  sessionStorage.setItem(
    'accountLinkState.v1',
    JSON.stringify({ provider: 'patreon', state: 'LINK-ST8', createdAt: Date.now() }),
  )
}

beforeEach(() => {
  mockedComplete.mockReset()
  mockedLink.mockReset()
  mockNavigate.mockReset()
  auth.refresh.mockReset()
  auth.isLoggedIn = false
  sessionStorage.clear()
  sessionStorage.setItem(
    'oauthState.v1',
    JSON.stringify({ provider: 'google', state: 'ST8', createdAt: Date.now() }),
  )
})

describe('OAuthCallback', () => {
  it('exchanges the code and navigates to the app', async () => {
    mockedComplete.mockResolvedValue(undefined)

    renderAt('?code=CODE&state=ST8')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/app', { replace: true })
    })
    expect(mockedComplete).toHaveBeenCalledWith('google', 'CODE', 'ST8')
  })

  it('shows a spinner while the exchange is in flight', () => {
    mockedComplete.mockReturnValue(new Promise(() => {}))

    renderAt('?code=CODE&state=ST8')

    expect(screen.getByText(/signing you in/i)).toBeInTheDocument()
  })

  /**
   * The authorization code is single-use, so a second exchange would fail and
   * show an error to a user who actually signed in fine. StrictMode double-
   * mounts every component in dev, which is exactly this scenario.
   */
  it('only exchanges once when mounted twice (StrictMode guard)', async () => {
    mockedComplete.mockResolvedValue(undefined)

    const { rerender } = renderAt('?code=CODE&state=ST8')
    rerender(
      <MemoryRouter initialEntries={['/auth/callback?code=CODE&state=ST8']}>
        <OAuthCallback />
      </MemoryRouter>,
    )

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    expect(mockedComplete).toHaveBeenCalledTimes(1)
  })

  it('reports a cancelled sign-in without alarming language', async () => {
    renderAt('?error=access_denied')

    expect(await screen.findByRole('alert')).toHaveTextContent(/cancelled/i)
    expect(mockedComplete).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('reports other provider errors', async () => {
    renderAt('?error=server_error')

    expect(await screen.findByRole('alert')).toHaveTextContent(/problem/i)
    expect(mockedComplete).not.toHaveBeenCalled()
  })

  it('reports an incomplete callback URL', async () => {
    renderAt('?code=CODE')

    expect(await screen.findByRole('alert')).toHaveTextContent(/incomplete/i)
    expect(mockedComplete).not.toHaveBeenCalled()
  })

  it('surfaces the service error message on a failed exchange', async () => {
    mockedComplete.mockRejectedValue(new ApiError('This sign-in link is no longer valid. Please try again.'))

    renderAt('?code=CODE&state=ST8')

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer valid/i)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('offers a way back and a guest escape hatch on failure', async () => {
    mockedComplete.mockRejectedValue(new Error('boom'))

    renderAt('?code=CODE&state=ST8')

    await screen.findByRole('alert')
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: /without an account/i })).toHaveAttribute('href', '/app')
  })
})

describe('OAuthCallback finishing an account link', () => {
  it('completes the LINK, re-reads the account and lands on /account', async () => {
    auth.isLoggedIn = true
    parkLink()
    mockedLink.mockResolvedValue({ provider: 'patreon', linked_at: '2026-09-12' })

    renderAt('?code=CODE&state=LINK-ST8')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/account', { replace: true })
    })
    expect(mockedLink).toHaveBeenCalledWith('patreon', 'CODE', 'LINK-ST8')
    expect(auth.refresh).toHaveBeenCalled()
    // The sign-in path must not have run: it would have consumed the sign-in
    // state for nothing and shown a spurious error.
    expect(mockedComplete).not.toHaveBeenCalled()
  })

  it('says it is connecting, not signing in', () => {
    auth.isLoggedIn = true
    parkLink()
    mockedLink.mockReturnValue(new Promise(() => {}))

    renderAt('?code=CODE&state=LINK-ST8')

    expect(screen.getByText(/connecting your account/i)).toBeInTheDocument()
  })

  /**
   * A link can only be started by someone signed in, so a parked link in a tab
   * with no token is stale. Honouring it would POST to an authenticated route
   * as a guest; ignoring it lets the sign-in path reject the mismatch cleanly.
   */
  it('ignores a parked link when nobody is signed in', async () => {
    auth.isLoggedIn = false
    parkLink()
    mockedComplete.mockResolvedValue(undefined)

    renderAt('?code=CODE&state=LINK-ST8')

    await waitFor(() => expect(mockedComplete).toHaveBeenCalled())
    expect(mockedLink).not.toHaveBeenCalled()
  })

  it('surfaces the server conflict message and offers a way back to the account', async () => {
    auth.isLoggedIn = true
    parkLink()
    mockedLink.mockRejectedValue(
      new ApiError('That patreon account is already linked to a different account.'),
    )

    renderAt('?code=CODE&state=LINK-ST8')

    expect(await screen.findByRole('alert')).toHaveTextContent(/already linked to a different account/)
    expect(screen.getByRole('heading', { name: /couldn't connect/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to your account/i })).toHaveAttribute('href', '/account')
    expect(screen.queryByRole('link', { name: /without an account/i })).toBeNull()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
