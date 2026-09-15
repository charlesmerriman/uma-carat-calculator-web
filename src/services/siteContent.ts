/**
 * The pure half of site content: how a page reads it, and how a build-time
 * render learns which parts a page read.
 *
 * Three places supply content (see SiteContentProvider and entry-server.ts):
 * the build passes the whole API response into render(); a prerendered
 * document embeds the subset that page used and main.tsx hands it to the
 * provider before hydrating; and the browser fetches /site-content once after
 * mount, both to fill in what nothing embedded and to pick up edits made
 * since the last build. Whatever the source, pages read it through the one
 * value built here.
 *
 * No React in this file: entry-server.ts and node-environment tests use it.
 */
import type { FaqCategory, FaqItem, SiteContent, SitePage, SitePageSlug } from "../types/siteContent"

/** What a page can ask the content for. Null means not loaded here yet. */
export interface SiteContentValue {
	page(slug: SitePageSlug): SitePage | null
	faq(): FaqCategory[] | null
}

/**
 * A key a page reads, as recorded during a build-time render: "page:about",
 * "faq". The prerender embeds exactly the keys that were read, so the About
 * document is not carrying the whole FAQ.
 */
export type ContentKey = `page:${SitePageSlug}` | "faq"

export interface BuildValueOptions {
	/** Called with each key as it is read. The build-time reporter. */
	onRead?: (key: ContentKey) => void
	/**
	 * Throw instead of returning null for content that is missing. On at build
	 * time, where the whole response is present and a missing row means the
	 * database lacks it: the build must fail rather than bake an empty page.
	 * Off in the browser, where null is the loading state.
	 */
	strict?: boolean
}

export function buildSiteContentValue(
	content: SiteContent | null,
	{ onRead, strict = false }: BuildValueOptions = {},
): SiteContentValue {
	return {
		page(slug) {
			onRead?.(`page:${slug}`)
			const page = content?.pages?.find((row) => row.slug === slug) ?? null
			if (page === null && strict) {
				throw new Error(`Site content has no page "${slug}"; the API did not return it`)
			}
			return page
		},
		faq() {
			onRead?.("faq")
			const faq = content?.faq ?? null
			if (faq === null && strict) {
				throw new Error("Site content has no FAQ; the API did not return it")
			}
			return faq
		},
	}
}

/**
 * The subset of `content` a page read, for embedding in its document. Keys
 * nobody read are left out entirely (not set to []), because a missing key
 * means "not loaded here" and an empty array would mean "there is no FAQ".
 */
export function selectEmbedded(content: SiteContent, keys: Iterable<ContentKey>): SiteContent {
	const embedded: SiteContent = {}
	for (const key of keys) {
		if (key === "faq") {
			if (content.faq) embedded.faq = content.faq
			continue
		}
		const slug = key.slice("page:".length)
		const page = content.pages?.find((row) => row.slug === slug)
		if (page) embedded.pages = [...(embedded.pages ?? []), page]
	}
	return embedded
}

/** The questions ticked for the homepage teaser, in FAQ order. */
export function homepageFaqItems(faq: FaqCategory[]): FaqItem[] {
	return faq.flatMap((category) => category.items).filter((item) => item.show_on_homepage)
}

/**
 * Two responses with the same words. Used by the provider so a revalidation
 * fetch that returns what the page already has does not re-render anything.
 */
export function sameContent(a: SiteContent | null, b: SiteContent | null): boolean {
	return JSON.stringify(a) === JSON.stringify(b)
}

/** The id of the JSON block a prerendered document carries. Shared with the prerender script. */
export const EMBED_ELEMENT_ID = "site-content"
