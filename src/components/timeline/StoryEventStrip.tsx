import { useId, useRef, type MouseEvent, type PointerEvent } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight } from "lucide-react"
import type { StoryEvent, StoryEventCard } from "../../types"
import { DateTimeRange } from "./DateTimeRange"
import PredictedBadge from "../PredictedBadge"
import { useHoverPopup } from "../pvp/hoverPopup"
import { useSkillsPreview } from "../../hooks/useSkillsPreview"
import { cardHref } from "../../utils/encyclopediaRoutes"
import { hoverCardProps } from "../../utils/hoverCards"
import {
	FREE_CARD_COPIES,
	rarityLabel,
	storyEventName,
	storyEventRewards,
} from "../../utils/storyEvents"

/**
 * The row that sits flush BENEATH a banner's Timeline card: the story event
 * running with that banner, its logo, the last day to claim its rewards, what
 * it pays, and the free card(s) it gives. notes/story-events-plan.md, and the
 * mocks in notes/story-events/mocks/.
 *
 * The mirror of AnniversaryEventStrip, which sits flush ABOVE: outside the
 * card's panel, so nothing here can change the size of the banner art or the
 * feature panels. The caller squares the panel's bottom corners to match.
 *
 * Display only. The rewards are the event's own, for reading; the planner's
 * income comes from elsewhere (GameEvent), so nothing here is counted twice.
 */
export function StoryEventStrip({ events }: { events: StoryEvent[] }) {
	return (
		<div className="flex flex-col divide-y divide-gray-700/70 rounded-b-xl border border-t-0 border-edge bg-gray-800 shadow-(--card-shadow)">
			{events.map((event) => (
				<StoryEventRow key={event.id} event={event} />
			))}
		</div>
	)
}

function StoryEventRow({ event }: { event: StoryEvent }) {
	const name = storyEventName(event)
	const rewards = storyEventRewards(event)
	return (
		<section
			aria-label={`Story event: ${name}`}
			className="flex flex-col gap-3 p-3 sm:px-4 md:flex-row md:items-center md:gap-5"
		>
			{event.image && (
				<img
					src={event.image}
					alt=""
					loading="lazy"
					decoding="async"
					className="mx-auto h-20 w-auto max-w-full shrink-0 object-contain md:mx-0 md:h-24"
				/>
			)}
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-full border border-brand/50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand">
						Story event
					</span>
					{event.is_predicted && <PredictedBadge />}
				</div>
				<h4 className="mt-1 text-lg leading-snug font-semibold text-balance text-gray-100">{name}</h4>
				{event.claim_end_date && (
					<p className="mt-0.5 text-sm text-gray-400">
						Runs with this banner. Claim rewards by <DateTimeRange start={event.claim_end_date} />
					</p>
				)}
				{rewards.length > 0 && (
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						<span className="mr-0.5 text-xs font-semibold text-gray-400">Event rewards</span>
						{rewards.map((reward) => (
							<span
								key={reward}
								className="rounded-full border border-gray-600 bg-gray-700 px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap text-gray-100"
							>
								{reward}
							</span>
						))}
					</div>
				)}
			</div>
			{event.cards.length > 0 && (
				<div className="flex shrink-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap md:flex-nowrap">
					{event.cards.map((card) => (
						<FreeCardTile key={card.id} card={card} eventName={name} />
					))}
				</div>
			)}
		</section>
	)
}

/**
 * One free card: compact, art on the left. Bordered `image`, not FramedCard:
 * Timeline tiles keep their bordered art (frontend-ui.md, "Card frames").
 *
 * EARLY ACCESS ONLY gets more than the tile, while the Encyclopedia is
 * supporters first (useSkillsPreview, the rule every tile follows). Then:
 *
 *   - on a computer, the site's shared hover card (hoverCardProps, drawn by
 *     HoverCardLayer, the same card every other tile opens), and a click goes
 *     to the card's page;
 *   - on a touch screen, which that layer ignores, a tap opens this row's own
 *     small details with "Open its page" inside, and never navigates (owner,
 *     2026-11-17, for this row). A banner tile does the opposite (a tap
 *     follows its link), which is why the click is held back only for a touch.
 *
 * The row's popup is `tapOnly` (its hover and focus are off), so a mouse or a
 * keyboard never opens it beside the shared card.
 */
function FreeCardTile({ card, eventName }: { card: StoryEventCard; eventName: string }) {
	const linksToPages = useSkillsPreview()
	const href = linksToPages && card.game_id ? cardHref(card.game_id) : null
	const purpose = card.purpose.trim()
	const detailId = useId()
	const { referenceProps, popup } = useHoverPopup("top", { interactive: true, tapOnly: true })
	// A ref, not a variable: the tap's pointerup opens the popup, and that
	// re-render lands before the click, which must still see "touch".
	const lastPointer = useRef("")
	const rarity = rarityLabel(card.rarity)

	const face = (
		<>
			{card.image ? (
				<img
					src={card.image}
					alt=""
					loading="lazy"
					decoding="async"
					className="block aspect-[3/4] w-16 shrink-0 rounded-md object-contain"
				/>
			) : (
				<div aria-hidden="true" className="aspect-[3/4] w-16 shrink-0 rounded-md bg-gray-700" />
			)}
			<div className="flex min-w-0 flex-col items-start gap-0.5">
				{card.must_get && (
					<span className="rounded-full border border-brand/55 bg-brand/10 px-2 py-px text-xs font-bold text-brand">
						Must get
					</span>
				)}
				<span className="text-[15px] leading-tight font-semibold text-gray-100">{card.name}</span>
				{card.title && <span className="text-xs leading-snug text-gray-400">{card.title}</span>}
				<span className="text-xs leading-snug text-gray-400">
					{rarity}, free, {FREE_CARD_COPIES} copies{card.note && `. ${card.note}`}
				</span>
			</div>
		</>
	)
	const tileClass =
		"flex min-w-0 items-center gap-2.5 rounded-lg border border-gray-600 bg-gray-700 p-2 pr-3 text-left md:max-w-[19rem]"

	if (href === null) {
		return <div className={tileClass}>{face}</div>
	}

	// `tapOnly`: the popup's hover and focus are off, so these are its tap
	// toggle and dismissal only. Ours call through to its handlers.
	const ownProps = referenceProps as typeof referenceProps & {
		onPointerDown?: (event: PointerEvent<HTMLElement>) => void
		onClick?: (event: MouseEvent<HTMLElement>) => void
	}
	const tapProps = {
		...referenceProps,
		onPointerDown(event: PointerEvent<HTMLElement>) {
			lastPointer.current = event.pointerType
			ownProps.onPointerDown?.(event)
		},
		onClick(event: MouseEvent<HTMLElement>) {
			// A tap opens the details (the pointerup); it must not also follow
			// the link underneath.
			if (lastPointer.current === "touch") event.preventDefault()
			ownProps.onClick?.(event)
		},
	}
	const interactiveClass = `${tileClass} transition hover:border-brand/60 focus-visible:outline-2 focus-visible:outline-brand`

	const details = (
		<div className="flex flex-col gap-1.5 text-[13px]">
			<div>
				<div className="text-sm font-semibold text-gray-100">{card.name}</div>
				{card.title && <div className="text-gray-400">{card.title}</div>}
			</div>
			{purpose && <p className="text-gray-200">{purpose}</p>}
			<p className="text-gray-300">
				{rarity} support card. Free from {eventName}, {FREE_CARD_COPIES} copies.
			</p>
			<Link
				to={href}
				className="mt-0.5 flex items-center justify-between border-t border-gray-700 pt-1.5 font-semibold text-brand underline-offset-2 hover:underline"
			>
				Open its page
				<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
			</Link>
		</div>
	)

	return (
		<>
			<Link
				to={href}
				aria-describedby={detailId}
				className={interactiveClass}
				{...hoverCardProps("card", card.id)}
				{...tapProps}
			>
				{face}
			</Link>
			{/* The screen reader's copy: always present, since the drawn popup is aria-hidden. */}
			<span id={detailId} role="tooltip" className="sr-only">
				{[card.title, purpose, `${rarity} support card. Free from ${eventName}, ${FREE_CARD_COPIES} copies.`]
					.filter(Boolean)
					.join(" ")}
			</span>
			{popup(details, "w-64")}
		</>
	)
}
