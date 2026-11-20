/**
 * The query cache is emptied when someone signs in or out (services/QueryProvider.tsx),
 * because cached answers describe the person who asked. The hydration case, where
 * `isLoggedIn` turns true a moment after a prerendered page loads for the same person,
 * is in hydration.test.tsx ("a stored token").
 */
import { act, render } from "@testing-library/react"
import type { QueryClient } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthProvider } from "../services/AuthProvider"
import { QueryProvider } from "../services/QueryProvider"
import { PrimedQueryClientContext, makeQueryClient } from "../services/queryClient"
import { clearAuthToken, setAuthToken } from "../services/authToken"

const KEY = ["gallery", "mine"]

let client: QueryClient

/** The provider around a client this test owns (the build's way in), holding one answer. */
function mount() {
	client = makeQueryClient()
	client.setQueryData(KEY, { posts: ["yours"] })
	render(
		<AuthProvider>
			<PrimedQueryClientContext.Provider value={client}>
				<QueryProvider>{null}</QueryProvider>
			</PrimedQueryClientContext.Provider>
		</AuthProvider>,
	)
}

describe("QueryProvider", () => {
	beforeEach(() => {
		localStorage.clear()
		// AuthProvider asks for /account when there is a token; leave it unanswered.
		vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("empties the cache when someone signs in", () => {
		mount()
		act(() => setAuthToken("a-new-token"))
		expect(client.getQueryData(KEY)).toBeUndefined()
	})

	it("empties the cache when someone signs out", () => {
		localStorage.setItem("authToken", "a-real-token")
		mount()
		act(() => clearAuthToken())
		expect(client.getQueryData(KEY)).toBeUndefined()
	})

	it("keeps the cache while the same person stays signed in", () => {
		localStorage.setItem("authToken", "a-real-token")
		mount()
		expect(client.getQueryData(KEY)).toEqual({ posts: ["yours"] })
	})
})
