/**
 * A PvP team, read-only, laid out for the team drawer: the three umas side
 * by side on top, then each uma's six cards in the builder's order (cards 1
 * to 5, a divider, the borrowed card).
 *
 * Nothing here edits. Teams are edited on the PvP page's My team view; the
 * drawer is for keeping the team in sight while planning elsewhere.
 */

import { PVP_BORROW_SLOT, PVP_TEAM_SIZE, memberAt } from "../../utils/pvpTeams"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import type { CatalogueSupportCard, CatalogueUma, PvpTeamMember } from "../../types/pvpTeam"

const POSITIONS = Array.from({ length: PVP_TEAM_SIZE }, (_, index) => index)
const OWNED_SLOTS = [1, 2, 3, 4, 5]
/** Five cards, a 2px divider, the borrowed card: the builder's row, minus the portrait. */
const CARD_COLUMNS = "repeat(5,minmax(0,1fr)) 2px minmax(0,1fr)"

export function TeamSnapshot({ members, umasById, cardsById }: {
	members: PvpTeamMember[]
	umasById: Map<number, CatalogueUma>
	cardsById: Map<number, CatalogueSupportCard>
}) {
	return (
		<div className="flex flex-col gap-3" aria-label="Your team">
			<ul className="grid grid-cols-3 gap-2" aria-label="Umas">
				{POSITIONS.map((position) => {
					const member = memberAt(members, position)
					const uma = member ? umasById.get(member.uma) : undefined
					return (
						<li key={position} className="min-w-0">
							{member ? (
								<>
									<div className="relative aspect-square overflow-hidden rounded-lg bg-gray-700 ring-1 ring-gray-600">
										<Art src={uma?.portrait ?? uma?.image ?? null} alt={uma?.name ?? ""} />
										<span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-black">
											{position + 1}
										</span>
										<span className="absolute inset-x-0 bottom-0 bg-gray-950/85 py-0.5 text-center text-[11px] font-semibold text-brand">
											{STYLE_LABELS[member.style]}
										</span>
									</div>
									<p className="mt-1 truncate text-center text-xs font-medium text-gray-100" title={uma?.name}>
										{uma?.name ?? "Unknown uma"}
									</p>
								</>
							) : (
								<>
									<div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900/40 text-xs text-gray-600">
										{position + 1}
									</div>
									<p className="mt-1 text-center text-xs text-gray-600">Empty</p>
								</>
							)}
						</li>
					)
				})}
			</ul>

			<div className="flex flex-col gap-2.5">
				{POSITIONS.map((position) => {
					const member = memberAt(members, position)
					if (!member) return null
					const uma = umasById.get(member.uma)
					return (
						<section key={position} aria-label={`${uma?.name ?? `Uma ${position + 1}`}'s cards`}>
							<h3 className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-300">
								<span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[10px] font-bold text-gray-300">
									{position + 1}
								</span>
								<span className="truncate">{uma?.name ?? "Unknown uma"}</span>
							</h3>
							<div className="grid items-start gap-1" style={{ gridTemplateColumns: CARD_COLUMNS }}>
								{OWNED_SLOTS.map((slot) => (
									<CardCell key={slot} member={member} slot={slot} cardsById={cardsById} />
								))}
								<span className="self-stretch rounded-full bg-gray-600" aria-hidden="true" />
								<CardCell member={member} slot={PVP_BORROW_SLOT} cardsById={cardsById} />
							</div>
						</section>
					)
				})}
			</div>
		</div>
	)
}

function CardCell({ member, slot, cardsById }: {
	member: PvpTeamMember
	slot: number
	cardsById: Map<number, CatalogueSupportCard>
}) {
	const entry = member.cards.find((card) => card.slot === slot)
	const card = entry ? cardsById.get(entry.support_card) : undefined
	const label = slot === PVP_BORROW_SLOT ? "Borrowed card" : `Card ${slot}`
	if (!entry) {
		return (
			<div
				className="aspect-[3/4] rounded-md border border-dashed border-gray-700 bg-gray-900/40"
				title={`${label}: empty`}
				aria-label={`${label}: empty`}
			/>
		)
	}
	return (
		<div className="aspect-[3/4] overflow-hidden rounded-md bg-gray-700 ring-1 ring-gray-600" title={`${label}: ${card?.name ?? "unknown"}`}>
			<Art src={card?.image ?? null} alt={`${label}: ${card?.name ?? "unknown"}`} />
		</div>
	)
}

function Art({ src, alt }: { src: string | null; alt: string }) {
	return src ? (
		<img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
	) : (
		<span className="block h-full w-full bg-gray-700" role="img" aria-label={alt} />
	)
}
