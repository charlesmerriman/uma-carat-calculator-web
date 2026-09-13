/**
 * GET /umas — the uma catalogue as picker options ({ id, name, image }).
 *
 * Public, and separate from /calculator-data on purpose: the avatar picker
 * lives on /account, which is outside CalculatorProvider and never loads that
 * payload, and the largest response the API serves is the wrong thing to
 * fetch for a few hundred tiles. Same raw-Response convention as the other
 * *FetchCalls modules — the caller checks `.ok` and parses.
 */

const API_URL = import.meta.env.VITE_API_URL

export function umasFetch(signal?: AbortSignal): Promise<Response> {
	return fetch(`${API_URL}/umas`, { method: "GET", signal })
}
