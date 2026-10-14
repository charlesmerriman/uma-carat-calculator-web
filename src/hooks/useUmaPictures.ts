/**
 * Uma names and pictures by id, from GET /umas, for a page outside /app that
 * needs a few portraits without the PvP catalogue (half a megabyte, mostly
 * skills). The account page's "Your gallery posts" is the one user.
 *
 * /umas lists pickable umas only (pictured, never the "(All)" placeholder),
 * so an id missing from the map draws as a grey square.
 */

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { umasFetch } from "../services/umasFetchCalls"
import { HttpError } from "../services/queryClient"

export interface UmaPicture {
	id: number
	name: string
	image: string | null
}

export function useUmaPictures(enabled: boolean): Map<number, UmaPicture> {
	const query = useQuery({
		queryKey: ["umas"],
		queryFn: async ({ signal }) => {
			const response = await umasFetch(signal)
			if (!response.ok) throw new HttpError(response.status, "The uma list didn't load.")
			return (await response.json()) as UmaPicture[]
		},
		enabled,
		// The catalogue changes when an editor adds an uma, not while a page is open.
		staleTime: Infinity,
	})
	return useMemo(() => new Map((query.data ?? []).map((uma) => [uma.id, uma])), [query.data])
}
