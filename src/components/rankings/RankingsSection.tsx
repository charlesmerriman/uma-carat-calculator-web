/**
 * One Rankings tab's body on the page.
 *
 * A CONTAINER, so the tabs lay out by their own width (the kit's `@min-[..]`
 * queries) and not the screen's. The pinned window has its own body since
 * the redesign (RankingsDock.tsx, WindowSources.tsx), so this is the page's
 * alone.
 */

import type { RankingsSection as Section } from "../../services/rankingsPinStore"
import { GuideRankings } from "./GuideRankings"
import { PullPlans } from "./PullPlans"
import { PvpTab } from "./PvpTab"
import { PlayersTab } from "./PlayersTab"

export function RankingsSection({ section }: { section: Section }) {
	return (
		<div className="@container">
			{section === "guides" && <GuideRankings />}
			{section === "pull-plans" && <PullPlans />}
			{section === "pvp" && <PvpTab />}
			{section === "players" && <PlayersTab />}
		</div>
	)
}
