/**
 * Puts the query client (services/queryClient.ts) around the routes, and
 * empties it when someone signs in or out.
 *
 * The gallery's cached answers describe the person who asked: `my_vote`,
 * `is_mine`, your own posts. After a sign-in or sign-out they describe
 * somebody else, so every query is reset (cleared, and refetched if on
 * screen) rather than shown stale until it ages out.
 *
 * Inside AuthProvider, which it reads. Renders on the server too: nothing
 * fetches during a prerender, because every query lives behind the /app
 * loading gate or on a page that is never prerendered.
 */

import { useEffect, useRef, useState, type ReactNode } from "react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { makeQueryClient } from "./queryClient"
import { useAccount } from "./AuthContext"

export function QueryProvider({ children }: { children: ReactNode }) {
	// One client per App instance, not per module: the prerender renders many
	// routes in one Node process, and a module-level cache would be shared.
	const [client] = useState(makeQueryClient)
	return (
		<QueryClientProvider client={client}>
			<ResetOnSignInChange client={client} />
			{children}
		</QueryClientProvider>
	)
}

function ResetOnSignInChange({ client }: { client: QueryClient }) {
	const { isLoggedIn } = useAccount()
	const previous = useRef(isLoggedIn)
	useEffect(() => {
		if (previous.current === isLoggedIn) return
		previous.current = isLoggedIn
		void client.resetQueries()
	}, [client, isLoggedIn])
	return null
}
