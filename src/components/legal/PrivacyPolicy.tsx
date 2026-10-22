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
 * views, the Feedback page, and the Patreon supporter sync (MEMBER_FIELDS in the
 * API's patreon_api.py, and the PatreonSupporter model it fills: those rows are
 * about people who may never visit the Site, which is GDPR Article 14 territory).
 * It is not legal advice.
 */
export const PrivacyPolicy: React.FC = () => {
	useDocumentMeta("Privacy Policy", "What the Uma Musume Carat Calculator collects, why, how long it is kept, and your rights. Accounts hold no email address or real name, and no IP address is ever stored.")

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
					<h1 className="font-display text-3xl font-bold text-gray-100">Privacy Policy</h1>
					<p className="mt-2 text-sm text-gray-500">Last updated: October 22, 2026</p>

					<p className={paragraph}>
						This policy explains what the Uma Musume Carat Calculator (&quot;the Site&quot;)
						collects, why, how long it is kept, and what you can do about it. It is written
						to meet the EU and UK General Data Protection Regulation (GDPR), and it applies
						to everyone who uses the Site, wherever they are.
					</p>

					<h2 className={heading}>The Short Version</h2>
					<p className={paragraph}>
						The Site holds as little about you as it can. Whether you visit as a guest or
						sign in, we do <strong>not</strong> collect or store:
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
						in, the plan you build, anything you choose to post in the PvP gallery, an
						anonymous visitor count, and the data that Google Analytics and (if ads run) our
						advertising partner collect with your consent.
					</p>
					<p className={paragraph}>
						Patreon supporters are the one exception. If you pledge to us on Patreon, Patreon
						shares your name and email address with us, and we keep them in our supporter
						list. See &quot;Patreon Supporters&quot; below.
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
							A display name, if you choose one on your account page. It is shown to you,
							and to everyone else only next to a team or comment you post in the PvP
							gallery, or a comment you leave on a PvP guide (see below). You can change it whenever you like, and clear it once
							you have no team posted.
						</li>
						<li>
							The favorite characters you pick on your account page. These are picks from
							the Site&apos;s own catalogue, not anything about you, and the first one is used
							as your picture, including next to anything you post in the gallery.
						</li>
					</ul>
					<p className={paragraph}>
						We never see your Google, Discord, or Patreon password. Those services verify it
						and only confirm to us that the sign-in succeeded. We request the narrowest
						permission each provider offers, so your email address and profile details
						are never sent to us in the first place; where a provider includes something
						about you anyway, such as a username, we discard it without storing it. In
						Patreon&apos;s case, signing in tells us that an account exists and, if you link
						it, whether it currently supports us. Signing in never sends us your email
						address, your pledge amount or your billing details. Supporters are covered
						separately in &quot;Patreon Supporters&quot; below.
					</p>
					<p className={paragraph}>
						When you use the calculator, we store the planning data you enter, including
						your current in-game resources (such as carats and tickets), your selected
						income ranks, the banners you plan to pull on, and any notes you write on them.
						Notes are shown only to you. This data is tied to your
						anonymous account so your plan is available the next time you sign in. If you
						use the Site as a guest, the same planning data is kept in your browser on
						your own device and is never sent to us. It stays there until you clear it,
						your browser removes it, or you sign in, at which point it is added to your
						account.
					</p>

					<h2 className={heading}>The PvP Gallery</h2>
					<p className={paragraph}>
						Posting a team to the gallery is your choice, and the post dialog asks you to
						agree first. Once you post, everyone can see the team, your caption and strategy, your
						display name, your favorite character picture and, if you support us on Patreon and
						leave it switched on, your tier. The same shows next to any comment you write, on a
						team or on a PvP guide. A thumbs-up you give a comment only adds to its count: nobody
						can see who gave it.
					</p>
					<ul className={list}>
						<li>
							<strong>Upvotes</strong>: we store which posts you upvoted, so each person
							counts once. Nobody else can see who upvoted what.
						</li>
						<li>
							<strong>Views</strong>: we count how often each post is opened. To count each
							person once a day, the server keeps a scrambled value in its memory for a day.
							It is never written to our database.
						</li>
						<li>
							<strong>Reports</strong>: if you report a post or comment, we keep the report
							and your account reference for our moderators. They see reported posts and
							comments in a private channel on our Discord server, along with each report and
							the display name of whoever made it, and once they decide, that message is cut
							down to the decision alone. The person you reported is never told who you are.
						</li>
						<li>
							<strong>Link previews</strong>: when a post&apos;s link is shared on Discord, X
							or a similar service, that service fetches a picture of the team&apos;s three
							characters with their running styles, plus the event name and the characters&apos;
							names. Nothing about you is in it. Those services keep their own copy under their
							own policies, even after a post is taken down.
						</li>
					</ul>
					<p className={paragraph}>
						Taking a post down deletes it with its upvotes and comments. Deleting your account
						deletes your posts, your upvotes and thumbs-ups, and your comments, except that a comment someone
						has replied to stays in its thread as &quot;[deleted]&quot;, with no text and no
						name.
					</p>

					<h2 className={heading}>Patreon Supporters</h2>
					<p className={paragraph}>
						If you pledge to us on a paid Patreon tier, Patreon shares some of your membership
						details with us as the page&apos;s creator. This happens whether or not you have an
						account on the Site. Every day we copy these details into our supporter list:
					</p>
					<ul className={list}>
						<li>the name on your Patreon account</li>
						<li>the email address on your Patreon account, if Patreon provides one</li>
						<li>your tier, the date your pledge started, and whether it is still active</li>
						<li>
							Patreon&apos;s ID number for your account, which lets us match your pledge to a
							Site account you sign in or link with Patreon
						</li>
					</ul>
					<p className={paragraph}>
						We don&apos;t ask Patreon for your postal address, phone number or payment
						history, so we never receive them. Free members of our Patreon page are not on
						the list.
					</p>
					<p className={paragraph}>
						We use the list to give supporters their benefits on the Site and to thank them.
						Your email address is seen only by Site staff, in our admin area, and only to
						tell supporters apart when two have similar names or one changes theirs. It is
						never shown on the Site, and we never use it to contact you.
					</p>
					<p className={paragraph}>
						Your name appears in the supporter list on the home page only if you have agreed
						to it. Everyone else is counted without a name. If you link Patreon to your
						account, your tier can also show next to your gallery posts, and you can switch
						that off on your Account page.
					</p>
					<p className={paragraph}>
						When a pledge ends, we keep your entry marked as inactive, so your start date
						and your choice about being named are still there if you come back. Deleting
						your Site account unlinks your entry but does not delete it. To see what we hold
						about you as a supporter, correct it, or have it deleted, email us from the
						address on your Patreon account.
					</p>

					<h2 className={heading}>Why We Use It, and the Legal Basis</h2>
					<p className={paragraph}>
						GDPR requires a legal basis for each thing we do with your data. These are ours:
					</p>
					<ul className={list}>
						<li>
							<strong>Running your account and saving your plan</strong> (your account
							reference, username, display name, favorite characters and planning data). Basis:{" "}
							<strong>performance of a contract</strong>, Article 6(1)(b). This is the
							service you asked for when you signed in.
						</li>
						<li>
							<strong>Showing what you post in the gallery</strong> (your team, caption, strategy,
							comments, display name, picture and tier). Basis: <strong>your consent</strong>,
							Article 6(1)(a), given when you post. You withdraw it by taking the post down or
							deleting the comment.
						</li>
						<li>
							<strong>Keeping the supporter list</strong> (the Patreon details described
							above). Basis: <strong>legitimate interest</strong>, Article 6(1)(f), in giving
							supporters the benefits they pledged for, thanking them, and keeping an accurate
							record of who supports us. Showing your name on the home page is based on{" "}
							<strong>your consent</strong>, Article 6(1)(a).
						</li>
						<li>
							<strong>Moderating the gallery</strong> (reports, and limits on how often you
							can post or comment). Basis: <strong>legitimate interest</strong>, Article
							6(1)(f), in keeping the gallery free of spam and abuse.
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
						We do not sell your personal information, and we send no marketing of any kind.
						The only contact details we hold are supporters&apos; email addresses, used only
						as described in &quot;Patreon Supporters&quot;.
					</p>

					<h2 className={heading}>Traffic Measurement</h2>
					<h3 className={subheading}>Our own counter</h3>
					<p className={paragraph}>
						To understand how many people use the Site, we count page loads ourselves.
						When you load the Site,
						your browser sends a single request that increments a daily counter. That
						request also says which page you opened first and the name of the site that
						linked you here, if any, such as google.com, so we can see which pages and
						communities bring people in. We keep only the page and the site&apos;s name,
						never the rest of the link. The request sets no cookie, and it happens whether
						or not you have an account.
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
						identifies you is sent until you accept the cookie prompt. Anywhere else it
						starts on, and Reject on the same prompt turns it off. You can also block it
						everywhere by installing the{" "}
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
						browser&apos;s local storage for three things: a sign-in token, so you stay
						signed in, your display preferences, such as the theme you picked, and your
						plan while you use the Site as a guest. All three are needed to run the Site
						as you asked for it, and none is sent anywhere else. You can remove a guest
						plan with &quot;Clear plan and start over&quot; in the calculator&apos;s
						settings, or by clearing the Site&apos;s data in your browser.
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
						set cookies. On your first visit a prompt asks whether to allow them, with
						Accept and Reject side by side. In the EU, the EEA, the UK and Switzerland
						neither service sets a cookie until you accept; elsewhere Analytics starts on,
						and Reject turns it off. Your choice is saved on your device so you are not
						asked again, and &quot;Cookie settings&quot; in the footer reopens the prompt
						whenever you want to change it. You can also clear or block cookies in your
						browser settings; the calculator works without them.
					</p>
					<p className={paragraph}>
						The video on the home page is embedded in YouTube&apos;s privacy-enhanced mode,
						which does not set advertising cookies unless you play it. Anything the player
						stores from then on is governed by Google&apos;s privacy policy.
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
						, and the Site never receives or stores it.
					</p>

					<h2 className={heading}>How Long We Keep It</h2>
					<ul className={list}>
						<li>
							<strong>Account data and your plan</strong>: until you delete your account.
							Deleting it removes everything at once.
						</li>
						<li>
							<strong>Gallery posts and comments</strong>: until you take them down or delete
							your account. Reports are kept as a record of what our moderators decided, with
							your account reference removed if you delete your account.
						</li>
						<li>
							<strong>Patreon supporter list</strong>: while you pledge, then kept marked as
							inactive until you ask us to delete it.
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
						only personal data transferred is the anonymous account data and the supporter
						list described above, and both are protected by Standard Contractual Clauses in DigitalOcean&apos;s data
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
							name, your favorite characters, and the plans themselves are on the calculator.
						</li>
						<li>
							<strong>Rectification</strong>: to correct it. Everything we hold is editable
							by you on the Account page or in the calculator.
						</li>
						<li>
							<strong>Erasure</strong>: to have it deleted. The &quot;Delete account&quot;
							button on the Account page does this immediately and completely. A Patreon
							supporter entry is kept separately: email us to have it deleted.
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
							any time, through &quot;Cookie settings&quot; in the footer. Withdrawing does
							not undo processing that already happened.
						</li>
						<li>
							<strong>Complain</strong>: to your national data protection authority if you
							think we have handled your data wrongly. We would rather hear from you first,
							but the choice is yours.
						</li>
					</ul>
					<p className={paragraph}>
						To make a request by email, include the username shown on your Account page. It
						is the only way we can tell which account is yours, because accounts have no
						email address to match you against. For a request about your Patreon supporter
						entry, write from the email address on your Patreon account. We answer within
						one month.
					</p>

					<h2 className={heading}>Account Recovery</h2>
					<p className={paragraph}>
						Because accounts have no email address, there is no password reset and no way for
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
