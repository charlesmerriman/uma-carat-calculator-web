// @vitest-environment node
//
// Unit tests for the preflight's decision rules (dev-preflight-decision.mjs). No real
// processes or ports are involved: each "holder" is a plain object shaped like what
// dev-preflight.mjs reads from /proc, which is the whole point of keeping the rules in a
// module with no side effects.
import { describe, expect, it } from "vitest"
import { decide, isLiveMode, isOwnViteServer, modeOf } from "./dev-preflight-decision.mjs"

const ROOT = "/work/frontend"
const VITE = `${ROOT}/node_modules/.bin/vite`

// The kinds of process that can be holding the port.
const plainVite = (pid = 101) => ({ pid, cwd: ROOT, argv: ["node", VITE, "--port", "5173", "--strictPort"] })
const liveVite = (pid = 202) => ({
	pid,
	cwd: ROOT,
	argv: ["node", VITE, "--mode", "live", "--port", "5173", "--strictPort"],
})
const foreignProc = (pid = 303) => ({ pid, cwd: "/elsewhere", argv: ["python", "-m", "http.server", "5173"] })
// What dev-preflight.mjs substitutes when /proc can't be read (exited, or another user's).
const unreadable = (pid = 404) => ({ pid, cwd: null, argv: [] })

describe("isLiveMode / modeOf", () => {
	it.each([
		[["node", VITE, "--mode", "live"], true],
		[["node", VITE, "--mode=live"], true],
		[["node", VITE, "--mode", "development"], false],
		[["node", VITE, "--port", "5173"], false],
		[["node", VITE, "--mode"], false],
	])("%j -> %s", (argv, expected) => {
		expect(isLiveMode({ pid: 1, cwd: ROOT, argv })).toBe(expected)
	})

	it("names the npm script each server came from", () => {
		expect(modeOf(liveVite())).toBe("npm run dev:live")
		expect(modeOf(plainVite())).toBe("npm run dev")
	})
})

describe("isOwnViteServer", () => {
	it("accepts a Vite running in this checkout", () => {
		expect(isOwnViteServer(plainVite(), ROOT)).toBe(true)
	})

	it("accepts a Vite started elsewhere whose binary lives in this checkout", () => {
		expect(isOwnViteServer({ pid: 1, cwd: "/tmp", argv: ["node", VITE] }, ROOT)).toBe(true)
	})

	it("rejects a non-Vite process in this checkout", () => {
		expect(isOwnViteServer({ pid: 1, cwd: ROOT, argv: ["node", "server.js"] }, ROOT)).toBe(false)
	})

	it("rejects a Vite from a different project", () => {
		const other = { pid: 1, cwd: "/other", argv: ["node", "/other/node_modules/.bin/vite"] }
		expect(isOwnViteServer(other, ROOT)).toBe(false)
	})

	it("rejects a process it could not read", () => {
		expect(isOwnViteServer(unreadable(), ROOT)).toBe(false)
	})
})

describe("decide", () => {
	const run = (holders, opts = {}) => decide({ holders, projectRoot: ROOT, ...opts })

	it("starts when the port is free", () => {
		expect(run([]).action).toBe("start")
	})

	it("reports nothing to stop when dev:stop finds the port free", () => {
		expect(run([], { stopOnly: true }).action).toBe("nothing")
	})

	it.each([false, true])("reclaims a stale non-live server (stopOnly=%s)", (stopOnly) => {
		const stale = plainVite()
		expect(run([stale], { stopOnly })).toMatchObject({ action: "kill", victims: [stale] })
	})

	// The bug this change fixes: every script used to kill the live server as "stale".
	it.each([false, true])("refuses to touch a live server (stopOnly=%s)", (stopOnly) => {
		const live = liveVite()
		expect(run([live], { stopOnly })).toMatchObject({
			action: "refuse",
			reason: "live",
			victims: [],
			blockers: [live],
		})
	})

	it("kills a live server only with DEV_FORCE", () => {
		const live = liveVite()
		expect(run([live], { stopOnly: true, force: true })).toMatchObject({ action: "kill", victims: [live] })
	})

	it("does not half-reclaim: a live server protects stale ones beside it", () => {
		expect(run([plainVite(), liveVite()])).toMatchObject({ action: "refuse", reason: "live", victims: [] })
	})

	it("with DEV_FORCE, kills every server of ours", () => {
		const both = [plainVite(), liveVite()]
		expect(run(both, { force: true }).victims).toEqual(both)
	})

	it.each([
		["a foreign process", [foreignProc()]],
		["a foreign process beside one of ours", [plainVite(), foreignProc()]],
		["an unreadable process", [unreadable()]],
	])("refuses when the port holds %s, and kills nothing", (_label, holders) => {
		expect(run(holders)).toMatchObject({ action: "refuse", reason: "foreign", victims: [] })
	})

	it("never lets DEV_FORCE kill a process it doesn't recognise", () => {
		expect(run([foreignProc()], { force: true, stopOnly: true })).toMatchObject({
			action: "refuse",
			reason: "foreign",
		})
	})
})
