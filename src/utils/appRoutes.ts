/**
 * What a segment under /app means, decided in one place.
 *
 * /app/<id> is a shared plan's link (SharedPlanLanding). The router ranks the
 * static tabs (timeline, selectors, legend-races) above the `:publicId`
 * param, so they never reach this check; "timeline" is eight letters and
 * would pass it. Everything else that fails it renders NotFound, exactly like
 * any other /app/* typo.
 *
 * The backend's half is calculatorapi/public_ids.py (the alphabet and length)
 * and visits.SHARED_PLAN_ROUTE (the analytics bucket).
 */

const PUBLIC_ID = /^[A-Za-z0-9]{8}$/

/** Whether `segment` has the shape of a plan's share id. */
export function isPublicId(segment: string | undefined): segment is string {
	return segment !== undefined && PUBLIC_ID.test(segment)
}

/** The in-app path of a shared plan: the landing card. */
export function sharedPlanPath(publicId: string): string {
	return `/app/${publicId}`
}

/**
 * The path of the link the owner copies, /plan/<id>. The API serves it (an
 * ingress rule, backend views/plan_share.py) so Discord and X get a preview
 * of the plan, then sends people on to sharedPlanPath(). An older /app/<id>
 * link still works; it just unfurls as the plain site. The dev server
 * redirects /plan/<id> to /app/<id> itself (vite.config.ts).
 */
export function sharedPlanLinkPath(publicId: string): string {
	return `/plan/${publicId}`
}
