import type React from "react"
import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"
import { useSiteContent } from "../../services/SiteContentContext"
import { MarkdownContent } from "./MarkdownContent"
import { ContentLoading } from "./ContentLoading"

// Same text-style vocabulary as PrivacyPolicy, so the two public content pages stay
// visually consistent without a shared layout component that would have to accommodate
// both a prose page and a Q&A page.
const categoryHeading = "text-xl font-semibold text-brand"
const question = "text-lg font-semibold text-gray-100"

/**
 * Public FAQ page (route: /faq).
 *
 * Answers render expanded rather than in an accordion. Two reasons: the page exists to
 * present readable content, and collapsed answers show a reviewer (or a search crawler
 * weighing the page) a wall of headings with nothing under them; and expanded needs no
 * open/closed state at all. The category jump-list covers the navigation an accordion
 * would otherwise have provided.
 *
 * The categories and questions are the admin's Site content -> FAQ, served by
 * /site-content. Answers are markdown. A question's slug is its anchor, which is why
 * the admin asks editors not to change one once published.
 */
export const Faq: React.FC = () => {
	useDocumentMeta("FAQ", "How the Uma Musume carat calculator works, where its numbers come from, whether you need an account, and what it does with your data.")

	const categories = useSiteContent().faq()
	const { hash } = useLocation()

	// The browser scrolls to a #fragment on a full page load, but not on a
	// client-side navigation — React Router changes the URL without ever firing
	// the navigation the browser would act on. Arriving from the homepage teaser
	// (/faq#do-i-need-an-account) is exactly that case, so do it by hand. Re-run
	// when the content lands, since the target does not exist before then.
	useEffect(() => {
		if (!hash || !categories) return
		// decodeURIComponent: ids are plain slugs today, but a future one with a
		// non-ASCII character would arrive percent-encoded and never match.
		const target = document.getElementById(decodeURIComponent(hash.slice(1)))
		target?.scrollIntoView({ behavior: "smooth", block: "start" })
	}, [hash, categories])

	return (
		// Mirrors PrivacyPolicy: flex-1 on <main> absorbs leftover viewport height so the
		// footer keeps its fixed band at the bottom of a short page, and there is no
		// overflow-y-auto, so long content scrolls the page rather than a nested region.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-3xl px-4 py-8">
					<h1 className="text-3xl font-bold text-gray-100">Frequently Asked Questions</h1>
					<p className="mt-2 text-gray-400">
						How the calculator works, where its numbers come from, and what it does with your
						data.
					</p>

					{categories === null ? (
						<ContentLoading what="the questions" />
					) : (
						<>
							{/* Jump list. Plain in-page anchors rather than router links — these
							    target sections on this page, so letting the browser handle the
							    hash is both correct and free. */}
							<nav aria-label="FAQ sections" className="mt-6 flex flex-wrap gap-2">
								{categories.map((category) => (
									<a
										key={category.slug}
										href={`#${category.slug}`}
										className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100"
									>
										{category.title}
									</a>
								))}
							</nav>

							{categories.map((category) => (
								// scroll-mt keeps the heading clear of the sticky navbar when a jump link
								// or a deep link lands on it.
								<section key={category.slug} id={category.slug} className="mt-12 scroll-mt-24">
									<h2 className={categoryHeading}>{category.title}</h2>

									<div className="mt-4 space-y-4">
										{category.items.map((item) => (
											<article
												key={item.slug}
												// Per-question anchor, so a single answer can be linked
												// directly — e.g. from the homepage teaser or in a reply
												// to someone asking. scroll-mt clears the sticky navbar.
												id={item.slug}
												className="scroll-mt-24 rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-md"
											>
												<h3 className={question}>{item.question}</h3>
												<MarkdownContent markdown={item.answer} />
											</article>
										))}
									</div>
								</section>
							))}
						</>
					)}

					<p className="mt-12 text-sm text-gray-500">
						Still stuck? Email{" "}
						<a
							href="mailto:Henryhandsomederby@gmail.com"
							className="text-brand transition hover:text-brand/75"
						>
							Henryhandsomederby@gmail.com
						</a>
						.
					</p>
				</div>
			</main>
			<Footer />
		</div>
	)
}
