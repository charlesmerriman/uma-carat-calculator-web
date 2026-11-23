// @vitest-environment node
//
// The per-page ad classes have two writers that must agree: the inline script at
// the top of <body> in index.html (first load, before the ad script places
// anything) and services/adPageClass.ts (client-side navigation, from App.tsx).
// The class names are also on file with Raptive, whose per-page layouts target
// them. This is the drift guard for all three.
import { describe, expect, it } from "vitest"
import html from "../../index.html?raw"
import { AD_PAGE_CLASSES, adPageClassFor } from "../services/adPageClass"

const bodyScript =
	[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
		.map((match) => match[1])
		.find((body) => body.includes("ad-page-")) ?? ""

/** Runs the inline script at a pathname with a fake body; returns the classes added. */
function run(pathname: string): string[] {
	const added: string[] = []
	const runScript = new Function("location", "document", bodyScript)
	runScript({ pathname }, { body: { classList: { add: (name: string) => added.push(name) } } })
	return added
}

const PATHS = ["/", "/app/pvp", "/app/pvp/", "/app", "/app/timeline", "/faq", "/app/pvpx", "/constructor"]

describe("the per-page ad classes", () => {
	it("are the names Raptive has on file", () => {
		expect(AD_PAGE_CLASSES).toEqual({ "/": "ad-page-home", "/app/pvp": "ad-page-pvp" })
	})

	it("has its first-load script in <body>, before the app root", () => {
		expect(bodyScript).not.toBe("")
		expect(html.indexOf(bodyScript)).toBeGreaterThan(html.indexOf("<body"))
		expect(html.indexOf(bodyScript)).toBeLessThan(html.indexOf('<div id="root">'))
	})

	it("gives each page the same class from the inline script and the module", () => {
		for (const path of PATHS) {
			const expected = adPageClassFor(path)
			expect(run(path), path).toEqual(expected ? [expected] : [])
		}
	})

	it("ignores a trailing slash and leaves other pages alone", () => {
		expect(adPageClassFor("/app/pvp/")).toBe("ad-page-pvp")
		expect(adPageClassFor("/")).toBe("ad-page-home")
		expect(adPageClassFor("/app")).toBeUndefined()
		// An inherited property name is not a page.
		expect(adPageClassFor("/constructor")).toBeUndefined()
	})
})
