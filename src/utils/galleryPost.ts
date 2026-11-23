/**
 * Which kind of gallery post this is. The ONE place a post is narrowed: a team
 * and a plan share most keys, so code never tells them apart by sniffing which
 * fields are present (the union rule, .claude/rules/frontend-ui.md). A team
 * from an API older than plans has no `kind`, so a missing kind is a team.
 *
 * Generic over anything with the tag, so the same two helpers narrow a full
 * post, a feed row and a profile card's short entry.
 */

type Tagged = { kind?: "pvp_team" | "plan" }

export function isPlanPost<T extends Tagged>(post: T): post is Extract<T, { kind: "plan" }> {
	return post.kind === "plan"
}

export function isTeamPost<T extends Tagged>(post: T): post is Exclude<T, { kind: "plan" }> {
	return post.kind !== "plan"
}

/** Where a plan post opens: the Community plans page with the post open in place. */
export function planPostHref(publicId: string): string {
	return `/app/plans?post=${encodeURIComponent(publicId)}`
}
