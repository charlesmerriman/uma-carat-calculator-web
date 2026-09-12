// @vitest-environment node
//
// Unit tests for the string half of prerendering (prerender-html.mjs). No dist/, no
// render: every case is a template string in and a document string out, which is the
// whole reason the rules live in a module with no file system in it.
import { describe, expect, it } from "vitest"
import {
	assertTemplate,
	buildPage,
	escapeHtml,
	injectRoot,
	normaliseRoute,
	outputPathsFor,
	rewriteHeadTags,
	stripComments,
	validateRendered,
} from "./prerender-html.mjs"

const SITE = { siteName: "Site", siteOrigin: "https://example.test" }

/** The shape of dist/index.html, reduced to the tags the prerender touches. */
const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <!-- a comment -->
    <meta charset="UTF-8" />
    <title>Site</title>
    <meta name="description" content="Default description." />
    <meta property="og:title" content="Site" />
    <meta property="og:description" content="Default description." />
    <meta property="og:url" content="https://example.test/" />
    <meta name="twitter:title" content="Site" />
    <meta name="twitter:description" content="Default description." />
    <script type="module" crossorigin src="/assets/index-abc123.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const meta = (overrides = {}) => ({
	title: "About | Site",
	description: 'What it is & who makes it — "unofficial".',
	canonical: "https://example.test/about",
	noindex: false,
	...overrides,
})

const rendered = (overrides = {}) => ({
	html: "<div><nav>nav</nav><main>What it does</main><footer>foot</footer></div>",
	meta: meta(),
	...overrides,
})

describe("escapeHtml / normaliseRoute", () => {
	it("escapes the five characters that matter in attributes and text", () => {
		expect(escapeHtml(`a & b < c > "d" 'e'`)).toBe("a &amp; b &lt; c &gt; &quot;d&quot; &#39;e&#39;")
	})

	it.each([
		["/", "/"],
		["/about", "/about"],
		["/about/", "/about"],
		["/app/timeline//", "/app/timeline"],
	])("normalises %s to %s", (input, expected) => {
		expect(normaliseRoute(input)).toBe(expected)
	})
})

describe("stripComments", () => {
	it("removes comments and the line break after them", () => {
		expect(stripComments("a\n<!-- gone\nmulti -->\nb")).toBe("a\nb")
	})
})

describe("assertTemplate", () => {
	it("accepts the reference template", () => {
		expect(() => assertTemplate(TEMPLATE)).not.toThrow()
	})

	it.each([
		["a missing root", TEMPLATE.replace('<div id="root"></div>', ""), /exactly one <div id="root">/],
		["a non-empty root", TEMPLATE.replace('<div id="root"></div>', '<div id="root">x</div>'), /exactly one <div id="root">/],
		["two titles", TEMPLATE.replace("<title>Site</title>", "<title>Site</title><title>Again</title>"), /exactly one <title>/],
		["a missing social tag", TEMPLATE.replace(/<meta property="og:url"[^>]*>/, ""), /og:url/],
		["a pre-existing canonical", TEMPLATE.replace("</head>", '<link rel="canonical" href="x" /></head>'), /canonical/],
	])("rejects %s", (_label, template, message) => {
		expect(() => assertTemplate(template)).toThrow(message)
	})
})

describe("injectRoot", () => {
	it("places the markup inside #root and marks the route it was built for", () => {
		const out = injectRoot(TEMPLATE, "/about/", "<p>hi</p>")
		expect(out).toContain('<div id="root" data-prerendered="/about"><p>hi</p></div>')
		expect(out).not.toContain('<div id="root"></div>')
	})

	it("does not interpret $ sequences in the rendered markup", () => {
		expect(injectRoot(TEMPLATE, "/", "<p>$& $1 $$</p>")).toContain("<p>$& $1 $$</p>")
	})
})

describe("rewriteHeadTags", () => {
	const out = rewriteHeadTags(TEMPLATE, meta())

	it("rewrites the title on every tag that carries one", () => {
		expect(out).toContain("<title>About | Site</title>")
		expect(out).toContain('<meta property="og:title" content="About | Site" />')
		expect(out).toContain('<meta name="twitter:title" content="About | Site" />')
	})

	it("rewrites the description, escaped for an attribute", () => {
		const escaped = "What it is &amp; who makes it — &quot;unofficial&quot;."
		expect(out).toContain(`<meta name="description" content="${escaped}" />`)
		expect(out).toContain(`<meta property="og:description" content="${escaped}" />`)
		expect(out).toContain(`<meta name="twitter:description" content="${escaped}" />`)
	})

	it("points og:url and a new canonical link at the route", () => {
		expect(out).toContain('<meta property="og:url" content="https://example.test/about" />')
		expect(out).toContain('<link rel="canonical" href="https://example.test/about" />')
		expect(out.match(/rel="canonical"/g)).toHaveLength(1)
	})

	it("never writes a robots tag", () => {
		expect(out).not.toContain('name="robots"')
	})
})

describe("outputPathsFor", () => {
	it.each([
		["/", "dir", ["index.html"]],
		["/", "flat", ["index.html"]],
		["/about", "dir", ["about/index.html"]],
		["/about/", "dir", ["about/index.html"]],
		["/about", "flat", ["about.html"]],
		["/app/timeline", "both", ["app/timeline/index.html", "app/timeline.html"]],
	])("%s in %s layout → %j", (route, layout, expected) => {
		expect(outputPathsFor(route, layout)).toEqual(expected)
	})

	it("rejects an unknown layout", () => {
		expect(() => outputPathsFor("/about", "nested")).toThrow(/PRERENDER_LAYOUT/)
	})
})

describe("validateRendered", () => {
	it("passes a complete render", () => {
		expect(() => validateRendered("/about", rendered(), SITE)).not.toThrow()
	})

	it("allows the homepage to use the bare site name", () => {
		const home = rendered({ meta: meta({ title: "Site", canonical: "https://example.test/" }) })
		expect(() => validateRendered("/", home, SITE)).not.toThrow()
	})

	it.each([
		["an empty render", rendered({ html: "  " }), /rendered nothing/],
		["a render without a footer", rendered({ html: "<main>only</main>" }), /footer/],
		["a missing title", rendered({ meta: meta({ title: "" }) }), /no title/],
		["the bare site name off the homepage", rendered({ meta: meta({ title: "Site" }) }), /bare site name/],
		["a canonical for another route", rendered({ meta: meta({ canonical: "https://example.test/faq" }) }), /canonical/],
		["a noindex page", rendered({ meta: meta({ noindex: true }) }), /noindex/],
	])("rejects %s", (_label, input, message) => {
		expect(() => validateRendered("/about", input, SITE)).toThrow(message)
	})
})

describe("buildPage", () => {
	it("produces a document with the markup and the route's head in one pass", () => {
		const page = buildPage(TEMPLATE, "/about", rendered(), SITE)
		expect(page).toContain('data-prerendered="/about"')
		expect(page).toContain("<main>What it does</main>")
		expect(page).toContain("<title>About | Site</title>")
		expect(page).toContain('href="https://example.test/about"')
		// The bundle reference from the client build survives untouched.
		expect(page).toContain('src="/assets/index-abc123.js"')
	})
})
