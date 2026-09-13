import { useEffect, useRef, useState } from "react"
import type React from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Footer } from "../footer/Footer"
import { Wordmark } from "../Wordmark"
import { completeSocialLogin, peekPendingLoginProvider } from "../../services/socialAuth"
import { completeAccountLink, peekPendingLinkProvider } from "../../services/accountLinking"
import { useAccount } from "../../services/AuthContext"
import { ApiError } from "../../services/userServices"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"
import { PROVIDERS } from "../../constants/providers"

/**
 * Where every provider sends the browser back to: /auth/callback?code=…&state=…
 *
 * ONE PAGE, TWO FLOWS. Sign-in (socialAuth.ts) and account linking
 * (accountLinking.ts) both register this URL with the providers, so this page
 * has to work out which one it is finishing. It asks the two services, each of
 * which parks its pending state under its OWN sessionStorage key — mirroring
 * the two salts on the server — and a link is only considered while someone is
 * signed in, because a link can only have been started by someone who was.
 *
 *   sign-in  → trade the code for an API token, hand off to /app (where
 *              CalculatorProvider picks up any stashed guest plan).
 *   link     → attach the identity to the signed-in account, re-read
 *              /account, hand off to /account.
 */

type Flow = "login" | "link"

export const OAuthCallback: React.FC = () => {
	useDocumentMeta("Signing In", "Completing sign-in.", true)

	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const { isLoggedIn, refresh } = useAccount()
	const [exchangeError, setExchangeError] = useState<string | null>(null)
	// Which flow this page is finishing, LATCHED at mount. It has to be read
	// before completeAccountLink consumes the parked entry, and it must not
	// change afterwards or the error screen would switch to the sign-in copy.
	// A pending LINK can only exist for someone who was signed in when they
	// started it, so it is only honoured while they still are; a link left in a
	// tab whose token has since gone is stale, and the sign-in path rejects it
	// cleanly rather than linking into nothing.
	//
	// This is the one render-time storage read outside the /app gate, and it is
	// allowed because this route is never prerendered or hydrated (see
	// prerenderRoutes.ts): the browser renders it from the empty shell, so
	// there is no server snapshot to disagree with.
	const [linkProvider] = useState(() => (isLoggedIn ? peekPendingLinkProvider() : null))
	const flow: Flow = linkProvider ? "link" : "login"

	const code = searchParams.get("code")
	const state = searchParams.get("state")
	const providerError = searchParams.get("error")

	/**
	 * The authorization code is SINGLE-USE. React StrictMode mounts every
	 * component twice in development, and without this guard the second mount
	 * would replay an already-redeemed code, get a 400, and show an error to a
	 * user whose sign-in actually succeeded. Same pattern as didMigrateRef in
	 * CalculatorProvider.
	 */
	const didExchangeRef = useRef(false)

	// Problems visible straight from the URL are a pure function of the query
	// string, so they are derived here rather than pushed into state.
	const isLinking = flow === "link"
	let paramError: string | null = null
	if (providerError) {
		// The user pressed Cancel on the consent screen. Not a failure worth
		// alarming language — just send them back to try again.
		paramError =
			providerError === "access_denied"
				? isLinking
					? "Connecting was cancelled."
					: "Sign in was cancelled."
				: "Your provider reported a problem."
	} else if (!code || !state) {
		paramError = "This link is incomplete. Please try again."
	}

	const error = paramError ?? exchangeError

	useEffect(() => {
		if (paramError || !code || !state) return
		if (didExchangeRef.current) return
		didExchangeRef.current = true

		if (linkProvider) {
			completeAccountLink(linkProvider, code, state)
				.then(() => {
					// The account in context predates the link; re-read it so the
					// account page lands already showing the new provider.
					refresh()
					toast.success(`${PROVIDERS[linkProvider].label} connected to your account.`)
					navigate("/account", { replace: true })
				})
				.catch((e: unknown) => {
					setExchangeError(
						e instanceof ApiError ? e.message : "Could not connect that account. Please try again."
					)
				})
			return
		}

		// The provider is inferred from the pending login saved before the
		// redirect, not from the URL — the URL is attacker-controllable.
		completeSocialLogin(peekPendingLoginProvider() ?? "", code, state)
			.then(() => {
				// replace: true so Back doesn't return to a spent callback URL.
				navigate("/app", { replace: true })
			})
			.catch((e: unknown) => {
				setExchangeError(
					e instanceof ApiError ? e.message : "Could not complete sign in. Please try again."
				)
			})
	}, [code, state, paramError, navigate, linkProvider, refresh])

	return (
		<div className="flex min-h-screen flex-col bg-gray-900 p-4">
			<div className="m-auto w-full max-w-sm overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl">
				<div className="flex justify-center border-b border-gray-700 px-8 py-4">
					<Wordmark size="card" />
				</div>

				<div className="px-8 py-7">
					{error ? (
						<>
							<h2 className="mb-3 text-xl font-semibold text-gray-100">
								{isLinking ? "Couldn't connect" : "Sign in failed"}
							</h2>
							<div role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
								<p className="text-sm text-red-400">{error}</p>
							</div>
							{isLinking ? (
								<Link
									to="/account"
									className="block w-full rounded-lg bg-brand py-2.5 text-center text-sm font-bold text-black transition hover:bg-brand/85"
								>
									Back to your account
								</Link>
							) : (
								<>
									<Link
										to="/login"
										className="block w-full rounded-lg bg-brand py-2.5 text-center text-sm font-bold text-black transition hover:bg-brand/85"
									>
										Back to sign in
									</Link>
									{/* Guests can keep planning without an account, so offer
									    the exit that doesn't require resolving the error. */}
									<Link
										to="/app"
										className="mt-4 block text-center text-xs text-gray-500 underline transition hover:text-gray-400"
									>
										Continue without an account
									</Link>
								</>
							)}
						</>
					) : (
						<div className="flex flex-col items-center gap-4 py-6" role="status" aria-live="polite">
							<div
								className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-brand"
								aria-hidden="true"
							/>
							<p className="text-sm text-gray-400">
								{isLinking ? "Connecting your account…" : "Signing you in…"}
							</p>
						</div>
					)}
				</div>
			</div>
			<Footer />
		</div>
	)
}
