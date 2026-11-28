/**
 * Which kind of gallery post this is. The ONE place a post is narrowed: the
 * kinds share most keys, so code never tells them apart by sniffing which
 * fields are present (the union rule, .claude/rules/frontend-ui.md). A team
 * from an API older than plans has no `kind`, so a missing kind is a team.
 *
 * Generic over anything with the tag, so the same helpers narrow a full post,
 * a feed row and a profile card's short entry.
 */

import { PVP_EVENT_PARAM, formatPvpEvent, type PvpEventRef } from "./pvpEvent"

type Tagged = { kind?: "pvp_team" | "plan" | "pvp_guide" }

export function isPlanPost<T extends Tagged>(post: T): post is Extract<T, { kind: "plan" }> {
	return post.kind === "plan"
}

/** A player's own PvP guide (community guides). */
export function isGuidePost<T extends Tagged>(post: T): post is Extract<T, { kind: "pvp_guide" }> {
	return post.kind === "pvp_guide"
}

export function isTeamPost<T extends Tagged>(post: T): post is Exclude<T, { kind: "plan" | "pvp_guide" }> {
	return post.kind !== "plan" && post.kind !== "pvp_guide"
}

/** Where a plan post opens: the Community plans page with the post open in place. */
export function planPostHref(publicId: string): string {
	return `/app/plans?post=${encodeURIComponent(publicId)}`
}

/** The PvP page's parameters for community guides: the list, and one guide open in it. */
export const GUIDES_PARAM = "guides"
export const GUIDE_PARAM = "guide"
export const COMMUNITY_GUIDES = "community"

/** Where a community guide opens: its event's page, on Community guides, with it open. */
export function guidePostHref(event: PvpEventRef, publicId: string): string {
	const params = new URLSearchParams({
		[PVP_EVENT_PARAM]: formatPvpEvent(event),
		[GUIDES_PARAM]: COMMUNITY_GUIDES,
		[GUIDE_PARAM]: publicId,
	})
	return `/app/pvp?${params}`
}
