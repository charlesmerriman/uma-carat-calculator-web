/**
 * A PvP team in the team window's compact layout: the three umas side by side
 * on top, then each uma's six cards in the builder's order (cards 1 to 5, a
 * divider, the borrowed card).
 *
 * The same props as TeamGrid (the PvP page's full layout), so TeamEditor can
 * draw either one with the same pickers and the same rules. It draws and
 * reports clicks; it owns no state.
 */

import type { ReactNode } from "react"
import { ChevronDown, Plus, Star, UserPlus, X } from "lucide-react"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import { MEMBER_STYLES, PVP_BORROW_SLOT, PVP_TEAM_SIZE, memberAt } from "../../utils/pvpTeams"
import { ReleaseFlag, type TeamGridProps } from "./TeamGrid"
import type { MemberStyle, PvpTeamMember } from "../../types/pvpTeam"

const POSITIONS = Array.from({ length: PVP_TEAM_SIZE }, (_, index) => index)
const OWNED_SLOTS = [1, 2, 3, 4, 5]
/** Five cards, a 2px divider, the borrowed card: the builder's row, minus the portrait. */
const CARD_COLUMNS = "repeat(5,minmax(0,1fr)) 2px minmax(0,1fr)"

export function CompactTeamGrid({
	members,
	umasById,
	cardsById,
	releaseFor,
	isRecommended,
	onPickUma,
	onPickCard,
	onStyleChange,
	onClearUma,
	onClearCard,
}: TeamGridProps) {
	const starred = (pool: "uma" | "support", id: number, member: PvpTeamMember) =>
		isRecommended?.(pool, id, member.style) ?? false

	return (
		<div className="flex flex-col gap-3" aria-label="Your team">
			<ul className="grid grid-cols-3 gap-2" aria-label="Umas">
				{POSITIONS.map((position) => {
					const member = memberAt(members, position)
					const uma = member ? umasById.get(member.uma) : undefined
					const name = uma?.name ?? `uma ${position + 1}`
					return (
						<li key={position} className="min-w-0">
							{member ? (
								<>
									<div className="group relative aspect-square overflow-hidden rounded-lg bg-gray-700 ring-1 ring-gray-600 transition hover:ring-2 hover:ring-brand/70">
										<button
											type="button"
											aria-label={`Change uma ${position + 1}: ${name}`}
											title={uma?.name}
											onClick={() => onPickUma(position)}
											className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
										>
											<Art src={uma?.portrait ?? uma?.image ?? null} />
										</button>
										<span className="pointer-events-none absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-black">
											{position + 1}
										</span>
										{starred("uma", member.uma, member) && <StarBadge />}
										<span className="absolute bottom-6 left-0">
											<ReleaseFlag status={releaseFor?.("uma", member.uma)} />
										</span>
										<ClearButton label={`Remove ${name}`} onClick={() => onClearUma(position)} />
										{/* The style, in the tile's bottom edge. A sibling of the
										    button: a select inside a button is invalid HTML. */}
										<label className="absolute inset-x-0 bottom-0">
											<span className="sr-only">Running style for {name}</span>
											<select
												value={member.style}
												onChange={(change) => onStyleChange(position, change.target.value as MemberStyle)}
												className="w-full cursor-pointer appearance-none bg-gray-950/85 py-0.5 pr-4 text-center text-[11px] font-semibold text-brand outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
											>
												{MEMBER_STYLES.map((style) => (
													<option key={style} value={style}>
														{STYLE_LABELS[style]}
													</option>
												))}
											</select>
											<ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" aria-hidden="true" />
										</label>
									</div>
									<p className="mt-1 truncate text-center text-xs font-medium text-gray-100" title={uma?.name}>
										{uma?.name ?? "Unknown uma"}
									</p>
								</>
							) : (
								<>
									<button
										type="button"
										aria-label={`Add uma ${position + 1}`}
										onClick={() => onPickUma(position)}
										className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-600 bg-gray-900/40 text-gray-500 transition hover:border-brand hover:bg-brand/5 hover:text-brand"
									>
										<UserPlus className="h-5 w-5" aria-hidden="true" />
										<span className="text-[11px] font-medium">Add uma</span>
									</button>
									<p className="mt-1 text-center text-xs text-gray-600">Spot {position + 1}</p>
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
					const name = uma?.name ?? `uma ${position + 1}`
					const cardCell = (slot: number) => {
						const entry = member.cards.find((card) => card.slot === slot)
						const card = entry ? cardsById.get(entry.support_card) : undefined
						const place = slot === PVP_BORROW_SLOT ? "the borrowed card" : `card ${slot}`
						if (!entry) {
							return (
								<button
									key={slot}
									type="button"
									aria-label={`Add ${place} for ${name}`}
									title={slot === PVP_BORROW_SLOT ? "Borrowed card" : `Card ${slot}`}
									onClick={() => onPickCard(position, slot)}
									className="flex aspect-[3/4] w-full items-center justify-center rounded-md border border-dashed border-gray-600 bg-gray-900/40 text-gray-500 transition hover:border-brand hover:bg-brand/5 hover:text-brand"
								>
									<Plus className="h-3.5 w-3.5" aria-hidden="true" />
								</button>
							)
						}
						return (
							<div key={slot} className="group relative aspect-[3/4] overflow-hidden rounded-md bg-gray-700 ring-1 ring-gray-600 transition hover:ring-2 hover:ring-brand/70">
								<button
									type="button"
									aria-label={`Change ${place} for ${name}: ${card?.name ?? "unknown"}`}
									title={card?.name}
									onClick={() => onPickCard(position, slot)}
									className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
								>
									<Art src={card?.image ?? null} />
								</button>
								{starred("support", entry.support_card, member) && <StarBadge small />}
								<ReleaseFlag status={releaseFor?.("support", entry.support_card)} />
								<ClearButton label={`Remove ${card?.name ?? "this card"}`} onClick={() => onClearCard(position, slot)} small />
							</div>
						)
					}
					return (
						<section key={position} aria-label={`${name}'s cards`}>
							<h3 className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-300">
								<span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[10px] font-bold text-gray-300">
									{position + 1}
								</span>
								<span className="truncate">{name}</span>
							</h3>
							<div className="grid items-start gap-1" style={{ gridTemplateColumns: CARD_COLUMNS }}>
								{OWNED_SLOTS.map(cardCell)}
								<span className="self-stretch rounded-full bg-gray-600" aria-hidden="true" />
								{cardCell(PVP_BORROW_SLOT)}
							</div>
						</section>
					)
				})}
			</div>
		</div>
	)
}

function Art({ src }: { src: string | null }): ReactNode {
	return src ? (
		<img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
	) : (
		<span className="block h-full w-full bg-gray-700" aria-hidden="true" />
	)
}

/** The guide's star on a pick it recommends for this uma's style. */
function StarBadge({ small = false }: { small?: boolean }) {
	return (
		<span
			className={`pointer-events-none absolute flex items-center justify-center rounded-full bg-gray-950/85 ${small ? "left-0.5 top-0.5 h-4 w-4" : "right-1 top-7 h-5 w-5"}`}
			title="Recommended by the guide"
		>
			<Star className={`fill-highlight text-highlight ${small ? "h-2.5 w-2.5" : "h-3 w-3"}`} aria-label="Recommended by the guide" />
		</span>
	)
}

/** The x in a filled place's corner, on hover and keyboard focus; the picker's Remove does the same on touch. */
function ClearButton({ label, onClick, small = false }: { label: string; onClick: () => void; small?: boolean }) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className={`absolute right-0.5 top-0.5 flex items-center justify-center rounded-full border border-gray-500 bg-gray-900/90 text-gray-300 opacity-0 transition hover:text-gray-100 focus-visible:opacity-100 group-hover:opacity-100 ${small ? "h-4 w-4" : "h-5 w-5"}`}
		>
			<X className={small ? "h-2.5 w-2.5" : "h-3 w-3"} />
		</button>
	)
}
