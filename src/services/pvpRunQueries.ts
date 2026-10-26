/**
 * The CM Runs view's server state: one event's logged runs, and the writes
 * that change them. TanStack Query, like the gallery (services/queryClient.ts
 * says why the app uses it at all).
 *
 * HOW A SAVE WORKS
 * ----------------
 * A change is a FUNCTION of the ticket as the cache holds it right now, never
 * of what the component last rendered: two picks made before React re-renders
 * would otherwise each start from the old ticket, and the second would undo
 * the first (it did, in the first draft's test). The save reads the cache,
 * applies the change, writes the cache back synchronously (the screen never
 * waits), and queues a PUT of the whole ticket. Every write for one event shares a mutation
 * `scope`, so TanStack runs them one at a time, in order: three quick picks
 * reach the server as three PUTs in the order made, and the last one wins
 * there as it did on screen. The answers are not written back (the cache
 * already holds what was sent); a failure refetches the event so the screen
 * shows what the server kept, and the view says it wasn't saved.
 *
 * Account only. The QueryProvider resets every query on a sign-in change, so a
 * run never outlives the account it belongs to.
 */

import { useCallback } from "react"
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { pvpRunDelete, pvpRunPut, pvpRunsFetch } from "./pvpRunFetchCalls"
import { refusalText } from "./galleryFetchCalls"
import { HttpError } from "./queryClient"
import { contentOf, emptyContent, sameSlot, slotOf } from "../utils/pvpRuns"
import type { PvpRun, PvpRunContent, PvpRunSlot } from "../types/pvpRun"
import type { PvpEventRef } from "../utils/pvpEvent"

export const pvpRunKeys = {
	all: ["pvpRuns"] as const,
	event: (ref: PvpEventRef) => ["pvpRuns", ref.kind, ref.id] as const,
}

/** Every run the player logged for the event. Only asks while `enabled` (signed in). */
export function usePvpRuns(ref: PvpEventRef, enabled: boolean) {
	return useQuery({
		queryKey: pvpRunKeys.event(ref),
		enabled,
		queryFn: async (): Promise<PvpRun[]> => {
			const response = await pvpRunsFetch(ref)
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "Your runs didn't load."))
			return (await response.json()) as PvpRun[]
		},
	})
}

/** A save: the slot and its whole content, or `null` content to clear it. */
export interface RunWrite {
	slot: PvpRunSlot
	content: PvpRunContent | null
}

/** The cache with one slot replaced by `content`, or removed when it is null. */
function withRun(runs: PvpRun[], ref: PvpEventRef, write: RunWrite, previous: PvpRun | undefined): PvpRun[] {
	const others = runs.filter((run) => !sameSlot(slotOf(run), write.slot))
	if (!write.content) return others
	const { slot } = write
	const next: PvpRun = {
		kind: ref.kind,
		event: ref.id,
		stage: slot.stage,
		day: slot.stage === "day" ? slot.day : null,
		ticket: slot.stage === "day" ? slot.ticket : null,
		updated_at: previous?.updated_at ?? new Date().toISOString(),
		...write.content,
	}
	return [...others, next]
}

/**
 * A change to one slot: the ticket as it should be, given the ticket as it is
 * (an empty one when nothing is logged there), or `null` to clear it.
 */
export type RunChange = (current: PvpRunContent) => PvpRunContent | null

/**
 * Save or clear slots. `save(slot, change)` updates the screen at once and
 * queues the write; `onError` gets the API's sentence when it sent one.
 */
export function useSaveRun(ref: PvpEventRef, onError: (message: string) => void) {
	const client = useQueryClient()
	const { kind, id } = ref
	const { mutate } = useMutation({
		mutationKey: pvpRunKeys.event({ kind, id }),
		// One queue per event: see the header.
		scope: { id: pvpRunKeys.event({ kind, id }).join(":") },
		mutationFn: async (write: RunWrite) => {
			const response = write.content
				? await pvpRunPut({ kind, id }, write.slot, write.content)
				: await pvpRunDelete({ kind, id }, write.slot)
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "That run wasn't saved."))
		},
		onError: (error) => {
			onError(error instanceof Error && error.message ? error.message : "That run wasn't saved.")
			void client.invalidateQueries({ queryKey: pvpRunKeys.event({ kind, id }) })
		},
	})

	return useCallback(
		(slot: PvpRunSlot, change: RunChange) => {
			const key = pvpRunKeys.event({ kind, id })
			// A GET still out would land after this and undo it on screen.
			// Kept as it is (no revert), so the data below is what stays.
			void client.cancelQueries({ queryKey: key }, { revert: false })
			const runs = client.getQueryData<PvpRun[]>(key) ?? []
			const previous = runs.find((run) => sameSlot(slotOf(run), slot))
			const content = change(previous ? contentOf(previous) : emptyContent())
			const write = { slot, content }
			client.setQueryData<PvpRun[]>(key, withRun(runs, { kind, id }, write, previous))
			mutate(write)
		},
		[client, kind, id, mutate]
	)
}

/** True while any save for the event is queued or out: the "Saving…" line. */
export function useRunsSaving(ref: PvpEventRef): boolean {
	return useIsMutating({ mutationKey: pvpRunKeys.event(ref) }) > 0
}
