/**
 * Where a limited Rankings tab stops (redesign step 6): everyone sees the
 * top three of each list, and this says the rest is for Patreon supporters,
 * with the way in. A guest is asked to sign in first (a supporter has to be
 * signed in for the site to know); a signed-in account gets the Patreon
 * link and a pointer to linking Patreon on the account page. The PvP page's
 * early-access card (pvp/PvpEarlyAccess.tsx) is its model.
 */

import { Link } from "react-router-dom"
import { Heart } from "lucide-react"
import { useAccount } from "../../../services/AuthContext"
import { useSignInPrompt } from "../../../hooks/useSignInPrompt"
import { PATREON_URL } from "../../../constants/links"
import { ACTION_BUTTON, PRIMARY_BUTTON } from "../../pvp/gallery/galleryStyles"

export function SupporterCard() {
	const { isLoggedIn } = useAccount()
	const { signInState } = useSignInPrompt()
	return (
		<section aria-label="The full list" className="card-panel flex flex-col items-center gap-3 p-5 text-center">
			<h2 className="font-display text-base font-bold text-gray-100">The full list is for our Patreon supporters</h2>
			<p className="max-w-prose text-sm text-gray-300">
				Everyone sees the top three. Supporters see every list in full, with the filters, what moved this week, and a
				window you can pin beside the planner.
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				{!isLoggedIn && (
					<Link to="/login" state={signInState} className={PRIMARY_BUTTON}>
						Sign in
					</Link>
				)}
				<a href={PATREON_URL} target="_blank" rel="noopener noreferrer" className={isLoggedIn ? PRIMARY_BUTTON : ACTION_BUTTON}>
					<Heart className="h-4 w-4" aria-hidden="true" />
					Support us on Patreon
				</a>
			</div>
			<p className="text-xs text-gray-400">
				{isLoggedIn ? (
					<>
						Already a supporter?{" "}
						<Link to="/account" className="text-brand hover:text-brand/75">
							Link your Patreon on your account page
						</Link>{" "}
						and it opens for you.
					</>
				) : (
					"Already a supporter? Sign in with Patreon, or with an account your Patreon is linked to."
				)}
			</p>
		</section>
	)
}
