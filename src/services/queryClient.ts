/**
 * The app's TanStack Query client: the cache for server state that several
 * components read at once and change in place.
 *
 * WHY A LIBRARY HERE AND NOT THE PROVIDER PATTERN THE REST OF THE APP USES.
 * The calculator's data is one payload loaded once (CalculatorProvider). The
 * gallery is the opposite: many small resources (a feed per sort and filter,
 * a post, its comments, your posts) that the feed row, the post panel and the
 * account page all show, and that votes, comments and take-downs change. By
 * hand that meant callbacks threading every change back to the feed, no
 * guard against an old sort's answer landing after a new one, and a fresh
 * fetch on every tab switch. The query cache keys each resource, drops
 * answers to questions no longer asked, and lets one write update every
 * place a post is drawn (services/galleryQueries.ts).
 *
 * Only the gallery uses it so far. Moving other fetches onto it is fine, but
 * is a choice to make per feature, not a rule.
 */

import { createContext } from "react"
import { QueryClient } from "@tanstack/react-query"

/**
 * A client the caller made and filled before the first render, for
 * QueryProvider to use in place of a fresh one. The build-time render
 * (entry-server.ts) puts an Encyclopedia page's payload in it, so the page
 * draws itself instead of a skeleton; the browser (main.tsx) does the same with
 * the copy a prerendered document carries, so hydration sees the same markup.
 * Null everywhere else, which is the normal case.
 */
export const PrimedQueryClientContext = createContext<QueryClient | null>(null)

/**
 * A failed request, with the status the server answered. `message` is the
 * sentence the API wrote for the player when it sent one (refusalText).
 */
export class HttpError extends Error {
	readonly status: number

	constructor(status: number, message: string) {
		super(message)
		this.name = "HttpError"
		this.status = status
	}
}

export function makeQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				// Long enough that switching between the PvP page's tabs reuses
				// what was just loaded; short enough that votes and comments
				// other people made show up when you come back.
				staleTime: 30_000,
				// A feed that reorders itself because the tab regained focus
				// moves rows out from under the reader.
				refetchOnWindowFocus: false,
				// A 4xx is an answer (missing, refused), not a hiccup: trying
				// again gets the same one. Network errors and 5xx get one retry.
				retry: (failures, error) => !(error instanceof HttpError && error.status < 500) && failures < 1,
			},
		},
	})
}
