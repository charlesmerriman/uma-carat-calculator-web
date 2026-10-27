/**
 * The player's veterans as server state (TanStack Query): read by the
 * Collection page, the Account page's summary and, next, the veteran pickers
 * in My team and CM Runs, so one cached list serves all of them.
 *
 * Writes are not optimistic, unlike CM Runs: a veteran is saved from a form
 * with a Save button, so the form waits for the server's answer (it may
 * refuse a stat or a skill) and the list takes what the server kept.
 *
 * One veteran's full record (her raw game data and spark names, for the
 * Collection's veteran card) is its own query, `trainedUmaKeys.detail(id)`,
 * fetched when her card opens. A veteran from the game never changes, so it
 * is never refetched on its own: an edit or a delete updates it here, and an
 * import drops every one.
 *
 * Account only; the QueryProvider resets every query on a sign-in change.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { refusalText } from "./galleryFetchCalls"
import { HttpError } from "./queryClient"
import {
	trainedUmaCreate,
	trainedUmaDelete,
	trainedUmaFetch,
	trainedUmaImport,
	trainedUmaPatch,
	trainedUmasFetch,
} from "./trainedUmaFetchCalls"
import type { TrainedUma, VeteranDetail, VeteranInput } from "../types/trainedUma"

export const trainedUmaKeys = {
	all: ["trainedUmas"] as const,
	/** Every veteran's own record, so an import can drop them all at once. */
	details: ["trainedUmas", "detail"] as const,
	detail: (id: number) => ["trainedUmas", "detail", id] as const,
}

async function readVeteran(response: Response, fallback: string): Promise<TrainedUma> {
	if (!response.ok) throw new HttpError(response.status, await refusalText(response, fallback))
	return (await response.json()) as TrainedUma
}

/** Every veteran, newest first. Only asks while `enabled` (signed in). */
export function useTrainedUmas(enabled: boolean) {
	return useQuery({
		queryKey: trainedUmaKeys.all,
		enabled,
		queryFn: async (): Promise<TrainedUma[]> => {
			const response = await trainedUmasFetch()
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "Your veterans didn't load."))
			return (await response.json()) as TrainedUma[]
		},
	})
}

/**
 * One veteran with her game data, while `id` is set. `staleTime: Infinity`:
 * nothing but this page's own writes changes her, and those update the cache.
 */
export function useVeteran(id: number | null) {
	return useQuery({
		queryKey: trainedUmaKeys.detail(id ?? 0),
		enabled: id !== null,
		staleTime: Infinity,
		queryFn: async (): Promise<VeteranDetail> => {
			const response = await trainedUmaFetch(id ?? 0)
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "Her details didn't load."))
			return (await response.json()) as VeteranDetail
		},
	})
}

/**
 * The saved veteran replaces (or joins) the cached list, newest first, and
 * her own record if it is cached. A PATCH answer has no game data, so the
 * record keeps the game data it had.
 */
function useCacheVeteran() {
	const client = useQueryClient()
	return (veteran: TrainedUma) => {
		client.setQueryData<TrainedUma[]>(trainedUmaKeys.all, (list = []) =>
			list.some((entry) => entry.id === veteran.id)
				? list.map((entry) => (entry.id === veteran.id ? veteran : entry))
				: [veteran, ...list]
		)
		client.setQueryData<VeteranDetail>(trainedUmaKeys.detail(veteran.id), (detail) => detail && { ...detail, ...veteran })
	}
}

export function useCreateVeteran() {
	const cache = useCacheVeteran()
	return useMutation({
		mutationFn: async (input: VeteranInput) => readVeteran(await trainedUmaCreate(input), "That veteran wasn't saved."),
		onSuccess: cache,
	})
}

export function useUpdateVeteran() {
	const cache = useCacheVeteran()
	return useMutation({
		mutationFn: async ({ id, changes }: { id: number; changes: Partial<VeteranInput> }) =>
			readVeteran(await trainedUmaPatch(id, changes), "That change wasn't saved."),
		onSuccess: cache,
	})
}

export function useDeleteVeteran() {
	const client = useQueryClient()
	return useMutation({
		mutationFn: async (id: number) => {
			const response = await trainedUmaDelete(id)
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "That veteran wasn't deleted."))
			return id
		},
		onSuccess: (id) => {
			client.setQueryData<TrainedUma[]>(trainedUmaKeys.all, (list = []) => list.filter((entry) => entry.id !== id))
			client.removeQueries({ queryKey: trainedUmaKeys.detail(id) })
		},
	})
}

/** What an import did, and the list as it now stands. */
export interface ImportOutcome {
	created: number
	updated: number
	removed: number
	kept: number
	veterans: TrainedUma[]
}

export function useImportVeterans() {
	const client = useQueryClient()
	return useMutation({
		mutationFn: async (items: unknown[]): Promise<ImportOutcome> => {
			const response = await trainedUmaImport(items)
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "The import wasn't saved."))
			return (await response.json()) as ImportOutcome
		},
		onSuccess: (outcome) => {
			client.setQueryData<TrainedUma[]>(trainedUmaKeys.all, outcome.veterans)
			// An import rewrites veterans in place, game data and all.
			client.removeQueries({ queryKey: trainedUmaKeys.details })
		},
	})
}

