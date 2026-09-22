import type React from "react"
import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"
import { useSiteContent } from "../../services/SiteContentContext"
import { formatDate } from "../../utils/dateFormat"
import { extractH2s, splitLeadingSubtitle } from "../../utils/guideMarkdown"
import { MarkdownContent } from "./MarkdownContent"
import { ContentLoading } from "./ContentLoading"

const link = "text-brand transition hover:text-brand/75"

/**
 * The carat income guide (route: /guides/carat-income).
 *
 * The long-form companion to the FAQ: how the projection is built, every income source
 * and its schedule, a day-by-day worked example, how pulls are paid for, and why the
 * result can differ from the game. The words are the `carat-income-guide` row of the
 * admin's Site content -> Pages, in markdown; this component is the frame around
 * them, plus a jump list built from the body's `##` headings.
 *
 * Mirrors Faq's layout: expanded prose (a search crawler and a first-time reader both
 * want the words on the page, not behind toggles), a jump list of pills over the
 * sections, and hash scrolling done by hand because React Router does not.
 */
export const CaratIncomeGuide: React.FC = () => {
	const page = useSiteContent().page("carat-income-guide")
	// The tab title stays "Carat Income Guide" whatever the row's H1 says: the H1 is a
	// sentence, and the tab wants a name. The description is the row's.
	useDocumentMeta(
		"Carat Income Guide",
		page?.meta_description ?? "How the Uma Musume Carat Calculator works out your carats, source by source.",
	)

	const { hash } = useLocation()
	const guide = page ? splitLeadingSubtitle(page.body) : null
	const sections = guide ? extractH2s(guide.body) : []

	// The browser scrolls to a #fragment on a full page load, but not on a
	// client-side navigation — see the same effect in Faq for the full reasoning.
	// Re-run when the content lands, since the target may not exist before then.
	useEffect(() => {
		if (!hash || !guide) return
		const target = document.getElementById(decodeURIComponent(hash.slice(1)))
		target?.scrollIntoView({ behavior: "smooth", block: "start" })
	}, [hash, guide])

	return (
		// Mirrors About and Faq: flex-1 on <main> absorbs leftover viewport height so
		// the footer keeps its fixed band at the bottom, and long content scrolls the
		// page rather than a nested region.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-3xl px-4 py-8">
					{page && guide ? (
						<>
							<h1 className="text-3xl font-bold text-gray-100">{page.title}</h1>
							{guide.subtitle && <p className="mt-2 text-gray-400">{guide.subtitle}</p>}
							{/* Date half only; see the same line in About for why. */}
							<p className="mt-2 text-sm text-gray-500">Last updated: {formatDate(page.updated_at.slice(0, 10))}</p>

							{/* Jump list. Plain in-page anchors rather than router links — these
							    target sections on this page, so letting the browser handle the
							    hash is both correct and free. */}
							<nav aria-label="Guide sections" className="mt-6 flex flex-wrap gap-2">
								{sections.map((section) => (
									<a
										key={section.id}
										href={`#${section.id}`}
										className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100"
									>
										{section.text}
									</a>
								))}
							</nav>

							<MarkdownContent markdown={guide.body} />
						</>
					) : (
						<>
							<h1 className="text-3xl font-bold text-gray-100">Carat income guide</h1>
							<ContentLoading what="the guide" />
						</>
					)}

					<p className="mt-12 text-sm text-gray-500">
						Anything this guide does not answer is probably in the{" "}
						<Link to="/faq" className={link}>
							FAQ
						</Link>
						. If it is not, ask on{" "}
						<Link to="/feedback" className={link}>
							Discord
						</Link>
						.
					</p>
				</div>
			</main>
			<Footer />
		</div>
	)
}
