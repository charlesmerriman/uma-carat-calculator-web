import { useId, useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight } from "lucide-react"
import type { StoryEvent, StoryEventCard, StoryEventUma } from "../../types"
import PredictedBadge from "../PredictedBadge"
import { FramedUma } from "../FramedUma"
import { useHoverPopup } from "../pvp/hoverPopup"
import { useOshiIds } from "../../hooks/useOshiIds"
import { cardHref, umaHref } from "../../utils/encyclopediaRoutes"
import { hoverCardProps, type HoverCardKind } from "../../utils/hoverCards"
import { HoverCardContent } from "../hovercards/HoverCardContent"
import {
	FREE_CARD_COPIES,
	rarityLabel,
	starLabel,
	storyEventLabel,
	storyEventLine,
	storyEventName,
	storyEventRewards,
	storyEventUmas,
} from "../../utils/storyEvents"
import { FramedCard } from "../FramedCard"
import { cardFrameArt } from "../../utils/cardFrame"

/**
 * The rows that sit flush BENEATH a banner's Timeline card: each free card
 * event running with that banner (a story event, a main story chapter, an
 * anniversary's missions, a special event), its picture, what it pays, and the
 * free cards and umas it gives. notes/story-events-plan.md, -plan-2.md, and
 * the mocks in notes/story-events/mocks/ and notes/story-events/plan-2/mocks/.
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
	const label = storyEventLabel(event)
	const line = storyEventLine(event)
	const rewards = storyEventRewards(event)
	const umas = storyEventUmas(event)
	const oshiIds = useOshiIds()
	return (
		<section
			aria-label={`${label}: ${name}`}
			className="flex flex-col gap-3 p-3 sm:px-4 md:flex-row md:items-center md:gap-5"
		>
			{/* Every kind's picture in the one slot, at one size: the art is 2:1
			    for all of them (Daptrius, 2026-11-20). None, no box. */}
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
						{label}
					</span>
					{event.is_predicted && <PredictedBadge />}
				</div>
				<h4 className="mt-1 text-lg leading-snug font-semibold text-balance text-gray-100">{name}</h4>
				{/* No claim date: players read it as the event's start (Daptrius,
				    2026-11-18). The row sits under its banner, which carries the dates. */}
				{line && <p className="mt-0.5 text-sm text-gray-400">{line}</p>}
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
			{event.cards.length + umas.length > 0 && (
				<div className="flex shrink-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap md:flex-nowrap">
					{event.cards.map((card) => (
						<FreeCardTile key={`card-${card.id}`} card={card} eventName={name} />
					))}
					{umas.map((uma) => (
						<FreeUmaTile key={`uma-${uma.id}`} uma={uma} eventName={name} oshi={oshiIds.has(uma.id)} />
					))}
				</div>
			)}
		</section>
	)
}

/** One free support card, in the game's frame (FramedCard), as on a banner's Timeline tiles (frontend-ui.md, "Card frames"). */
function FreeCardTile({ card, eventName }: { card: StoryEventCard; eventName: string }) {
	const rarity = rarityLabel(card.rarity)
	const freeFrom = `${rarity} support card. Free from ${eventName}, ${FREE_CARD_COPIES} copies.`
	return (
		<FreeRewardTile
			kind="card"
			id={card.id}
			href={card.game_id ? cardHref(card.game_id) : null}
			art={
				card.image || card.image_borderless ? (
					<FramedCard card={cardFrameArt(card)} className="w-16" />
				) : (
					<div aria-hidden="true" className="aspect-[3/4] w-16 shrink-0 rounded-md bg-gray-700" />
				)
			}
			name={card.name}
			title={card.title}
			purpose={card.purpose}
			mustGet={card.must_get}
			tag={`${rarity}, free, ${FREE_CARD_COPIES} copies${card.note && `. ${card.note}`}`}
			freeFrom={freeFrom}
			popupLine={`Free from ${eventName}, ${FREE_CARD_COPIES} copies.`}
		/>
	)
}

/**
 * One free uma outfit (a main story chapter's): FramedUma from her `portrait`,
 * as every uma on the site (frontend-ui.md, "Every uma ... is FramedUma"),
 * rainbow for the viewer's favorites. An outfit is one character, so no copies.
 */
function FreeUmaTile({ uma, eventName, oshi }: { uma: StoryEventUma; eventName: string; oshi: boolean }) {
	const stars = starLabel(uma.rarity)
	return (
		<FreeRewardTile
			kind="uma"
			id={uma.id}
			href={umaHref(uma.game_id)}
			art={
				// The frame's ears need room above: the tile's padding gives it.
				<FramedUma src={uma.portrait ?? uma.image} layers={uma.portrait_layers} oshi={oshi} className="w-16 shrink-0" />
			}
			name={uma.name}
			title={uma.title}
			purpose={uma.purpose}
			mustGet={uma.must_get}
			tag={`${stars} uma, free${uma.note && `. ${uma.note}`}`}
			freeFrom={`${stars} uma. Free from ${eventName}.`}
			popupLine={`Free from ${eventName}.`}
		/>
	)
}

/**
 * The tile both rewards share: compact, art on the left. A reward with a page
 * gets more than the tile (for everyone, since the Encyclopedia opened on
 * 2026-11-18):
 *
 *   - on a computer, a click opens the site's shared hover card (hoverCardProps,
 *     drawn by HoverCardLayer, the same card every other tile opens), whose
 *     "Open Encyclopedia" goes to the page; from the keyboard the link goes
 *     straight there;
 *   - on a touch screen, which that layer ignores, a tap opens the SAME card
 *     (HoverCardContent) in this row's own popup, its "Open Encyclopedia" inside,
 *     and never navigates (owner, 2026-11-17: the Timeline's cards get the
 *     same hover cards, and on a phone a tap opens it). A banner tile does the
 *     opposite (a tap follows its link), which is why the click is held back
 *     only for a touch.
 *
 * The row's popup is `tapOnly` (its hover and focus are off), so a mouse or a
 * keyboard never opens it beside the shared card. The layer takes a mouse's
 * click before React sees it, so `onClick` below only ever runs for a tap or
 * the keyboard.
 */
function FreeRewardTile({ kind, id, href, art, name, title, purpose, mustGet, tag, freeFrom, popupLine }: {
	kind: HoverCardKind
	/** The row id the hover card looks up. */
	id: number
	/** Its Encyclopedia page; null draws a plain tile (a placeholder card). */
	href: string | null
	art: ReactNode
	name: string
	title: string
	purpose: string
	mustGet: boolean
	/** The tile's small line: "SSR, free, 5 copies", "3★ uma, free". */
	tag: string
	/** The screen reader's and the fallback popup's sentence. */
	freeFrom: string
	/** The line on top of the shared hover card in the tap popup. */
	popupLine: string
}) {
	const detailId = useId()
	const { referenceProps, popup } = useHoverPopup("top", { interactive: true, tapOnly: true, fit: true })
	// A ref, not a variable: the tap's pointerup opens the popup, and that
	// re-render lands before the click, which must still see "touch".
	const lastPointer = useRef("")
	const blurb = purpose.trim()

	const face = (
		<>
			{art}
			<div className="flex min-w-0 flex-col items-start gap-0.5">
				{mustGet && (
					<span className="rounded-full border border-brand/55 bg-brand/10 px-2 py-px text-xs font-bold text-brand">
						Must get
					</span>
				)}
				<span className="text-[15px] leading-tight font-semibold text-gray-100">{name}</span>
				{title && <span className="text-xs leading-snug text-gray-400">{title}</span>}
				<span className="text-xs leading-snug text-gray-400">{tag}</span>
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

	// Drawn only while the catalogue doesn't know the reward yet; otherwise the
	// tap opens the site's own card (below).
	const fallback = (
		<div className="flex flex-col gap-1.5 text-[13px]">
			<div>
				<div className="text-sm font-semibold text-gray-100">{name}</div>
				{title && <div className="text-gray-400">{title}</div>}
			</div>
			{blurb && <p className="text-gray-200">{blurb}</p>}
			<p className="text-gray-300">{freeFrom}</p>
			<Link
				to={href}
				className="mt-0.5 flex items-center justify-between border-t border-gray-700 pt-1.5 font-semibold text-brand underline-offset-2 hover:underline"
			>
				Open Encyclopedia
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
				{...hoverCardProps(kind, id)}
				{...tapProps}
			>
				{face}
			</Link>
			{/* The screen reader's copy: always present, since the drawn popup is aria-hidden. */}
			<span id={detailId} role="tooltip" className="sr-only">
				{[title, blurb, freeFrom].filter(Boolean).join(" ")}
			</span>
			{/* The same card a computer's hover opens (HoverCardContent, what
			    HoverCardLayer draws), with this event's line on top. */}
			{popup(
				<HoverCardContent
					kind={kind}
					id={id}
					top={<p className="mb-1 text-[13px] text-gray-300">{popupLine}</p>}
					fallback={fallback}
				/>,
				"w-80"
			)}
		</>
	)
}
