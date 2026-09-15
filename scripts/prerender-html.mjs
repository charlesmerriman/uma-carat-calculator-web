/**
 * The string half of prerendering: everything scripts/prerender.mjs does to HTML,
 * with no file system in it.
 *
 * Same split as dev-preflight-decision.mjs / dev-preflight.mjs — the rules live in a
 * module with no side effects so every case is a plain string test
 * (prerender-html.test.mjs), and the script that touches dist/ stays too thin to hide a
 * bug.
 *
 * The template is the CLIENT build's dist/index.html, not the source index.html: it
 * already carries the hashed <script> and <link> tags for the bundle, and the
 * prerendered documents must reference exactly those.
 */

const ROOT_PLACEHOLDER = '<div id="root"></div>'

/** The id of the JSON block each document carries. Mirrors EMBED_ELEMENT_ID in src/services/siteContent.ts. */
export const CONTENT_ELEMENT_ID = 'site-content'

/** Every head tag the template must carry exactly once for `rewriteHeadTags` to work. */
const REQUIRED_META = [
	['name', 'description'],
	['property', 'og:title'],
	['property', 'og:description'],
	['property', 'og:url'],
	['name', 'twitter:title'],
	['name', 'twitter:description'],
]

function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Escaping for text nodes and attribute values alike. */
export function escapeHtml(text) {
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/** "/about/" → "/about"; "/" stays "/". Mirrors src/hydrationTarget.ts. */
export function normaliseRoute(route) {
	const trimmed = route.replace(/\/+$/, '')
	return trimmed === '' ? '/' : trimmed
}

/**
 * Drops HTML comments. The source index.html explains itself at length, and none of
 * that belongs in every response — until this existed, a comment was literally the only
 * text a crawler could find on the site.
 */
export function stripComments(html) {
	return html.replace(/<!--[\s\S]*?-->\n?/g, '')
}

function metaTagPattern(attr, key) {
	return new RegExp(`<meta ${attr}="${escapeRegExp(key)}" content="[^"]*"\\s*/?>`)
}

/**
 * Refuses a template this module cannot rewrite safely. Vite copies index.html into
 * dist more or less verbatim today; if a future Vite reformats it, this is where the
 * build stops instead of quietly emitting documents with the default tags.
 */
export function assertTemplate(template) {
	const count = (pattern) => (template.match(new RegExp(pattern.source, 'g')) ?? []).length

	if (count(new RegExp(escapeRegExp(ROOT_PLACEHOLDER))) !== 1) {
		throw new Error(`template must contain exactly one ${ROOT_PLACEHOLDER}`)
	}
	if (count(/<title>[^<]*<\/title>/) !== 1) {
		throw new Error('template must contain exactly one <title>')
	}
	for (const [attr, key] of REQUIRED_META) {
		if (count(metaTagPattern(attr, key)) !== 1) {
			throw new Error(`template must contain exactly one <meta ${attr}="${key}">`)
		}
	}
	if (/<link rel="canonical"/.test(template)) {
		throw new Error('template must not carry a canonical link; the prerender inserts one per route')
	}
	if (count(/<\/body>/) !== 1) {
		throw new Error('template must contain exactly one </body>')
	}
	if (template.includes(`id="${CONTENT_ELEMENT_ID}"`)) {
		throw new Error(`template must not already carry #${CONTENT_ELEMENT_ID}; the prerender inserts it per route`)
	}
}

/** Puts the rendered markup inside #root and marks which route it was built for. */
export function injectRoot(template, route, html) {
	return template.replace(
		ROOT_PLACEHOLDER,
		() => `<div id="root" data-prerendered="${escapeHtml(normaliseRoute(route))}">${html}</div>`,
	)
}

/**
 * Embeds the site content a route rendered with, as a JSON data block just before
 * </body>, so the client's first render reads the same rows the build did and
 * hydration attaches cleanly (main.tsx reads it back by id).
 *
 * Every "<" in the JSON is written as \u003c. That is still valid JSON, and it is
 * what stops a "</script>" inside an admin-written answer from ending the data
 * block early; "<!--" is covered by the same substitution. The block's type is not
 * a script MIME type, so the browser never executes it whatever it contains.
 */
export function injectContent(template, content) {
	const json = JSON.stringify(content).replace(/</g, '\\u003c')
	return template.replace(
		'</body>',
		() => `<script id="${CONTENT_ELEMENT_ID}" type="application/json">${json}</script>\n  </body>`,
	)
}

/**
 * Writes one route's title, description and canonical into the head, on every tag a
 * browser, a crawler or a link unfurler reads. The og:image stays site-wide.
 */
export function rewriteHeadTags(template, meta) {
	const title = escapeHtml(meta.title)
	const description = escapeHtml(meta.description)
	const canonical = escapeHtml(meta.canonical)

	const setMeta = (html, attr, key, content) =>
		html.replace(metaTagPattern(attr, key), () => `<meta ${attr}="${key}" content="${content}" />`)

	let html = template.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
	html = setMeta(html, 'name', 'description', description)
	html = setMeta(html, 'property', 'og:title', title)
	html = setMeta(html, 'property', 'og:description', description)
	html = setMeta(html, 'property', 'og:url', canonical)
	html = setMeta(html, 'name', 'twitter:title', title)
	html = setMeta(html, 'name', 'twitter:description', description)

	// Right after the description, where useDocumentMeta's upsert will find it on the
	// client and reuse it rather than appending a second one.
	const descriptionTag = html.match(metaTagPattern('name', 'description'))[0]
	html = html.replace(descriptionTag, () => `${descriptionTag}\n    <link rel="canonical" href="${canonical}" />`)
	return html
}

/**
 * Where a route's document goes inside dist/, for a given hosting layout.
 *
 *   dir   /about → about/index.html
 *   flat  /about → about.html
 *   both  both files — THE DEFAULT, and deliberately so
 *
 * Static hosts disagree about what a bare "/about" means. Some serve the directory
 * index, some try "about.html", and Vite's own preview server only tries the latter.
 * A throwaway App Platform deploy on 2026-09-12 served the prerendered document for a
 * bare path when BOTH files were present, and which one it chose was not
 * distinguishable. Emitting both costs eleven small duplicate files and guarantees the
 * canonical URL never falls through to the empty shell on any host; every copy carries
 * the same <link rel="canonical">, so search engines consolidate the URL forms.
 *
 * "/" is always index.html.
 */
export function outputPathsFor(route, layout = 'both') {
	const clean = normaliseRoute(route)
	if (clean === '/') return ['index.html']
	const stem = clean.slice(1)
	switch (layout) {
		case 'dir':
			return [`${stem}/index.html`]
		case 'flat':
			return [`${stem}.html`]
		case 'both':
			return [`${stem}/index.html`, `${stem}.html`]
		default:
			throw new Error(`unknown PRERENDER_LAYOUT "${layout}" (expected dir, flat or both)`)
	}
}

/**
 * The checks that turn a subtly wrong render into a failed build: an empty page, a page
 * that never reached its footer, a page still wearing the site's default title, a
 * canonical for the wrong route, or a noindex page in the prerender list.
 */
export function validateRendered(route, rendered, { siteName, siteOrigin }) {
	const { html, meta } = rendered
	const clean = normaliseRoute(route)
	if (!html || html.trim() === '') throw new Error(`${clean}: rendered nothing`)
	if (!html.includes('</footer>')) throw new Error(`${clean}: render did not reach the footer`)
	if (!meta || !meta.title) throw new Error(`${clean}: no title reported`)
	if (clean !== '/' && meta.title === siteName) {
		throw new Error(`${clean}: title is the bare site name; did the page call useDocumentMeta?`)
	}
	if (meta.canonical !== `${siteOrigin}${clean}`) {
		throw new Error(`${clean}: canonical is ${meta.canonical}, expected ${siteOrigin}${clean}`)
	}
	if (meta.noindex) throw new Error(`${clean}: a noindex page must not be prerendered`)
}

/** One route, start to finish: validate, inject the markup and its content, rewrite the head. */
export function buildPage(template, route, rendered, site) {
	validateRendered(route, rendered, site)
	const withRoot = injectRoot(template, route, rendered.html)
	return injectContent(rewriteHeadTags(withRoot, rendered.meta), rendered.content ?? {})
}

/**
 * Where the prerender gets its site content from, given the environment.
 *
 *   (unset)    fetch `${apiUrl}/site-content`: the API the bundle was built against,
 *              which on App Platform is the live one. A failed fetch fails the build,
 *              the same policy as every other check here. The default, so that
 *              production can never bake a stale snapshot.
 *   snapshot   read src/content/snapshot.json, committed and refreshed by
 *              `npm run content:pull`. For CI and for a local build with no API.
 */
export function resolveContentSource(env, apiUrl) {
	const mode = env.PRERENDER_CONTENT ?? 'api'
	switch (mode) {
		case 'api':
			if (!apiUrl) throw new Error('VITE_API_URL is not set; the prerender has nowhere to fetch site content from')
			return { kind: 'api', url: `${apiUrl.replace(/\/+$/, '')}/site-content` }
		case 'snapshot':
			return { kind: 'snapshot', path: 'src/content/snapshot.json' }
		default:
			throw new Error(`unknown PRERENDER_CONTENT "${mode}" (expected api or snapshot)`)
	}
}

/**
 * Refuses content the pages cannot be built from. The shape check is shallow on
 * purpose: the render is strict about the rows it reads, so a missing page fails
 * there with the page's name.
 */
export function assertContent(content, source) {
	if (!content || typeof content !== 'object' || Array.isArray(content)) {
		throw new Error(`site content from ${source} is not an object`)
	}
	if (!Array.isArray(content.pages) || !Array.isArray(content.faq)) {
		throw new Error(`site content from ${source} must carry "pages" and "faq" arrays`)
	}
	if (content.pages.length === 0) throw new Error(`site content from ${source} has no pages`)
	if (content.faq.length === 0) throw new Error(`site content from ${source} has no FAQ`)
}
