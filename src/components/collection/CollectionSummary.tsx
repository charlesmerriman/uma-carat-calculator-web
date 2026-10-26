/**
 * The Account page's way into the Collection: how many veterans the player
 * keeps, and a link. One cached list (services/trainedUmaQueries.ts), so
 * opening the Collection afterwards costs no second request.
 *
 * Drawn only for a signed-in account (the page around it already is).
 */

import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { useTrainedUmas } from "../../services/trainedUmaQueries"

export function CollectionSummary({ className, titleClassName }: { className: string; titleClassName: string }) {
	const list = useTrainedUmas(true)
	const count = list.data?.length
	return (
		<section className={className} aria-labelledby="collection">
			<h2 id="collection" className={titleClassName}>
				Collection
			</h2>
			<p className="mt-1 text-sm text-gray-400">
				{count === undefined
					? "Your veterans: the umas you finished training, with their stats and skills."
					: count === 0
						? "No veterans yet. Add the umas you finished training to link them to your PvP teams and CM runs."
						: `${count} ${count === 1 ? "veteran" : "veterans"}, ready to link to your PvP teams and CM runs.`}
			</p>
			<Link
				to="/app/collection"
				className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand transition hover:text-brand/75"
			>
				Open your collection
				<ArrowRight className="h-4 w-4" aria-hidden="true" />
			</Link>
		</section>
	)
}
