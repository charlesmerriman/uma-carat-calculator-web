/**
 * API fetch call for the public feedback form.
 *
 * Write-only and public, like the visit beacon. An auth header is attached only
 * when the visitor happens to be signed in — the endpoint accepts guests, and
 * the API links the submission to an account when it can. The caller does the
 * `.ok` check, matching the convention in changelogFetchCalls.ts.
 */

import type { FeedbackPayload } from "../types/feedback"
import { authHeaders } from "./authToken"

const API_URL = import.meta.env.VITE_API_URL

/** POST /feedback — 201 with an empty body on success. */
export function feedbackSubmit(
	payload: FeedbackPayload,
	signal?: AbortSignal
): Promise<Response> {
	return fetch(`${API_URL}/feedback`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			// Optional by design: a guest posts without one and is stored with
			// no account linkage. authHeaders() yields an empty object for a
			// guest, keeping the header off the request entirely rather than
			// sending "Token null".
			...authHeaders(),
		},
		body: JSON.stringify(payload),
		signal,
	})
}
