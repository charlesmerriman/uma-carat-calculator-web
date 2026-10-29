import { useState } from "react"
import type { RaceEvent } from "../../../types"
import type { CatalogueSupportCard, CatalogueUma, PvpTeam } from "../../../types/pvpTeam"
import type { TrainedUma } from "../../../types/trainedUma"
import { useAccount } from "../../../services/AuthContext"
import { useOshiIds } from "../../../hooks/useOshiIds"
import { teamPictureFilename } from "../../../utils/teamPicture"
import { ShareOption, SharePictureButton } from "../../share/SharePictureButton"
import { TeamPicture } from "./TeamPicture"

/**
 * "Share picture" on the My team bar: the selected team as a picture
 * (TeamPicture), through the same panel as the pull plan's.
 *
 * The owner's defaults (2026-10-29, notes/team-picture-plan.md): the name off,
 * like the plan's; the veterans off, since they are the account's own data;
 * the notes on, since they say how to run the team. The veteran box shows only
 * when one of the team's umas has a veteran linked.
 */
export function ShareTeamButton({ event, team, umasById, cardsById, veterans }: {
	event: RaceEvent
	team: PvpTeam
	umasById: ReadonlyMap<number, CatalogueUma>
	cardsById: ReadonlyMap<number, CatalogueSupportCard>
	/** The account's veterans; undefined for a guest, who has none. */
	veterans: TrainedUma[] | undefined
}) {
	const { account } = useAccount()
	const oshiIds = useOshiIds()
	const name = account?.display_name.trim() || null
	const avatar = account?.avatar_url ?? null
	const [showName, setShowName] = useState(false)
	const [showVeterans, setShowVeterans] = useState(false)
	const [showNotes, setShowNotes] = useState(true)
	const linked = veterans?.some((veteran) => team.members.some((member) => member.trained_uma === veteran.id)) ?? false
	const teamName = team.name.trim() || null

	return (
		<SharePictureButton
			buttonClassName="flex h-8 items-center gap-1.5 rounded-md border border-gray-600 px-2 text-sm font-medium text-gray-300 transition hover:border-gray-400 hover:bg-gray-800 hover:text-gray-100"
			className="self-center"
			blurb="A picture of this team, to post anywhere."
			shareTitle="My Uma Musume team"
			filename={(stamp) => teamPictureFilename(event, stamp, [showName ? name : null, teamName])}
			optionsKey={`${showName && !!name}|${showVeterans && linked}|${showNotes}`}
			options={
				<>
					{name && (
						<ShareOption checked={showName} onChange={setShowName}>
							{avatar ? "Show my name and picture" : "Show my name"} ({name})
						</ShareOption>
					)}
					{linked && (
						<ShareOption checked={showVeterans} onChange={setShowVeterans}>
							Show my veterans
						</ShareOption>
					)}
					{team.notes.length > 0 && (
						<ShareOption checked={showNotes} onChange={setShowNotes}>
							Show notes
						</ShareOption>
					)}
				</>
			}
			picture={(now) => (
				<TeamPicture
					event={event}
					members={team.members}
					teamName={teamName}
					notes={showNotes ? team.notes : []}
					umasById={umasById}
					cardsById={cardsById}
					isFavorite={(umaId) => oshiIds.has(umaId)}
					veterans={showVeterans && linked && veterans ? veterans : null}
					ownerName={showName ? name : null}
					ownerPicture={showName ? avatar : null}
					now={now}
				/>
			)}
		/>
	)
}
