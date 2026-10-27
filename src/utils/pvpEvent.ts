/**
 * Naming one PvP event in a URL: `?event=cm-12` / `?event=loh-7`.
 *
 * `kind` + the event's database id, the same pair GET /pvp-guides/<kind>/<id>
 * takes. The id rather than the CM number because the id is what every payload
 * carries and it never moves; a CM's number could be corrected in the admin.
 *
 * `refForRaceEvent` is the ONE place that maps the backend's `event_type` tag
 * onto `kind`, so a card or a link never branches on the tag itself.
 */

import type { RaceEvent } from "../types"

export type PvpEventKind = "cm" | "loh"

export interface PvpEventRef {
	kind: PvpEventKind
	id: number
}

/** The query parameter the PvP page reads its event from. */
export const PVP_EVENT_PARAM = "event"

/** "cm-12". */
export function formatPvpEvent(ref: PvpEventRef): string {
	return `${ref.kind}-${ref.id}`
}

/** "cm-12" -> {kind: "cm", id: 12}; anything else -> null. */
export function parsePvpEvent(value: string | null | undefined): PvpEventRef | null {
	const match = /^(cm|loh)-(\d+)$/.exec(value ?? "")
	if (!match) return null
	const id = Number(match[2])
	return id > 0 ? { kind: match[1] as PvpEventKind, id } : null
}

export function refForRaceEvent(event: RaceEvent): PvpEventRef {
	return { kind: event.event_type === "champions_meeting" ? "cm" : "loh", id: event.id }
}

export function sameEvent(a: PvpEventRef | null, b: PvpEventRef | null): boolean {
	return a !== null && b !== null && a.kind === b.kind && a.id === b.id
}

/** The PvP page with this event selected. */
export function pvpEventHref(ref: PvpEventRef): string {
	return `/app/pvp?${PVP_EVENT_PARAM}=${formatPvpEvent(ref)}`
}

/** "CM 46" / "LoH 3": an event's short name, where the full one would be cut off. */
export function shortEventName(event: RaceEvent): string {
	return event.event_type === "champions_meeting" ? `CM ${event.cm_number}` : `LoH ${event.loh_number}`
}

/**
 * "Champions Meeting 20 Sagittarius Cup" -> kicker "Champions Meeting 20",
 * title "Sagittarius Cup". A name with nothing after its number ("League of
 * Heroes 6") keeps the whole name as the title and no kicker.
 */
export function splitEventName(event: RaceEvent): { kicker: string; title: string } {
	const match = /^((?:Champions Meeting|League of Heroes)\s+\d+)\s+(.+)$/i.exec(event.name.trim())
	return match ? { kicker: match[1], title: match[2] } : { kicker: "", title: event.name }
}
