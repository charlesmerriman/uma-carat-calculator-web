/**
 * Update watch: notices when the deployed site has moved past the bundle this
 * tab is running, so the person can be told to refresh.
 *
 * WHY THIS EXISTS
 *
 * The app is a single-page app, so a tab that is already open never reloads on
 * its own. Someone who opened the planner on Sunday is still running Sunday's
 * JavaScript on Wednesday, talking to Wednesday's API, and nothing tells them
 * a fix went out. That is how "the site is wrong for me" reports kept arriving
 * from builds that were days old.
 *
 * HOW IT WORKS
 *
 * Every build is stamped with an id (vite.config.ts) that is both compiled into
 * the bundle as `__BUILD_ID__` and written next to it as /version.json. This
 * module polls the file and compares. Different means a newer build is live.
 *
 * The poll runs on an interval while the tab is visible and again the moment a
 * hidden tab comes back to the foreground, which is exactly when a stale tab
 * wakes up. The request carries a cache-busting query string: the static site
 * sits behind a CDN that caches by full URL, and a fresh URL goes to origin.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It never reloads the page itself. The planner auto-saves, and a reload forced
 * in the middle of a save could drop a row. It notifies once per tab and leaves
 * the refresh to the person.
 *
 * It never nags on a bad answer. A missing /version.json is served as the SPA
 * catch-all document with a 200, so a response that is not JSON, or JSON without
 * a non-empty `build` string, is ignored rather than treated as a new version.
 */

export const VERSION_PATH = "/version.json"

/** Ten minutes. Each tick is one tiny request to origin per open tab. */
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000

export interface UpdateWatchOptions {
	/** The id this bundle was built with. Defaults to `__BUILD_ID__`. */
	currentBuild?: string
	/** Called once, the first time a different build id is seen. */
	onUpdate: (liveBuild: string) => void
	intervalMs?: number
	/** Injectable for tests. Defaults to the global fetch. */
	fetchImpl?: typeof fetch
}

/**
 * Pull the live build id. Resolves to null for anything that is not a well-formed
 * version file, so a caller can never mistake an outage for an update.
 */
export async function fetchLiveBuildId(fetchImpl: typeof fetch = fetch): Promise<string | null> {
	try {
		const response = await fetchImpl(`${VERSION_PATH}?t=${Date.now()}`, { cache: "no-store" })
		if (!response.ok) return null
		const body: unknown = await response.json()
		if (typeof body !== "object" || body === null) return null
		const build = (body as { build?: unknown }).build
		return typeof build === "string" && build.length > 0 ? build : null
	} catch {
		return null
	}
}

/**
 * Start watching. Returns a stop function for the effect cleanup.
 *
 * Safe to call from a mount effect under StrictMode: the double-invoke starts
 * two watchers and stops the first, and neither fires a check synchronously.
 */
export function startUpdateWatch(options: UpdateWatchOptions): () => void {
	const {
		currentBuild = __BUILD_ID__,
		onUpdate,
		intervalMs = DEFAULT_INTERVAL_MS,
		fetchImpl = fetch,
	} = options

	let notified = false
	let stopped = false
	let inFlight = false

	const check = async () => {
		// One request at a time: a visibility change landing on top of a slow tick
		// should not double up, and a stopped watcher must not report late.
		if (notified || stopped || inFlight) return
		inFlight = true
		const liveBuild = await fetchLiveBuildId(fetchImpl)
		inFlight = false
		if (stopped || liveBuild === null || liveBuild === currentBuild) return
		notified = true
		onUpdate(liveBuild)
	}

	const onTick = () => {
		// A background tab can wait: it will be checked the moment it is shown
		// again, and polling from hidden tabs is wasted requests.
		if (document.visibilityState === "hidden") return
		void check()
	}
	const onVisibilityChange = () => {
		if (document.visibilityState === "visible") void check()
	}

	const timer = setInterval(onTick, intervalMs)
	document.addEventListener("visibilitychange", onVisibilityChange)

	return () => {
		stopped = true
		clearInterval(timer)
		document.removeEventListener("visibilitychange", onVisibilityChange)
	}
}
