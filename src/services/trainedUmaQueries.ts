/**
 * The player's veterans as server state (TanStack Query): read by the
 * Collection page, the Account page's summary and, next, the veteran pickers
 * in My team and CM Runs, so one cached list serves all of them.
 *
 * Writes are not optimistic, unlike CM Runs: a veteran is saved from a form
 * with a Save button, so the form waits for the server's answer (it may
 * refuse a stat or a skill) and the list takes what the server kept.
 *
 * Account only; the QueryProvider resets every query on a sign-in change.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { refusalText } from "./galleryFetchCalls"
import { HttpError } from "./queryClient"
import { trainedUmaCreate, trainedUmaDelete, trainedUmaPatch, trainedUmasFetch } from "./trainedUmaFetchCalls"
import type { TrainedUma, VeteranInput } from "../types/trainedUma"

export const trainedUmaKeys = {
	all: ["trainedUmas"] as const,
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

/** The saved veteran replaces (or joins) the cached list, newest first. */
function useCacheVeteran() {
	const client = useQueryClient()
	return (veteran: TrainedUma) =>
		client.setQueryData<TrainedUma[]>(trainedUmaKeys.all, (list = []) =>
			list.some((entry) => entry.id === veteran.id)
				? list.map((entry) => (entry.id === veteran.id ? veteran : entry))
				: [veteran, ...list]
		)
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
		onSuccess: (id) =>
			client.setQueryData<TrainedUma[]>(trainedUmaKeys.all, (list = []) => list.filter((entry) => entry.id !== id)),
	})
}
