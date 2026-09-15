import { Children, isValidElement } from "react"
import type { ReactNode } from "react"

/**
 * Helpers for pages that render admin-authored markdown as site content (the carat
 * income guide at /guides/carat-income, the FAQ teaser on the homepage).
 *
 * The markdown is a row of the admin's Site content, served by /site-content. These
 * helpers pull the page-level pieces out of a body (a leading italic subtitle, the
 * first paragraph) and build heading ids the same way for a jump list and for the
 * rendered headings, so a pill and its target never disagree.
 *
 * Pure string functions, no DOM: they run in node-environment tests and at build time.
 */

export interface GuideBody {
	/** A lone italic line at the top of the body, if the author wrote one. */
	subtitle: string | null
	/** Everything else, ready for the markdown renderer. */
	body: string
}

/**
 * Splits a leading subtitle from a body.
 *
 * The guide's row opens with `*A plain-English guide. No coding knowledge needed.*`,
 * which the page shows under the H1 in its own style rather than as the first
 * paragraph. Only a lone italic line on the first non-blank line counts, so a body
 * that starts with prose or a heading comes back untouched. The title and the date
 * are not in the body at all: they are the row's `title` and `updated_at`.
 */
export function splitLeadingSubtitle(markdown: string): GuideBody {
	const lines = markdown.split("\n")
	let index = 0
	while (index < lines.length && lines[index].trim() === "") index++

	const italic = /^[*_](.+)[*_]$/.exec((lines[index] ?? "").trim())
	if (!italic) return { subtitle: null, body: markdown.replace(/^\n+/, "") }

	return {
		subtitle: italic[1].trim(),
		body: lines
			.slice(index + 1)
			.join("\n")
			.replace(/^\n+/, ""),
	}
}

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
 * and every run of non-alphanumerics collapses to one hyphen. Shared by the rendered
 * headings and the jump list — the one function is what keeps them in step.
 */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/^\d+\.\s*/, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
}

/** Removes emphasis and code markers so raw heading text matches its rendered text. */
function stripInlineMarkdown(text: string): string {
	return text.replace(/[*_`]/g, "")
}

export interface GuideSection {
	id: string
	text: string
}

/**
 * The `## ` headings of a body, in document order, for a jump list. Fenced code blocks
 * are skipped so a `## ` inside one is not mistaken for a heading.
 */
export function extractH2s(body: string): GuideSection[] {
	const sections: GuideSection[] = []
	let inFence = false
	for (const raw of body.split("\n")) {
		const line = raw.trim()
		if (line.startsWith("```")) {
			inFence = !inFence
			continue
		}
		if (inFence) continue
		const match = /^##\s+(.+?)\s*$/.exec(line)
		if (match) {
			const text = stripInlineMarkdown(match[1])
			sections.push({ id: slugify(text), text })
		}
	}
	return sections
}

/**
 * Flattens a heading's rendered children back to plain text, so the component can
 * derive the same id `extractH2s` derived from the source line. Emphasis inside a
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
