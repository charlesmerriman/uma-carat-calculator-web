/**
 * Auth context and its hook, split from the provider.
 *
 * Same two-file shape as ThemeContext/ThemeProvider. The split is not
 * ceremony: Vite's fast refresh only preserves component state when a module
 * exports components exclusively, so keeping the context object and the hook
 * out of the .tsx file stops every edit to the provider from remounting the app.
 */

import { createContext, useContext } from "react"
import type { Account, AccountStatus } from "../types/account"

export interface AuthContextType {
	/**
	 * Is there a token? SYNCHRONOUS, and true from the very first render.
	 *
	 * This is the direct replacement for the old
	 * `!!localStorage.getItem("authToken")` and answers the same question, so
	 * the navbar draws the right button immediately with no flicker. It says
	 * nothing about whether the token is still VALID — only `status` can, and
	 * only after a round trip.
	 */
	isLoggedIn: boolean
	/** How far the /account lookup has got. See types/account.ts. */
	status: AccountStatus
	/** The account summary, or null until (and unless) it loads. */
	account: Account | null
	/**
	 * Convenience for the common gate. False whenever we do not positively know
	 * otherwise — including while loading and after an error.
	 *
	 * A consumer that must FAIL OPEN on uncertainty (the ad loader) has to check
	 * `status` as well, because "not known to be a supporter" and "known not to
	 * be a supporter" are the same value here and must not be to it.
	 */
	isSupporter: boolean
	/** Re-read /account. For after an action that could change entitlement. */
	refresh: () => void
	/** Sign out: drop the server-side token, then forget it locally. */
	signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAccount = (): AuthContextType => {
	const context = useContext(AuthContext)
	if (context === undefined) throw new Error("useAccount must be used within an AuthProvider")
	return context
}
