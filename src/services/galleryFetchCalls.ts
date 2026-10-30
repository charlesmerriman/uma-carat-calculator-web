/**
 * The gallery's routes: posting a team, an event's feed, one post, votes,
 * views, copies, comments and reports. Shapes and refusals:
 * backend/docs/api-reference.md ("Gallery").
 *
 * Every call returns the raw Response, like the rest of the fetch modules, so
 * the component decides what a failure means. A refusal carries
 * {"error": "<one sentence>"}, written for the player; refusalText reads it.
 */
import { authHeaders } from "./authToken"
import type { GalleryReportReason, GallerySort, ProfileCardTarget, VoteChoice } from "../types/gallery"
import type { PvpEventRef } from "../utils/pvpEvent"

const API_URL = import.meta.env.VITE_API_URL

const jsonHeaders = (): HeadersInit => ({
	"Content-Type": "application/json",
	...authHeaders(),
})

const post = (path: string, body?: unknown, method = "POST"): Promise<Response> =>
	fetch(`${API_URL}${path}`, {
		method,
		headers: jsonHeaders(),
		body: body === undefined ? undefined : JSON.stringify(body),
	})

/** The sentence a refusal carries, or `fallback` when it has none. */
export async function refusalText(response: Response, fallback: string): Promise<string> {
	return (await refusal(response, fallback)).text
}

/**
 * A refusal's sentence, and the request field it was about when the API
 * names one (`caption` or `strategy` on a post), so a form with two text
 * boxes can mark the right one.
 */
export async function refusal(response: Response, fallback: string): Promise<{ text: string; field: string | null }> {
	try {
		const body = (await response.json()) as { error?: unknown; field?: unknown }
		return {
			text: typeof body.error === "string" && body.error ? body.error : fallback,
			field: typeof body.field === "string" ? body.field : null,
		}
	} catch {
		return { text: fallback, field: null }
	}
}

/** A person's card, from a post of theirs or a comment. */
export function profileCardFetch(target: ProfileCardTarget): Promise<Response> {
	return fetch(`${API_URL}/profile-cards/${target.kind}/${target.id}`, { method: "GET", headers: jsonHeaders() })
}

export function pvpTeamPublish(teamId: number, caption: string, strategy: string): Promise<Response> {
	return post(`/pvp-teams/${teamId}/publish`, { confirm_public_identity: true, caption, strategy })
}

/** One event's feed: the top `limit` rows for the sort, only teams with `uma` when set. */
export function galleryFeedFetch(
	ref: PvpEventRef,
	{ sort, uma, limit }: { sort: GallerySort; uma: number | null; limit: number }
): Promise<Response> {
	const query = new URLSearchParams({ sort, limit: String(limit) })
	if (uma !== null) query.set("uma", String(uma))
	return fetch(`${API_URL}/pvp-gallery/${ref.kind}/${ref.id}?${query}`, { headers: jsonHeaders() })
}

export function galleryPostFetch(publicId: string): Promise<Response> {
	return fetch(`${API_URL}/gallery/posts/${encodeURIComponent(publicId)}`, { headers: jsonHeaders() })
}

export function galleryPostTakeDown(publicId: string): Promise<Response> {
	return post(`/gallery/posts/${encodeURIComponent(publicId)}`, undefined, "DELETE")
}

export function galleryMyPosts(): Promise<Response> {
	return fetch(`${API_URL}/gallery/my-posts`, { headers: jsonHeaders() })
}

/** Vote up or down (PUT), or take the vote back ("none", a DELETE). */
export function galleryVote(publicId: string, choice: VoteChoice): Promise<Response> {
	return voteRequest(`/gallery/posts/${encodeURIComponent(publicId)}/vote`, choice)
}

function voteRequest(path: string, choice: VoteChoice): Promise<Response> {
	return choice === "none" ? post(path, undefined, "DELETE") : post(path, { value: choice }, "PUT")
}

/** Count one view. Fire and forget: the answer is always 204. */
export function galleryView(publicId: string): void {
	void fetch(`${API_URL}/gallery/posts/${encodeURIComponent(publicId)}/view`, {
		method: "POST",
		headers: jsonHeaders(),
		keepalive: true,
	}).catch(() => undefined)
}

export function galleryCopy(publicId: string): Promise<Response> {
	return post(`/gallery/posts/${encodeURIComponent(publicId)}/copy`)
}

export function galleryCommentsFetch(publicId: string, page = 1): Promise<Response> {
	return fetch(`${API_URL}/gallery/posts/${encodeURIComponent(publicId)}/comments?page=${page}`, {
		headers: jsonHeaders(),
	})
}

export function galleryCommentCreate(publicId: string, body: string, parent?: number): Promise<Response> {
	return post(`/gallery/posts/${encodeURIComponent(publicId)}/comments`, parent ? { body, parent } : { body })
}

export function galleryCommentEdit(id: number, body: string): Promise<Response> {
	return post(`/gallery/comments/${id}`, { body }, "PATCH")
}

export function galleryCommentDelete(id: number): Promise<Response> {
	return post(`/gallery/comments/${id}`, undefined, "DELETE")
}

/** A thumbs-up or thumbs-down on a comment, or taking it back; answers `{score, my_vote, split?}`. */
export function galleryCommentVote(id: number, choice: VoteChoice): Promise<Response> {
	return voteRequest(`/gallery/comments/${id}/vote`, choice)
}

/** One section of a PvP guide's comments: "" for the whole guide, else a running style. */
export function guideCommentsFetch(ref: PvpEventRef, section: string, page = 1): Promise<Response> {
	const query = new URLSearchParams({ section, page: String(page) })
	return fetch(`${API_URL}/pvp-guides/${ref.kind}/${ref.id}/comments?${query}`, { headers: jsonHeaders() })
}

export function guideCommentCreate(ref: PvpEventRef, section: string, body: string, parent?: number): Promise<Response> {
	return post(`/pvp-guides/${ref.kind}/${ref.id}/comments`, parent ? { body, parent, section } : { body, section })
}

export type GalleryReportTarget = { post: string } | { comment: number }

export function galleryReport(target: GalleryReportTarget, reason: GalleryReportReason, note: string): Promise<Response> {
	return post("/gallery/reports", { ...target, reason, note })
}

/**
 * A post's permanent link, the one people paste in Discord. Built from the
 * page's own origin, so it is only called from an event handler (never at
 * render time: /app is prerendered). `/post` is served by the API through an
 * ingress rule; see backend/views/gallery_share.py.
 */
export function galleryShareUrl(publicId: string): string {
	return `${window.location.origin}/post/${publicId}`
}
