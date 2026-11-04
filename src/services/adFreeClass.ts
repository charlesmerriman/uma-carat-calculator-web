/**
 * The ad-free body class for supporters and staff.
 *
 * Raptive's ad layout can be configured to load no ads when a body class is
 * present (their "ad-free membership" setup), and that is the whole mechanism:
 * the site adds ONE class to <body> for accounts the API says are ad-free
 * (`ad_free` on GET /account: any paid tier, or staff) and Raptive's side is
 * told the class name once, by support ticket. Nothing here touches the ad
 * script. Rename the class and the ads come back for every supporter until
 * Raptive is told again, so the name is pinned by a test.
 *
 * WHY A STORED HINT AS WELL
 *
 * The ad script starts from <head> on every page load, while the account is a
 * round trip away, and a class that arrives after the first ads are placed is
 * too late for that page view. So the answer is remembered per device
 * (AD_FREE_STORAGE_KEY) and an inline script at the top of <body> in
 * index.html re-adds the class before the ad script can place anything; the
 * keys and class there duplicate these and a test keeps them in step. The hint
 * is only ever a copy of what the server last said: it is written when the
 * account loads and cleared on sign-out, a revoked token or a lapse, so it can
 * never outlive the entitlement by more than one page load. It is a
 * convenience for the first paint, not an entitlement store: the server's
 * answer always overwrites it.
 */

/** The class Raptive's layout is configured to honour. Pinned by a test. */
export const AD_FREE_BODY_CLASS = "ad-free-member"

/** Per-device memory of the last server answer, read before first paint. */
export const AD_FREE_STORAGE_KEY = "uma-planner-ad-free"

/**
 * Put the class on <body> (or take it off) and remember the answer.
 *
 * Safe to call during a build-time render: there is no document there, and
 * nothing to do.
 */
export function applyAdFreeClass(adFree: boolean): void {
	if (typeof document === "undefined") return
	document.body.classList.toggle(AD_FREE_BODY_CLASS, adFree)
	try {
		if (adFree) localStorage.setItem(AD_FREE_STORAGE_KEY, "true")
		else localStorage.removeItem(AD_FREE_STORAGE_KEY)
	} catch {
		// No storage (private mode, blocked site data): the class on this page
		// is still right; only the head start on the next load is lost.
	}
}
