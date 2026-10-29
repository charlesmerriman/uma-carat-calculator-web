import type { Plan } from "../types"

/**
 * Whether the PLANS bar (PlanSwitcher) draws at all: a signed-in account
 * whose open plan is in the list. A guest has one unnamed plan (`activePlanId`
 * null), and an API from before plans, or a list not loaded yet, gets no bar
 * either.
 *
 * Its own module so a control that moves into the bar (the share picture's
 * button, CaratCalculator) can tell when there is no bar to move into, from
 * the same test the bar itself makes. Both can't read it from PlanSwitcher.tsx:
 * a component file exports only components (react-refresh).
 */
export function hasPlansBar(plans: Plan[], activePlanId: number | null): boolean {
	return activePlanId !== null && plans.some((plan) => plan.id === activePlanId)
}
