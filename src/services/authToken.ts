/**
 * The one module allowed to touch the stored API token.
 *
 * WHY CENTRALISE SOMETHING THIS SMALL
 *
 * Before this file, `localStorage.getItem("authToken")` appeared in five
 * modules and `removeItem` in two more, each deciding independently what the
 * presence of that string meant. Two problems followed from that:
 *
 *  1. The literal key was repeated everywhere, so a typo in any one of them
 *     produced a silently signed-out user rather than a compile error.
 *  2. Nothing could REACT to the token changing. When the calculator dropped a
 *     stale token after a 401, the navbar went on rendering "Logout" because
 *     nobody had told it. Anything caching account state — which is exactly
 *     what AuthProvider does — is wrong from that moment until a page reload.
 *
 * So writes go through here and notify subscribers. That is the whole point of
 * the module; the getters are just what falls out of owning the key.
 *
 * This is deliberately NOT a React hook. Service functions building an
 * Authorization header run outside React entirely, and async callbacks that ask
 * "is there a token right now?" want the live answer rather than whatever was
 * captured when their closure was created. AuthProvider sits on top of this for
 * the React-facing half.
 */

const STORAGE_KEY = "authToken"

type Listener = () => void

const listeners = new Set<Listener>()

function notify(): void {
	for (const listener of listeners) listener()
}

/** The raw token, or null for a guest. Also null where there is no storage at
 *  all — a build-time render — so a stray call there reads as a guest rather
 *  than a crash. */
export function getAuthToken(): string | null {
	if (typeof localStorage === "undefined") return null
	return localStorage.getItem(STORAGE_KEY)
}

/** Store a freshly issued token and tell everyone watching. */
export function setAuthToken(token: string): void {
	localStorage.setItem(STORAGE_KEY, token)
	notify()
}

/**
 * Forget the token — sign-out, or a token the server has stopped accepting.
 *
 * Always use this rather than removing the key directly, or subscribers keep
 * believing the user is signed in.
 */
export function clearAuthToken(): void {
	localStorage.removeItem(STORAGE_KEY)
	notify()
}

/**
 * The Authorization header, or nothing at all for a guest.
 *
 * The empty object matters: sending `Authorization: Token null` makes the
 * backend reject the request outright, where sending no header at all is a
 * valid guest request on every public route.
 */
export function authHeaders(): Record<string, string> {
	const token = getAuthToken()
	return token ? { Authorization: `Token ${token}` } : {}
}

/**
 * Watch for the token being set or cleared. Returns an unsubscribe function.
 *
 * Fires for changes made in THIS tab (via the setters above) and, through the
 * `storage` listener below, for changes made in another one.
 */
export function subscribeToAuthToken(listener: Listener): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

// A `storage` event fires only in the OTHER tabs of the same origin, never in
// the tab that made the change — so this complements notify() rather than
// duplicating it. Without it, signing out in one tab leaves every other tab
// showing a signed-in navbar and quietly failing to save.
//
// `key === null` is what the browser sends for localStorage.clear().
if (typeof window !== "undefined") {
	window.addEventListener("storage", (event: StorageEvent) => {
		if (event.key === null || event.key === STORAGE_KEY) notify()
	})
}
