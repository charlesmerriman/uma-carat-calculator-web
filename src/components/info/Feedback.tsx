import type React from "react"
import { ExternalLink } from "lucide-react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"
import { DISCORD_INVITE_URL } from "../../constants/links"

/**
 * Feedback page (route: /feedback).
 *
 * Used to be a form that posted to the API. Since 2026-09-22 it points at Henry's
 * Discord instead, so the site stores no feedback at all: a message sent there
 * is Discord's to hold, under Discord's privacy policy, and the person can get a
 * reply, which the one-way form never allowed. The route stays because the
 * footer, the home tiles, the guide and the FAQ all link here, and so does
 * anything indexed under the old URL.
 */
export const Feedback: React.FC = () => {
	useDocumentMeta("Feedback", "Report a bug, flag wrong banner data or suggest a feature for the Uma Musume Carat Calculator on Henry's Discord.")

	return (
		// Same shell as PrivacyPolicy and Faq: flex-1 on <main> absorbs leftover
		// viewport height so the footer keeps its band at the bottom of a short page.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-2xl px-4 py-8">
					<h1 className="text-3xl font-bold text-gray-100">Feedback</h1>
					<p className="mt-2 leading-relaxed text-gray-400">
						Found a bug, spotted wrong data, or thought of something the calculator should
						do? Tell us on Discord. That is where reports get read, and where you can get
						a reply.
					</p>

					<div className="mt-8 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-md">
						<h2 className="text-lg font-semibold text-gray-100">What helps most</h2>
						<ul className="mt-3 list-disc space-y-1 pl-6 leading-relaxed text-gray-400">
							<li>Which screen or banner it was on.</li>
							<li>What you expected to see, and what you saw instead.</li>
							<li>For a data correction, where the right value comes from.</li>
						</ul>
						<a
							href={DISCORD_INVITE_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2 font-bold text-black transition hover:brightness-110"
						>
							Open our Discord
							<ExternalLink className="h-4 w-4" aria-hidden="true" />
						</a>
						<p className="mt-4 text-xs leading-relaxed text-gray-500">
							Discord is a separate service. Anything you post there is held by Discord under
							its own privacy policy, and this site never receives or stores it.
						</p>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	)
}
