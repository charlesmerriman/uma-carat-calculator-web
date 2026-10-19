/**
 * The small pieces the gallery's feed, post panel and comments share: who
 * posted (picture, name, tier chip), the upvote, an uma's picture and style,
 * and a read-only team.
 */

import type { ReactNode } from "react"
import { ArrowBigUp, Heart } from "lucide-react"
import { toast } from "sonner"
import { Avatar } from "../../account/Avatar"
import { STYLE_LABELS } from "../../../utils/pvpGuide"
import { PVP_BORROW_SLOT, PVP_TEAM_SIZE, memberAt } from "../../../utils/pvpTeams"
import { posterName } from "../../../utils/galleryText"
import { failureText, useGalleryVote } from "../../../services/galleryQueries"
import { useSignInPrompt } from "../../../hooks/useSignInPrompt"
import { useOshiIds } from "../../../hooks/useOshiIds"
import { FramedUma } from "../../FramedUma"
import type { PvpCatalogueIndex } from "../../../hooks/usePvpCatalogue"
import type { GalleryPoster, GalleryRow } from "../../../types/gallery"
import type { CatalogueUma, MemberStyle, PvpTeamMember } from "../../../types/pvpTeam"

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

/** "You" beside your own post or comment, so it is findable in a list. */
export function YouChip() {
	return <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[11px] font-semibold text-brand">You</span>
}

/**
 * Picture, name and tier chip, in one line when they fit; `extra` follows
 * them. When they don't, the chips and `extra` wrap to a second line and the
 * name keeps its room: it used to be the only thing allowed to shrink, so a
 * phone feed showed "K..." and "Moon...", and comment headers "Kor..." even on
 * desktop. The name truncates only when it and the picture outgrow the line. The
 * picture is the poster's first favourite uma, framed like every uma: the
 * rainbow frame on your own (`mine`), since it is yours.
 *
 * `avatarClassName` and `nameClassName` add to the small defaults, for a
 * caller that draws the line bigger somewhere (the feed's wide row does, by
 * container query).
 */
export function PosterLine({ poster, extra, mine = false, avatarClassName = "", nameClassName = "" }: {
	poster: GalleryPoster
	extra?: ReactNode
	mine?: boolean
	avatarClassName?: string
	nameClassName?: string
}) {
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
			{/* Picture and name never part: as one group they wrap together, and
			    the name truncates only when the pair is wider than the line. */}
			<span className="flex min-w-0 max-w-full items-center gap-2">
				<Avatar src={poster.portrait} size="sm" oshi={mine} className={avatarClassName} />
				<span className={`min-w-0 truncate text-sm font-semibold text-gray-100 ${nameClassName}`}>{posterName(poster)}</span>
			</span>
			<TierChip poster={poster} />
			{extra}
		</div>
	)
}

/**
 * An uma in the site's frame (FramedUma): the borderless art, silver for
 * everyone and the rainbow frame for the viewer's own favourites, the same
 * as on every other page. A grey square inside the frame when the uma has
 * no picture or has left the catalogue. Takes a catalogue uma (`portrait`
 * first) or a /umas entry (`image`, already the borderless cut).
 */
export function UmaPortrait({ uma, className, frame = true }: {
	uma: (Pick<CatalogueUma, "id" | "image"> & Partial<Pick<CatalogueUma, "portrait">>) | undefined
	className: string
	/** False only for the owner's named exceptions (the account page's posts list). */
	frame?: boolean
}) {
	const oshiIds = useOshiIds()
	return (
		<FramedUma
			src={uma?.portrait ?? uma?.image}
			oshi={uma !== undefined && oshiIds.has(uma.id)}
			frame={frame}
			className={className}
		/>
	)
}

export function StyleChip({ style }: { style: MemberStyle }) {
	return (
		<span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-200">
			{STYLE_LABELS[style]}
		</span>
	)
}

/**
 * A post's upvote: the arrow and the count, which a guest presses to be
 * asked to sign in, and which your own post shows without a button (it
 * already carries your vote).
 *
 *   column  the feed: arrow over count, a tall target at the row's edge
 *   row     the post panel, beside the other numbers
 */
export function GalleryUpvote({ post, layout }: { post: GalleryRow; layout: "column" | "row" }) {
	const vote = useGalleryVote()
	const { prompt } = useSignInPrompt()
	const count = post.stats.upvotes
	const voted = post.my_vote === true
	const shape =
		layout === "column"
			? "min-h-14 w-12 flex-col justify-center gap-0.5 py-1.5"
			: "gap-1 px-2.5 py-1.5"

	if (post.is_mine) {
		return (
			<span
				title="Your own team"
				aria-label={`${count} upvotes on your team`}
				className={`flex shrink-0 items-center rounded-lg border border-gray-700 text-sm font-semibold tabular-nums text-gray-400 ${shape}`}
			>
				<ArrowBigUp className="h-5 w-5" aria-hidden="true" />
				{count}
			</span>
		)
	}

	const press = () => {
		if (post.my_vote === null) {
			prompt("Sign in to upvote teams.")
			return
		}
		vote.mutate(
			{ publicId: post.public_id, on: !voted },
			{ onError: (error) => toast.error(failureText(error, "Your upvote didn't go through. Try again in a moment.")) }
		)
	}

	return (
		<button
			type="button"
			aria-pressed={voted}
			aria-label={voted ? `Remove your upvote (${count} upvotes)` : `Upvote (${count} upvotes)`}
			disabled={vote.isPending}
			onClick={press}
			className={`flex shrink-0 items-center rounded-md border text-sm font-semibold tabular-nums transition disabled:cursor-wait ${shape} ${
				voted
					? "border-brand bg-brand/15 text-brand"
					: "border-gray-600 text-gray-300 enabled:hover:border-brand enabled:hover:text-brand"
			}`}
		>
			<ArrowBigUp className={`h-5 w-5 ${voted ? "fill-current" : ""}`} aria-hidden="true" />
			{count}
		</button>
	)
}

const POSITIONS = Array.from({ length: PVP_TEAM_SIZE }, (_, index) => index)
const SLOTS = [1, 2, 3, 4, 5, PVP_BORROW_SLOT]

/**
 * A posted team, read-only: each uma with its name and running style, then
 * its six cards with their names (the borrowed card last, set apart). Drawn
 * from the catalogue; an id the catalogue no longer has shows as an empty
 * tile. The deck is capped in width so a wide pane does not blow the cards
 * up to poster size.
 *
 * On a phone the deck is three by two (design polish item 26a). Six across
 * beside the uma left each card about 45px wide, and the names under them
 * cut to "Kawaka Princ...". Three across they are about 80px, and two lines
 * of name fit. The gap before the borrowed card would cost a whole cell in
 * that grid, so it shows from sm only; the name says "(borrowed)" anyway.
 */
export function GalleryTeam({ members, index }: {
	members: PvpTeamMember[]
	index: Pick<PvpCatalogueIndex, "umasById" | "cardsById">
}) {
	return (
		<ul className="flex flex-col gap-4" aria-label="Team">
			{POSITIONS.map((position) => {
				const member = memberAt(members, position)
				if (!member) return null
				const uma = index.umasById.get(member.uma)
				return (
					<li key={position} className="flex items-start gap-3">
						<div className="flex w-20 shrink-0 flex-col items-center gap-1 text-center">
							<UmaPortrait uma={uma} className="w-20" />
							<span className="line-clamp-2 text-xs font-medium text-gray-100">{uma?.name ?? "Unknown uma"}</span>
							<StyleChip style={member.style} />
						</div>
						<ul
							className="grid min-w-0 max-w-xl flex-1 grid-cols-3 gap-1.5 sm:grid-cols-[repeat(5,minmax(0,1fr))_2px_minmax(0,1fr)]"
							aria-label={`${uma?.name ?? "Uma"}'s deck`}
						>
							{SLOTS.map((slot) => {
								const card = member.cards.find((entry) => entry.slot === slot)
								const art = card ? index.cardsById.get(card.support_card) : undefined
								const borrowed = slot === PVP_BORROW_SLOT
								return [
									borrowed ? <li key="divider" aria-hidden="true" className="hidden h-full w-0.5 rounded bg-gray-600 sm:block" /> : null,
									<li key={slot} className="flex min-w-0 flex-col gap-0.5">
										{art?.image ? (
											<img
												src={art.image}
												alt=""
												loading="lazy"
												className="aspect-[3/4] w-full rounded-md bg-gray-700 object-cover"
											/>
										) : (
											<div className="aspect-[3/4] w-full rounded-md bg-gray-700" />
										)}
										<span className="line-clamp-2 text-[10px] leading-tight text-gray-400" title={art?.name}>
											{art ? (borrowed ? `${art.name} (borrowed)` : art.name) : "Empty"}
										</span>
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
