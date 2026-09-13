import { useAccount } from "../services/AuthContext"

/**
 * Whether the signed-in account holds the benefit named `key` (e.g. "ad_free").
 *
 * Gate on a KEY, never on the tier name. The server decides which tiers earn
 * which keys (calculatorapi/benefits.py) and sends the result; a client
 * comparing tier names would be a second copy of the paywall, free to disagree
 * with the real one and broken the day a tier is renamed on Patreon.
 *
 * FAILS CLOSED: false while the account is loading, after an error, and for a
 * guest. That is right for a feature ("you don't get it until we know you
 * do"). It is WRONG for the ad loader, which must fail OPEN — that consumer
 * has to read `status` from useAccount() itself. See types/account.ts.
 */
export function useHasBenefit(key: string): boolean {
	const { account } = useAccount()
	return account?.supporter.benefits?.includes(key) ?? false
}
