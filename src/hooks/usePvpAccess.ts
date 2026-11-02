import { useAccount } from "../services/AuthContext"
import { defaultPvpEvent } from "../utils/pvpGuide"
import type { RaceEvent } from "../types"

/**
 * The PvP page (guides, My team, the gallery) opens to Patreon supporters and
 * staff first: the owner's call on 2026-10-14. What else a reader without
 * early access may open is each guide's own setting since 2026-11-02
 * (notes/guide-visibility-plan.md), chosen in the guide editor:
 *
 *   Private     staff only; the payload says no guide
 *   Supporters  early access only; everyone else gets the early-access card
 *   Public      everyone may read the guide
 *   Public + `guide_tools_public`   My team and the Gallery (and the event's
 *               CM Runs) open to everyone too
 *
 * The server says WHO is early (`account.early_access`: a supporter, staff,
 * or an account granted it in the admin; backend benefits.early_access_for)
 * and, per event, WHAT is open (`guide_visibility`, `guide_tools_public` on
 * the race arrays). Nothing here is a constant any more: the rolling free
 * guide and the one open CM were replaced by the setting (owner, 2026-11-02).
 * The API refuses a Supporters guide and its comments itself
 * (guide_access.py); My team and the Gallery are drawn or not here only.
 */

/** Whether everyone may read `event`'s guide: it is Public. */
export function guideOpenToEveryone(event: RaceEvent): boolean {
	return event.guide_visibility === "public"
}

/** Whether My team, the Gallery and CM Runs for `event` are open to everyone. */
export function toolsOpenToEveryone(event: RaceEvent): boolean {
	return guideOpenToEveryone(event) && event.guide_tools_public === true
}

/**
 * The events someone the page is locked to can open at all, for the PvP
 * page's event list: those with a Public guide.
 */
export function lockedPvpEvents(events: RaceEvent[]): RaceEvent[] {
	return events.filter(guideOpenToEveryone)
}

/**
 * The events someone the page is locked to can build a team for (My team and
 * the team window): a Public guide with My team and the Gallery opened.
 */
export function lockedTeamEvents(events: RaceEvent[]): RaceEvent[] {
	return events.filter(toolsOpenToEveryone)
}

/**
 * Where a bare /app/pvp lands for someone the page is locked to: the Public
 * guide running now, else the next, else the latest (`defaultPvpEvent` over
 * the Public ones), so the navbar link lands somewhere readable. Null when no
 * guide is Public. `events` in start order.
 */
export function lockedLandingEvent(events: RaceEvent[], now: Date): RaceEvent | null {
	return defaultPvpEvent(lockedPvpEvents(events), now)
}

/**
 * Whether this visitor may use the PvP page right now. `pending` while the
 * account is still loading, so a supporter never sees the gate flash up.
 * Fails closed otherwise: a guest, an account that didn't load, or one
 * without early access is `locked`, which the page reads as "what each
 * event's setting opens to everyone".
 */
export type PvpAccess = "open" | "pending" | "locked"

export function usePvpAccess(): PvpAccess {
	const { account, status } = useAccount()
	if (status === "loading") return "pending"
	return account?.early_access ? "open" : "locked"
}
