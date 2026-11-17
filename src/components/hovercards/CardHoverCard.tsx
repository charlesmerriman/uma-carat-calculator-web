/**
 * THE SUPPORT CARD'S CARD: what hovering a support card shows, the skill
 * card's sibling (notes/uma-card-hover-plan.md, the canvas the owner approved
 * on 2026-11-17).
 *
 * Top to bottom: a header (the card as the game draws it, its name, title,
 * rarity and type, and when it came out on Global), its training effects at
 * 0LB and at max limit break side by side, plus the player's own limit break
 * when the card is in their Collection (owner, 2026-11-17), its unique effect,
 * the skills it hints and teaches through events, and "Open its page".
 *
 * It only draws, like UmaHoverCard: HoverCardLayer fetches the page.
 */

import type { ReactNode } from "react"
import type { CardPageData } from "../../types/encyclopedia"
import type { CatalogueSupportCard } from "../../types/pvpTeam"
import { FramedCard } from "../FramedCard"
import { CARD_TYPE_LABELS } from "../../utils/cardTypes"
import { formatDate } from "../../utils/dateFormat"
import { colourStyle, RARITY_WORDS } from "../../utils/encyclopedia"
import { effectAt, effectColumns } from "../../utils/hoverCards"
import { CardFoot, CardHead, ChipRow, Label, Loading } from "./parts"

export interface CardHoverCardProps {
	/** The catalogue's entry: draws the header before the page arrives. */
	card: Pick<CatalogueSupportCard, "id" | "name" | "image" | "image_borderless" | "card_type" | "rarity" | "title">
	/** Its page (GET /encyclopedia/cards/<game_id>); undefined while loading, null when there is none. */
	page: CardPageData | null | undefined
	/** Its page's address, or null to draw no link. */
	href: string | null
	/** The player's limit break, 0 to 4, when the card is in their Collection. */
	ownedLimitBreak?: number | null
	/** False: skill chips are plain text (where leaving would drop an edit). */
	links?: boolean
	/** Above the body, under the header: a guide's note for this card. */
	top?: ReactNode
}

export function CardHoverCard({ card, page, href, ownedLimitBreak = null, links = true, top = null }: CardHoverCardProps) {
	const name = page?.name ?? card.name
	const source = page ?? card
	const kind = [source.rarity ? RARITY_WORDS[source.rarity] : "", source.card_type ? CARD_TYPE_LABELS[source.card_type] ?? "" : ""]
		.filter(Boolean)
		.join(" ")
	const out = page ? (page.released_at ? `Out ${formatDate(page.released_at)}` : page.on_global ? "" : "JP only") : ""
	const meta = [source.title, kind, out].filter(Boolean).join(" · ")
	return (
		<div className="skill-card hover-card">
			<CardHead
				name={name}
				meta={meta}
				style={colourStyle(page?.colours)}
				art={<FramedCard card={source} limitBreaks={ownedLimitBreak} className="w-full" />}
			/>
			{top && <div className="skill-card__note">{top}</div>}
			{page === undefined ? (
				<Loading what={name} />
			) : page === null ? null : (
				<CardBody page={page} ownedLimitBreak={ownedLimitBreak} links={links} />
			)}
			<CardFoot href={href} credit={Boolean(page?.uses_translation || page?.unique_effect?.translated)} />
		</div>
	)
}

function CardBody({ page, ownedLimitBreak, links }: { page: CardPageData; ownedLimitBreak: number | null; links: boolean }) {
	const columns = effectColumns(page.caps ?? [], ownedLimitBreak)
	const effects = page.effects ?? []
	const unique = page.unique_effect ?? null
	// The parts' own lines carry the numbers ("Training Effectiveness 5%"); the
	// game's sentence is the fallback when a part can't be read yet.
	const uniqueLines = unique?.amounts?.every((amount) => amount.line) ? unique.amounts.map((amount) => amount.line).join(", ") : null
	const skills = (source: string) => page.skills.filter((skill) => skill.source === source)
	const hints = skills("hint")
	return (
		<>
			{columns.length > 0 && effects.length > 0 && (
				<div>
					<Label>{`Training effects · Lv ${columns[0].level} at 0LB, Lv ${columns[1].level} at MLB`}</Label>
					<table className="hover-card__effects">
						<thead>
							<tr>
								<th />
								{columns.map((column) => (
									<th key={column.label} data-yours={column.yours} title={column.yours ? "Your limit break" : undefined}>
										{/* 0LB or MLB is the player's own: say so on it, no extra column. */}
										{column.label}
										{column.yours && !column.label.startsWith("Yours") ? " (yours)" : ""}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{effects.map((effect) => (
								<tr key={effect.type}>
									<td>{effect.name}</td>
									{columns.map((column) => (
										<td key={column.label} data-yours={column.yours}>{effectAt(effect, column.level)}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{unique && (
				<div className="skill-card__block">
					<Label>{`Unique effect · from Lv ${unique.level}`}</Label>
					<span className="skill-card__text">{uniqueLines ?? unique.text}</span>
				</div>
			)}
			{page.skills.length > 0 && (
				<div className="skill-card__block">
					<ChipRow label={`Hints · ${hints.length}`} skills={hints} links={links} />
					<ChipRow label="Events" skills={skills("event")} links={links} />
				</div>
			)}
		</>
	)
}
