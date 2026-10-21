/**
 * The site's guide editor routes (backend/docs/api-reference.md, "PvP guide
 * editor"). Raw Responses, like the other *FetchCalls modules: the editor's
 * hook (hooks/useGuideDocument.ts) decides what each status means, because
 * a 400 carries field paths, a 409 the other person's document.
 */
import { authHeaders } from "./authToken"
import type { GuideDocumentPut } from "../types/guideDocument"
import type { PvpEventKind } from "../utils/pvpEvent"

const API_URL = import.meta.env.VITE_API_URL

const jsonHeaders = (): HeadersInit => ({
	"Content-Type": "application/json",
	...authHeaders(),
})

function send(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
	return fetch(`${API_URL}${path}`, {
		method,
		headers: jsonHeaders(),
		body: body === undefined ? undefined : JSON.stringify(body),
		signal,
	})
}

export function guideEditableFetch(signal?: AbortSignal): Promise<Response> {
	return send("GET", "/pvp-guides/editable", undefined, signal)
}

export function guideCreate(body: {
	kind: PvpEventKind
	event: number
	scenario?: number | null
	copy_from?: number | null
}): Promise<Response> {
	return send("POST", "/pvp-guides", body)
}

export function guideDocumentFetch(guideId: number, signal?: AbortSignal): Promise<Response> {
	return send("GET", `/pvp-guides/${guideId}/document`, undefined, signal)
}

export function guideDocumentPut(guideId: number, body: GuideDocumentPut): Promise<Response> {
	return send("PUT", `/pvp-guides/${guideId}/document`, body)
}

export function guidePublish(guideId: number, isPublished: boolean): Promise<Response> {
	return send("PATCH", `/pvp-guides/${guideId}`, { is_published: isPublished })
}

export function guideDelete(guideId: number): Promise<Response> {
	return send("DELETE", `/pvp-guides/${guideId}`)
}

export function guideRevisionsFetch(guideId: number): Promise<Response> {
	return send("GET", `/pvp-guides/${guideId}/revisions`)
}

export function guideRevisionFetch(guideId: number, number: number): Promise<Response> {
	return send("GET", `/pvp-guides/${guideId}/revisions/${number}`)
}

export type GuideActionName = "copy-from" | "sheet" | "track-greens"

export function guideAction(guideId: number, name: GuideActionName, body: Record<string, unknown>): Promise<Response> {
	return send("POST", `/pvp-guides/${guideId}/actions/${name}`, body)
}

/** The API's sentence for a refusal, or `fallback`. */
export async function guideRefusalText(response: Response, fallback: string): Promise<string> {
	try {
		const body = (await response.json()) as { error?: unknown }
		return typeof body.error === "string" && body.error ? body.error : fallback
	} catch {
		return fallback
	}
}
