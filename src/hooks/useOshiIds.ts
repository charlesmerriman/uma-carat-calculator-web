/**
 * The ids of the signed-in person's favourite umas that their tier covers
 * (the first `oshi_slots`): the umas that get the oshi frame (FramedUma)
 * wherever they appear. Empty for a guest, and before the account loads.
 *
 * The same slice the Daily Legend Races tab has always used for its oshi
 * lines: a pick beyond the covered slots (kept after a lapse) is not framed.
 *
 * Reads the context directly instead of through useAccount, which throws
 * outside an AuthProvider. The frame is decoration on components (planner
 * rows, pickers) that are rendered on their own in tests and must not need
 * the whole sign-in machinery to draw; outside a provider nobody is signed
 * in, so nothing is a favourite.
 */

import { useContext, useMemo } from "react"
import { AuthContext } from "../services/AuthContext"

export function useOshiIds(): ReadonlySet<number> {
	const account = useContext(AuthContext)?.account ?? null
	return useMemo(
		() => new Set(account ? account.oshis.slice(0, account.oshi_slots).map((oshi) => oshi.id) : []),
		[account]
	)
}
