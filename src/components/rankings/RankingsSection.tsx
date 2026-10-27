/**
 * One Rankings tab's body, for the page and the pinned panel alike.
 *
 * A CONTAINER, so the tabs lay out by their own width (`@4xl:grid-cols-2`)
 * and not the screen's: the same tab fills the page or a 24rem column
 * beside the Calculator. In the panel (`inPanel`) the PvP tab keeps its
 * event to itself instead of in the address bar, which belongs to the page
 * underneath.
 */

import type { RankingsSection as Section } from "../../services/rankingsPinStore"
import { GuideRankings } from "./GuideRankings"
import { PullPlans } from "./PullPlans"
import { PvpTab } from "./PvpTab"
import { PlayersTab } from "./PlayersTab"

export function RankingsSection({ section, inPanel = false }: { section: Section; inPanel?: boolean }) {
	return (
		<div className="@container">
			{section === "guides" && <GuideRankings />}
			{section === "pull-plans" && <PullPlans />}
			{section === "pvp" && <PvpTab inPanel={inPanel} />}
			{section === "players" && <PlayersTab />}
		</div>
	)
}
