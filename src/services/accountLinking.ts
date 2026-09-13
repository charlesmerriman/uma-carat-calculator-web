/**
 * Connecting another sign-in provider to the account that is ALREADY signed in.
 *
 * Same OAuth2 round trip as socialAuth.ts, against the /account/link/* routes
 * instead of /auth/*:
 *
 *   1. startAccountLink()    — ask our API for the consent URL (authenticated),
 *                              park the `state`, send the browser to the provider.
 *   2. ...user approves...
 *   3. Provider redirects back to /auth/callback?code=…&state=… — the SAME page
 *      sign-in uses. OAuthCallback asks peekPendingLinkProvider() whether a
 *      link is what it is finishing.
 *   4. completeAccountLink() — verify the state, post the code, get the new row.
 *
 * WHY A SEPARATE sessionStorage KEY, AND WHY THAT IS NOT A DETAIL
 *
 * The server signs a link state with a different salt from a sign-in state and
 * binds it to the user id, so the two can never be confused THERE. This module
 * mirrors that separation on the client: a pending link lives under its own key,
 * so a stale sign-in attempt can never be read as a link (and sent to the
 * linking endpoint) or the other way round. One key with a `mode` flag would be
 * one bad branch away from finishing the wrong flow.
 *
 * Linking never signs anyone in and never creates an account — the token in
 * localStorage stays exactly what it was. It only adds a row to the account.
 */

import { ApiError } from "./userServices"
import { authHeaders } from "./authToken"
import { isSocialProvider, type SocialProvider } from "./socialAuth"
import type { LinkedProvider } from "../types/account"

const API_URL = import.meta.env.VITE_API_URL

/** Deliberately NOT socialAuth's "oauthState.v1" — see the module docblock. */
const LINK_STATE_KEY = "accountLinkState.v1"

/** Matches OAUTH_STATE_MAX_AGE_SECONDS on the backend; a UX guard only. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000

interface PendingLink {
	provider: SocialProvider
	state: string
	createdAt: number
}

interface StartResponse {
	authorize_url: string
	state: string
}

/** Same reasoning as socialAuth.callbackUrl: name our own origin so a link
 *  started under `npm run dev:live` finishes here, not on the deployed site. */
function callbackUrl(): string {
	return `${window.location.origin}/auth/callback`
}

/** The server's `error` string if the body carries one, else `fallback`.
 *  Linking is the one flow whose 4xx messages are written for the user
 *  ("already linked to a different account"), so they are worth surfacing. */
async function serverMessage(response: Response, fallback: string): Promise<string> {
	try {
		const body = (await response.json()) as { error?: unknown }
		return typeof body.error === "string" && body.error ? body.error : fallback
	} catch {
		return fallback
	}
}

const SIGNED_OUT = "You've been signed out. Sign in again, then connect the provider."
const TOO_MANY = "Too many attempts. Please wait a while and try again."
const GENERIC_START = "Connecting is unavailable right now. Please try again later."
const GENERIC_COMPLETE = "Could not connect that account. Please try again."

function parsePendingLink(raw: string | null): PendingLink | null {
	if (!raw) return null
	try {
		const parsed = JSON.parse(raw) as Partial<PendingLink>
		if (
			!isSocialProvider(parsed.provider) ||
			typeof parsed.state !== "string" ||
			typeof parsed.createdAt !== "number" ||
			Date.now() - parsed.createdAt > STATE_MAX_AGE_MS
		) {
			return null
		}
		return parsed as PendingLink
	} catch {
		return null
	}
}

/**
 * Which provider a link is pending for, WITHOUT consuming the entry.
 *
 * OAuthCallback calls this to decide which flow it is finishing. Reading does
 * not spend the state; only completeAccountLink does.
 */
export function peekPendingLinkProvider(): SocialProvider | null {
	try {
		return parsePendingLink(sessionStorage.getItem(LINK_STATE_KEY))?.provider ?? null
	} catch {
		return null
	}
}

/** Read and clear the pending link — single-use, like a sign-in state. */
function takePendingLink(): PendingLink | null {
	let raw: string | null = null
	try {
		raw = sessionStorage.getItem(LINK_STATE_KEY)
		sessionStorage.removeItem(LINK_STATE_KEY)
	} catch {
		return null
	}
	return parsePendingLink(raw)
}

/**
 * Step 1: fetch the consent URL for attaching `provider` and redirect to it.
 * Does not return in the success case — the page navigates away.
 */
export async function startAccountLink(provider: SocialProvider): Promise<void> {
	const response = await fetch(
		`${API_URL}/account/link/${provider}/start?redirect_uri=${encodeURIComponent(callbackUrl())}`,
		{ headers: authHeaders() }
	)

	if (!response.ok) {
		// Each of these is a different thing for the user to DO, so they are
		// told apart rather than collapsed into one line.
		if (response.status === 401) throw new ApiError(SIGNED_OUT)
		if (response.status === 429) throw new ApiError(TOO_MANY)
		if (response.status === 400) {
			throw new ApiError(
				`Connecting from ${window.location.origin} is not approved on this backend.`
			)
		}
		throw new ApiError(GENERIC_START)
	}

	const data = (await response.json()) as StartResponse
	if (!data.authorize_url || !data.state) throw new ApiError(GENERIC_START)

	// Written BEFORE navigating — nothing after assign() runs in this tab.
	try {
		const pending: PendingLink = { provider, state: data.state, createdAt: Date.now() }
		sessionStorage.setItem(LINK_STATE_KEY, JSON.stringify(pending))
	} catch {
		throw new ApiError("Connecting a provider needs browser storage enabled to work.")
	}

	window.location.assign(data.authorize_url)
}

/**
 * Step 4: verify the callback and attach the identity. Resolves to the new
 * linked-provider row (201), or the existing one when the same identity was
 * already attached (200 — completing twice is not an error).
 *
 * The state comparison is the same login-CSRF defence socialAuth has; the
 * server additionally refuses a state minted for a different user.
 */
export async function completeAccountLink(
	provider: string,
	code: string,
	state: string
): Promise<LinkedProvider> {
	const pending = takePendingLink()

	if (
		!pending ||
		!isSocialProvider(provider) ||
		pending.provider !== provider ||
		pending.state !== state ||
		!code
	) {
		throw new ApiError("This connection link is no longer valid. Please try again.")
	}

	const response = await fetch(`${API_URL}/account/link/${provider}/complete`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify({ code, state }),
	})

	if (!response.ok) {
		if (response.status === 401) throw new ApiError(SIGNED_OUT)
		if (response.status === 429) throw new ApiError(TOO_MANY)
		// 409: the identity belongs to another account, or this account already
		// has a login for that provider. Both messages come from the server and
		// tell the user exactly which, so they are passed through.
		if (response.status === 409) throw new ApiError(await serverMessage(response, GENERIC_COMPLETE))
		throw new ApiError(GENERIC_COMPLETE)
	}

	return (await response.json()) as LinkedProvider
}

/**
 * Detach `provider` from the account. Resolves on 204.
 *
 * The server refuses to remove the LAST sign-in method of a password-less
 * account (400, with a message saying so) — there is no email to recover
 * through, so that would be a permanent lockout. The account page disables the
 * button in that case as a courtesy; this is where the rule actually lives.
 */
export async function unlinkProvider(provider: SocialProvider): Promise<void> {
	const response = await fetch(`${API_URL}/account/link/${provider}`, {
		method: "DELETE",
		headers: authHeaders(),
	})

	if (response.ok) return
	if (response.status === 401) throw new ApiError(SIGNED_OUT)
	if (response.status === 404) throw new ApiError("That provider isn't connected to this account.")
	if (response.status === 400) {
		throw new ApiError(
			await serverMessage(response, "That provider can't be disconnected right now.")
		)
	}
	throw new ApiError("Could not disconnect that provider. Please try again.")
}
