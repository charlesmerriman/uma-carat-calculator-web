/**
 * Puts the query client (services/queryClient.ts) around the routes, and
 * empties it when someone signs in or out.
 *
 * The gallery's cached answers describe the person who asked: `my_vote`,
 * `is_mine`, your own posts. After a sign-in or sign-out they describe
 * somebody else, so every query is reset (cleared, and refetched if on
 * screen) rather than shown stale until it ages out.
 *
 * Inside AuthProvider, which it reads. Renders on the server too, where
 * nothing fetches: effects don't run in renderToString, and a query only
 * fetches from its effect. An Encyclopedia detail page, which renders outside
 * the /app loading gate, gets its payload from a client primed by the caller
 * (PrimedQueryClientContext) instead.
 */

import { useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { PrimedQueryClientContext, makeQueryClient } from "./queryClient"
import { useAccount } from "./AuthContext"
import { getAuthToken } from "./authToken"

export function QueryProvider({ children }: { children: ReactNode }) {
	// One client per App instance, not per module: the prerender renders many
	// routes in one Node process, and a module-level cache would be shared.
	// The build passes a fresh primed client per route for the same reason.
	const primed = useContext(PrimedQueryClientContext)
	const [client] = useState(() => primed ?? makeQueryClient())
	return (
		<QueryClientProvider client={client}>
			<ResetOnSignInChange client={client} />
			{children}
		</QueryClientProvider>
	)
}

/**
 * Compares the TOKEN's presence, read live in the effect, never the rendered
 * `isLoggedIn`. On a prerendered page `isLoggedIn` is the server's false for
 * the hydration render and turns true a moment later for someone signed in.
 * That is the same person: every request reads the live token, so nothing in
 * the cache was asked as anybody else. Resetting there threw away the
 * Encyclopedia page the document was built with, and the page fell back to its
 * skeleton until the refetch answered (hydration.test.tsx, "a stored token").
 * The rendered value is still the dependency, so a real sign-in or sign-out
 * runs the effect.
 */
function ResetOnSignInChange({ client }: { client: QueryClient }) {
	const { isLoggedIn } = useAccount()
	const previous = useRef<boolean | null>(null)
	useEffect(() => {
		const signedIn = getAuthToken() !== null
		if (previous.current === null || previous.current === signedIn) {
			previous.current = signedIn
			return
		}
		previous.current = signedIn
		void client.resetQueries()
	}, [client, isLoggedIn])
	return null
}
