/**
 * The navbar's "Team" button: opens and closes the PvP team drawer
 * (components/pvp/TeamDrawer.tsx).
 *
 * Reads TeamDrawerContext, which only AppShell provides, so outside /app it
 * renders nothing (the SettingsMenu rule). It also stands aside on the PvP
 * page's My team view, where the full builder already shows the team.
 * Icon only below desktop-nav, where the mobile bar is tight.
 */

import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { useTeamDrawer } from "../../services/TeamDrawerContext"
import { NAV_BUTTON } from "./navStyles"

export const TeamDrawerButton = () => {
	const drawer = useTeamDrawer()
	if (!drawer || !drawer.available) return null
	const Icon = drawer.open ? PanelRightClose : PanelRightOpen
	return (
		<button
			type="button"
			data-team-drawer-button
			aria-expanded={drawer.open}
			aria-controls="team-drawer"
			aria-label={drawer.open ? "Hide your PvP team" : "Show your PvP team"}
			title={drawer.open ? "Hide your PvP team" : "Show your PvP team"}
			onClick={() => drawer.setOpen(!drawer.open)}
			className={`${NAV_BUTTON} px-2.5 ${drawer.open ? "border-brand/60 text-brand" : ""}`}
		>
			<Icon className="h-4 w-4" />
			<span className="hidden desktop-nav:inline">Team</span>
		</button>
	)
}
