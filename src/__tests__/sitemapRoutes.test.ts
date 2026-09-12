// @vitest-environment node
//
// The prerender list and the sitemap are two hand-maintained lists of the same
// routes. This is what keeps them from drifting: a public route added to one and
// not the other fails here, in CI, rather than being quietly left out of the index
// or served as an empty shell.
import { describe, expect, it } from "vitest"
import xml from "../../public/sitemap.xml?raw"
import { PRERENDER_ROUTES } from "../prerenderRoutes"
import { SITE_ORIGIN } from "../hooks/useDocumentMeta"

describe("public/sitemap.xml", () => {
	it("lists exactly the prerendered routes", () => {
		const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])

		for (const loc of locs) expect(loc.startsWith(SITE_ORIGIN)).toBe(true)
		const paths = locs.map((loc) => loc.slice(SITE_ORIGIN.length) || "/")

		expect([...paths].sort()).toEqual([...PRERENDER_ROUTES].sort())
	})
})
