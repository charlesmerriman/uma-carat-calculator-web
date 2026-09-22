import type React from "react"
import { Link } from "react-router-dom"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"

// Same text-style vocabulary as PrivacyPolicy, deliberately — the two legal pages should
// read as one document split in half.
const heading = "mt-8 text-xl font-semibold text-gray-100"
const paragraph = "mt-3 leading-relaxed text-gray-300"
const list = "mt-3 list-disc space-y-1 pl-6 leading-relaxed text-gray-300"
const link = "text-brand transition hover:text-brand/75"

/**
 * Public Terms of Service page (route: /terms).
 *
 * Companion to PrivacyPolicy, and the same caveat applies: this is customized boilerplate
 * describing how the site actually works, NOT legal advice, and it should be reviewed
 * before it is relied on. Kept deliberately short — a free fan tool that holds no personal
 * data and takes no payments has little to govern.
 *
 * The three clauses that are actually load-bearing for this site are "Projections are
 * estimates", "Not affiliated with Cygames" and "Acceptable use"; the rest is the framing
 * those need to sit in.
 */
export const Terms: React.FC = () => {
	useDocumentMeta("Terms of Service", "The terms for using the Uma Musume Carat Calculator: acceptable use, that projections are estimates, and that the site is unaffiliated with Cygames.")

	return (
		// Mirrors PrivacyPolicy: flex-1 on <main> absorbs leftover viewport height so the
		// footer keeps its fixed band at the bottom of a short page.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-3xl px-4 py-8">
					<h1 className="text-3xl font-bold text-gray-100">Terms of Service</h1>
					<p className="mt-2 text-sm text-gray-500">Last updated: September 12, 2026</p>

					<p className={paragraph}>
						These terms govern your use of the Uma Musume Carat Calculator (&quot;the
						Site&quot;). By using the Site you agree to them. If you do not agree,
						please do not use the Site.
					</p>

					<h2 className={heading}>What the Site Is</h2>
					<p className={paragraph}>
						The Site is a free, unofficial fan-made planning tool that estimates the
						in-game currency and tickets you are likely to have available on a given
						date in <em>Uma Musume Pretty Derby</em>. It is provided at no charge and
						sells nothing. There is more detail on the{" "}
						<Link to="/about" className={link}>
							About
						</Link>{" "}
						page.
					</p>

					<h2 className={heading}>Projections Are Estimates</h2>
					<p className={paragraph}>
						Every figure the Site produces is an estimate based on published schedules,
						historical reward patterns and the settings you choose. Reward amounts and
						event dates are announced late, change, or differ from what was expected,
						and a single toggle set differently from how you play will move the
						result. <strong>Do not treat a projection as a guarantee</strong>, and
						do not make a purchase decision on the assumption that it will hold. You
						are solely responsible for how you spend your time and money in the game.
					</p>

					<h2 className={heading}>Not Affiliated with Cygames</h2>
					<p className={paragraph}>
						The Site is not affiliated with, endorsed by, sponsored by, or connected to
						Cygames, Inc. or <em>Uma Musume Pretty Derby</em> in any way. All game
						names, characters, images and other assets are the property of their
						respective owners and are referenced here for identification under fair
						use. Nothing on the Site is an official statement about the game.
					</p>

					<h2 className={heading}>Acceptable Use</h2>
					<p className={paragraph}>You agree not to:</p>
					<ul className={list}>
						<li>
							Attempt to disrupt, overload, or gain unauthorized access to the Site,
							its API, or the accounts or data of other users.
						</li>
						<li>
							Use automated tools to scrape or bulk-download the Site&apos;s content or
							hammer its API. Reasonable personal or research use is fine. If you
							need the data in bulk, ask.
						</li>
						<li>
							Reproduce the Site&apos;s content and present it as official, or in a way
							that implies an affiliation or endorsement that does not exist.
						</li>
					</ul>

					<h2 className={heading}>Accounts and Your Data</h2>
					<p className={paragraph}>
						An account is optional; the calculator works fully as a guest. If you sign
						in through Google, Discord or Patreon, we create an anonymous account holding
						no email address, no real name and no password. You may connect more than one
						of those sign-ins to it, and you can delete it yourself at any time from the
						Account page. Because we hold no way to verify who you are,{" "}
						<strong>an account whose every sign-in is lost cannot be recovered</strong>,
						and the plan saved to it is gone with it. What we store and why is set out in
						the{" "}
						<Link to="/privacy-policy" className={link}>
							Privacy Policy
						</Link>
						, which forms part of these terms.
					</p>
					<p className={paragraph}>
						You keep ownership of the planning data you enter. We may remove content or
						suspend access where it is necessary to comply with the law or to stop
						abuse of the Site.
					</p>

					<h2 className={heading}>Availability</h2>
					<p className={paragraph}>
						The Site is a hobby project maintained in spare time. It is provided
						&quot;as is&quot; and &quot;as available&quot;, with no warranty of any
						kind. We may change, suspend, or discontinue any part of it, including
						saved plans, at any time and without notice. To the fullest extent
						permitted by law, we are not liable for any loss arising from your use of,
						or inability to use, the Site.
					</p>

					<h2 className={heading}>Advertising and Third-Party Links</h2>
					<p className={paragraph}>
						The Site may display advertising and link to third-party sites, including
						YouTube, Google Sheets and Patreon. We do not control that content and are not
						responsible for it. How advertising partners handle cookies, and how to opt
						out, is covered in the{" "}
						<Link to="/privacy-policy" className={link}>
							Privacy Policy
						</Link>
						.
					</p>

					<h2 className={heading}>Changes to These Terms</h2>
					<p className={paragraph}>
						We may update these terms from time to time. Changes will be posted on this
						page with an updated &quot;Last updated&quot; date, and continuing to use
						the Site after that means you accept them.
					</p>

					<h2 className={heading}>Contact</h2>
					<p className={paragraph}>
						Questions about these terms can be sent to{" "}
						<a href="mailto:Henryhandsomederby@gmail.com" className={link}>
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
