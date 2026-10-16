/**
 * The umas that get the oshi (rainbow) frame (FramedUma) wherever they appear:
 * every outfit of each favourite the signed-in person's tier covers (the first
 * `oshi_slots`). A favourite Oguri Cap frames Oguri Cap (Christmas) too, on
 * every page (owner, 2026-10-16). Empty for a guest, and before the account
 * loads.
 *
 * The server resolves the outfits (`account.oshi_uma_ids`): only it knows
 * which umas share a character, and the planner and Timeline umas carry no
 * character id to work it out here. An API older than that field gets the
 * exact covered picks, which was the rule before.
 *
 * A pick beyond the covered slots (kept after a lapse) is not framed.
 *
 * Reads the context directly instead of through useAccount, which throws
 * outside an AuthProvider. The frame is decoration on components (planner
 * rows, pickers) that are rendered on their own in tests and must not need
 * the whole sign-in machinery to draw; outside a provider nobody is signed
 * in, so nothing is a favourite.
 */

import { useContext, useMemo } from "react"
import { AuthContext } from "../services/AuthContext"
import type { Account } from "../types/account"

/** The covered picks themselves, exactly as chosen. */
function coveredPickIds(account: Account): number[] {
	return account.oshis.slice(0, account.oshi_slots).map((oshi) => oshi.id)
}

export function useOshiIds(): ReadonlySet<number> {
	const account = useContext(AuthContext)?.account ?? null
	return useMemo(
		() => new Set(account ? (account.oshi_uma_ids ?? coveredPickIds(account)) : []),
		[account]
	)
}

/**
 * Only the exact covered picks, no other outfits. For the favourites picker,
 * where the rainbow says "you picked THIS card": framing a pick's other
 * outfits there would read as them being picked too.
 */
export function useOshiPickIds(): ReadonlySet<number> {
	const account = useContext(AuthContext)?.account ?? null
	return useMemo(() => new Set(account ? coveredPickIds(account) : []), [account])
}
