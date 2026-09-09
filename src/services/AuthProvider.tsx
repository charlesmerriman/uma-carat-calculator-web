/**
 * Holds the answer to "who is signed in, and what are they entitled to?".
 *
 * WHY A PROVIDER AND NOT A HOOK PER COMPONENT
 *
 * Every consumer would otherwise fetch /account for itself: the navbar, the ad
 * loader, and later every supporter-gated feature — several requests per page
 * for one unchanging answer, each with its own loading state to get wrong. One
 * provider at the root fetches once and shares it.
 *
 * TWO QUESTIONS, TWO LATENCIES — the important idea in this file
 *
 * "Am I signed in?" and "who am I?" are not the same question and must not be
 * answered on the same schedule:
 *
 *   isLoggedIn  is derived from the token being present. Synchronous, correct
 *               on the first render, and exactly what the old localStorage
 *               check meant. The navbar draws the right button with no flicker.
 *
 *   account     requires a round trip. Null until it lands.
 *
 * Collapsing the two — making isLoggedIn wait for /account — would flash
 * "Login" at every returning user on every page load. Going the other way and
 * trusting the token to imply a valid account would show a signed-in shell to
 * someone whose token was revoked. Keeping both is what avoids each.
 *
 * A GUEST COSTS NOTHING. With no token there is no request at all — status goes
 * straight to "anonymous". Most traffic here is anonymous, and it must not pay
 * for a feature aimed at supporters.
 */

import { useCallback, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { AuthContext } from "./AuthContext"
import { accountFetch } from "./accountFetchCalls"
import { clearAuthToken, getAuthToken, subscribeToAuthToken } from "./authToken"
import { userLogout } from "./userServices"
import type { Account, AccountStatus } from "../types/account"

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	// Mirrors the token's presence. State rather than a direct read at render
	// time so that a change — sign-in, sign-out, a 401 elsewhere, another tab —
	// actually re-renders the consumers.
	const [hasToken, setHasToken] = useState<boolean>(() => getAuthToken() !== null)
	const [account, setAccount] = useState<Account | null>(null)
	const [status, setStatus] = useState<AccountStatus>(() =>
		getAuthToken() !== null ? "loading" : "anonymous"
	)
	// Bumped to re-run the fetch effect. A counter rather than calling the
	// fetch directly keeps one code path responsible for the request, so a
	// refresh cannot race the mount load into an inconsistent state.
	const [reloadNonce, setReloadNonce] = useState(0)

	useEffect(() => {
		return subscribeToAuthToken(() => setHasToken(getAuthToken() !== null))
	}, [])

	useEffect(() => {
		if (!hasToken) {
			setAccount(null)
			setStatus("anonymous")
			return
		}

		const controller = new AbortController()
		setStatus("loading")

		const load = async (): Promise<void> => {
			try {
				const response = await accountFetch(controller.signal)

				// The token is present but the server will not accept it —
				// revoked, or from a deleted account. Dropping it here is what
				// makes /account the source of truth rather than localStorage:
				// clearAuthToken notifies, hasToken flips, and this effect
				// re-runs into the anonymous branch. No status write, because
				// that re-run owns it.
				if (response.status === 401) {
					clearAuthToken()
					return
				}

				if (!response.ok) {
					setStatus("error")
					return
				}

				setAccount((await response.json()) as Account)
				setStatus("ready")
			} catch {
				// An abort is a normal unmount, not a failure — writing state
				// here would both warn and overwrite the newer effect's status.
				if (!controller.signal.aborted) setStatus("error")
			}
		}

		void load()
		return () => controller.abort()
	}, [hasToken, reloadNonce])

	const refresh = useCallback((): void => {
		setReloadNonce((nonce) => nonce + 1)
	}, [])

	const signOut = useCallback(async (): Promise<void> => {
		try {
			await userLogout()
		} catch {
			// The server-side token delete failed (offline, or it was already
			// gone). Clearing locally is still right: the user asked to sign
			// out, and refusing to would strand them signed in. The stale row
			// is harmless — a token nobody holds any more.
			console.error("Logout request failed; signing out locally anyway")
		} finally {
			clearAuthToken()
		}
	}, [])

	return (
		<AuthContext.Provider
			value={{
				isLoggedIn: hasToken,
				status,
				account,
				isSupporter: account?.supporter.is_supporter ?? false,
				refresh,
				signOut,
			}}
		>
			{children}
		</AuthContext.Provider>
	)
}
