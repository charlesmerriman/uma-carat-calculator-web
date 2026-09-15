import type React from "react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"
import { useSiteContent } from "../../services/SiteContentContext"
import { formatDate } from "../../utils/dateFormat"
import { MarkdownContent } from "./MarkdownContent"
import { ContentLoading } from "./ContentLoading"

/**
 * Public About page (route: /about).
 *
 * The words are the `about` row of the admin's Site content -> Pages, written in
 * markdown and served by /site-content. The page itself is only the frame: title,
 * "Last updated", the rendered body. Every factual claim in that row should be one
 * the FAQ or the privacy policy already makes; three pages disagreeing about what
 * the site stores is worse than no About page.
 *
 * The fallbacks passed to useDocumentMeta are for the loading state only. At build
 * time the row is always present (the render is strict), and a hydrating page reads
 * the row its document embedded, so the head tags never actually fall back on a
 * prerendered load.
 */
export const About: React.FC = () => {
	const page = useSiteContent().page("about")
	useDocumentMeta(
		page?.title ?? "About",
		page?.meta_description ?? "What the Uma Musume Carat Calculator is, who makes it, and where its numbers come from.",
	)

	return (
		// Mirrors PrivacyPolicy: flex-1 on <main> absorbs leftover viewport height so the
		// footer keeps its fixed band at the bottom of a short page, and there is no
		// overflow-y-auto, so long content scrolls the page rather than a nested region.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-3xl px-4 py-8">
					{page ? (
						<>
							<h1 className="text-3xl font-bold text-gray-100">{page.title}</h1>
							{/* The date half only: the build renders in UTC and the browser
							    in local time, and an instant near midnight would otherwise
							    format to different days on the two sides of hydration. */}
							<p className="mt-2 text-sm text-gray-500">Last updated: {formatDate(page.updated_at.slice(0, 10))}</p>
							<MarkdownContent markdown={page.body} />
						</>
					) : (
						<>
							<h1 className="text-3xl font-bold text-gray-100">About</h1>
							<ContentLoading what="the page" />
						</>
					)}
				</div>
			</main>
			<Footer />
		</div>
	)
}
