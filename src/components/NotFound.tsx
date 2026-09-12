import type React from "react"
import { Link } from "react-router-dom"
import { Navbar } from "./navbar/Navbar"
import { Footer } from "./footer/Footer"
import { useDocumentMeta } from "../hooks/useDocumentMeta"

/**
 * 404 page, routed at "*" in BOTH App.tsx and ApplicationViews.
 *
 * Replaces the old `<Navigate to="/" replace />` catch-all. That redirect made
 * every mistyped URL a SOFT 404: a crawler asked for a page that does not
 * exist, received HTTP 200 and the entire home page, and recorded the home
 * page as existing at unlimited addresses. Google counts that against site
 * quality, and it is on the AdSense polish list for exactly that reason.
 *
 * This page cannot return a real 404 STATUS, and nothing client-side can. The
 * site is a static bundle on DigitalOcean App Platform, whose catch-all hands
 * the empty shell (dist/spa.html) to every unmatched path with a 200 before
 * React exists at all (visible as `x-do-static-catchall-document` on the
 * response). Prerendered routes never reach this page; see prerenderRoutes.ts.
 * The `noindex` argument below is therefore the load-bearing part: it states
 * to the crawler what the status code cannot.
 */
export const NotFound: React.FC = () => {
	useDocumentMeta(
		"Page not found",
		"That page does not exist. Head back to the Uma Musume Carat Calculator to plan your gacha pulls.",
		true,
	)

	return (
		// Same shell as Faq/Changelog/PrivacyPolicy: flex-1 on <main> absorbs the
		// leftover viewport height so the footer stays a band at the bottom of what
		// is always a short page, rather than floating under the text.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-3xl px-4 py-16 text-center">
					<p className="text-sm font-semibold tracking-widest text-brand">404</p>
					<h1 className="mt-3 text-3xl font-bold text-gray-100">Page not found</h1>
					<p className="mt-3 text-gray-400">
						That address doesn't match anything on the site. It may have been mistyped, or
						the page may have moved.
					</p>
					<div className="mt-8 flex flex-wrap justify-center gap-3">
						<Link
							to="/app"
							className="rounded-lg bg-brand px-5 py-2 font-semibold text-black transition hover:bg-brand/85"
						>
							Open the calculator
						</Link>
						<Link
							to="/"
							className="rounded-lg border border-gray-700 bg-gray-800 px-5 py-2 font-semibold text-gray-200 transition hover:border-gray-500 hover:bg-gray-700"
						>
							Back to home
						</Link>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	)
}
