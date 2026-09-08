import { useState } from "react"
import type React from "react"
import { Link } from "react-router-dom"
import { Footer } from "../footer/Footer"
import { Wordmark } from "../Wordmark"
import { readGuestPlanStash } from "../../services/guestMigration"
import { startSocialLogin, type SocialProvider } from "../../services/socialAuth"
import { ApiError } from "../../services/userServices"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"

/** Google's four-colour "G". Inline because a strict CSP blocks remote assets
 *  and lucide-react (our icon set) deliberately ships no brand marks. */
const GoogleMark: React.FC = () => (
	<svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true" focusable="false">
		<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
		<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
		<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
		<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
	</svg>
)

const DiscordMark: React.FC = () => (
	<svg viewBox="0 0 127.14 96.36" className="h-5 w-5" fill="currentColor" aria-hidden="true" focusable="false">
		<path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
	</svg>
)

/** Patreon's rounded "P" (their 2023 mark). Inline for the same reason as the
 *  two above: a strict CSP blocks remote brand assets and lucide ships none. */
const PatreonMark: React.FC = () => (
	<svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true" focusable="false">
		<path d="M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" />
	</svg>
)

export const Login: React.FC = () => {
	useDocumentMeta("Sign In", "Staff sign-in for the Uma Musume Carat Calculator.", true)

	// Which provider is mid-redirect, so only that button shows a pending state.
	const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null)
	const [error, setError] = useState<string | null>(null)

	// Called during render (as before) — safe because readGuestPlanStash only
	// clears entries that are already expired or malformed.
	const hasGuestPlan = !!readGuestPlanStash()

	const handleSignIn = async (provider: SocialProvider): Promise<void> => {
		setError(null)
		setPendingProvider(provider)
		try {
			// On success the browser navigates away and nothing below runs.
			await startSocialLogin(provider)
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

					{/* Shown when the user arrived via "Sign in to save" with a guest plan pending migration */}
					{hasGuestPlan && (
						<div className="mb-5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2.5">
							<p className="text-sm text-brand">
								Your current plan will be saved to your account after you sign in.
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
						<button
							type="button"
							onClick={() => void handleSignIn("google")}
							disabled={pendingProvider !== null}
							className={`${buttonBase} bg-white text-[#1f1f1f] hover:bg-gray-100`}
						>
							<GoogleMark />
							{pendingProvider === "google" ? "Redirecting…" : "Continue with Google"}
						</button>

						<button
							type="button"
							onClick={() => void handleSignIn("discord")}
							disabled={pendingProvider !== null}
							className={`${buttonBase} bg-[#5865F2] text-white hover:bg-[#4752C4]`}
						>
							<DiscordMark />
							{pendingProvider === "discord" ? "Redirecting…" : "Continue with Discord"}
						</button>

						<button
							type="button"
							onClick={() => void handleSignIn("patreon")}
							disabled={pendingProvider !== null}
							className={`${buttonBase} bg-[#FF424D] text-white hover:bg-[#E03A44]`}
						>
							<PatreonMark />
							{pendingProvider === "patreon" ? "Redirecting…" : "Continue with Patreon"}
						</button>
					</div>

					{/* Signing in with Patreon is just a third way in — it does NOT
					    find an existing plan made under Google or Discord. Someone
					    who already has an account should sign in the way they did
					    before and link Patreon from there, or they land in a second
					    empty account and think their plan is gone. */}
					<p className="mt-4 text-center text-xs leading-relaxed text-gray-500">
						Already have a plan? Sign in the way you did before — you can add Patreon
						to your account afterwards.
					</p>

					{/* The point of the whole flow — worth saying out loud, since
					    "sign in with Google" usually implies handing over an email. */}
					<p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
						We never see your password, and we don't store your email address or
						name — only an anonymous ID from your provider.{" "}
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
