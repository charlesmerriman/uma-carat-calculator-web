/**
 * A person's card, opened from their name on an open post or a comment
 * (notes/profile-cards-plan.md). Everyone sees it, guests included. Who they
 * are comes from the post or comment it opened on; the API adds what's new:
 * their favorites, their other teams, and their shared plans if they turned
 * that on (backend views/profile_card.py says what never leaves).
 *
 * The first favorite is their picture, so the card has no picture of its own.
 * A person has no public address, so there's nothing here to link to.
 */

import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useOshiIds } from "../../../hooks/useOshiIds"
import { profileCardFetch, refusalText } from "../../../services/galleryFetchCalls"
import { HttpError } from "../../../services/queryClient"
import { planTotalsLine, plural } from "../../../utils/planTotals"
import { pvpEventHref } from "../../../utils/pvpEvent"
import { FramedUma } from "../../FramedUma"
import { GalleryModal } from "./GalleryModal"
import type { ProfileCardData, ProfileCardTarget } from "../../../types/gallery"

const HEADING = "text-[11px] font-bold uppercase tracking-[0.08em] text-gray-300"
const ROW =
	"flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 transition hover:border-gray-500"

export function ProfileCard({ target, name, tier, onClose }: {
	target: ProfileCardTarget
	name: string
	/** The tier chip from the line it opened on: nothing without a tier. */
	tier: ReactNode
	onClose: () => void
}) {
	const card = useQuery({
		queryKey: ["profile-card", target.kind, target.id],
		// A 404 is an answer: a retry only makes the reader wait for it again.
		retry: false,
		queryFn: async (): Promise<ProfileCardData> => {
			const response = await profileCardFetch(target)
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "This card isn't available."))
			return (await response.json()) as ProfileCardData
		},
	})

	return (
		<GalleryModal title={name} onClose={onClose}>
			<div className="flex flex-col gap-4">
				{tier && <div className="flex">{tier}</div>}
				{card.isPending && (
					<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						Loading their card…
					</p>
				)}
				{card.isError && <p className="text-sm text-gray-300">This card isn't available.</p>}
				{card.data && <CardBody card={card.data} onClose={onClose} />}
			</div>
		</GalleryModal>
	)
}

function CardBody({ card, onClose }: { card: ProfileCardData; onClose: () => void }) {
	const oshiIds = useOshiIds()
	return (
		<>
			{card.favorites.length > 0 && (
				<section className="flex flex-col gap-2">
					<h3 className={HEADING}>{card.favorites.length > 1 ? "Favorites" : "Favorite"}</h3>
					<ul className="flex flex-wrap gap-2">
						{card.favorites.map((favorite) => (
							<li key={favorite.uma}>
								<FramedUma src={favorite.image} oshi={oshiIds.has(favorite.uma)} alt={favorite.label} title={favorite.label} className="w-14" />
							</li>
						))}
					</ul>
				</section>
			)}
			{card.posts.length > 0 ? (
				<section className="flex flex-col gap-2">
					<h3 className={HEADING}>Gallery teams</h3>
					<ul className="flex flex-col gap-1.5">
						{card.posts.map((post) => (
							<li key={post.public_id}>
								<Link to={`${pvpEventHref(post.event)}&view=gallery&post=${post.public_id}`} onClick={onClose} className={ROW}>
									<span className="min-w-0">
										<span className="block truncate text-sm font-medium text-gray-100">{post.caption || post.event.label}</span>
										{post.caption && <span className="block truncate text-xs text-gray-400">{post.event.label}</span>}
									</span>
									<span className="shrink-0 text-sm font-semibold text-gray-100" title={`Score ${post.score}`}>
										▲ {post.score}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			) : (
				<p className="text-sm text-gray-400">No gallery teams yet.</p>
			)}
			{card.plans.length > 0 && (
				<section className="flex flex-col gap-2">
					<h3 className={HEADING}>Shared plans</h3>
					<ul className="flex flex-col gap-1.5">
						{card.plans.map((plan) => (
							<li key={plan.public_id}>
								<Link to={`/app/${plan.public_id}`} onClick={onClose} className={ROW}>
									<span className="min-w-0 truncate text-sm text-gray-100">
										{plural(plan.row_count, "banner", "banners")} · {planTotalsLine(plan.pull_count, plan.step_count)}
									</span>
									<span className="shrink-0 text-sm font-semibold text-brand">Open</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}
		</>
	)
}
