import { useAccount } from "../services/AuthContext"
import type { RaceEvent } from "../types"

/**
 * The PvP page (guides, My team, the gallery) opens to Patreon supporters and
 * staff first: the owner's call on 2026-10-14. Since 2026-10-22 one guide is
 * free for everyone while it is early, the event running now or the next one
 * (components/pvp/PvpGuidePage.tsx). Set this to false to open it all to
 * everyone; nothing else needs to change.
 *
 * The server says WHO is early (`account.early_access`: a supporter, staff,
 * or an account granted it in the admin; backend benefits.early_access_for);
 * this says WHAT is still early. A client
 * gate: it decides what is drawn, and the PvP API itself stays open.
 */
export const PVP_EARLY_ACCESS = true

/**
 * The one Champions Meeting open in full while the page is early: its guide,
 * My team and the Gallery, for everyone (owner, 2026-10-22). From CM 22 on,
 * only the rolling free guide is open (components/pvp/PvpGuidePage.tsx).
 * Matched on the CM's number, never its database id. Null closes it again.
 */
export const PVP_OPEN_CM_NUMBER: number | null = 21

/** Whether `event` is the CM that is open in full while the page is early. */
export function isOpenPvpEvent(event: RaceEvent): boolean {
	return event.event_type === "champions_meeting" && event.cm_number === PVP_OPEN_CM_NUMBER
}

/**
 * Whether this visitor may use the PvP page right now. `pending` while the
 * account is still loading, so a supporter never sees the gate flash up.
 * Fails closed otherwise: a guest, an account that didn't load, or one
 * without early access is `locked`, which the page reads as "the free guide
 * only".
 */
export type PvpAccess = "open" | "pending" | "locked"

export function usePvpAccess(): PvpAccess {
	const { account, status } = useAccount()
	if (!PVP_EARLY_ACCESS) return "open"
	if (status === "loading") return "pending"
	return account?.early_access ? "open" : "locked"
}
