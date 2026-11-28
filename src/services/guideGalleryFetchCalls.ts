/**
 * Community guides: players' own PvP guides (backend views/guide_gallery.py,
 * notes/community-guides-plan.md). Reading one posted guide, voting, views,
 * comments, reports and taking it down are the shared /gallery/posts routes
 * in galleryFetchCalls.ts, as a team's are.
 */

import { authHeaders } from "./authToken"
import type { GuideSort } from "../types/gallery"
import type { PvpEventRef } from "../utils/pvpEvent"

const API_URL = import.meta.env.VITE_API_URL

const jsonHeaders = (): HeadersInit => ({
	"Content-Type": "application/json",
	...authHeaders(),
})

const send = (path: string, method: string, body?: unknown): Promise<Response> =>
	fetch(`${API_URL}${path}`, {
		method,
		headers: jsonHeaders(),
		body: body === undefined ? undefined : JSON.stringify(body),
	})

/** One event's community guides, in Top or New order. */
export function guideFeedFetch(ref: PvpEventRef, sort: GuideSort): Promise<Response> {
	const query = new URLSearchParams({ sort })
	return fetch(`${API_URL}/pvp-guide-gallery/${ref.kind}/${ref.id}?${query}`, { headers: jsonHeaders() })
}

/** A "Use this deck" on a community guide, counted like a team's copy. Fire and forget. */
export function guideDeckUsed(publicId: string): void {
	void send(`/gallery/posts/${encodeURIComponent(publicId)}/copy`, "POST").catch(() => {})
}
