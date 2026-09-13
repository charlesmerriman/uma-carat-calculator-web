import { useState } from "react"
import type React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ArrowUpRight, Heart, LogOut } from "lucide-react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { Avatar } from "./Avatar"
import { PROVIDERS } from "../../constants/providers"
import { useAccount } from "../../services/AuthContext"
import { SOCIAL_PROVIDERS, type SocialProvider } from "../../services/socialAuth"
import { startAccountLink, unlinkProvider } from "../../services/accountLinking"
import { ApiError } from "../../services/userServices"
import { PATREON_URL } from "../../constants/links"
import { formatDate } from "../../utils/dateFormat"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"
import type { Account } from "../../types/account"

/**
 * /account — the signed-in person's account: which providers are connected,
 * whether they are a Patreon supporter, and sign-out.
 *
 * This is what makes linking REACHABLE. The link endpoints shipped with Patreon
 * sign-in and sat unused until this page called them; before it, someone with a
 * Google account who pledged on Patreon had no way to be recognised.
 *
 * No route requires an account, and this one is no exception: a guest sees a
 * card inviting them to sign in, not a redirect. `noindex` because it is
 * plumbing — the same class as /login — and it is deliberately NOT in
 * PRERENDER_ROUTES: a static render of it is a guest card, which is not the page.
 *
 * Render-time code here touches no browser globals (the navbar above it renders
 * on every prerendered page); `window.location.assign` only runs in a handler.
 */

/**
 * How a benefit KEY from the API reads to a person. Keys arrive from
 * `account.supporter.benefits`; the server decides who holds which (see
 * calculatorapi/benefits.py). A key with no label here is skipped rather than
 * shown raw — a benefit should not appear on this page before it has a name.
 */
const BENEFIT_LABELS: Record<string, string> = {
	ad_free: "Ad-free browsing",
}

const CARD = "rounded-xl border border-gray-700 bg-gray-800 p-5"
const CARD_TITLE = "text-base font-semibold text-gray-100"
const BUTTON_PRIMARY =
	"rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
const BUTTON_GHOST =
	"rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-600 disabled:hover:bg-transparent disabled:hover:text-gray-300"

function messageFrom(e: unknown, fallback: string): string {
	return e instanceof ApiError ? e.message : fallback
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	// Same shell as Feedback and NotFound: flex-1 on <main> absorbs leftover
	// viewport height so the footer keeps its band at the bottom of a short page.
	<div className="flex min-h-dvh flex-col bg-gray-900">
		<Navbar />
		<main className="flex-1">
			<div className="mx-auto max-w-2xl px-4 py-8">
				<h1 className="text-3xl font-bold text-gray-100">Account</h1>
				{children}
			</div>
		</main>
		<Footer />
	</div>
)

const GuestCard: React.FC = () => (
	<div className={`${CARD} mt-6`}>
		<h2 className={CARD_TITLE}>You're not signed in</h2>
		<p className="mt-2 text-sm leading-relaxed text-gray-400">
			Sign in to manage the providers connected to your account and to be recognised as a
			Patreon supporter. The calculator itself works without an account.
		</p>
		<div className="mt-4 flex flex-wrap gap-3">
			<Link to="/login" className={BUTTON_PRIMARY}>
				Sign in
			</Link>
			<Link to="/app" className={BUTTON_GHOST}>
				Open the calculator
			</Link>
		</div>
	</div>
)

const Loading: React.FC = () => (
	<div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
		<div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-600 border-t-brand" aria-hidden="true" />
		<span className="sr-only">Loading your account…</span>
	</div>
)

const LoadError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
	<div className={`${CARD} mt-6`}>
		<h2 className={CARD_TITLE}>Couldn't load your account</h2>
		<p className="mt-2 text-sm text-gray-400">The server may be down. Please try again.</p>
		<button type="button" onClick={onRetry} className={`${BUTTON_PRIMARY} mt-4`}>
			Retry
		</button>
	</div>
)

interface DetailsProps {
	account: Account
	refresh: () => void
	signOut: () => Promise<void>
}

const AccountDetails: React.FC<DetailsProps> = ({ account, refresh, signOut }) => {
	// Which provider has an action in flight, so only that row shows it.
	const [pending, setPending] = useState<SocialProvider | null>(null)
	const [signingOut, setSigningOut] = useState(false)

	const linkedFor = (provider: SocialProvider) =>
		account.linked_providers.find((row) => row.provider === provider)
	// The server refuses to remove the last sign-in method of a password-less
	// account (there is no email to recover through). Disabling the button is a
	// courtesy so the refusal is not a surprise; the rule itself lives there.
	const isOnlyMethod = account.linked_providers.length <= 1
	const patreonLinked = linkedFor("patreon") !== undefined
	const supporter = account.supporter

	const handleConnect = async (provider: SocialProvider): Promise<void> => {
		setPending(provider)
		try {
			// On success the browser navigates to the provider; nothing below runs.
			await startAccountLink(provider)
		} catch (e: unknown) {
			toast.error(messageFrom(e, `Could not start connecting ${PROVIDERS[provider].label}.`))
			setPending(null)
		}
	}

	const handleDisconnect = async (provider: SocialProvider): Promise<void> => {
		setPending(provider)
		try {
			await unlinkProvider(provider)
			toast.success(`${PROVIDERS[provider].label} disconnected.`)
			// Entitlement may have changed too (Patreon), so re-read the whole
			// account rather than patching the list locally.
			refresh()
		} catch (e: unknown) {
			toast.error(messageFrom(e, `Could not disconnect ${PROVIDERS[provider].label}.`))
		} finally {
			setPending(null)
		}
	}

	const handleSignOut = async (): Promise<void> => {
		setSigningOut(true)
		await signOut()
		// A full load so every provider starts over as a guest; the home page is
		// the natural place to land from here.
		window.location.assign("/")
	}

	const benefitLabels = (supporter.benefits ?? [])
		.filter((key) => key in BENEFIT_LABELS)
		.map((key) => BENEFIT_LABELS[key])

	return (
		<>
			{/* Identity */}
			<div className="mt-6 flex items-center gap-4">
				<Avatar src={account.avatar_url} name={account.username} size="lg" />
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span className="truncate text-lg font-semibold text-gray-100">{account.username}</span>
						{supporter.is_supporter && supporter.tier && (
							<span className="rounded-full border border-brand/55 bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
								{supporter.tier}
							</span>
						)}
					</div>
					<p className="mt-1 text-xs leading-relaxed text-gray-500">
						Your picture comes from the provider you last signed in with. We never store
						your name or email — only this handle and your picture.
					</p>
				</div>
			</div>

			{/* Sign-in methods */}
			<section className={`${CARD} mt-6`} aria-labelledby="sign-in-methods">
				<h2 id="sign-in-methods" className={CARD_TITLE}>
					Sign-in methods
				</h2>
				<p className="mt-1 text-sm text-gray-400">
					Connect more than one so you can sign in either way. Each provider can be
					connected to one account.
				</p>
				<ul className="mt-4 divide-y divide-gray-700">
					{SOCIAL_PROVIDERS.map((provider) => {
						const { label, Mark } = PROVIDERS[provider]
						const linked = linkedFor(provider)
						const busy = pending === provider
						return (
							<li key={provider} className="flex flex-wrap items-center justify-between gap-3 py-3">
								<div className="flex min-w-0 items-center gap-3">
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-700 text-gray-100">
										<Mark />
									</span>
									<div className="min-w-0">
										<div className="text-sm font-medium text-gray-100">{label}</div>
										<div className="text-xs text-gray-400">
											{linked ? `Connected ${formatDate(linked.linked_at)}` : "Not connected"}
										</div>
										{linked && provider === "patreon" && (
											<div className="mt-0.5 text-xs text-gray-500">
												Disconnecting also removes your supporter status here until you reconnect.
											</div>
										)}
									</div>
								</div>
								{linked ? (
									<button
										type="button"
										onClick={() => void handleDisconnect(provider)}
										disabled={busy || isOnlyMethod}
										title={
											isOnlyMethod
												? "This is the only way to sign in to this account. Connect another provider first."
												: undefined
										}
										className={BUTTON_GHOST}
									>
										{busy ? "Disconnecting…" : "Disconnect"}
									</button>
								) : (
									<button
										type="button"
										onClick={() => void handleConnect(provider)}
										disabled={pending !== null}
										className={BUTTON_PRIMARY}
									>
										{busy ? "Redirecting…" : "Connect"}
									</button>
								)}
							</li>
						)
					})}
				</ul>
			</section>

			{/* Patreon supporter */}
			<section className={`${CARD} mt-4`} aria-labelledby="supporter-status">
				<h2 id="supporter-status" className={`${CARD_TITLE} flex items-center gap-2`}>
					<Heart className="h-4 w-4 text-brand" aria-hidden="true" />
					Patreon supporter
				</h2>
				{supporter.is_supporter ? (
					<>
						<p className="mt-2 text-sm leading-relaxed text-gray-300">
							Thank you for supporting the site
							{supporter.tier ? ` on the ${supporter.tier} tier` : ""}.
						</p>
						{benefitLabels.length > 0 && (
							<>
								<h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
									Your benefits
								</h3>
								<ul className="mt-1.5 flex flex-wrap gap-2">
									{benefitLabels.map((label) => (
										<li
											key={label}
											className="rounded-full border border-gray-600 bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-200"
										>
											{label}
										</li>
									))}
								</ul>
							</>
						)}
						{/* Honest about timing: the key is real, the ads are not yet. */}
						<p className="mt-3 text-xs leading-relaxed text-gray-500">
							Ads aren't running on the site yet. When they start, supporters won't see them.
						</p>
					</>
				) : patreonLinked ? (
					<>
						<p className="mt-2 text-sm leading-relaxed text-gray-300">
							Your Patreon is connected, but we don't see an active pledge on it. Pledges
							sync once a day, so if you pledged in the last 24 hours, check back tomorrow.
						</p>
						<a
							href={PATREON_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-3 inline-flex items-center gap-1 text-sm text-brand underline-offset-2 hover:underline"
						>
							Support the site on Patreon
							<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
						</a>
					</>
				) : (
					<>
						<p className="mt-2 text-sm leading-relaxed text-gray-300">
							Connect the Patreon account you pledge with and you'll be recognised as a
							supporter here.
						</p>
						<div className="mt-3 flex flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={() => void handleConnect("patreon")}
								disabled={pending !== null}
								className={BUTTON_PRIMARY}
							>
								{pending === "patreon" ? "Redirecting…" : "Connect Patreon"}
							</button>
							<a
								href={PATREON_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-sm text-gray-400 underline-offset-2 hover:text-brand hover:underline"
							>
								Not a patron yet?
								<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
							</a>
						</div>
					</>
				)}
			</section>

			{/* Session */}
			<section className={`${CARD} mt-4`} aria-labelledby="session">
				<h2 id="session" className={CARD_TITLE}>
					Session
				</h2>
				<p className="mt-1 text-sm text-gray-400">
					Signing out forgets this browser. Your plan stays saved to your account.
				</p>
				<button
					type="button"
					onClick={() => void handleSignOut()}
					disabled={signingOut}
					className={`${BUTTON_GHOST} mt-4 inline-flex items-center gap-2`}
				>
					<LogOut className="h-4 w-4" aria-hidden="true" />
					{signingOut ? "Signing out…" : "Sign out"}
				</button>
			</section>
		</>
	)
}

export const AccountPage: React.FC = () => {
	useDocumentMeta(
		"Account",
		"Manage the sign-in providers connected to your Uma Musume Carat Calculator account and see your Patreon supporter status.",
		true
	)

	const { isLoggedIn, status, account, refresh, signOut } = useAccount()

	let body: React.ReactNode
	if (!isLoggedIn) {
		body = <GuestCard />
	} else if (status === "error") {
		body = <LoadError onRetry={refresh} />
	} else if (account === null) {
		// "loading", or a token that has not been checked yet.
		body = <Loading />
	} else {
		body = <AccountDetails account={account} refresh={refresh} signOut={signOut} />
	}

	return <Shell>{body}</Shell>
}
