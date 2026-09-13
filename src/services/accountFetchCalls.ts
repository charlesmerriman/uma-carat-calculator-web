/**
 * API fetch calls for /account: GET (who am I) and DELETE (remove me).
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

/**
 * DELETE /account — remove the signed-in account. 204 on success, 403 for
 * staff (their accounts are managed in the admin), 401 for a guest.
 *
 * Irreversible, and the caller owns the confirmation: the account page makes
 * the person type a phrase before it calls this. After a 204 the token in
 * localStorage refers to nothing — clear it through clearAuthToken() so the
 * rest of the app finds out.
 */
export function accountDelete(): Promise<Response> {
	return fetch(`${API_URL}/account`, {
		method: "DELETE",
		headers: authHeaders(),
	})
}
