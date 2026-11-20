#!/usr/bin/env node
/**
 * Writes one static HTML document per public route into dist/, and one per
 * Encyclopedia uma, card and skill page with a sitemap of them (see
 * prerenderEncyclopedia at the end).
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
 * The About page and the FAQ are rows the team edits in the
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
	PAGE_DATA_ELEMENT_ID,
	assertContent,
	assertTemplate,
	buildDetailPage,
	buildPage,
	buildSitemap,
	encyclopediaJobs,
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

const ssr = await import(pathToFileURL(entry).href)
const { render, PRERENDER_ROUTES, SITE_NAME, SITE_ORIGIN, API_URL } = ssr
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

const width = Math.max(...written.map((entry) => entry.relative.length))
console.log(`prerender: ${routesWritten.size} routes → ${written.length} files (layout: ${layout}), plus spa.html`)
for (const { relative, bytes } of written) {
	const title = readFileSync(join(dist, relative), "utf8").match(/<title>([^<]+)<\/title>/)[1]
	console.log(`  ${relative.padEnd(width)}  ${String(bytes).padStart(7)} B  ${title}`)
}

await prerenderEncyclopedia()

rmSync(ssrDir, { recursive: true, force: true })

// ── The Encyclopedia's detail pages ─────────────────────────────────────────
//
// notes/encyclopedia-open-plan.md, PR 4. One document per uma, card and skill
// page the API's index lists, each rendered from its own payload, and
// dist/sitemap-encyclopedia.xml listing exactly the documents written.
//
// LAYOUT: "dir" only (<route>/index.html). Checked on the live site on
// 2026-11-20: /index and /app/index (whose files exist only as index.html and
// app/index.html) got the spa.html shell, so App Platform never appends ".html"
// to a bare path; /privacy-policy is served from privacy-policy/index.html.
// Writing both, as the fixed routes do, would double about 3,000 files for a
// copy the host never serves.
//
// LOAD ON THE API: two requests at a time, so the live server (four threads)
// keeps two for players. Each page is a few ms of work. A failed request is
// tried three more times; after that the build fails and the old site stays up
// (FAILURE IS THE FEATURE). Not at the 15:00 UTC daily peak (/push-live).
//
// PRERENDER_CONTENT=snapshot renders the committed sample instead
// (src/content/encyclopedia-sample.json, one page of each kind).
async function prerenderEncyclopedia() {
	const started = Date.now()
	const { encyclopediaHref, encyclopediaApiPath, ENCYCLOPEDIA_INDEX_PATH } = ssr
	const snapshot = (process.env.PRERENDER_CONTENT ?? "api") === "snapshot"
	const base = API_URL?.replace(/\/+$/, "")

	let jobs
	let sample = null
	if (snapshot) {
		const path = "src/content/encyclopedia-sample.json"
		try {
			sample = JSON.parse(readFileSync(join(root, path), "utf8"))
		} catch (error) {
			fail(`could not read ${path}: ${error.message}; run npm run content:pull`)
		}
		const index = { umas: [sample.uma.game_id], cards: [sample.card.game_id], skills: [sample.skill.game_id] }
		jobs = encyclopediaJobs(index, { href: encyclopediaHref, apiPath: encyclopediaApiPath })
	} else {
		const index = await fetchJson(`${base}${ENCYCLOPEDIA_INDEX_PATH}`)
		try {
			jobs = encyclopediaJobs(index, { href: encyclopediaHref, apiPath: encyclopediaApiPath })
		} catch (error) {
			fail(error.message)
		}
	}
	console.log(`prerender: ${jobs.length} encyclopedia pages from ${snapshot ? "the committed sample" : `${base}${ENCYCLOPEDIA_INDEX_PATH}`}`)

	const pages = []
	const queue = [...jobs]
	async function worker() {
		for (let job = queue.shift(); job; job = queue.shift()) {
			const data = sample ? sample[job.kind] : await fetchJson(`${base}${job.apiPath}`)
			let html
			try {
				html = buildDetailPage(template, job.route, render(job.route, content, data), data, site)
			} catch (error) {
				fail(`${job.route}: ${error.message}`)
			}
			const [relative] = outputPathsFor(job.route, "dir")
			const target = join(dist, relative)
			mkdirSync(dirname(target), { recursive: true })
			writeFileSync(target, html)
			pages.push({ ...job, relative, bytes: Buffer.byteLength(html) })
		}
	}
	await Promise.all([worker(), worker()])

	// The same belt and braces as the fixed routes: every job landed, and each
	// file on disk is the document built for its own path.
	if (pages.length !== jobs.length) fail(`wrote ${pages.length} encyclopedia pages, expected ${jobs.length}`)
	for (const { route, relative } of pages) {
		const html = readFileSync(join(dist, relative), "utf8")
		if (!html.includes(`data-prerendered="${normaliseRoute(route)}"`)) fail(`${relative}: missing its marker`)
		if (!html.includes(`id="${PAGE_DATA_ELEMENT_ID}"`)) fail(`${relative}: missing its page data`)
	}

	// In the index's order (the workers finish out of order), so the file diffs cleanly.
	const order = new Map(jobs.map((job, at) => [job.route, at]))
	pages.sort((a, b) => order.get(a.route) - order.get(b.route))
	writeFileSync(join(dist, "sitemap-encyclopedia.xml"), buildSitemap(pages.map((page) => `${SITE_ORIGIN}${page.route}`)))

	const seconds = ((Date.now() - started) / 1000).toFixed(1)
	const total = pages.reduce((sum, page) => sum + page.bytes, 0)
	console.log(`prerender: ${pages.length} encyclopedia pages (layout: dir) in ${seconds} s, ${(total / 1e6).toFixed(1)} MB, plus sitemap-encyclopedia.xml`)
	for (const [, kind] of [["umas", "uma"], ["cards", "card"], ["skills", "skill"]]) {
		const ofKind = pages.filter((page) => page.kind === kind)
		const bytes = ofKind.map((page) => page.bytes)
		const sum = bytes.reduce((a, b) => a + b, 0)
		console.log(`  ${kind.padEnd(5)}  ${String(ofKind.length).padStart(5)} pages  average ${Math.round(sum / ofKind.length / 1000)} KB  largest ${Math.round(Math.max(...bytes) / 1000)} KB`)
	}
}

/**
 * GET a JSON answer from the API, trying three more times on a network error,
 * a 5xx or a 429, with a growing pause. A 4xx is an answer (a page the index
 * lists but the API won't serve) and fails the build at once.
 */
async function fetchJson(url) {
	const RETRIES = 3
	for (let attempt = 0; ; attempt++) {
		let problem
		try {
			const response = await fetch(url)
			if (response.ok) return await response.json()
			if (response.status < 500 && response.status !== 429) fail(`${url} answered ${response.status}`)
			problem = `answered ${response.status}`
		} catch (error) {
			problem = error.cause?.message ?? error.message
		}
		if (attempt === RETRIES) fail(`${url} ${problem}, ${RETRIES + 1} times`)
		await new Promise((done) => setTimeout(done, 1000 * 2 ** attempt))
	}
}
