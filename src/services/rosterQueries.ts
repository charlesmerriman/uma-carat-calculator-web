/**
 * What the player owns, as server state (TanStack Query): read by the
 * Collection's Umas and Support cards tabs and by My team's pickers (the
 * Owned filter), so one cached roster serves all of them.
 *
 * Grid taps are optimistic, like CM Runs (services/pvpRunQueries.ts): a tap
 * changes the cache at once (utils/roster.ts applyRosterChanges) and queues a
 * PATCH; every write shares one mutation `scope`, so they reach the server in
 * the order made. A refusal toasts the API's sentence and refetches.
 *
 * Account only; the QueryProvider resets every query on a sign-in change.
 */

import { useCallback } from "react"
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { refusalText } from "./galleryFetchCalls"
import { HttpError } from "./queryClient"
import { rosterClear, rosterFetch, rosterImport, rosterPatch } from "./rosterFetchCalls"
import { applyRosterChanges } from "../utils/roster"
import type { ImportCounts, Roster, RosterChanges, RosterList } from "../types/roster"

export const rosterKeys = {
	all: ["roster"] as const,
}

const EMPTY: Roster = { umas: [], support_cards: [] }

/** The roster. Only asks while `enabled` (signed in). */
export function useRoster(enabled: boolean) {
	return useQuery({
		queryKey: rosterKeys.all,
		enabled,
		queryFn: async (): Promise<Roster> => {
			const response = await rosterFetch()
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "Your collection didn't load."))
			return (await response.json()) as Roster
		},
	})
}

/** `edit(changes)` shows the change at once and queues the save. */
export function useEditRoster(onError: (message: string) => void) {
	const client = useQueryClient()
	const { mutate } = useMutation({
		mutationKey: rosterKeys.all,
		scope: { id: "roster" },
		mutationFn: async (changes: RosterChanges) => {
			const response = await rosterPatch(changes)
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "That change wasn't saved."))
		},
		onError: (error) => {
			onError(error instanceof Error && error.message ? error.message : "That change wasn't saved.")
			void client.invalidateQueries({ queryKey: rosterKeys.all })
		},
	})
	return useCallback(
		(changes: RosterChanges) => {
			void client.cancelQueries({ queryKey: rosterKeys.all }, { revert: false })
			client.setQueryData<Roster>(rosterKeys.all, (roster = EMPTY) => applyRosterChanges(roster, changes))
			mutate(changes)
		},
		[client, mutate]
	)
}

/** True while a grid edit is queued or out: the "Saving…" line. */
export function useRosterSaving(): boolean {
	return useIsMutating({ mutationKey: rosterKeys.all }) > 0
}

export interface RosterImportOutcome {
	/** Present for each list the import sent. */
	umas?: ImportCounts
	support_cards?: ImportCounts
	roster: Roster
}

export function useImportRoster() {
	const client = useQueryClient()
	return useMutation({
		mutationFn: async (body: { umas?: unknown[]; support_cards?: unknown[] }): Promise<RosterImportOutcome> => {
			const response = await rosterImport(body)
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "The import wasn't saved."))
			return (await response.json()) as RosterImportOutcome
		},
		onSuccess: (outcome) => client.setQueryData<Roster>(rosterKeys.all, outcome.roster),
	})
}

/** Start over on one list; the cache takes the roster the server answers with. */
export function useClearRoster() {
	const client = useQueryClient()
	return useMutation({
		mutationFn: async (list: RosterList): Promise<Roster> => {
			const response = await rosterClear(list)
			if (!response.ok) throw new HttpError(response.status, await refusalText(response, "That list wasn't cleared."))
			return (await response.json()) as Roster
		},
		onSuccess: (roster) => client.setQueryData<Roster>(rosterKeys.all, roster),
	})
}

