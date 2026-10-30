/**
 * The small pieces the gallery's feed, post panel and comments share: who
 * posted (picture, name, tier chip), the upvote, an uma's picture and style,
 * and a read-only team.
 */

import { useState, type ReactNode } from "react"
import { ArrowBigDown, ArrowBigUp, Heart } from "lucide-react"
import { toast } from "sonner"
import { Avatar } from "../../account/Avatar"
import { STYLE_LABELS } from "../../../utils/pvpGuide"
import { PVP_BORROW_SLOT, PVP_TEAM_SIZE, memberAt } from "../../../utils/pvpTeams"
import { posterName, splitText } from "../../../utils/galleryText"
import { failureText, useGalleryVote } from "../../../services/galleryQueries"
import { useSignInPrompt } from "../../../hooks/useSignInPrompt"
import { useOshiIds } from "../../../hooks/useOshiIds"
import { FramedUma } from "../../FramedUma"
import { ProfileCard } from "./ProfileCard"
import type { PvpCatalogueIndex } from "../../../hooks/usePvpCatalogue"
import type { GalleryPoster, GalleryRow, ProfileCardTarget } from "../../../types/gallery"
import type { CatalogueUma, MemberStyle, PvpTeamMember } from "../../../types/pvpTeam"

/**
 * The tier chip: the tier's NAME on the look's colours. The name is the
 * signal, so it never rests on colour alone. Nothing at all without a tier.
 */
function TierChip({ poster }: { poster: GalleryPoster }) {
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
 * picture is the poster's first favorite uma, framed like every uma: the
 * rainbow frame on your own (`mine`), since it is yours.
 *
 * `avatarClassName` and `nameClassName` add to the small defaults, for a
 * caller that draws the line bigger somewhere (the feed's wide row does, by
 * container query).
 *
 * `card` makes the picture and name open the person's card. The feed passes
 * none: its whole row is already a link to the post.
 */
export function PosterLine({ poster, extra, mine = false, card, avatarClassName = "", nameClassName = "" }: {
	poster: GalleryPoster
	extra?: ReactNode
	mine?: boolean
	card?: ProfileCardTarget
	avatarClassName?: string
	nameClassName?: string
}) {
	const [cardOpen, setCardOpen] = useState(false)
	const who = (
		<>
			<Avatar src={poster.portrait} size="sm" oshi={mine} className={avatarClassName} />
			<span className={`min-w-0 truncate text-sm font-semibold text-gray-100 ${nameClassName}`}>{posterName(poster)}</span>
		</>
	)
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
			{/* Picture and name never part: as one group they wrap together, and
			    the name truncates only when the pair is wider than the line. */}
			{card ? (
				<button
					type="button"
					aria-haspopup="dialog"
					onClick={() => setCardOpen(true)}
					className="flex min-w-0 max-w-full items-center gap-2 rounded text-left outline-none decoration-gray-400 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-brand"
				>
					{who}
				</button>
			) : (
				<span className="flex min-w-0 max-w-full items-center gap-2">{who}</span>
			)}
			<TierChip poster={poster} />
			{extra}
			{card && cardOpen && (
				<ProfileCard target={card} name={posterName(poster)} tier={poster.tier_name ? <TierChip poster={poster} /> : null} onClose={() => setCardOpen(false)} />
			)}
		</div>
	)
}

/**
 * An uma in the site's frame (FramedUma): the borderless art, silver for
 * everyone and the rainbow frame for the viewer's own favorites, the same
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
 * A post's vote: an up arrow, the score and a down arrow (Henry, 2026-10-26).
 * Pressing the arrow you already chose takes the vote back; pressing the
 * other one switches. A guest is asked to sign in; your own post shows the
 * score alone. Staff see the real split under the score (row) or in its
 * title (column), since the score never shows below 0.
 *
 *   column  the feed: up, score, down, stacked at the row's edge
 *   row     the post panel, beside the other numbers
 */
export function GalleryVote({ post, layout }: { post: GalleryRow; layout: "column" | "row" }) {
	const vote = useGalleryVote()
	const { prompt } = useSignInPrompt()
	const score = post.stats.score
	const split = splitText(post.stats.split)
	const shape = layout === "column" ? "w-12 flex-col py-1" : "gap-0.5 px-1"
	const box = `flex shrink-0 items-center rounded-lg border text-sm font-semibold tabular-nums ${shape}`
	const number = (
		<span className="flex flex-col items-center px-1 leading-tight" title={split}>
			{score}
			{split && layout === "row" && <span className="text-[10px] font-medium text-gray-400">{split}</span>}
		</span>
	)

	if (post.is_mine) {
		return (
			<span title={split ?? "Your own team"} aria-label={`Score ${score} on your team`} className={`${box} border-gray-700 text-gray-400`}>
				<ArrowBigUp className="h-5 w-5" aria-hidden="true" />
				{number}
			</span>
		)
	}

	const press = (choice: "up" | "down") => {
		if (post.my_vote === null) {
			prompt("Sign in to vote on teams.")
			return
		}
		const next = post.my_vote === choice ? "none" : choice
		vote.mutate(
			{ publicId: post.public_id, choice: next, previous: post.my_vote },
			{ onError: (error) => toast.error(failureText(error, "Your vote didn't go through. Try again in a moment.")) }
		)
	}
	const arrow = (choice: "up" | "down") => {
		const chosen = post.my_vote === choice
		const Icon = choice === "up" ? ArrowBigUp : ArrowBigDown
		const word = choice === "up" ? "upvote" : "downvote"
		return (
			<button
				type="button"
				aria-pressed={chosen}
				aria-label={chosen ? `Take back your ${word} (score ${score})` : `${choice === "up" ? "Upvote" : "Downvote"} (score ${score})`}
				disabled={vote.isPending}
				onClick={() => press(choice)}
				className={`rounded-md p-0.5 transition disabled:cursor-wait ${
					chosen ? (choice === "up" ? "text-brand" : "text-gray-100") : "text-gray-400 enabled:hover:text-gray-100"
				}`}
			>
				<Icon className={`h-5 w-5 ${chosen ? "fill-current" : ""}`} aria-hidden="true" />
			</button>
		)
	}

	return (
		<span className={`${box} ${post.my_vote === "up" ? "border-brand bg-brand/10" : "border-gray-600"} text-gray-200`}>
			{arrow("up")}
			{number}
			{arrow("down")}
		</span>
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
