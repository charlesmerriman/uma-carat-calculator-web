/**
 * The admin-editable site content: the prose pages and the FAQ.
 *
 * Mirrors GET /site-content. The team edits these rows in the Django admin
 * (Site content -> Pages / FAQ); the frontend never writes them. `body` and
 * `answer` are markdown, rendered by components/info/MarkdownContent.tsx.
 */

/** The pages that exist. Fixed: each has a route in App.tsx and a row the API refuses to delete. */
export type SitePageSlug = "about" | "carat-income-guide"

export interface SitePage {
	slug: SitePageSlug
	/** The H1, and the browser tab title. */
	title: string
	/** The <meta name="description">. */
	meta_description: string
	/** Markdown. */
	body: string
	/** ISO instant of the last save, shown as "Last updated". */
	updated_at: string
}

export interface FaqItem {
	/** The question's anchor on the FAQ page (/faq#do-i-need-an-account). Stable. */
	slug: string
	question: string
	/** Markdown; a blank line separates paragraphs. */
	answer: string
	/** Ticked in the admin to put the question in the homepage teaser. */
	show_on_homepage: boolean
}

export interface FaqCategory {
	/** The section's anchor on the FAQ page. */
	slug: string
	title: string
	/** In display order. */
	items: FaqItem[]
}

/**
 * What the API returns, and also what a prerendered page embeds. Both keys are
 * optional because the embed carries only what that page read: the About
 * document holds the About row and no FAQ. A missing key means "not loaded
 * here", never "empty"; the runtime fetch fills it in.
 */
export interface SiteContent {
	pages?: SitePage[]
	faq?: FaqCategory[]
}
