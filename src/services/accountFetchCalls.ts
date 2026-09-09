/**
 * API fetch call for GET /account.
 *
 * Same convention as supportersFetchCalls.ts and changelogFetchCalls.ts: this
 * returns the raw Response and the caller does the `.ok` check and `.json()`.
 * AuthProvider needs to treat a 401 differently from any other failure, so
 * handing it the Response rather than parsed data is what makes that possible.
 */

import { authHeaders } from "./authToken"

const API_URL = import.meta.env.VITE_API_URL

/** GET /account — 401 for a guest, 200 with the account summary otherwise. */
export function accountFetch(signal?: AbortSignal): Promise<Response> {
	return fetch(`${API_URL}/account`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			...authHeaders(),
		},
		signal,
	})
}
