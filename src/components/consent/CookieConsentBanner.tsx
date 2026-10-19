import type React from "react"
import { useSyncExternalStore } from "react"
import { Link } from "react-router-dom"
import { X } from "lucide-react"
import {
	closeConsentPrompt,
	getConsentSnapshot,
	getServerConsentSnapshot,
	subscribeToConsent,
	writeConsentChoice,
} from "../../services/consentStore"

/**
 * The cookie prompt. Mounted once in App so it is on every route, the
 * calculator included.
 *
 * Shown to every visitor, not only those in the EU: a static site cannot tell
 * where a request came from, and asking everyone is simpler to explain than a
 * guess from the browser's time zone. Reject is as easy to reach as Accept, and
 * both are real buttons, because a banner where "Reject" is a link in the small
 * print is the kind the law was written against.
 *
 * Not a modal. It is a slim bar along the bottom of the window, the page
 * behind it stays usable, and the only way to make it go away is to answer it.
 * A close (X) is offered only when the prompt was reopened from the footer and
 * a choice already exists.
 *
 * A BAR, NOT A CARD (2026-10-18). It was a 384px card in the bottom-left
 * corner, which on a first visit to the calculator at 1440x1000 sat on top of
 * the New Uma Banner button, the first thing a new visitor wants to press. One
 * row along the window's bottom edge costs about 60px of height instead.
 *
 * Renders nothing on the server and during hydration (see consentStore), so
 * the prerendered HTML never carries it and a returning visitor never sees it
 * flash.
 */
export const CookieConsentBanner: React.FC = () => {
	const { choice, isPromptOpen, isReady } = useSyncExternalStore(
		subscribeToConsent,
		getConsentSnapshot,
		getServerConsentSnapshot,
	)

	if (!isReady || !isPromptOpen) return null

	return (
		<section
			role="dialog"
			aria-label="Cookie preferences"
			// Above the app shell's sticky bits, below the toaster.
			className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-gray-800 text-sm text-gray-300 shadow-2xl"
		>
			<div className="mx-auto flex max-w-[96rem] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
				<p className="min-w-0 flex-1 leading-relaxed">
					This site uses Google Analytics to see how it is used, and may show ads in future.
					Both set cookies only if you allow it. Signing in and your settings use no cookies.
					See the{" "}
					<Link to="/privacy-policy" className="text-brand transition hover:text-brand/75">
						privacy policy
					</Link>
					, or change your answer later from Cookie settings in the footer.
				</p>
				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						onClick={() => writeConsentChoice("granted")}
						className="flex-1 rounded-lg bg-brand px-5 py-2 font-bold text-black transition hover:brightness-110 sm:flex-none"
					>
						Accept
					</button>
					<button
						type="button"
						onClick={() => writeConsentChoice("denied")}
						className="flex-1 rounded-lg border border-gray-600 px-5 py-2 font-semibold text-gray-200 transition hover:border-gray-400 hover:bg-gray-700 sm:flex-none"
					>
						Reject
					</button>
					{choice !== null && (
						<button
							type="button"
							onClick={closeConsentPrompt}
							aria-label="Close"
							className="rounded p-1.5 text-gray-500 transition hover:text-gray-200"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</button>
					)}
				</div>
			</div>
		</section>
	)
}
