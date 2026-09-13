/**
 * Google / Discord / Patreon sign-in.
 *
 * The OAuth2 authorization-code flow, from this side:
 *
 *   1. startSocialLogin()   — ask our API for the provider's consent URL,
 *                             remember the `state` it minted, send the browser
 *                             to the provider.
 *   2. ...user approves on accounts.google.com / discord.com / patreon.com...
 *   3. Provider redirects back to /auth/callback?code=…&state=…
 *   4. completeSocialLogin() — check the returned state matches what we saved,
 *                              hand the code to our API, store the token.
 *
 * The `code` in step 3 travels through the browser, which is safe: it is
 * single-use, expires in seconds, and cannot be redeemed without the client
 * secret, which only ever exists on the Django side.
 */

import { ApiError } from "./userServices"
import { setAuthToken } from "./authToken"

const API_URL = import.meta.env.VITE_API_URL

export const SOCIAL_PROVIDERS = ["google", "discord", "patreon"] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

/**
 * Where the pending login's `state` is parked while the browser is away at the
 * provider. sessionStorage (not localStorage) so it is tab-scoped and cleared
 * when the tab closes — and, unlike a cookie, it survives the cross-origin
 * round trip without needing SameSite=None, which plain http://localhost in
 * dev can't do.
 */
const STATE_KEY = "oauthState.v1"

/** Matches OAUTH_STATE_MAX_AGE_SECONDS on the backend. Purely a UX guard —
 *  the backend's signed timestamp is the real enforcement. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000

interface PendingLogin {
	provider: SocialProvider
	state: string
	createdAt: number
}

interface StartResponse {
	authorize_url: string
	state: string
}

/**
 * Where the provider should send the browser back to.
 *
 * Sent explicitly instead of letting the backend fall back to its own default,
 * because under `npm run dev:live` this dev server talks to a DEPLOYED backend
 * whose default is the deployed site — so a login started on localhost would
 * finish over there, and you could never be signed in while looking at real
 * content. Naming our own origin fixes that.
 *
 * This is a REQUEST, not an instruction: the backend checks it against a
 * server-side allowlist and refuses anything unlisted, so a page cannot steer
 * a login (or an authorization code) to an address of its choosing.
 */
function callbackUrl(): string {
	return `${window.location.origin}/auth/callback`
}

export function isSocialProvider(value: unknown): value is SocialProvider {
	return (
		typeof value === "string" &&
		(SOCIAL_PROVIDERS as readonly string[]).includes(value)
	)
}

/** A stored pending login, or null if it is missing, malformed or stale. */
function parsePendingLogin(raw: string | null): PendingLogin | null {
	if (!raw) return null
	try {
		const parsed = JSON.parse(raw) as Partial<PendingLogin>
		if (
			!isSocialProvider(parsed.provider) ||
			typeof parsed.state !== "string" ||
			typeof parsed.createdAt !== "number" ||
			Date.now() - parsed.createdAt > STATE_MAX_AGE_MS
		) {
			return null
		}
		return parsed as PendingLogin
	} catch {
		return null
	}
}

/**
 * Which provider a sign-in is pending for, WITHOUT consuming the entry.
 *
 * /auth/callback is shared between sign-in and account linking (see
 * accountLinking.ts), so the page has to know which flow it is finishing
 * before it calls the consuming function for that flow. Reading here does not
 * spend the state; only completeSocialLogin does.
 */
export function peekPendingLoginProvider(): SocialProvider | null {
	try {
		return parsePendingLogin(sessionStorage.getItem(STATE_KEY))?.provider ?? null
	} catch {
		return null
	}
}

/**
 * Reads and validates the pending login, clearing it either way.
 *
 * Single-use by design: a `state` must never be accepted twice, so it is
 * removed the moment it's read, before any validation can fail and return
 * early. Wrapped in try/catch because sessionStorage throws in some
 * private-browsing modes.
 */
function takePendingLogin(): PendingLogin | null {
	let raw: string | null = null
	try {
		raw = sessionStorage.getItem(STATE_KEY)
		sessionStorage.removeItem(STATE_KEY)
	} catch {
		return null
	}
	return parsePendingLogin(raw)
}

/**
 * Step 1: fetch the provider's consent URL and redirect the browser to it.
 * Does not return in the success case — the page navigates away.
 */
export async function startSocialLogin(provider: SocialProvider): Promise<void> {
	const response = await fetch(
		`${API_URL}/auth/${provider}/start?redirect_uri=${encodeURIComponent(callbackUrl())}`
	)

	if (!response.ok) {
		// 400 is specifically "this origin isn't on that backend's allowlist".
		// In practice that means dev:live against a deployment that hasn't set
		// OAUTH_EXTRA_REDIRECT_URIS — worth naming, because the generic message
		// sends you looking for an outage that isn't happening.
		throw new ApiError(
			response.status === 400
				? `Sign in from ${window.location.origin} is not approved on this backend.`
				: "Sign in is unavailable right now. Please try again later."
		)
	}

	const data = (await response.json()) as StartResponse
	if (!data.authorize_url || !data.state) {
		throw new ApiError("Sign in is unavailable right now. Please try again later.")
	}

	// Must be written BEFORE navigating — once assign() runs, no further code
	// in this tab executes.
	try {
		const pending: PendingLogin = {
			provider,
			state: data.state,
			createdAt: Date.now()
		}
		sessionStorage.setItem(STATE_KEY, JSON.stringify(pending))
	} catch {
		// Private browsing with storage disabled. Without the saved state we
		// can't verify the callback, so fail here rather than send the user on
		// a round trip that is guaranteed to be rejected on return.
		throw new ApiError("Sign in needs browser storage enabled to work.")
	}

	window.location.assign(data.authorize_url)
}

/**
 * Step 4: verify the callback and trade the code for an API token.
 *
 * The state comparison is what stops login CSRF — an attacker can craft a
 * callback URL but cannot write to this tab's sessionStorage, so a forged
 * callback has nothing to match against.
 */
export async function completeSocialLogin(
	provider: string,
	code: string,
	state: string
): Promise<void> {
	const pending = takePendingLogin()

	if (
		!pending ||
		!isSocialProvider(provider) ||
		pending.provider !== provider ||
		pending.state !== state ||
		!code
	) {
		throw new ApiError("This sign-in link is no longer valid. Please try again.")
	}

	const response = await fetch(`${API_URL}/auth/social`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ provider, code, state })
	})

	if (!response.ok) {
		throw new ApiError("Could not complete sign in. Please try again.")
	}

	const data = (await response.json()) as { token?: string }
	if (!data.token) {
		throw new ApiError("Could not complete sign in. Please try again.")
	}

	// Goes through the token module so AuthProvider notices the sign-in and
	// fetches the account, rather than waiting for the next page load.
	setAuthToken(data.token)
}
