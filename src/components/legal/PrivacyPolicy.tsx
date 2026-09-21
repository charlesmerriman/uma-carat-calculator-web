import type React from "react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"

// Shared text styles so the sections stay visually consistent and easy to tweak.
const heading = "mt-8 text-xl font-semibold text-gray-100"
const paragraph = "mt-3 leading-relaxed text-gray-300"
const list = "mt-3 list-disc space-y-1 pl-6 leading-relaxed text-gray-300"
const link = "text-brand transition hover:text-brand/75"

/**
 * Public Privacy Policy page (route: /privacy-policy).
 *
 * Required for Google AdSense approval. The content is customized boilerplate that
 * reflects what this site actually collects and does — it is NOT legal advice and
 * should be reviewed before going live with ads.
 */
export const PrivacyPolicy: React.FC = () => {
	useDocumentMeta("Privacy Policy", "What the Uma Musume Carat Calculator collects, how it is used, and the choices you have. No email address, no real name and no IP address is ever stored.")

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
					<p className="mt-2 text-sm text-gray-500">Last updated: September 21, 2026</p>

					<p className={paragraph}>
						This Privacy Policy explains what information the Uma Musume Carat Calculator
						(&quot;the Site&quot;) collects, how it is used, and the choices you have. By
						using the Site you agree to the practices described below.
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
						We do <strong>not</strong> collect or store your email address, your real
						name, your provider display name, your profile picture, or any password. We
						never see your Google, Discord, or Patreon password. Those services verify it
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
						income ranks, and the banners you plan to pull on. This data is tied to your
						anonymous account so your plan is available the next time you sign in. If you
						use the Site as a guest, your plan stays in your browser and is discarded
						when you leave.
					</p>

					<h2 className={heading}>How We Use Your Information</h2>
					<p className={paragraph}>
						We use your account reference and planning data to operate the Site: to
						recognize you when you sign in, to save and display your resource
						projections, and to keep your plan synced across sessions. We also analyze
						planning data in aggregate, anonymized form (for example, the percentage of
						users who enable certain income options, or the overall popularity of
						banners) to understand how the Site is used and to improve it. These statistics
						never identify individual users. We do not sell your personal information,
						and because we hold no contact details, we cannot send you marketing of any
						kind.
					</p>

					<h2 className={heading}>Account Recovery</h2>
					<p className={paragraph}>
						Because we store no email address, there is no password reset and no way for
						us to verify your identity if you lose access to every Google, Discord, or
						Patreon account you signed in with. If that happens, your saved plan cannot be
						recovered, and you would need to start a new plan. That is the trade-off
						for holding none of your personal data.
					</p>

					<h2 className={heading}>Deleting Your Account</h2>
					<p className={paragraph}>
						You can delete your account at any time from the Account page. This
						permanently removes your saved plan, your connected sign-in methods, your
						display name and your oshis. Feedback you have sent
						stays, with no link to you. If you support us on Patreon, your place on the supporters list is
						unaffected. It reflects your pledge, not your account here.
					</p>

					<h2 className={heading}>Feedback You Send Us</h2>
					<p className={paragraph}>
						If you use the feedback form, we store the message you write and the category
						you pick, so we can read and act on it. The form has{" "}
						<strong>no contact field</strong>. We do not ask for your email address or any
						other way to reach you, which also means we cannot reply to what you send. If
						you are signed in, the message is linked to your anonymous account reference so
						we can tell repeat reports apart; if you are a guest, it is stored with no
						account attached at all.
					</p>
					<p className={paragraph}>
						Because the message box is free text, please do not put personal details in it. It is
						stored exactly as you write it. As with the traffic counting described
						above, <strong>no IP address is recorded</strong> when you submit feedback.
					</p>

					<h2 className={heading}>Cookies and Local Storage</h2>
					<p className={paragraph}>
						The Site stores an authentication token in your browser&apos;s local storage to
						keep you signed in, along with display preferences such as your chosen theme.
						The Site sets no cookies of its own. Google Analytics and third-party
						advertising partners (see below) may set cookies on your device.
					</p>

					<h2 className={heading}>Traffic Measurement</h2>
					<p className={paragraph}>
						To understand how many people use the Site, we count page loads ourselves.
						When you load the Site,
						your browser sends a single request that increments a daily counter. It sets
						no cookie, and it happens whether or not you have an account.
					</p>
					<p className={paragraph}>
						So that we can tell how many separate people visit rather than just how many
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
					<p className={paragraph}>
						We also use Google Analytics, a service run by Google, to see which pages are
						visited and roughly where visitors come from. Google Analytics sets cookies and
						collects information such as the pages you view, your device and browser type,
						and your approximate location. Google processes this under its own{" "}
						<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className={link}>
							privacy policy
						</a>
						. It does not receive your account details or anything you save in the
						calculator. You can stop it by installing the{" "}
						<a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className={link}>
							Google Analytics opt-out browser add-on
						</a>
						.
					</p>

					<h2 className={heading}>Third-Party Advertising</h2>
					<p className={paragraph}>
						We may use third-party advertising companies, including Google, to serve ads when
						you visit the Site. Google, as a third-party vendor, uses cookies to serve ads
						based on your prior visits to this and other websites. Google&apos;s use of
						advertising cookies enables it and its partners to serve ads to you based on your
						visits to this Site and/or other sites on the internet.
					</p>

					<h2 className={heading}>How to Opt Out</h2>
					<p className={paragraph}>
						You may opt out of personalized advertising by visiting{" "}
						<a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className={link}>
							Google Ads Settings
						</a>
						. You can also opt out of a third party&apos;s use of cookies for personalized
						advertising by visiting{" "}
						<a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className={link}>
							www.aboutads.info
						</a>
						.
					</p>

					<h2 className={heading}>Changes to This Policy</h2>
					<p className={paragraph}>
						We may update this Privacy Policy from time to time. Any changes will be posted on
						this page with an updated &quot;Last updated&quot; date.
					</p>

					<h2 className={heading}>Contact Us</h2>
					<p className={paragraph}>
						If you have any questions about this Privacy Policy, you can contact us at{" "}
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
