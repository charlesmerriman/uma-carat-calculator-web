/**
 * API fetch call for the admin-editable pages and FAQ.
 *
 * Public reference data, like the changelog: no auth header. The caller does
 * the `.ok` check and `.json()` parse, matching calculatorFetchCalls.ts.
 */

const API_URL = import.meta.env.VITE_API_URL

/** GET /site-content: every page and the whole FAQ, in one response. */
export function siteContentFetch(signal?: AbortSignal): Promise<Response> {
	return fetch(`${API_URL}/site-content`, {
		method: "GET",
		headers: { "Content-Type": "application/json" },
		signal,
	})
}
