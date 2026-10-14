/**
 * The small pieces the gallery's feed, post panel and comments share: who
 * posted (picture, name, tier chip), the upvote button, and a read-only team.
 */

import type { ReactNode } from "react"
import { ArrowBigUp, Heart } from "lucide-react"
import { Avatar } from "../../account/Avatar"
import { STYLE_LABELS } from "../../../utils/pvpGuide"
import { PVP_BORROW_SLOT, PVP_TEAM_SIZE, memberAt } from "../../../utils/pvpTeams"
import type { PvpCatalogueIndex } from "../../../hooks/usePvpCatalogue"
import type { GalleryPoster } from "../../../types/gallery"
import type { PvpTeamMember } from "../../../types/pvpTeam"

/** The name a post or comment shows. A blanked name reads as below. */
function posterName(poster: GalleryPoster): string {
	return poster.display_name || "Unnamed trainer"
}

/**
 * The tier chip: the tier's NAME on the look's colours. The name is the
 * signal, so it never rests on colour alone. Nothing at all without a tier.
 */
export function TierChip({ poster }: { poster: GalleryPoster }) {
	if (!poster.tier_name || !poster.gallery_style) return null
	return (
		<span className="gallery-chip" data-gallery-style={poster.gallery_style}>
			{poster.gallery_style === "rose" && <Heart className="h-3 w-3 fill-current" aria-hidden="true" />}
			{poster.tier_name}
		</span>
	)
}

/** Picture, name and tier chip, in one line. */
export function PosterLine({ poster, extra }: { poster: GalleryPoster; extra?: ReactNode }) {
	return (
		<div className="flex min-w-0 items-center gap-2">
			<Avatar src={poster.portrait} size="sm" />
			<span className="min-w-0 truncate text-sm font-semibold text-gray-100">{posterName(poster)}</span>
			<TierChip poster={poster} />
			{extra}
		</div>
	)
}

/**
 * The upvote toggle with its count. `voted` null means a guest, who gets the
 * same button asking them to sign in (onClick decides what happens). Disabled
 * on your own post: it already carries your vote.
 */
export function UpvoteButton({ count, voted, own, busy, onClick }: {
	count: number
	voted: boolean | null
	own: boolean
	busy?: boolean
	onClick: () => void
}) {
	const label = own
		? `${count} upvotes on your team`
		: voted
			? `Remove your upvote (${count} upvotes)`
			: `Upvote (${count} upvotes)`
	return (
		<button
			type="button"
			aria-pressed={voted === true}
			aria-label={label}
			title={own ? "Your own team" : undefined}
			disabled={own || busy}
			onClick={onClick}
			className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-sm font-semibold tabular-nums transition disabled:cursor-default ${
				voted
					? "border-brand bg-brand/15 text-brand"
					: "border-gray-600 text-gray-300 enabled:hover:border-brand enabled:hover:text-brand"
			}`}
		>
			<ArrowBigUp className={`h-4 w-4 ${voted ? "fill-current" : ""}`} aria-hidden="true" />
			{count}
		</button>
	)
}

const POSITIONS = Array.from({ length: PVP_TEAM_SIZE }, (_, index) => index)
const SLOTS = [1, 2, 3, 4, 5, PVP_BORROW_SLOT]

/**
 * A posted team, read-only: each uma with its running style, then its six
 * cards (the borrowed card last, set apart). Drawn from the catalogue; an id
 * the catalogue no longer has shows as an empty tile.
 */
export function GalleryTeam({ members, index }: {
	members: PvpTeamMember[]
	index: Pick<PvpCatalogueIndex, "umasById" | "cardsById">
}) {
	return (
		<ul className="flex flex-col gap-3" aria-label="Team">
			{POSITIONS.map((position) => {
				const member = memberAt(members, position)
				if (!member) return null
				const uma = index.umasById.get(member.uma)
				return (
					<li key={position} className="flex items-start gap-3">
						<div className="flex w-20 shrink-0 flex-col items-center gap-1 text-center">
							{uma?.portrait || uma?.image ? (
								<img src={uma.portrait ?? uma.image ?? ""} alt="" className="aspect-square w-20 rounded-lg bg-gray-700 object-cover" />
							) : (
								<div className="aspect-square w-20 rounded-lg bg-gray-700" />
							)}
							<span className="line-clamp-2 text-xs font-medium text-gray-100">{uma?.name ?? "Unknown uma"}</span>
							<span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] text-gray-300">
								{STYLE_LABELS[member.style]}
							</span>
						</div>
						<ul className="grid min-w-0 flex-1 grid-cols-[repeat(5,minmax(0,1fr))_2px_minmax(0,1fr)] gap-1.5" aria-label={`${uma?.name ?? "Uma"}'s deck`}>
							{SLOTS.map((slot) => {
								const card = member.cards.find((entry) => entry.slot === slot)
								const art = card ? index.cardsById.get(card.support_card) : undefined
								return [
									slot === PVP_BORROW_SLOT ? <li key="divider" aria-hidden="true" className="h-full w-0.5 rounded bg-gray-600" /> : null,
									<li key={slot} className="min-w-0">
										{art?.image ? (
											<img
												src={art.image}
												alt={slot === PVP_BORROW_SLOT ? `${art.name} (borrowed)` : art.name}
												title={art.name}
												className="aspect-[3/4] w-full rounded-md bg-gray-700 object-cover"
											/>
										) : (
											<div className="aspect-[3/4] w-full rounded-md bg-gray-700" />
										)}
									</li>,
								]
							})}
						</ul>
					</li>
				)
			})}
		</ul>
	)
}
