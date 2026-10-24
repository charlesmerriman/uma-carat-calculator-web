/**
 * "Use the Pace Standard deck on:" over My team's grid, after "Use this deck"
 * on a guide (owner, 2026-10-24, `guide-visuals-plan-2.md` release C). The
 * guide hands the deck over; this offers the selected team's three spots, a
 * new team, or Cancel.
 *
 *   a spot with cards   asks first: "Replace Oguri Cap's 6 cards with …?"
 *   a spot with no cards (but an uma)   takes the deck at once
 *   an empty spot       opens My team's uma picker; the deck goes on her
 *   New team            a new team, then its first spot as an empty spot
 *
 * Presentational: TeamBuilder holds the team, the rules and the picker, and
 * says what each spot holds.
 */

import { useState } from "react"
import { Layers, Plus, X } from "lucide-react"
import { countLabel } from "../../utils/plural"

export interface DeckSpot {
	position: number
	/** The uma in the spot, or null when it is empty. */
	umaName: string | null
	cardCount: number
}

export function UseDeckBanner({ deckName, spots, newTeamBlocked, onUse, onPickUma, onNewTeam, onCancel }: {
	/** "Pace Standard deck". */
	deckName: string
	spots: DeckSpot[]
	/** Why a new team can't be made (the cap), or null. */
	newTeamBlocked: string | null
	onUse: (position: number) => void
	onPickUma: (position: number) => void
	onNewTeam: () => void
	onCancel: () => void
}) {
	const [confirming, setConfirming] = useState<DeckSpot | null>(null)
	const choose = (spot: DeckSpot) => {
		if (!spot.umaName) onPickUma(spot.position)
		else if (spot.cardCount > 0) setConfirming(spot)
		else onUse(spot.position)
	}
	return (
		<section aria-label="Use a guide deck" className="rounded-xl border border-brand/40 bg-brand/5 p-3">
			<div className="flex items-start gap-2">
				<Layers className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
				<p className="min-w-0 flex-1 text-sm font-semibold text-gray-100">Use the {deckName} on:</p>
				<button
					type="button"
					onClick={onCancel}
					aria-label="Cancel"
					className="-m-1 rounded-md p-1 text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			{confirming ? (
				<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-200" role="group" aria-label="Confirm">
					<span>
						Replace {confirming.umaName}&rsquo;s {countLabel(confirming.cardCount, "card")} with the {deckName}?
					</span>
					<span className="flex gap-2">
						<button
							type="button"
							onClick={() => onUse(confirming.position)}
							className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-black transition hover:bg-brand/85"
						>
							Replace
						</button>
						<button
							type="button"
							onClick={() => setConfirming(null)}
							className="rounded-md border border-gray-600 px-3 py-1 text-xs font-semibold text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
						>
							Keep them
						</button>
					</span>
				</div>
			) : (
				<div className="mt-2 flex flex-wrap gap-2">
					{spots.map((spot) => (
						<button
							key={spot.position}
							type="button"
							onClick={() => choose(spot)}
							className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 transition hover:border-brand/60 hover:bg-gray-700"
						>
							{/* The space between the two spans, not inside the second:
							    an accessible name drops a span's leading space. */}
							<span className="font-semibold">Spot {spot.position + 1}</span>{" "}
							<span className="text-gray-400">· {spot.umaName ?? "empty, pick an uma"}</span>
						</button>
					))}
					<button
						type="button"
						onClick={onNewTeam}
						disabled={newTeamBlocked !== null}
						title={newTeamBlocked ?? undefined}
						className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-600 px-3 py-1.5 text-sm text-gray-300 transition enabled:hover:border-brand/60 enabled:hover:text-gray-100 disabled:opacity-50"
					>
						<Plus className="h-3.5 w-3.5" aria-hidden="true" />
						New team
					</button>
				</div>
			)}
			{newTeamBlocked && !confirming && <p className="mt-1.5 text-xs text-gray-400">{newTeamBlocked}</p>}
		</section>
	)
}
