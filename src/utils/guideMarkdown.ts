import { Children, isValidElement } from "react"
import type { ReactNode } from "react"

/**
 * Helpers for pages that render admin-authored markdown as site content (the FAQ, the
 * FAQ teaser on the homepage, the About page).
 *
 * The markdown is a row of the admin's Site content, served by /site-content. These
 * helpers pull the first paragraph out of a body for a teaser, and turn a heading
 * into a stable id so a #hash link lands on it.
 *
 * Pure string functions, no DOM: they run in node-environment tests and at build time.
 */

/**
 * The first paragraph of a markdown body: everything up to the first blank line.
 * For the homepage FAQ teaser, which shows a taste of an answer rather than all of it.
 */
export function firstParagraph(markdown: string): string {
	return markdown.trim().split(/\n\s*\n/)[0] ?? ""
}

/**
 * Heading text → DOM id.
 *
 * Leading "3. " numbering is dropped so ids read as words and survive a renumbering,
 * and every run of non-alphanumerics collapses to one hyphen. Used for the rendered
 * headings' ids, so a link written against the heading text keeps working.
 */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/^\d+\.\s*/, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
}

/**
 * Flattens a heading's rendered children back to plain text, so the component can
 * derive the heading's id from what it actually rendered. Emphasis inside a
 * heading (`### Misc Earnings — *your toggle*`) arrives as a nested element, which
 * is why this recurses rather than joining strings.
 */
export function childrenToText(children: ReactNode): string {
	return Children.toArray(children)
		.map((child) => {
			if (typeof child === "string" || typeof child === "number") return String(child)
			if (isValidElement<{ children?: ReactNode }>(child)) return childrenToText(child.props.children)
			return ""
		})
		.join("")
}
