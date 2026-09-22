import type React from "react"
import { Link } from "react-router-dom"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"
import { DISCORD_INVITE_URL } from "../../constants/links"

// Shared text styles so the sections stay visually consistent and easy to tweak.
const heading = "mt-8 text-xl font-semibold text-gray-100"
const subheading = "mt-5 text-base font-semibold text-gray-200"
const paragraph = "mt-3 leading-relaxed text-gray-300"
const list = "mt-3 list-disc space-y-1 pl-6 leading-relaxed text-gray-300"
const link = "text-brand transition hover:text-brand/75"

// The person responsible for the data (the "controller" in GDPR terms) and the
// one address every request goes to. Kept in one place so the two mentions below
// cannot drift apart.
const CONTROLLER_NAME = "Henry (Henry Handsome Derby)"
const CONTACT_EMAIL = "Henryhandsomederby@gmail.com"

/**
 * Public Privacy Policy page (route: /privacy-policy).
 *
 * Written to satisfy GDPR Articles 13 and 14 (and the UK GDPR) as well as the
 * ad networks' publisher policies. It describes what the site ACTUALLY does, so
 * a change to data handling anywhere in the codebase is a change here too:
 * visits.py (the counter), index.html (Analytics and the ad tag), the account
 * views, and the Feedback page. It is not legal advice.
 */
export const PrivacyPolicy: React.FC = () => {
	useDocumentMeta("Privacy Policy", "What the Uma Musume Carat Calculator collects, why, how long it is kept, and your rights. No email address, no real name and no IP address is ever stored.")

	return (
		// flex-1 on <main> absorbs any leftover viewport height so the footer keeps its
		// fixed ~53px band at the bottom of a short page — leftover space sits above it,
		// not below (footer and page share bg-gray-900, so slack underneath would read as
		// a giant footer). Long content pushes the footer past the fold and it scrolls
		// away normally; note there is no overflow-y-auto here, so the *page* scrolls
		// rather than a nested region, which is what kept the footer permanently visible.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-3xl px-4 py-8">
					<h1 className="text-3xl font-bold text-gray-100">Privacy Policy</h1>
					<p className="mt-2 text-sm text-gray-500">Last updated: September 22, 2026</p>

					<p className={paragraph}>
						This policy explains what the Uma Musume Carat Calculator (&quot;the Site&quot;)
						collects, why, how long it is kept, and what you can do about it. It is written
						to meet the EU and UK General Data Protection Regulation (GDPR), and it applies
						to everyone who uses the Site, wherever they are.
					</p>

					<h2 className={heading}>The Short Version</h2>
					<p className={paragraph}>
						The Site holds as little about you as it can. We do <strong>not</strong> collect
						or store:
					</p>
					<ul className={list}>
						<li>your email address</li>
						<li>your real name, or the name on your Google, Discord or Patreon account</li>
						<li>your profile picture</li>
						<li>any password</li>
						<li>your IP address</li>
					</ul>
					<p className={paragraph}>
						What we do hold is described below: an anonymous account reference if you sign
						in, the plan you build, an anonymous visitor count, and the data that Google
						Analytics and (if ads run) our advertising partner collect with your consent.
					</p>

					<h2 className={heading}>Who Is Responsible</h2>
					<p className={paragraph}>
						The Site is run by {CONTROLLER_NAME}, who is the data controller for everything
						described in this policy. There is no company behind it. For any question or
						request about your data, email{" "}
						<a href={`mailto:${CONTACT_EMAIL}`} className={link}>
							{CONTACT_EMAIL}
						</a>
						.
					</p>

					<h2 className={heading}>Information We Collect</h2>
					<p className={paragraph}>
						You can use the calculator without an account at all. If you choose to create
						one, you sign in through Google, Discord, or Patreon, and we collect as
						little as possible:
					</p>
					<ul className={list}>
						<li>
							An anonymous account reference supplied by Google, Discord, or Patreon.
							This is an opaque identifier that lets us recognize you when you return.
							It is specific to this Site and cannot be used to identify you elsewhere.
							You may link more than one of these to the same account.
						</li>
						<li>
							A randomly generated username, such as <code>user_a3f9c1</code>, created
							by us. You are not asked to choose one.
						</li>
						<li>
							A display name, if you choose one on your account page. It is shown to you
							alone, never appears anywhere else on the Site, and you can change or clear
							it whenever you like.
						</li>
						<li>
							If you support the Site on Patreon, the favourite characters you pick on your
							account page (your &quot;oshis&quot;). These are picks from the Site&apos;s own
							catalogue, not anything about you, and the first one is used as your picture.
						</li>
					</ul>
					<p className={paragraph}>
						We never see your Google, Discord, or Patreon password. Those services verify it
						and only confirm to us that the sign-in succeeded. We request the narrowest
						permission each provider offers, so your email address and profile details
						are never sent to us in the first place; where a provider includes something
						about you anyway, such as a username, we discard it without storing it. In
						Patreon&apos;s case that means we can see that an account exists and, if you
						link it, whether it currently supports us. We never see your email address,
						your pledge amount, or your billing details.
					</p>
					<p className={paragraph}>
						When you use the calculator, we store the planning data you enter, including
						your current in-game resources (such as carats and tickets), your selected
						income ranks, the banners you plan to pull on, and any notes you write on them.
						Notes are shown only to you. This data is tied to your
						anonymous account so your plan is available the next time you sign in. If you
						use the Site as a guest, your plan stays in your browser and is discarded
						when you leave.
					</p>

					<h2 className={heading}>Why We Use It, and the Legal Basis</h2>
					<p className={paragraph}>
						GDPR requires a legal basis for each thing we do with your data. These are ours:
					</p>
					<ul className={list}>
						<li>
							<strong>Running your account and saving your plan</strong> (your account
							reference, username, display name, oshis and planning data). Basis:{" "}
							<strong>performance of a contract</strong>, Article 6(1)(b). This is the
							service you asked for when you signed in.
						</li>
						<li>
							<strong>Counting visitors</strong> with the anonymous counter described
							below, and <strong>rate-limiting</strong> requests to keep the Site up.
							Basis: <strong>legitimate interest</strong>, Article 6(1)(f), in knowing
							whether the Site is used and in protecting it from abuse. The counter is
							designed so that this interest costs you nothing: no IP address and no
							identifier on your device.
						</li>
						<li>
							<strong>Aggregate statistics</strong> about how the calculator is used (for
							example, the share of accounts that enable a given income option, or which
							banners are popular). Basis: <strong>legitimate interest</strong>, Article
							6(1)(f), in improving the Site. These figures are totals and never identify
							anyone.
						</li>
						<li>
							<strong>Google Analytics</strong> and <strong>advertising cookies</strong>.
							Basis: <strong>your consent</strong>, Article 6(1)(a), if you are in the EU,
							the EEA, the UK or Switzerland. Neither sets a cookie there until you agree
							(see &quot;Cookies&quot; below).
						</li>
					</ul>
					<p className={paragraph}>
						We do not sell your personal information, and because we hold no contact
						details, we cannot send you marketing of any kind.
					</p>

					<h2 className={heading}>Traffic Measurement</h2>
					<h3 className={subheading}>Our own counter</h3>
					<p className={paragraph}>
						To understand how many people use the Site, we count page loads ourselves.
						When you load the Site,
						your browser sends a single request that increments a daily counter. It sets
						no cookie, and it happens whether or not you have an account.
					</p>
					<p className={paragraph}>
						So that we can tell how many separate people visit, not just how many
						times the Site is opened, we combine your IP address and browser user agent
						into a scrambled value that cannot be turned back into either.{" "}
						<strong>Your IP address is never stored.</strong> We keep only that scrambled
						value, and we use it purely to avoid counting the same visitor twice.
					</p>
					<p className={paragraph}>
						The scrambling changes at the start of every calendar month, so the value
						representing you in one month bears no relation to the next. In practice this
						means we can recognize a repeat visit within a single month, which is what
						lets us report how many people used the Site that month. We{" "}
						<strong>cannot</strong> follow anyone from one month into the next, or build
						a long-term picture of any individual&apos;s activity. The scrambled values
						are deleted after 90 days; only anonymous totals are kept.
					</p>
					<p className={paragraph}>
						This counting uses no cookie and no identifier stored on your device, so it
						cannot be linked to you on any other website, or to anything else we hold. We
						never see who you are, only that some visitor, distinguishable from other
						visitors for the rest of the month, was here.
					</p>

					<h3 className={subheading}>Google Analytics</h3>
					<p className={paragraph}>
						We also use Google Analytics, a service run by Google, to see which pages are
						visited and roughly where visitors come from. With your consent, Google
						Analytics sets cookies and collects information such as the pages you view,
						your device and browser type, and your approximate location. Google processes
						this under its own{" "}
						<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className={link}>
							privacy policy
						</a>
						, keeps it for at most 14 months, and does not receive your account details or
						anything you save in the calculator.
					</p>
					<p className={paragraph}>
						If you are in the EU, the EEA, the UK or Switzerland, Google Analytics starts
						in a no-cookie mode: nothing is stored on your device and nothing that
						identifies you is sent until you agree. Anywhere else, you can stop it by
						installing the{" "}
						<a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className={link}>
							Google Analytics opt-out browser add-on
						</a>
						.
					</p>

					<h2 className={heading}>Advertising</h2>
					<p className={paragraph}>
						The Site may show ads from a third-party advertising partner, which may include
						Google, to help pay for hosting. An advertising partner uses cookies to serve
						ads, and with your consent may use them to show ads based on your visits to this
						and other websites. Without that consent, in the regions listed above, any ads
						shown are not personalized. We will name the partner here when ads start.
					</p>
					<p className={paragraph}>
						You can opt out of personalized advertising from Google at{" "}
						<a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className={link}>
							Google Ads Settings
						</a>
						, and from other partners at{" "}
						<a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className={link}>
							www.aboutads.info
						</a>
						. Residents of US states with privacy laws can treat the consent controls
						described below as their &quot;do not sell or share&quot; choice.
					</p>

					<h2 className={heading}>Cookies and Local Storage</h2>
					<p className={paragraph}>
						The Site&apos;s own code sets <strong>no cookies</strong>. It uses your
						browser&apos;s local storage for two things: a sign-in token, so you stay
						signed in, and your display preferences, such as the theme you picked. Both are
						needed to run the Site as you asked for it, and neither is sent anywhere else.
					</p>
					<p className={paragraph}>
						One cookie is set on every visit without asking, because the Site cannot work
						without it: <code>__cf_bm</code>, from Cloudflare, the network that delivers
						the Site and protects it from automated abuse. It tells Cloudflare that
						requests from your browser belong to one person and not a bot. It holds no
						information about you, cannot be read by our code, and expires 30 minutes
						after your last request. Cloudflare describes it in its{" "}
						<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className={link}>
							privacy policy
						</a>
						. Site staff who sign in to the admin area also receive a session cookie for
						that area; it is never set for visitors.
					</p>
					<p className={paragraph}>
						Google Analytics and our advertising partner are the only other services that
						set cookies, and in the EU, the EEA, the UK and Switzerland they do so only
						after you agree. The prompt that asks arrives together with the ads; until
						then, neither service sets a cookie in those regions at all. Once it is there,
						your choice is remembered on your device so you are not asked again, and you
						can change it at any time. You can also clear or block cookies in your browser
						settings; the calculator works without them.
					</p>
					<p className={paragraph}>
						The video on the home page is a YouTube video, but it does not load until you
						press play. Until then nothing on that page contacts YouTube. Once you do, the
						player runs in YouTube&apos;s privacy-enhanced mode, which does not set
						advertising cookies before playback, and anything it stores from then on is
						governed by Google&apos;s privacy policy.
					</p>

					<h2 className={heading}>Feedback and Bug Reports</h2>
					<p className={paragraph}>
						Bug reports, data corrections and feature ideas go through our{" "}
						<a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className={link}>
							Discord server
						</a>
						. Discord is a separate service: anything you post there is held by Discord
						under{" "}
						<a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className={link}>
							its own privacy policy
						</a>
						, and the Site never receives or stores it. Messages sent through the form the
						Site had before September 22, 2026 were stored without any contact details or
						IP address; they are kept only until they have been acted on, then deleted.
					</p>

					<h2 className={heading}>How Long We Keep It</h2>
					<ul className={list}>
						<li>
							<strong>Account data and your plan</strong>: until you delete your account.
							Deleting it removes everything at once.
						</li>
						<li>
							<strong>Visitor scrambled values</strong>: 90 days. The daily and monthly
							totals they produce contain nothing about anyone and are kept.
						</li>
						<li>
							<strong>Google Analytics data</strong>: at most 14 months, held by Google.
						</li>
						<li>
							<strong>Cloudflare&apos;s <code>__cf_bm</code> cookie</strong>: 30 minutes.
						</li>
						<li>
							<strong>Your cookie choice</strong>: on your device, until you change or
							clear it.
						</li>
					</ul>

					<h2 className={heading}>Where Your Data Is Stored</h2>
					<p className={paragraph}>
						The Site&apos;s database is hosted by DigitalOcean in the United States (New
						York), and it is delivered through Cloudflare&apos;s network, which handles each
						request at the data centre nearest you. Google Analytics and Google&apos;s
						advertising services process data in the United States as well. For visitors in the EU, the EEA, the UK and
						Switzerland this is a transfer outside your region. Google is certified under
						the EU-US Data Privacy Framework, and its UK and Swiss extensions, which the
						European Commission recognizes as adequate protection. For the database, the
						only personal data transferred is the anonymous account data described above,
						and it is protected by Standard Contractual Clauses in DigitalOcean&apos;s data
						processing agreement.
					</p>

					<h2 className={heading}>Your Rights</h2>
					<p className={paragraph}>
						If you are in the EU, the EEA, the UK or Switzerland, GDPR gives you the
						following rights over your data. We extend them to everyone.
					</p>
					<ul className={list}>
						<li>
							<strong>Access</strong>: to know what we hold about you. Your{" "}
							<Link to="/account" className={link}>
								Account page
							</Link>{" "}
							shows all of it: your username, your linked sign-in methods, your display
							name, your oshis, and the plans themselves are on the calculator.
						</li>
						<li>
							<strong>Rectification</strong>: to correct it. Everything we hold is editable
							by you on the Account page or in the calculator.
						</li>
						<li>
							<strong>Erasure</strong>: to have it deleted. The &quot;Delete account&quot;
							button on the Account page does this immediately and completely.
						</li>
						<li>
							<strong>Portability</strong>: to receive a copy of your data in a usable
							form. Email us and we will send your plan data as a file.
						</li>
						<li>
							<strong>Restriction and objection</strong>: to ask us to stop or limit
							processing, including on legitimate-interest grounds. Email us.
						</li>
						<li>
							<strong>Withdraw consent</strong>: for Analytics and advertising cookies, at
							any time, through the same prompt that asked for it. Withdrawing does not
							undo processing that already happened.
						</li>
						<li>
							<strong>Complain</strong>: to your national data protection authority if you
							think we have handled your data wrongly. We would rather hear from you first,
							but the choice is yours.
						</li>
					</ul>
					<p className={paragraph}>
						To make a request by email, include the username shown on your Account page. It
						is the only way we can tell which account is yours, because we hold no email
						address to match you against. We answer within one month.
					</p>

					<h2 className={heading}>Account Recovery</h2>
					<p className={paragraph}>
						Because we store no email address, there is no password reset and no way for
						us to verify your identity if you lose access to every Google, Discord, or
						Patreon account you signed in with. If that happens, your saved plan cannot be
						recovered, and you would need to start a new plan. That is the trade-off
						for holding none of your personal data.
					</p>

					<h2 className={heading}>Children</h2>
					<p className={paragraph}>
						The Site is not aimed at children under 16, and we do not knowingly hold any
						data about them. Since we hold no age or contact details, we cannot tell; if you
						believe a child has created an account, email us and we will delete it.
					</p>

					<h2 className={heading}>Changes to This Policy</h2>
					<p className={paragraph}>
						We may update this Privacy Policy from time to time. Any changes will be posted on
						this page with an updated &quot;Last updated&quot; date, and a change that
						affects what we collect will also appear on the{" "}
						<Link to="/changelog" className={link}>
							Changelog
						</Link>
						.
					</p>

					<h2 className={heading}>Contact Us</h2>
					<p className={paragraph}>
						For anything about this policy or your data, email{" "}
						<a href={`mailto:${CONTACT_EMAIL}`} className={link}>
							{CONTACT_EMAIL}
						</a>
						.
					</p>
				</div>
			</main>
			<Footer />
		</div>
	)
}
