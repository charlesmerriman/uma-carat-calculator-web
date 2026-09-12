import { Children, isValidElement } from "react"
import type { ReactNode } from "react"

/**
 * Helpers for pages that render a markdown document from `docs/` as site content
 * (today: the carat income guide at /guides/carat-income).
 *
 * The markdown file is the single source. It is a repo doc AND, imported with Vite's
 * `?raw`, the page copy — so an edit to the doc ships to the page with the next deploy
 * and there is no second copy to drift. These helpers pull the page-level pieces
 * (title, subtitle, last-updated line) out of the top of the document so the component
 * can render them in the site's own heading styles, and build heading ids the same way
 * for the jump list and for the rendered headings, so a pill and its target never
 * disagree.
 *
 * Pure string functions, no DOM: they run in node-environment tests and at build time.
 */

export interface GuideHeader {
	/** The `# H1` text, rendered as the page heading. */
	title: string
	/** The italic line under the H1, if any. */
	subtitle: string | null
	/** The `*Last updated: …*` line, if any, without its label. */
	lastUpdated: string | null
	/** Everything after the header block, ready for the markdown renderer. */
	body: string
}

/**
 * Splits the document header from its body.
 *
 * The header is: an H1 on the first non-blank line; then, in any order, an optional
 * italic subtitle line and an optional italic `*Last updated: …*` line; then an optional
 * `---` rule. Blank lines between them are ignored. The first line that is none of
 * those ends the header, and everything from there on is the body.
 *
 * Throws if the document does not start with an H1 — a guide without a title is a
 * broken page, and the build should say so rather than render "undefined".
 */
export function splitGuideHeader(markdown: string): GuideHeader {
	const lines = markdown.split("\n")
	let index = 0
	const skipBlank = (): void => {
		while (index < lines.length && lines[index].trim() === "") index++
	}

	skipBlank()
	const h1 = /^#\s+(.+?)\s*$/.exec(lines[index] ?? "")
	if (!h1) throw new Error("Guide markdown must start with a level-one heading")
	const title = h1[1]
	index++

	let subtitle: string | null = null
	let lastUpdated: string | null = null
	for (;;) {
		skipBlank()
		const line = (lines[index] ?? "").trim()
		const italic = /^[*_](.+)[*_]$/.exec(line)
		if (italic) {
			const updated = /^Last updated:\s*(.+)$/i.exec(italic[1])
			if (updated) lastUpdated = updated[1].trim()
			else if (subtitle === null) subtitle = italic[1].trim()
			else break // a second plain italic line is body text, not header
			index++
			continue
		}
		// The rule that closes the header block, if the author drew one.
		if (/^-{3,}$/.test(line)) index++
		break
	}

	return {
		title,
		subtitle,
		lastUpdated,
		body: lines.slice(index).join("\n").replace(/^\n+/, ""),
	}
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
