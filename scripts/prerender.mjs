#!/usr/bin/env node
/**
 * Writes one static HTML document per public route into dist/.
 *
 * Runs as the last step of `npm run build`, after the client build (dist/) and the
 * server build (dist-ssr/entry-server.js). For every route in PRERENDER_ROUTES it
 * renders the app, injects the markup into the client's index.html and rewrites the
 * head tags for that route, then writes dist/<route>/index.html AND dist/<route>.html
 * (see outputPathsFor for why both). The untouched
 * template is kept as dist/spa.html, which is what App Platform serves for any path
 * that has no document — the catch-all.
 *
 * WHY THIS EXISTS
 *
 * The site was refused by an ad network for "low value content" while carrying several
 * thousand words: every URL served the same empty <div id="root">, and nothing that
 * reads a page without running JavaScript could see a single one of them. Prerendering
 * is the fix at the root — the words are in the HTML — and it makes the per-route
 * titles and link previews real as a side effect.
 *
 * FAILURE IS THE FEATURE
 *
 * Every check here throws, and a throw is a non-zero exit, and a non-zero exit fails
 * CI and the deploy. That is deliberate: a build that "succeeds" by shipping empty
 * shells would put the site straight back where it started, silently.
 *
 * SITE CONTENT
 *
 * The About page, the carat income guide and the FAQ are rows the team edits in the
 * API's admin. Before rendering anything, this fetches GET /site-content from the API
 * the bundle was built against and hands it to every render; each document then
 * embeds the rows it used, so hydration sees the same words. Unreachable means the
 * build fails, by the policy above. PRERENDER_CONTENT=snapshot reads the committed
 * src/content/snapshot.json instead, for CI and for a local build with no API.
 *
 * Usage: node scripts/prerender.mjs
 *   PRERENDER_LAYOUT=dir|flat|both  (default both) — see outputPathsFor in prerender-html.mjs
 *   PRERENDER_CONTENT=api|snapshot  (default api)  — see resolveContentSource
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
	assertContent,
	assertTemplate,
	buildPage,
	normaliseRoute,
	outputPathsFor,
	resolveContentSource,
	stripComments,
} from "./prerender-html.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
const ssrDir = join(root, "dist-ssr")
const entry = join(ssrDir, "entry-server.js")
const layout = process.env.PRERENDER_LAYOUT ?? "both"

function fail(message) {
	console.error(`prerender: ${message}`)
	process.exit(1)
}

if (!existsSync(join(dist, "index.html"))) fail("dist/index.html is missing; run the client build first")
if (!existsSync(entry)) fail("dist-ssr/entry-server.js is missing; run the server build first")

const { render, PRERENDER_ROUTES, SITE_NAME, SITE_ORIGIN, API_URL } = await import(pathToFileURL(entry).href)
const site = { siteName: SITE_NAME, siteOrigin: SITE_ORIGIN }

const content = await loadContent()

async function loadContent() {
	let source
	try {
		source = resolveContentSource(process.env, API_URL)
	} catch (error) {
		fail(error.message)
	}
	let loaded
	let label
	if (source.kind === "snapshot") {
		label = source.path
		try {
			loaded = JSON.parse(readFileSync(join(root, source.path), "utf8"))
		} catch (error) {
			fail(`could not read ${label}: ${error.message}; run npm run content:pull`)
		}
	} else {
		label = source.url
		let response
		try {
			response = await fetch(source.url)
		} catch (error) {
			fail(
				`could not fetch site content from ${label}: ${error.cause?.message ?? error.message}. ` +
					"Is the API up? For a build without it, set PRERENDER_CONTENT=snapshot.",
			)
		}
		if (!response.ok) fail(`site content fetch from ${label} answered ${response.status}`)
		try {
			loaded = await response.json()
		} catch (error) {
			fail(`site content from ${label} is not JSON: ${error.message}`)
		}
	}
	try {
		assertContent(loaded, label)
	} catch (error) {
		fail(error.message)
	}
	console.log(`prerender: site content from ${label} (${loaded.pages.length} pages, ${loaded.faq.length} FAQ categories)`)
	return loaded
}

const template = stripComments(readFileSync(join(dist, "index.html"), "utf8"))
try {
	assertTemplate(template)
} catch (error) {
	fail(error.message)
}

// The shell FIRST: the homepage overwrites dist/index.html below, and the shell must be
// the pristine template, not a prerendered page.
writeFileSync(join(dist, "spa.html"), template)

const written = []
for (const route of PRERENDER_ROUTES) {
	let page
	try {
		page = buildPage(template, route, render(route, content), site)
	} catch (error) {
		fail(`${route}: ${error.message}`)
	}
	for (const relative of outputPathsFor(route, layout)) {
		const target = join(dist, relative)
		mkdirSync(dirname(target), { recursive: true })
		writeFileSync(target, page)
		written.push({ route, relative, bytes: Buffer.byteLength(page) })
	}
}

// Belt and braces: count what landed on disk against what was asked for, and re-read
// every file rather than trusting the string that was handed to writeFileSync.
const routesWritten = new Set(written.map((entry) => entry.route))
if (routesWritten.size !== PRERENDER_ROUTES.length) {
	fail(`wrote ${routesWritten.size} routes, expected ${PRERENDER_ROUTES.length}`)
}
for (const { route, relative } of written) {
	const html = readFileSync(join(dist, relative), "utf8")
	const marker = `data-prerendered="${normaliseRoute(route)}"`
	if (!html.includes(marker)) fail(`${relative}: missing ${marker}`)
	if (!/<title>[^<]+<\/title>/.test(html)) fail(`${relative}: missing <title>`)
}

rmSync(ssrDir, { recursive: true, force: true })

const width = Math.max(...written.map((entry) => entry.relative.length))
console.log(`prerender: ${routesWritten.size} routes → ${written.length} files (layout: ${layout}), plus spa.html`)
for (const { relative, bytes } of written) {
	const title = readFileSync(join(dist, relative), "utf8").match(/<title>([^<]+)<\/title>/)[1]
	console.log(`  ${relative.padEnd(width)}  ${String(bytes).padStart(7)} B  ${title}`)
}
