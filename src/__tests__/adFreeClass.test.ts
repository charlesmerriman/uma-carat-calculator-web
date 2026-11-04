// @vitest-environment node
//
// The ad-free body class has two writers that must agree: services/adFreeClass.ts
// (after the account loads) and the inline script at the top of <body> in
// index.html (before the ad script can place anything). The class name is also
// on file with Raptive, whose layout loads no ads while it is present. This is
// the drift guard for all three.
import { describe, expect, it } from "vitest"
import html from "../../index.html?raw"
import { AD_FREE_BODY_CLASS, AD_FREE_STORAGE_KEY } from "../services/adFreeClass"

// The key authToken.ts stores the token under. A literal on purpose: that
// module does not export it, and the inline script needs the same string.
const AUTH_TOKEN_KEY = "authToken"

const bodyScript =
	[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
		.map((match) => match[1])
		.find((body) => body.includes(AD_FREE_STORAGE_KEY)) ?? ""

/** Runs the inline script with a fake storage and body; returns the classes added. */
function run(stored: Record<string, string>): string[] {
	const added: string[] = []
	const runScript = new Function("localStorage", "document", bodyScript)
	runScript(
		{ getItem: (key: string) => stored[key] ?? null },
		{ body: { classList: { add: (name: string) => added.push(name) } } },
	)
	return added
}

describe("the ad-free class", () => {
	it("is the name Raptive has on file", () => {
		expect(AD_FREE_BODY_CLASS).toBe("ad-free-member")
	})

	it("has its head-start script first in <body>, before the app root", () => {
		expect(bodyScript).not.toBe("")
		expect(html.indexOf(bodyScript)).toBeGreaterThan(html.indexOf("<body"))
		expect(html.indexOf(bodyScript)).toBeLessThan(html.indexOf('<div id="root">'))
	})

	it("adds the class only for a remembered ad-free answer with a token present", () => {
		expect(run({ [AD_FREE_STORAGE_KEY]: "true", [AUTH_TOKEN_KEY]: "t" })).toEqual([AD_FREE_BODY_CLASS])
		expect(run({ [AD_FREE_STORAGE_KEY]: "true" })).toEqual([])
		expect(run({ [AUTH_TOKEN_KEY]: "t" })).toEqual([])
		expect(run({})).toEqual([])
	})

	it("survives a page with no storage", () => {
		const runScript = new Function("localStorage", "document", bodyScript)
		expect(() => runScript(undefined, { body: { classList: { add: () => {} } } })).not.toThrow()
	})
})
