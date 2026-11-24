/**
 * Community plans' view in the address: sort, Top's window and the four
 * filters as query parameters (`?sort=new&spending=f2p&strategy=front,pace`),
 * so a filtered list can be linked. Pure, so it has plain tests; the page
 * (components/community-plans/CommunityPlansPage.tsx) reads and writes it.
 *
 * An unknown value is no value, as on the server (views/plan_gallery.py), and
 * a default is left out of the address, so a plain visit has a plain address.
 */

import type { PlanFilters as Filters, PlanSort, PlanSpending, PlanStrategy, PlanSweat, PlanWindow } from "../types/gallery"

export interface PlanView {
	sort: PlanSort
	window: PlanWindow
	filters: Filters
}

/** The server's default window (plan_gallery.DEFAULT_WINDOW). */
const DEFAULT_WINDOW: PlanWindow = "week"
const STRATEGIES: readonly PlanStrategy[] = ["front", "pace", "late", "end"]
const SPENDING: readonly PlanSpending[] = ["f2p", "minnow", "dolphin", "orca", "whale"]
const SWEAT: readonly PlanSweat[] = ["casual", "semi_comp", "comp", "no_life"]

/** The view's parameters; `post` is not one (it is a place, not a view). */
export const VIEW_PARAMS = ["sort", "window", "range", "strategy", "spending", "sweat"] as const
export const REMEMBER_KEY = "community-plans-view"

const pick = <T extends string>(allowed: readonly T[], value: string | null): T | null =>
	allowed.includes(value as T) ? (value as T) : null

/** The view the address asks for. An unknown value is no value, as on the server. */
export function readView(params: URLSearchParams): PlanView {
	const range = Number(params.get("range"))
	return {
		sort: params.get("sort") === "new" ? "new" : "top",
		window: pick(["day", "week", "month", "all"], params.get("window")) ?? DEFAULT_WINDOW,
		filters: {
			range: Number.isInteger(range) && range > 0 ? range : null,
			strategies: STRATEGIES.filter((style) => (params.get("strategy") ?? "").split(",").includes(style)),
			spending: pick(SPENDING, params.get("spending")),
			sweat: pick(SWEAT, params.get("sweat")),
		},
	}
}

/** `params` with the view written into it; defaults are left out, so a plain visit has a plain address. */
export function writeView(params: URLSearchParams, view: PlanView): URLSearchParams {
	const next = new URLSearchParams(params)
	for (const key of VIEW_PARAMS) next.delete(key)
	if (view.sort === "new") next.set("sort", "new")
	else if (view.window !== DEFAULT_WINDOW) next.set("window", view.window)
	if (view.filters.range !== null) next.set("range", String(view.filters.range))
	if (view.filters.strategies.length) next.set("strategy", view.filters.strategies.join(","))
	if (view.filters.spending) next.set("spending", view.filters.spending)
	if (view.filters.sweat) next.set("sweat", view.filters.sweat)
	return next
}

/**
 * A spending level as its option reads: "Minnow - Daily Carat Pack only"
 * (Henry, board 2026-11-24: say what a level stands for before it is picked).
 * The post dialog and the filter both use it, so the two lists can't drift.
 * Both halves come from the API's `filters` block (plan_gallery.SPENDING_MEANINGS),
 * so rewording a level there needs no web release. A hyphen, never a dash:
 * copy.md.
 */
export function spendingOptionLabel(level: { label: string; meaning: string }): string {
	return level.meaning ? `${level.label} - ${level.meaning}` : level.label
}

/** How many of the four are set: the "Filters (2)" button's number. */
export function filtersSet(filters: Filters): number {
	return [filters.range !== null, filters.strategies.length > 0, filters.spending !== null, filters.sweat !== null].filter(Boolean)
		.length
}
