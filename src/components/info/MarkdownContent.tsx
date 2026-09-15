import { useMemo } from "react"
import { Link } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { childrenToText, slugify } from "../../utils/guideMarkdown"

// Same text-style vocabulary as the legal pages, so every public content page
// reads the same whether its words come from a component or from the admin.
const PARAGRAPH = "mt-3 leading-relaxed text-gray-300"
const list = "mt-3 space-y-1 pl-6 leading-relaxed text-gray-300"
const link = "text-brand transition hover:text-brand/75"

/** A site-relative href: "/faq", "/faq#anchor". Not "//host" and not "#anchor". */
function isInternalHref(href: string): boolean {
	return href.startsWith("/") && !href.startsWith("//")
}

/**
 * Maps markdown elements onto the site's styles.
 *
 * Every override drops `node` (the syntax-tree node react-markdown passes along)
 * before spreading the rest, so it never reaches the DOM as an unknown attribute.
 * Headings get their id from the same `slugify` a jump list uses on the source text,
 * so a pill and the heading it targets cannot drift apart.
 *
 * Links: a site-relative href becomes a router <Link>, so `[FAQ](/faq#anchor)` written
 * in the admin navigates client-side like a link in a component would; an external
 * one opens in a new tab, as the hand-written About page's did; mailto: and in-page
 * anchors stay plain.
 *
 * Two arbitrary variants do work a plain class cannot: `[&>p]` on list items keeps a
 * loose list (items with blank lines between them, which render as <li><p>) from
 * inheriting the paragraph top margin, and `[&>code]` on <pre> strips the inline-code
 * chip styling from a fenced block, since react-markdown routes both through `code`.
 */
function buildComponents(paragraph: string): Components {
	return {
		h2: ({ node: _node, children, ...props }) => (
			<h2
				id={slugify(childrenToText(children))}
				className="mt-12 scroll-mt-24 text-xl font-semibold text-brand"
				{...props}
			>
				{children}
			</h2>
		),
		h3: ({ node: _node, children, ...props }) => (
			<h3
				id={slugify(childrenToText(children))}
				className="mt-8 scroll-mt-24 text-lg font-semibold text-gray-100 [&>em]:font-normal [&>em]:text-gray-400"
				{...props}
			>
				{children}
			</h3>
		),
		p: ({ node: _node, ...props }) => <p className={paragraph} {...props} />,
		ul: ({ node: _node, ...props }) => <ul className={`${list} list-disc`} {...props} />,
		ol: ({ node: _node, ...props }) => <ol className={`${list} list-decimal`} {...props} />,
		li: ({ node: _node, ...props }) => <li className="[&>p]:mt-0 [&>p+p]:mt-2" {...props} />,
		strong: ({ node: _node, ...props }) => <strong className="font-semibold text-gray-100" {...props} />,
		a: ({ node: _node, href, children, ...props }) => {
			if (href && isInternalHref(href)) {
				return (
					<Link to={href} className={link} {...props}>
						{children}
					</Link>
				)
			}
			const external = href?.startsWith("http") ?? false
			return (
				<a
					href={href}
					className={link}
					{...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
					{...props}
				>
					{children}
				</a>
			)
		},
		hr: ({ node: _node, ...props }) => <hr className="my-10 border-gray-700" {...props} />,
		table: ({ node: _node, ...props }) => (
			<div className="mt-4 overflow-x-auto">
				<table className="w-full border-collapse text-left text-sm" {...props} />
			</div>
		),
		th: ({ node: _node, ...props }) => (
			<th className="border-b border-gray-600 px-3 py-2 align-bottom font-semibold text-gray-100" {...props} />
		),
		td: ({ node: _node, ...props }) => (
			<td className="border-b border-gray-800 px-3 py-2 align-top text-gray-300" {...props} />
		),
		pre: ({ node: _node, ...props }) => (
			<pre
				className="mt-4 overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 p-4 text-sm leading-relaxed text-gray-200 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-sm"
				{...props}
			/>
		),
		code: ({ node: _node, ...props }) => (
			<code className="rounded bg-gray-800 px-1.5 py-0.5 text-[0.9em] text-gray-200" {...props} />
		),
	}
}

/**
 * Renders a block of admin-authored markdown in the site's styles.
 *
 * react-markdown does not render raw HTML by default, and that default is relied
 * on: it is what makes a content row unable to put script on the site, whoever
 * edits it. Do not add rehype-raw.
 *
 * `paragraphClassName` exists for the homepage teaser, whose cards set paragraphs
 * smaller than a content page does. Everything else is the same map.
 */
export function MarkdownContent({ markdown, paragraphClassName = PARAGRAPH }: { markdown: string; paragraphClassName?: string }) {
	const components = useMemo(() => buildComponents(paragraphClassName), [paragraphClassName])
	return (
		<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
			{markdown}
		</ReactMarkdown>
	)
}
