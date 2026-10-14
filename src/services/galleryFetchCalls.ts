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
import type { GalleryReportReason, GallerySort } from "../types/gallery"
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
	try {
		const body = (await response.json()) as { error?: unknown }
		return typeof body.error === "string" && body.error ? body.error : fallback
	} catch {
		return fallback
	}
}

export function pvpTeamPublish(teamId: number, caption: string): Promise<Response> {
	return post(`/pvp-teams/${teamId}/publish`, { confirm_public_identity: true, caption })
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

/** Upvote (`true`) or take the upvote back. */
export function galleryVote(publicId: string, on: boolean): Promise<Response> {
	return post(`/gallery/posts/${encodeURIComponent(publicId)}/vote`, undefined, on ? "PUT" : "DELETE")
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
