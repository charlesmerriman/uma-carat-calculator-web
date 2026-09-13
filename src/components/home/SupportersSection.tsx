import { useEffect, useState } from "react"
import { ArrowUpRight, Heart } from "lucide-react"
import { supportersFetch } from "../../services/supportersFetchCalls"
import type { PatreonSupporter, SupportersResponse } from "../../types"
import { HOME_CARD } from "./homeStyles"
import { PATREON_URL } from "../../constants/links"

/**
 * Chip emphasis by tier, strongest first. Indexed by a tier's POSITION in the
 * ordered tier list rather than by its name or its id, so the client can
 * rename, add or reorder tiers in the admin without touching this file — the
 * top tier is always whatever they put first.
 *
 * Tiers past the end of this array fall back to BASE_TIER_STYLE. That is the
 * common case, not an edge case: most supporters sit on the entry tier, and
 * that tier is the one the dense chip field is designed around — a wall of
 * quiet chips reads as a crowd, which is the impression the block wants.
 *
 * Accents go through `brand` with a slash opacity rather than a stock palette
 * class. The seven themes override only --color-brand and the gray ramp, so a
 * literal `border-amber-400` would survive one theme and fail the other six.
 * A brand-FILLED chip is deliberately avoided too: black-on-brand drops to
 * ~3.5:1 against the light theme's bronze, which is fine on a large button and
 * not fine on 13px of name.
 */
const TIER_STYLES = [
	"border-brand/55 bg-brand/10 text-brand",
	"border-brand/25 bg-gray-700 text-gray-100",
]
const BASE_TIER_STYLE = "border-gray-600 bg-gray-700 text-gray-200"

/**
 * Shape shared by every chip; only the colours above vary by tier. The weight
 * lives here rather than in TIER_STYLES so every name is bold regardless of
 * tier — two Tailwind font-weight classes on one element resolve by stylesheet
 * order, not by their order in the class string, so a per-tier weight here
 * would override this one unpredictably.
 */
const CHIP_BASE =
	"inline-block rounded-full border px-2.5 py-1 text-sm leading-tight font-bold"

/**
 * One rendered block: a tier's label and the supporters on it.
 *
 * `rank` is the tier's position in the admin's chosen order — the index
 * TIER_STYLES is keyed by — and is null for supporters with no tier at all.
 */
type SupporterGroup = {
	key: string
	label: string | null
	rank: number | null
	members: PatreonSupporter[]
}

/**
 * Group supporters by tier, strongest tier first, untiered last.
 *
 * The ordering is derived here rather than trusted from the response. The
 * backend orders by `tier__order`, but where a NULL tier lands in that sort is
 * database-dependent — last on PostgreSQL, first on SQLite — so an untiered
 * supporter would head the list in dev and tail it in prod. Deriving it makes
 * both agree.
 *
 * Within a tier the API's order is kept as-is: it is longest-standing first
 * (`patron_since`, nulls last), which is a deliberate editorial choice on the
 * model and not ours to re-sort.
 */
function groupByTier(supporters: PatreonSupporter[]): SupporterGroup[] {
	const orders = Array.from(
		new Set(supporters.map((s) => s.tier_order).filter((o): o is number => o !== null)),
	).sort((a, b) => a - b)

	const groups: SupporterGroup[] = orders.map((order, rank) => {
		const members = supporters.filter((s) => s.tier_order === order)
		// Every member of a group shares one tier, so any of them carries its
		// name. `tier_name` and `tier_order` are set and cleared together by the
		// serializer, so a non-null order always has a name alongside it.
		return { key: String(order), label: members[0].tier_name, rank, members }
	})

	const untiered = supporters.filter((s) => s.tier_order === null)
	if (untiered.length > 0) {
		groups.push({ key: "untiered", label: null, rank: null, members: untiered })
	}

	return groups
}

/**
 * Public thank-you list for Patreon supporters.
 *
 * Renders nothing at all when there is nobody to thank or the fetch fails.
 * A thank-you list is not worth an error state or a skeleton — a visitor who
 * never sees it has lost nothing, whereas "Couldn't load supporters" on the
 * home page is pure noise.
 *
 * Names come from the API rather than the bundle so the client can update the
 * list from the admin panel when the monthly Patreon export changes, with no
 * frontend deploy. See backend/calculatorapi/admin_patreon_import.py.
 */
export const SupportersSection = () => {
	const [data, setData] = useState<SupportersResponse | null>(null)

	useEffect(() => {
		const controller = new AbortController()
		supportersFetch(controller.signal)
			.then((res) => (res.ok ? res.json() : null))
			.then((body: SupportersResponse | null) => {
				if (body) setData(body)
			})
			.catch(() => undefined)
		return () => controller.abort()
	}, [])

	const supporters = data?.supporters ?? []
	const anonymousCount = data?.anonymous_count ?? 0

	// Nothing to say yet — before the client has entered anyone, or if the
	// request failed. Hiding the whole section beats an empty heading.
	if (supporters.length === 0 && anonymousCount === 0) return null

	const groups = groupByTier(supporters)

	const chipStyle = (rank: number | null) =>
		rank === null ? BASE_TIER_STYLE : TIER_STYLES[rank] ?? BASE_TIER_STYLE

	return (
		<section id="supporters" className="mt-10 scroll-mt-20 border-t border-gray-800 pt-8">
			<div className="flex flex-wrap items-baseline justify-between gap-3">
				<h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-gray-100">
					<Heart className="h-5 w-5 text-brand" aria-hidden="true" />
					Patreon supporters
				</h2>
				<a
					href={PATREON_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1 text-sm font-semibold text-brand transition hover:text-brand/75"
				>
					Support the project
					<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
				</a>
			</div>

			<p className="mt-2 max-w-3xl text-gray-400">
				This calculator is free to use. Thank you to everyone on Patreon helping to keep it running.
			</p>

			<div className={`${HOME_CARD} mt-5 p-4`}>
				{groups.map((group, index) => (
					<div
						key={group.key}
						className={index > 0 ? "mt-4 border-t border-dashed border-gray-700 pt-4" : ""}
					>
						{/* No label for the untiered group — there is no honest one to
						    write, and a heading like "Other" ranks people the admin
						    never ranked. It reads as a trailing run of chips instead. */}
						{group.label && (
							<div className="mb-2.5 flex items-center gap-2.5">
								<h3
									className={`text-xs font-bold tracking-wider uppercase ${
										group.rank === 0 ? "text-brand" : "text-gray-400"
									}`}
								>
									{group.label}
								</h3>
								<span aria-hidden="true" className="h-px flex-1 bg-gray-700" />
								{/* The list below already tells a screen reader how many
								    items it holds, so the visible count is decoration. */}
								<span aria-hidden="true" className="text-xs text-gray-500">
									{group.members.length}
								</span>
							</div>
						)}

						<ul className="flex flex-wrap gap-1.5">
							{group.members.map((supporter) => (
								<li key={supporter.id} className={`${CHIP_BASE} ${chipStyle(group.rank)}`}>
									{supporter.display_name}
								</li>
							))}
						</ul>
					</div>
				))}

				{anonymousCount > 0 && (
					<p
						className={`text-sm text-gray-500 ${
							supporters.length > 0 ? "mt-4 border-t border-gray-700 pt-3" : ""
						}`}
					>
						{supporters.length > 0 ? "… and " : "Thank you to "}
						{anonymousCount} anonymous {anonymousCount === 1 ? "supporter" : "supporters"}.
					</p>
				)}
			</div>
		</section>
	)
}
