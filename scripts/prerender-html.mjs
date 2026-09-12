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
}

/** Puts the rendered markup inside #root and marks which route it was built for. */
export function injectRoot(template, route, html) {
	return template.replace(
		ROOT_PLACEHOLDER,
		() => `<div id="root" data-prerendered="${escapeHtml(normaliseRoute(route))}">${html}</div>`,
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

/** One route, start to finish: validate, inject, rewrite. */
export function buildPage(template, route, rendered, site) {
	validateRendered(route, rendered, site)
	return rewriteHeadTags(injectRoot(template, route, rendered.html), rendered.meta)
}
