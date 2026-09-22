// @vitest-environment node
//
// index.html carries the Google Analytics tag with Consent Mode v2 defaults. The
// defaults only take effect if they are pushed BEFORE gtag('config'); set them
// afterwards and GA initialises with cookies on for every visitor, including the
// EEA, and nothing in the browser says so. This is the drift guard for that order
// and for the denied-by-default regions.
import { describe, expect, it } from "vitest"
import html from "../../index.html?raw"

// The inline gtag script is the one that declares dataLayer; the first inline
// <script> is the theme script (themeScript.test.ts owns that one).
const gtagScript =
	[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
		.map((match) => match[1])
		.find((body) => body.includes("window.dataLayer")) ?? ""

// Every storage type Consent Mode v2 knows. Missing one leaves it "granted" for
// EEA visitors, which is the failure this file exists to catch.
const STORAGE_TYPES = ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage"]

// The EEA (27 EU states plus IS, LI, NO), the UK, and Switzerland.
const DENIED_REGIONS = [
	"AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
	"HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
	"SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
]

describe("Consent Mode defaults in index.html", () => {
	it("finds the gtag script", () => {
		expect(gtagScript).toContain("gtag('config'")
	})

	it("sets consent defaults before gtag('config')", () => {
		const firstDefault = gtagScript.indexOf("gtag('consent', 'default'")
		const config = gtagScript.indexOf("gtag('config'")
		expect(firstDefault).toBeGreaterThan(-1)
		expect(firstDefault).toBeLessThan(config)
	})

	it("denies every storage type in the EEA, the UK and Switzerland", () => {
		// The regional block is the one carrying a 'region' key.
		const regional = gtagScript
			.split("gtag('consent', 'default'")
			.find((chunk) => chunk.includes("'region'"))
		expect(regional).toBeDefined()
		for (const type of STORAGE_TYPES) {
			expect(regional).toMatch(new RegExp(`'${type}':\\s*'denied'`))
		}
		for (const region of DENIED_REGIONS) {
			expect(regional).toContain(`'${region}'`)
		}
	})

	it("grants every storage type by default elsewhere", () => {
		const global = gtagScript
			.split("gtag('consent', 'default'")
			.find((chunk) => chunk.includes("'granted'") && !chunk.includes("'region'"))
		expect(global).toBeDefined()
		for (const type of STORAGE_TYPES) {
			expect(global).toMatch(new RegExp(`'${type}':\\s*'granted'`))
		}
	})
})
