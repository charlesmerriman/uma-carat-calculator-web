/**
 * The projection's per-banner result shape, and its zeroed instance.
 *
 * Lives in its own module rather than beside the hook that produces it because
 * both the producer (useBannerResources) and every consumer (BannerRow,
 * CaratCalculator, the tests) need it. Co-locating it with the hook made the
 * hook's module the import target for components that never call it, which is
 * what left a deleted legacy engine still being imported for its types.
 *
 * TYPESCRIPT CONCEPT: Custom Hooks Return Types
 * We define BannerResources as a named interface rather than using an inline
 * object type. This makes the hook's contract clear and reusable — any
 * component that receives these results gets autocomplete.
 */

import type { MaxPullBreakdown, ReservedFunding } from "../utils/bannerHelpers"
import type { SelectorTicketBucket } from "../utils/selectorTickets"

export interface BannerResources {
	/** Combined free + paid carats available before this banner's spend. */
	carats: number
	/** The free (earned) half of `carats`. Drives the "Carats (Est.)" box. */
	freeCarats: number
	/** The paid (purchased) half of `carats`. Drives the "Paid (Est.)" box. */
	paidCarats: number
	/**
	 * Max pulls this banner could support if all available resources were spent
	 * on it (accounts for the paid-carat pull strategy). Drives "Max Pulls".
	 */
	maxPossiblePulls: number
	/** Which resources those max pulls come from. Drives "Free/Tickets/Paid". */
	maxPullBreakdown: MaxPullBreakdown
	umaTickets: number
	supportTickets: number
	/**
	 * Selector tickets, bucketed by JP cutoff rather than summed — two tickets
	 * with different cutoffs are different resources. Use totalSelectorTickets
	 * for a display number. See utils/selectorTickets.
	 */
	umaSelectorTickets: SelectorTicketBucket[]
	supportSelectorTickets: SelectorTicketBucket[]
	/** SSR crystals available before this banner's reserved copies are paid for. */
	ssrCrystals: number
	/** Leftover SSR shards; SHARDS_PER_CRYSTAL of them make another crystal. */
	ssrShards: number
	/** Cumulative planned real-money spend as of this banner, in USD. */
	usdSpent: number
	/** Which resources paid for this banner's reserved copies. */
	reservedFunding: ReservedFunding
	/**
	 * Purchased selectors of THIS ROW'S kind (uma or support) that have no card
	 * picked on the Selectors page yet. Such a ticket pays for nothing, so it is
	 * never in the pools above — this count exists only so the row can explain
	 * an unfunded reserved copy. Always 0 on a step-up row, which reserves none.
	 */
	unpickedSelectorTickets: number

	// ── Step-up rows only ──
	// Present only when the row targets a BannerStepUp. Optional rather than
	// zeroed so a consumer can tell "not a step-up" from "a step-up you cannot
	// afford a single step of", which are different things to display.
	/** Steps affordable here, capped by how many the campaign actually runs. */
	maxPossibleSteps?: number
	/** Steps actually charged for — planned, clamped to what exists. */
	chargeableSteps?: number
	/** `chargeableSteps` in the sheet's spelling: "3", "5x1-2", "5x2". */
	stepLabel?: string
}

/**
 * The zeroed snapshot used wherever a banner has no projection yet — the
 * pre-filled result slots in the hook, and the consumer's fallback for an index
 * with no entry. Exported so those two can't drift apart when a field is added.
 * Frozen because it's shared by reference across every such slot.
 */
export const EMPTY_BANNER_RESOURCES: BannerResources = Object.freeze({
	carats: 0,
	freeCarats: 0,
	paidCarats: 0,
	maxPossiblePulls: 0,
	maxPullBreakdown: Object.freeze({
		freePulls: 0,
		tickets: 0,
		paidPulls: 0,
		freeCaratPulls: 0,
	}),
	umaTickets: 0,
	supportTickets: 0,
	// Plain empty arrays rather than frozen ones: every bucket operation returns
	// a new array (see utils/selectorTickets), so these are never mutated, and
	// freezing them would force a readonly type through the whole consumer chain.
	umaSelectorTickets: [] as SelectorTicketBucket[],
	supportSelectorTickets: [] as SelectorTicketBucket[],
	ssrCrystals: 0,
	ssrShards: 0,
	usdSpent: 0,
	reservedFunding: Object.freeze({ selectors: 0, crystals: 0, unfunded: 0 }),
	unpickedSelectorTickets: 0,
})
