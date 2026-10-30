/**
 * One team, editable: the grid (TeamGrid) and the two pickers its places
 * open, an uma for a spot or a card for a slot.
 *
 * ONE EDITOR, TWO PLACES. The PvP page's My team view draws the full layout
 * (TeamGrid) and the team window the compact one (CompactTeamGrid), with the
 * same pickers and rules, and both write through PvpTeamsProvider, so an edit
 * in one shows in the other at once. The caller owns which team it is and
 * what an edit does (both create the team on the first pick).
 *
 * The guide is optional: with it, recommended picks get their star in the
 * grid and sort first in the pickers.
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useOshiIds } from "../../hooks/useOshiIds"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useCardReleases } from "../../hooks/useCardReleases"
import { releaseBlockReason, releaseNote } from "../../utils/cardRelease"
import {
	MEMBER_STYLES,
	PVP_BORROW_SLOT,
	addCardToEveryDeck,
	cardBlockReason,
	clearCard,
	clearMember,
	memberAt,
	recommendedIds,
	setCard,
	setMemberStyle,
	setMemberVeteran,
	setMemberUma,
	umaBlockReason,
} from "../../utils/pvpTeams"
import { PvpCardPicker } from "./PvpCardPicker"
import { CompactTeamGrid } from "./CompactTeamGrid"
import { TeamGrid, type DeckDeal } from "./TeamGrid"
import type { RaceEvent } from "../../types"
import type { PvpGuide } from "../../types/pvpGuide"
import type { MemberStyle, PvpTeamMember } from "../../types/pvpTeam"
import type { TrainedUma } from "../../types/trainedUma"
import type { Roster } from "../../types/roster"
import { ownedForPicker } from "../../utils/roster"

type PlaceTarget = { pool: "uma"; position: number } | { pool: "support"; position: number; slot: number }

export function TeamEditor({ event, members, index, guide, layout = "full", deal, veterans, roster, onChange }: {
	event: RaceEvent
	members: PvpTeamMember[]
	index: PvpCatalogueIndex
	guide: PvpGuide | null
	/** "compact": the team window's umas-on-top layout. */
	layout?: "full" | "compact"
	/** A guide deck being dealt onto a spot ("Use this deck", My team only). */
	deal?: DeckDeal
	/** The account's veterans, for each member's "which veteran" pick (My team, signed in). */
	veterans?: TrainedUma[]
	/** What the account owns, for the pickers' Owned filter (My team, signed in). */
	roster?: Roster
	onChange: (members: PvpTeamMember[]) => void
}) {
	const [picker, setPicker] = useState<PlaceTarget | null>(null)
	// The card picker's "Add to every deck" box. Off each time the picker
	// opens, so a pick never lands in three decks by surprise.
	const [addToEveryDeck, setAddToEveryDeck] = useState(false)
	// The account's favorite umas, every outfit of each, get the rainbow
	// frame: the same set every other page frames (useOshiIds).
	const oshiIds = useOshiIds()
	const isFavorite = (umaId: number): boolean => oshiIds.has(umaId)
	// Only what is out by the event's last day can be picked; what lands
	// mid-event is marked (utils/cardRelease.ts).
	const releaseFor = useCardReleases(event, index)

	// The guide's picks per style, worked out once per guide for the stars.
	const picksByStyle = useMemo(
		() => new Map(MEMBER_STYLES.map((style) => [style, recommendedIds(guide, style)])),
		[guide]
	)
	const isRecommended = (pool: "uma" | "support", id: number, style: MemberStyle): boolean => {
		const picks = picksByStyle.get(style)
		return picks !== undefined && (pool === "uma" ? picks.umas : picks.cards).has(id)
	}

	const pickerMember = picker ? memberAt(members, picker.position) : undefined
	const pickerStyle = pickerMember?.style ?? null
	const recommended = recommendedIds(guide, pickerStyle ?? "front")
	const umaName = (position: number): string => {
		const member = memberAt(members, position)
		return (member && index.umasById.get(member.uma)?.name) || `uma ${position + 1}`
	}
	const Grid = layout === "compact" ? CompactTeamGrid : TeamGrid
	const apply = (next: PvpTeamMember[]) => {
		onChange(next)
		setPicker(null)
	}

	return (
		<>
			<Grid
				members={members}
				umasById={index.umasById}
				cardsById={index.cardsById}
				course={event}
				releaseFor={releaseFor}
				isFavorite={isFavorite}
				isRecommended={isRecommended}
				onPickUma={(position) => setPicker({ pool: "uma", position })}
				onPickCard={(position, slot) => {
					setAddToEveryDeck(false)
					setPicker({ pool: "support", position, slot })
				}}
				onStyleChange={(position, style) => onChange(setMemberStyle(members, position, style))}
				onClearUma={(position) => onChange(clearMember(members, position))}
				onClearCard={(position, slot) => onChange(clearCard(members, position, slot))}
				deal={deal}
				veterans={veterans}
				onVeteranChange={veterans ? (position, trainedUma) => onChange(setMemberVeteran(members, position, trainedUma)) : undefined}
			/>

			{picker?.pool === "uma" && (
				<PvpCardPicker
					pool="uma"
					items={index.catalogue.umas}
					owned={ownedForPicker(roster, "uma")}
					place="uma"
					title={`Uma ${picker.position + 1}`}
					skillsById={index.skillsById}
					event={event}
					style={pickerStyle}
					recommended={recommended.umas}
					blockReason={(id) => {
						const candidate = index.umasById.get(id)
						return (
							releaseBlockReason(releaseFor("uma", id)) ??
							(candidate ? umaBlockReason(members, picker.position, candidate, index) : null)
						)
					}}
					noteFor={(id) => releaseNote(releaseFor("uma", id))}
					selectedId={pickerMember?.uma ?? null}
					onPick={(id) => {
						const uma = index.umasById.get(id)
						if (uma) apply(setMemberUma(members, picker.position, uma))
						else setPicker(null)
					}}
					onRemove={pickerMember ? () => apply(clearMember(members, picker.position)) : undefined}
					onClose={() => setPicker(null)}
				/>
			)}
			{picker?.pool === "support" && (
				<PvpCardPicker
					pool="support"
					items={index.catalogue.support_cards}
					owned={ownedForPicker(roster, "support")}
					place={picker.slot === PVP_BORROW_SLOT ? "borrow" : "card"}
					title={`${picker.slot === PVP_BORROW_SLOT ? "Borrowed card" : `Card ${picker.slot}`} for ${umaName(picker.position)}`}
					skillsById={index.skillsById}
					event={event}
					style={pickerStyle}
					recommended={recommended.cards}
					blockReason={(id) =>
						releaseBlockReason(releaseFor("support", id)) ??
						cardBlockReason(pickerMember, picker.slot, id, index)
					}
					noteFor={(id) => releaseNote(releaseFor("support", id))}
					selectedId={pickerMember?.cards.find((card) => card.slot === picker.slot)?.support_card ?? null}
					tabs={
						members.length > 1 ? (
							<label className="flex w-fit items-center gap-1.5 text-xs font-medium text-gray-300">
								<input type="checkbox" checked={addToEveryDeck} onChange={(change) => setAddToEveryDeck(change.target.checked)} />
								Add to every deck on this team
							</label>
						) : undefined
					}
					onPick={(id) => {
						if (!addToEveryDeck) {
							apply(setCard(members, picker.position, picker.slot, id))
							return
						}
						const added = addCardToEveryDeck(members, picker.position, picker.slot, id, index)
						apply(added.members)
						if (added.skipped.length > 0) {
							toast(`Not added to every deck. ${added.skipped.map((skip) => `${umaName(skip.position)}: ${skip.reason}`).join(". ")}.`)
						}
					}}
					onRemove={
						pickerMember?.cards.some((card) => card.slot === picker.slot)
							? () => apply(clearCard(members, picker.position, picker.slot))
							: undefined
					}
					onClose={() => setPicker(null)}
				/>
			)}
		</>
	)
}
