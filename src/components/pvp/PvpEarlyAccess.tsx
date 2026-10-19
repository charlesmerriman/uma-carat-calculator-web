/**
 * What the PvP page shows while it is in early access (hooks/usePvpAccess.ts)
 * to anyone who isn't a supporter or staff: what it is, who has it, and the
 * way in. A guest is asked to sign in first, since a supporter has to be
 * signed in for the site to know; a signed-in account without a pledge gets
 * the Patreon link, and a pointer to linking Patreon on the account page for
 * someone who already supports us.
 *
 * Inside the /app loading gate, so it may read the account freely.
 */

import { Link } from "react-router-dom"
import { Heart, Loader2, Swords } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { useSignInPrompt } from "../../hooks/useSignInPrompt"
import { PATREON_URL } from "../../constants/links"
import { ACTION_BUTTON, PRIMARY_BUTTON } from "./gallery/galleryStyles"

export function PvpEarlyAccess({ pending }: { pending: boolean }) {
	const { isLoggedIn } = useAccount()
	const { signInState } = useSignInPrompt()

	return (
		<div className="w-full px-4 py-10">
			{pending ? (
				<div className="flex items-center justify-center gap-2 text-sm text-gray-400" role="status">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					Checking your account…
				</div>
			) : (
				<section className="card-panel mx-auto flex max-w-lg flex-col items-center gap-4 p-6 text-center" aria-labelledby="pvp-early-access">
					<Swords className="h-8 w-8 text-brand" aria-hidden="true" />
					<h1 id="pvp-early-access" className="font-display text-lg font-bold text-gray-100">
						PvP is in early access
					</h1>
					<p className="text-sm leading-relaxed text-gray-300">
						Our Patreon supporters get the PvP guides, the team builder and the team gallery first. It opens to
						everyone soon.
					</p>
					<div className="flex flex-wrap justify-center gap-2">
						{!isLoggedIn && (
							<Link to="/login" state={signInState} className={PRIMARY_BUTTON}>
								Sign in
							</Link>
						)}
						<a
							href={PATREON_URL}
							target="_blank"
							rel="noopener noreferrer"
							className={ACTION_BUTTON}
						>
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
			)}
		</div>
	)
}
