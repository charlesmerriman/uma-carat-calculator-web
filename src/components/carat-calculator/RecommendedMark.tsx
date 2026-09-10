import { Star } from "lucide-react"

/**
 * The planner dropdown's mark on a banner an editor has ticked as Recommended:
 * a filled gold star before the name, in the open menu and on the chosen value
 * alike.
 *
 * The word travels as sr-only text, so the mark is never carried by colour or
 * an icon alone. `muted` follows the option's "(in calculator)" greying — a
 * banner already in the plan is no longer a suggestion, so its star steps back
 * with the rest of the label.
 *
 * Shared by BannerRow and StagedBannerRow; the row styling half lives beside
 * the select styles, in `withRecommendedOption`.
 */
export function RecommendedMark({ muted = false }: { muted?: boolean }) {
	return (
		<>
			<Star
				aria-hidden="true"
				fill="currentColor"
				className={`mr-1 inline-block h-3 w-3 shrink-0 align-[-1px] ${
					muted ? "text-gray-500" : "text-recommended"
				}`}
			/>
			<span className="sr-only">Recommended: </span>
		</>
	)
}
