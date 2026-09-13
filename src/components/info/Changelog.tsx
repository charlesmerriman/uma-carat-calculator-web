import type React from "react"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { OguriSpinner } from "../OguriSpinner"
import { changelogFetch } from "../../services/changelogFetchCalls"
import { formatDate } from "../../utils/dateFormat"
import type { ChangeCategory, ChangelogEntry } from "../../types"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"

/** Subtle fade/slide-up on mount — matches the motion used elsewhere in the app. */
const fadeUp = {
	initial: { opacity: 0, y: 16 },
	animate: { opacity: 1, y: 0 },
	transition: { duration: 0.4, ease: "easeOut" as const },
}

const card = "rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-md"

// Semantic chip colors per category, tinted like the homepage number badge.
const categoryStyles: Record<ChangeCategory, string> = {
	added: "bg-emerald-500/15 text-emerald-400",
	fixed: "bg-rose-500/15 text-rose-400",
	changed: "bg-sky-500/15 text-sky-400",
}

const categoryLabel: Record<ChangeCategory, string> = {
	added: "Added",
	fixed: "Fixed",
	changed: "Changed",
}

/**
 * Public Changelog page (route: /changelog).
 *
 * Fetches patch notes standalone (no CalculatorProvider) and renders them as a
 * newest-first timeline of dated cards, each listing categorized change lines.
 */
export const Changelog: React.FC = () => {
	useDocumentMeta("Changelog", "Recent updates to the Uma Musume Carat Calculator: new banners, corrected event data and calculator changes.")

	const [entries, setEntries] = useState<ChangelogEntry[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState(false)

	useEffect(() => {
		const controller = new AbortController()

		async function load() {
			try {
				const res = await changelogFetch(controller.signal)
				if (!res.ok) throw new Error(`Changelog fetch failed: ${res.status}`)
				const data = (await res.json()) as ChangelogEntry[]
				setEntries(data)
				setIsLoading(false)
			} catch (err) {
				// AbortError is expected under React StrictMode's double-mount; ignore it.
				if (err instanceof DOMException && err.name === "AbortError") return
				console.error(err)
				setError(true)
				setIsLoading(false)
			}
		}

		load()
		return () => controller.abort()
	}, [])

	return (
		// See PrivacyPolicy: flex-1 lets <main> absorb leftover viewport height so the
		// footer stays a fixed band at the bottom of a short page, and no overflow-y-auto
		// so long content scrolls the page (footer included) instead of a nested region.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-3xl px-4 py-8">
					<h1 className="text-3xl font-bold text-gray-100">Changelog</h1>
					<p className="mt-2 text-sm text-gray-500">
						Updates and fixes to the calculator, newest first.
					</p>

					{/* Loading */}
					{isLoading && (
						<div className="mt-10 flex justify-center" role="status" aria-live="polite">
							<OguriSpinner />
							<span className="sr-only">Loading the changelog…</span>
						</div>
					)}

					{/* Error */}
					{!isLoading && error && (
						<div className="mt-10 text-center">
							<p className="text-gray-400">
								Something went wrong loading the changelog. Please try again.
							</p>
							<button
								type="button"
								onClick={() => window.location.reload()}
								className="mt-4 rounded-lg bg-brand px-5 py-2 font-semibold text-black transition hover:bg-brand/85"
							>
								Reload
							</button>
						</div>
					)}

					{/* Empty */}
					{!isLoading && !error && entries.length === 0 && (
						<p className="mt-10 text-center text-gray-400">No updates yet. Check back soon.</p>
					)}

					{/* Entries */}
					{!isLoading && !error && entries.length > 0 && (
						<div className="mt-8 space-y-6">
							{entries.map((entry) => (
								<motion.article key={entry.id} {...fadeUp} className={card}>
									<div className="flex flex-wrap items-center gap-3">
										<time className="text-sm font-medium text-gray-400">
											{formatDate(entry.date)}
										</time>
										{entry.version && (
											<span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
												{entry.version}
											</span>
										)}
									</div>
									<h2 className="mt-1 text-lg font-semibold text-gray-100">{entry.title}</h2>

									{entry.changes.length > 0 && (
										<ul className="mt-3 space-y-2">
											{entry.changes.map((change) => (
												<li key={change.id} className="flex items-start gap-2.5">
													<span
														className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${categoryStyles[change.category]}`}
													>
														{categoryLabel[change.category]}
													</span>
													<span className="leading-relaxed text-gray-300">{change.text}</span>
												</li>
											))}
										</ul>
									)}
								</motion.article>
							))}
						</div>
					)}
				</div>
			</main>
			<Footer />
		</div>
	)
}
