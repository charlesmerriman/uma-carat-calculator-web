/**
 * Where the selected team is saved, as a small icon and a word or two: "On
 * this device" for a guest, "Saving…" / "Saved" for an account, a red "Not
 * saved" when the last write failed. Shown by the builder's toolbar and the
 * team window's header. Nothing when there is no team to save.
 */

import type { ReactNode } from "react"
import { CloudAlert, CloudCheck, HardDrive, Loader2 } from "lucide-react"
import type { PvpTeamsContextType } from "../../services/PvpTeamsContext"

export function SaveStatus({ mode, saveState, hasTeam }: {
	mode: PvpTeamsContextType["mode"]
	saveState: PvpTeamsContextType["saveState"]
	hasTeam: boolean
}) {
	if (!hasTeam && saveState !== "error") return null
	let icon: ReactNode
	let text: string
	let tone = "text-gray-400"
	if (saveState === "error") {
		icon = <CloudAlert className="h-4 w-4" />
		text = mode === "guest" ? "Not saved on this device" : "Not saved"
		tone = "text-highlight"
	} else if (mode === "guest") {
		icon = <HardDrive className="h-4 w-4" />
		text = "On this device"
	} else if (saveState === "pending" || saveState === "saving") {
		icon = <Loader2 className="h-4 w-4 animate-spin" />
		text = "Saving…"
	} else {
		icon = <CloudCheck className="h-4 w-4" />
		text = "Saved"
	}
	return (
		<span
			className={`mr-1 flex items-center gap-1.5 text-xs font-medium ${tone}`}
			role="status"
			aria-live="polite"
			title={saveState === "error" && mode !== "guest" ? "Your next change will try again." : undefined}
		>
			{icon}
			{text}
		</span>
	)
}
