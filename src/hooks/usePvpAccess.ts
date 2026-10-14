import { useAccount } from "../services/AuthContext"

/**
 * The PvP page (guides, My team, the gallery) opens to Patreon supporters and
 * staff first: the owner's call on 2026-10-14, for about a week. Set this to
 * false to open it to everyone; nothing else needs to change.
 *
 * The server says WHO is early (`account.early_access`, supporter or staff,
 * backend benefits.early_access_for); this says WHAT is still early. A client
 * gate: it decides what is drawn, and the PvP API itself stays open.
 */
export const PVP_EARLY_ACCESS = true

/**
 * Whether this visitor may use the PvP page right now. `pending` while the
 * account is still loading, so a supporter never sees the gate flash up.
 * Fails closed otherwise: a guest, an account that didn't load, or one
 * without early access is `locked`.
 */
export type PvpAccess = "open" | "pending" | "locked"

export function usePvpAccess(): PvpAccess {
	const { account, status } = useAccount()
	if (!PVP_EARLY_ACCESS) return "open"
	if (status === "loading") return "pending"
	return account?.early_access ? "open" : "locked"
}
