#!/usr/bin/env node
/**
 * Refreshes src/content/snapshot.json, and the Encyclopedia sample beside it
 * (src/content/encyclopedia-sample.json, see the end of this file), from the live API.
 *
 * The snapshot is what CI and an API-less local build prerender from
 * (PRERENDER_CONTENT=snapshot; see scripts/prerender.mjs), and what the tests render
 * with. Production never reads it: a real build fetches the live content itself. So
 * drift is harmless, and this is only worth running when a test wants a phrase the
 * snapshot does not yet have, or after the team has changed a page enough that the
 * committed copy reads as stale.
 *
 * Usage: npm run content:pull
 *   CONTENT_API_URL=https://...   another API's base URL (default: the live one)
 */
import { writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { assertContent } from "./prerender-html.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const target = join(root, "src", "content", "snapshot.json")
const base = (process.env.CONTENT_API_URL ?? "https://umacaratcalculator.com/api").replace(/\/+$/, "")
const url = `${base}/site-content`

const response = await fetch(url)
if (!response.ok) {
	console.error(`content:pull: ${url} answered ${response.status}`)
	process.exit(1)
}
const content = await response.json()
assertContent(content, url)
// Tab-indented like the rest of the repo; the trailing newline keeps git diffs clean.
writeFileSync(target, `${JSON.stringify(content, null, "\t")}\n`)
console.log(`content:pull: wrote ${target} (${content.pages.length} pages, ${content.faq.length} FAQ categories) from ${url}`)

// ── The Encyclopedia sample ─────────────────────────────────────────────────
//
// One detail page of each kind, as its API route answers it, for the tests
// that render and hydrate a detail page (entryServer.test.tsx,
// hydration.test.tsx) and for a build without an API
// (notes/encyclopedia-open-plan.md, "CI and builds with no API").
// Picked for having most sections (a global uma with skills, objectives,
// outfits and cards; an SSR with effects, a unique effect, hints and event
// skills; a white skill umas and cards teach) and NO UmaTL text: this repo is
// public, and UmaTL's text is only ever shown with its credit
// (.claude/rules/backend-models.md). The pull refuses a page that has some.
const SAMPLE = { uma: "/encyclopedia/umas/103101", card: "/encyclopedia/cards/30011", skill: "/skills/200013" }

/** Does any part of a payload say its text is UmaTL's? */
function holdsUmaTlText(value) {
	if (Array.isArray(value)) return value.some(holdsUmaTlText)
	if (value === null || typeof value !== "object") return false
	return Object.entries(value).some(([key, inner]) =>
		(["uses_translation", "title_translated", "translated"].includes(key) && inner === true) || holdsUmaTlText(inner))
}
const sampleTarget = join(root, "src", "content", "encyclopedia-sample.json")

/**
 * Drops every `other_names`: it holds GameTora's names, which search may match
 * but the site never shows (owner, 2026-11-12), so they stay out of the repo
 * the same way they stay out of a built document.
 */
function withoutOtherNames(value) {
	if (Array.isArray(value)) return value.map(withoutOtherNames)
	if (value === null || typeof value !== "object") return value
	return Object.fromEntries(
		Object.entries(value).filter(([key]) => key !== "other_names").map(([key, inner]) => [key, withoutOtherNames(inner)]),
	)
}

const sample = {}
for (const [kind, path] of Object.entries(SAMPLE)) {
	const pageResponse = await fetch(`${base}${path}`)
	if (!pageResponse.ok) {
		console.error(`content:pull: ${base}${path} answered ${pageResponse.status}`)
		process.exit(1)
	}
	const page = await pageResponse.json()
	if (holdsUmaTlText(page)) {
		console.error(`content:pull: ${path} now holds UmaTL text; pick another ${kind} for the sample`)
		process.exit(1)
	}
	sample[kind] = withoutOtherNames(page)
}
writeFileSync(sampleTarget, `${JSON.stringify(sample, null, "\t")}\n`)
console.log(`content:pull: wrote ${sampleTarget} (${Object.keys(sample).join(", ")}) from ${base}`)
