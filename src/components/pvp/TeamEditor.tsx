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
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import {
	MEMBER_STYLES,
	PVP_BORROW_SLOT,
	cardBlockReason,
	clearCard,
	clearMember,
	memberAt,
	recommendedIds,
	setCard,
	setMemberStyle,
	setMemberUma,
	umaBlockReason,
} from "../../utils/pvpTeams"
import { PvpCardPicker } from "./PvpCardPicker"
import { CompactTeamGrid } from "./CompactTeamGrid"
import { TeamGrid } from "./TeamGrid"
import type { RaceEvent } from "../../types"
import type { PvpGuide } from "../../types/pvpGuide"
import type { MemberStyle, PvpTeamMember } from "../../types/pvpTeam"

type PlaceTarget = { pool: "uma"; position: number } | { pool: "support"; position: number; slot: number }

export function TeamEditor({ event, members, index, guide, layout = "full", onChange }: {
	event: RaceEvent
	members: PvpTeamMember[]
	index: PvpCatalogueIndex
	guide: PvpGuide | null
	/** "compact": the team window's umas-on-top layout. */
	layout?: "full" | "compact"
	onChange: (members: PvpTeamMember[]) => void
}) {
	const [picker, setPicker] = useState<PlaceTarget | null>(null)

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
				isRecommended={isRecommended}
				onPickUma={(position) => setPicker({ pool: "uma", position })}
				onPickCard={(position, slot) => setPicker({ pool: "support", position, slot })}
				onStyleChange={(position, style) => onChange(setMemberStyle(members, position, style))}
				onClearUma={(position) => onChange(clearMember(members, position))}
				onClearCard={(position, slot) => onChange(clearCard(members, position, slot))}
			/>

			{picker?.pool === "uma" && (
				<PvpCardPicker
					pool="uma"
					items={index.catalogue.umas}
					title={`Uma ${picker.position + 1}`}
					skillsById={index.skillsById}
					event={event}
					style={pickerStyle}
					recommended={recommended.umas}
					blockReason={(id) => {
						const candidate = index.umasById.get(id)
						return candidate ? umaBlockReason(members, picker.position, candidate, index.umasById) : null
					}}
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
					title={`${picker.slot === PVP_BORROW_SLOT ? "Borrowed card" : `Card ${picker.slot}`} for ${umaName(picker.position)}`}
					skillsById={index.skillsById}
					event={event}
					style={pickerStyle}
					recommended={recommended.cards}
					blockReason={(id) => cardBlockReason(pickerMember, picker.slot, id)}
					selectedId={pickerMember?.cards.find((card) => card.slot === picker.slot)?.support_card ?? null}
					onPick={(id) => apply(setCard(members, picker.position, picker.slot, id))}
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
