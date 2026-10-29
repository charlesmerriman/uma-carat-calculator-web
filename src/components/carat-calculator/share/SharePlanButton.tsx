import { useState } from "react"
import type { BannerSupport, BannerUma, UserStepUpSelection } from "../../../types"
import type { BannerResources } from "../../../hooks/bannerResources"
import type { PlannerRow } from "../../../utils/plannerSections"
import { useAccount } from "../../../services/AuthContext"
import { ShareOption, SharePictureButton } from "../../share/SharePictureButton"
import { PlanPicture } from "./PlanPicture"

/**
 * "Share picture" on the calculator: the pull plan as a poster (PlanPicture),
 * with two options. The panel, the drawing and Copy / Share / Download are
 * SharePictureButton's, shared with the PvP team's picture.
 */
export function SharePlanButton({ plannerRows, bannerResources, umaBannerData, supportBannerData, userStepUpSelectionData, inBar = false }: {
	plannerRows: PlannerRow[]
	bannerResources: BannerResources[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	userStepUpSelectionData: UserStepUpSelection[]
	/** On the PLANS bar (signed in), dressed like the bar's "New" and "..."
	 *  buttons; otherwise in the add-banner row, the guest's only toolbar. */
	inBar?: boolean
}) {
	const { account } = useAccount()
	const name = account?.display_name.trim() || null
	const avatar = account?.avatar_url ?? null
	// Off by default (board post, 2026-10-21): the share link's preview never
	// shows a name either, so showing it is the player's choice each time.
	const [showName, setShowName] = useState(false)
	const [hideSpend, setHideSpend] = useState(false)

	return (
		<SharePictureButton
			// A flex box: in the add-banner row the button stretches to the add
			// buttons' height beside it; on the PLANS bar it centres at the bar's 32px.
			className={inBar ? "self-center" : ""}
			buttonClassName={`flex items-center gap-1.5 rounded-md border border-gray-600 font-medium transition ${
				inBar
					? "h-8 px-2 text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-800 hover:text-gray-100"
					: "px-3 text-gray-200 hover:border-brand hover:text-brand"
			}`}
			blurb="A picture of your plan, to post anywhere."
			shareTitle="My Uma Musume pull plan"
			filename={(date) => `uma-plan-${date}.png`}
			optionsKey={`${showName && !!name}|${hideSpend}`}
			options={
				<>
					{name && (
						<ShareOption checked={showName} onChange={setShowName}>
							{avatar ? "Show my name and picture" : "Show my name"} ({name})
						</ShareOption>
					)}
					<ShareOption checked={hideSpend} onChange={setHideSpend}>
						Hide paid carats
					</ShareOption>
				</>
			}
			picture={(now) => (
				<PlanPicture
					plannerRows={plannerRows}
					bannerResources={bannerResources}
					umaBannerData={umaBannerData}
					supportBannerData={supportBannerData}
					userStepUpSelectionData={userStepUpSelectionData}
					ownerName={showName ? name : null}
					ownerPicture={showName ? avatar : null}
					hideSpend={hideSpend}
					now={now}
				/>
			)}
		/>
	)
}
