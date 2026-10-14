/**
 * Asking a guest to sign in from the gallery, and bringing them back.
 *
 * `signInState` goes on any link to /login (`<Link to="/login" state=…>`);
 * `prompt` is the toast for a button a guest pressed (upvote, report), with
 * a Sign in action. Either way the current address rides along as
 * `returnTo`, so after the provider round trip the person lands on the post
 * they were reading instead of the calculator (services/socialAuth.ts,
 * safeReturnPath).
 */

import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

export function useSignInPrompt() {
	const location = useLocation()
	const navigate = useNavigate()
	const signInState = { returnTo: `${location.pathname}${location.search}` }
	const prompt = (message: string) =>
		toast(message, { action: { label: "Sign in", onClick: () => navigate("/login", { state: signInState }) } })
	return { signInState, prompt }
}
