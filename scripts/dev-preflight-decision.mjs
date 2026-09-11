/**
 * The decision half of dev-preflight.mjs: given who is holding the port, should we
 * start, kill a stale server first, or refuse?
 *
 * Kept free of side effects -- no `ss`, no /proc, no process.kill -- so every case can
 * be unit tested with plain objects (see dev-preflight.test.mjs). dev-preflight.mjs does
 * the I/O and only acts on what this module decides. This split is often called
 * "functional core, imperative shell": the part with the rules is the part that's easy
 * to test, and the part that touches the real system stays too thin to hide a bug.
 *
 * A "holder" is what dev-preflight.mjs learns about one PID listening on the port:
 *   { pid: number, cwd: string | null, argv: string[] }
 * `cwd: null, argv: []` means the process couldn't be read (already gone, or owned by
 * another user), which is treated like any process we don't recognise.
 *
 * WHY A LIVE SERVER IS PROTECTED
 *
 * `npm run dev:live` is usually a window someone is actively watching, holding a real
 * production sign-in. The preflight used to kill ANY Vite from this checkout and call it
 * "stale", so a single unprompted `npm run dev` -- from a person or an agent -- silently
 * ended that session and cost a real sign-in to get back. A live server is therefore
 * never killed without an explicit DEV_FORCE=1. A non-live one really is almost always a
 * forgotten dev server, and is still reclaimed automatically, as before.
 */

/**
 * Is this one of OUR dev servers?
 *
 * Deliberately strict: it must be a Vite launched from this checkout. We test the
 * resolved binary path as well as the cwd, because npm scripts inherit the package
 * directory as cwd but a process started elsewhere might not.
 */
export function isOwnViteServer(proc, projectRoot) {
	const joined = proc.argv.join(" ")
	const looksLikeVite = /(^|[/\s])vite(\s|$|\.js|\.mjs)/.test(joined)
	const belongsToUs = proc.cwd === projectRoot || joined.includes(projectRoot)
	return looksLikeVite && belongsToUs
}

/** True for a Vite started with `--mode live` (or `--mode=live`), i.e. `npm run dev:live`. */
export function isLiveMode(proc) {
	if (proc.argv.includes("--mode=live")) return true
	const i = proc.argv.indexOf("--mode")
	return i !== -1 && proc.argv[i + 1] === "live"
}

/** "npm run dev:live" or "npm run dev" -- whichever npm script this process came from. */
export function modeOf(proc) {
	return isLiveMode(proc) ? "npm run dev:live" : "npm run dev"
}

/**
 * Decide what the preflight should do.
 *
 * @param {object}  args
 * @param {Array<{pid: number, cwd: string|null, argv: string[]}>} args.holders
 *        every process listening on the port (empty when it's free)
 * @param {string}  args.projectRoot  absolute path of this checkout
 * @param {boolean} [args.stopOnly]   true for `npm run dev:stop`
 * @param {boolean} [args.force]      true when DEV_FORCE=1
 * @returns {{
 *   action: "start" | "nothing" | "kill" | "refuse",
 *   reason?: "foreign" | "live",
 *   victims: Array,   // processes to kill (action "kill" only)
 *   blockers: Array,  // processes that made us refuse (action "refuse" only)
 * }}
 */
export function decide({ holders, projectRoot, stopOnly = false, force = false }) {
	if (holders.length === 0) {
		return { action: stopOnly ? "nothing" : "start", victims: [], blockers: [] }
	}

	// Anything we can't identify blocks the whole operation. Killing our own servers
	// wouldn't free the port while something else still holds it, and DEV_FORCE never
	// extends to processes we don't recognise.
	const foreign = holders.filter((p) => !isOwnViteServer(p, projectRoot))
	if (foreign.length > 0) {
		return { action: "refuse", reason: "foreign", victims: [], blockers: foreign }
	}

	// All ours. A live one protects the port -- including any stale non-live servers
	// alongside it, so we never half-reclaim and then fail on the live one.
	const live = holders.filter(isLiveMode)
	if (live.length > 0 && !force) {
		return { action: "refuse", reason: "live", victims: [], blockers: live }
	}

	return { action: "kill", victims: holders, blockers: [] }
}
