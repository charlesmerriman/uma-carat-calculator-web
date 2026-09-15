#!/usr/bin/env node
/**
 * Refreshes src/content/snapshot.json from the live API.
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
