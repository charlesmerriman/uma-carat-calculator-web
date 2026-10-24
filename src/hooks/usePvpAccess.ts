import { useAccount } from "../services/AuthContext"
import { defaultPvpEvent } from "../utils/pvpGuide"
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
 *
 * The API keeps a COPY of this rule (backend calculatorapi/pvp_gate.py, with
 * PVP_OPEN_CM_NUMBER below), only to decide what a guide's link preview
 * (/guide/cm-21) may show. Flip both together.
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
 * The events someone the page is locked to can open at all, for the PvP
 * page's event list: the free guide's (the event running now, else the next,
 * `defaultPvpEvent`) and the open CM. `events` in start order.
 */
export function lockedPvpEvents(events: RaceEvent[], now: Date): RaceEvent[] {
	const free = defaultPvpEvent(events, now)
	return events.filter((event) => event === free || isOpenPvpEvent(event))
}

/**
 * The events someone the page is locked to can build a team for (My team and
 * the team window): the open CM only. The free guide is a guide, not a team.
 */
export function lockedTeamEvents(events: RaceEvent[]): RaceEvent[] {
	return events.filter(isOpenPvpEvent)
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
