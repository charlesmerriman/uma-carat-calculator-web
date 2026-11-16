/**
 * What anyone without early access sees on a supporters-first page (Rankings,
 * and the Encyclopedia's lists and pages): one line saying who it is for, and
 * a way back. Waits while a signed-in account loads, so a supporter's page
 * doesn't flash the note first.
 *
 * `feature` is the sentence's subject: "Rankings are", "The Encyclopedia is".
 * The Encyclopedia's wording is the owner's to change (notes/encyclopedia-plan.md).
 */

import { useContext } from "react"
import { Link } from "react-router-dom"
import { AuthContext } from "../services/AuthContext"

export function SupportersFirstNote({ feature, className = "" }: { feature: string; className?: string }) {
	const auth = useContext(AuthContext)
	const waiting = Boolean(auth?.isLoggedIn) && auth?.status === "loading"
	return (
		<p className={`text-sm text-gray-400 ${className}`} role="status">
			{waiting ? "Loading..." : (
				<>
					{feature} for our Patreon supporters for now.{" "}
					<Link to="/app" className="text-brand transition hover:text-brand/75">Back to the calculator</Link>
				</>
			)}
		</p>
	)
}
