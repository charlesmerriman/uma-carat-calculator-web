import { useState } from "react"
import type React from "react"
import { Link, useLocation } from "react-router-dom"
import { Footer } from "../footer/Footer"
import { Wordmark } from "../Wordmark"
import { readGuestPlan } from "../../services/guestPlanStore"
import { SOCIAL_PROVIDERS, safeReturnPath, startSocialLogin, type SocialProvider } from "../../services/socialAuth"
import { PROVIDERS } from "../../constants/providers"
import { ApiError } from "../../services/userServices"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"

export const Login: React.FC = () => {
	useDocumentMeta("Sign In", "Sign in to the Uma Musume Carat Calculator with Google, Discord or Patreon to keep your plan on every device.", true)

	// Where to land after signing in, when a page sent people here to do
	// something (the gallery's "Sign in to comment"). Router state, so a link
	// from outside cannot set it; checked again before it is stored.
	const location = useLocation()
	const returnTo = safeReturnPath((location.state as { returnTo?: unknown } | null)?.returnTo)

	// Which provider is mid-redirect, so only that button shows a pending state.
	const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null)
	const [error, setError] = useState<string | null>(null)

	// Read during render, which is safe on this route alone: /login is never
	// prerendered or hydrated, and readGuestPlan only reads.
	const hasGuestPlan = !!readGuestPlan()

	const handleSignIn = async (provider: SocialProvider): Promise<void> => {
		setError(null)
		setPendingProvider(provider)
		try {
			// On success the browser navigates away and nothing below runs.
			await startSocialLogin(provider, returnTo)
		} catch (e: unknown) {
			setError(
				e instanceof ApiError
					? e.message
					: "Could not start sign in. Please try again."
			)
			setPendingProvider(null)
		}
	}

	const buttonBase =
		"flex w-full items-center justify-center gap-3 rounded-lg py-2.5 text-sm font-semibold " +
		"transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"

	return (
		<div className="flex min-h-screen flex-col bg-gray-900 p-4">
			<div className="m-auto w-full max-w-sm overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl">
				{/* Brand header strip */}
				<div className="flex justify-center border-b border-gray-700 px-8 py-4">
					<Wordmark size="card" />
				</div>

				<div className="px-8 py-7">
					<h2 className="mb-6 text-xl font-semibold text-gray-100">Sign In</h2>

					{/* Shown when this device holds a guest plan, which the calculator
					    moves into the account on the first load after sign-in */}
					{hasGuestPlan && (
						<div className="mb-5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2.5">
							<p className="text-sm text-brand">
								The plan on this device will be added to your account when you sign in.
							</p>
						</div>
					)}

					{error && (
						<div
							role="alert"
							className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5"
						>
							<p className="text-sm text-red-400">{error}</p>
						</div>
					)}

					<div className="flex flex-col gap-3">
						{SOCIAL_PROVIDERS.map((provider) => {
							const { label, Mark, button } = PROVIDERS[provider]
							return (
								<button
									key={provider}
									type="button"
									onClick={() => void handleSignIn(provider)}
									disabled={pendingProvider !== null}
									className={`${buttonBase} ${button}`}
								>
									<Mark />
									{pendingProvider === provider ? "Redirecting…" : `Continue with ${label}`}
								</button>
							)
						})}
					</div>

					{/* Signing in with Patreon is just a third way in — it does NOT
					    find an existing plan made under Google or Discord. Someone
					    who already has an account should sign in the way they did
					    before and link Patreon from there, or they land in a second
					    empty account and think their plan is gone. */}
					<p className="mt-4 text-center text-xs leading-relaxed text-gray-500">
						Already have a plan? Sign in the way you did before. You can add Patreon
						to your account afterwards.
					</p>

					{/* The point of the whole flow — worth saying out loud, since
					    "sign in with Google" usually implies handing over an email. The
					    picture is the one profile detail we keep, and it is named here
					    because the consent screen will show it being shared. */}
					<p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
						We never see your password, and we don't store your email address or
						name. We keep only an anonymous ID and your profile picture from your provider.{" "}
						<Link to="/privacy-policy" className="text-gray-400 underline hover:text-gray-300">
							Privacy policy
						</Link>
					</p>
				</div>
			</div>
			<Footer />
		</div>
	)
}
