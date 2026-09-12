import type React from "react"
import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"
import guideMarkdown from "../../../docs/carat-income-explained.md?raw"
import { childrenToText, extractH2s, slugify, splitGuideHeader } from "../../utils/guideMarkdown"

// Same text-style vocabulary as About and Faq, so the public content pages stay
// visually consistent without a shared layout component.
const paragraph = "mt-3 leading-relaxed text-gray-300"
const list = "mt-3 space-y-1 pl-6 leading-relaxed text-gray-300"
const link = "text-brand transition hover:text-brand/75"

// Parsed once at module load. The markdown is a build-time constant (it is the
// contents of docs/carat-income-explained.md, inlined by Vite's ?raw import), so
// splitting it again on every render would be pure waste.
const GUIDE = splitGuideHeader(guideMarkdown)
const SECTIONS = extractH2s(GUIDE.body)

/**
 * Maps markdown elements onto the site's styles.
 *
 * Every override drops `node` — the syntax-tree node react-markdown passes along —
 * before spreading the rest, so it never reaches the DOM as an unknown attribute.
 * Headings get their id from the same `slugify` the jump list uses on the source
 * text, so a pill and the heading it targets cannot drift apart.
 *
 * Two arbitrary variants do work a plain class cannot: `[&>p]` on list items keeps a
 * loose list (items with blank lines between them, which render as <li><p>) from
 * inheriting the paragraph top margin, and `[&>code]` on <pre> strips the inline-code
 * chip styling from a fenced block, since react-markdown routes both through `code`.
 */
const components: Components = {
	h2: ({ node, children, ...props }) => (
		<h2
			id={slugify(childrenToText(children))}
			className="mt-12 scroll-mt-24 text-xl font-semibold text-brand"
			{...props}
		>
			{children}
		</h2>
	),
	h3: ({ node, children, ...props }) => (
		<h3
			id={slugify(childrenToText(children))}
			className="mt-8 scroll-mt-24 text-lg font-semibold text-gray-100 [&>em]:font-normal [&>em]:text-gray-400"
			{...props}
		>
			{children}
		</h3>
	),
	p: ({ node, ...props }) => <p className={paragraph} {...props} />,
	ul: ({ node, ...props }) => <ul className={`${list} list-disc`} {...props} />,
	ol: ({ node, ...props }) => <ol className={`${list} list-decimal`} {...props} />,
	li: ({ node, ...props }) => <li className="[&>p]:mt-0 [&>p+p]:mt-2" {...props} />,
	strong: ({ node, ...props }) => <strong className="font-semibold text-gray-100" {...props} />,
	a: ({ node, ...props }) => <a className={link} {...props} />,
	hr: ({ node, ...props }) => <hr className="my-10 border-gray-700" {...props} />,
	table: ({ node, ...props }) => (
		<div className="mt-4 overflow-x-auto">
			<table className="w-full border-collapse text-left text-sm" {...props} />
		</div>
	),
	th: ({ node, ...props }) => (
		<th className="border-b border-gray-600 px-3 py-2 align-bottom font-semibold text-gray-100" {...props} />
	),
	td: ({ node, ...props }) => (
		<td className="border-b border-gray-800 px-3 py-2 align-top text-gray-300" {...props} />
	),
	pre: ({ node, ...props }) => (
		<pre
			className="mt-4 overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 p-4 text-sm leading-relaxed text-gray-200 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-sm"
			{...props}
		/>
	),
	code: ({ node, ...props }) => (
		<code className="rounded bg-gray-800 px-1.5 py-0.5 text-[0.9em] text-gray-200" {...props} />
	),
}

/**
 * The carat income guide (route: /guides/carat-income).
 *
 * The long-form companion to the FAQ: how the projection is built, every income source
 * and its schedule, a day-by-day worked example, how pulls are paid for, and why the
 * result can differ from the game. The copy is docs/carat-income-explained.md, rendered
 * here rather than transcribed, so the doc and the page are one file — see
 * utils/guideMarkdown.ts for the header handling.
 *
 * Mirrors Faq's layout: expanded prose (a search crawler and a first-time reader both
 * want the words on the page, not behind toggles), a jump list of pills over the
 * sections, and hash scrolling done by hand because React Router does not.
 */
export const CaratIncomeGuide: React.FC = () => {
	useDocumentMeta(
		"Carat Income Guide",
		"How the Uma Musume Carat Calculator works out your carats: every income source and its schedule, a day-by-day worked example, how pulls are paid for, and why the number can differ from the game.",
	)

	const { hash } = useLocation()

	// The browser scrolls to a #fragment on a full page load, but not on a
	// client-side navigation — see the same effect in Faq for the full reasoning.
	useEffect(() => {
		if (!hash) return
		const target = document.getElementById(decodeURIComponent(hash.slice(1)))
		target?.scrollIntoView({ behavior: "smooth", block: "start" })
	}, [hash])

	return (
		// Mirrors About and Faq: flex-1 on <main> absorbs leftover viewport height so
		// the footer keeps its fixed band at the bottom, and long content scrolls the
		// page rather than a nested region.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-3xl px-4 py-8">
					<h1 className="text-3xl font-bold text-gray-100">{GUIDE.title}</h1>
					{GUIDE.subtitle && <p className="mt-2 text-gray-400">{GUIDE.subtitle}</p>}
					{GUIDE.lastUpdated && (
						<p className="mt-2 text-sm text-gray-500">Last updated: {GUIDE.lastUpdated}</p>
					)}

					{/* Jump list. Plain in-page anchors rather than router links — these
					    target sections on this page, so letting the browser handle the
					    hash is both correct and free. */}
					<nav aria-label="Guide sections" className="mt-6 flex flex-wrap gap-2">
						{SECTIONS.map((section) => (
							<a
								key={section.id}
								href={`#${section.id}`}
								className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100"
							>
								{section.text}
							</a>
						))}
					</nav>

					<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
						{GUIDE.body}
					</ReactMarkdown>

					<p className="mt-12 text-sm text-gray-500">
						Anything this guide does not answer is probably in the{" "}
						<Link to="/faq" className={link}>
							FAQ
						</Link>
						. If it is not, send it through the{" "}
						<Link to="/feedback" className={link}>
							feedback form
						</Link>
						.
					</p>
				</div>
			</main>
			<Footer />
		</div>
	)
}
