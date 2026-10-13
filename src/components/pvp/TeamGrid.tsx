/**
 * A PvP team drawn as the sheet draws it: three rows, each an uma and her six
 * support cards, slot six being the borrowed card.
 *
 * EVERY CELL IS SQUARE, and the row is seven equal columns, so the grid
 * scales as one picture: the same component fills the PvP page's My team
 * view and (R2b) the 26rem team drawer. Nothing in here measures the screen.
 *
 * It draws and reports clicks; it owns no state. The caller opens the picker
 * and applies the edit (components/pvp/TeamBuilder.tsx).
 */

import { Plus, X } from "lucide-react"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import { MEMBER_STYLES, PVP_BORROW_SLOT, PVP_DECK_SIZE, PVP_TEAM_SIZE, memberAt } from "../../utils/pvpTeams"
import type { CatalogueSupportCard, CatalogueUma, MemberStyle, PvpTeamMember } from "../../types/pvpTeam"

interface TeamGridProps {
	members: PvpTeamMember[]
	umasById: Map<number, CatalogueUma>
	cardsById: Map<number, CatalogueSupportCard>
	onPickUma: (position: number) => void
	onPickCard: (position: number, slot: number) => void
	onStyleChange: (position: number, style: MemberStyle) => void
	onClearUma: (position: number) => void
	onClearCard: (position: number, slot: number) => void
}

const SLOTS = Array.from({ length: PVP_DECK_SIZE }, (_, index) => index + 1)
const POSITIONS = Array.from({ length: PVP_TEAM_SIZE }, (_, index) => index)

const CELL = "relative aspect-square min-w-0 overflow-hidden rounded-lg border"
const EMPTY_CELL = `${CELL} flex items-center justify-center border-dashed border-gray-600 bg-gray-800/60 text-gray-500 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-600 disabled:hover:text-gray-500`

export function TeamGrid({
	members,
	umasById,
	cardsById,
	onPickUma,
	onPickCard,
	onStyleChange,
	onClearUma,
	onClearCard,
}: TeamGridProps) {
	return (
		<div className="flex flex-col gap-2" role="table" aria-label="Your team">
			<div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500" role="row">
				<span role="columnheader">Uma</span>
				{SLOTS.map((slot) => (
					<span key={slot} role="columnheader">
						{slot === PVP_BORROW_SLOT ? "Borrow" : `Card ${slot}`}
					</span>
				))}
			</div>
			{POSITIONS.map((position) => {
				const member = memberAt(members, position)
				const uma = member ? umasById.get(member.uma) : undefined
				return (
					<div key={position} className="grid grid-cols-7 gap-1.5" role="row" aria-label={`Uma ${position + 1}`}>
						<div role="cell" className="min-w-0">
							{member ? (
								<div className={`${CELL} group border-gray-600 bg-gray-700`}>
									<button
										type="button"
										className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-brand"
										aria-label={`Change uma ${position + 1}: ${uma?.name ?? "unknown"}`}
										title={uma?.name}
										onClick={() => onPickUma(position)}
									>
										<CellArt src={uma?.portrait ?? uma?.image ?? null} />
									</button>
									<ClearButton label={`Remove ${uma?.name ?? "this uma"}`} onClick={() => onClearUma(position)} />
									{/* The sheet's style dropdown, in the tile's bottom edge. A
									    sibling of the button, never inside it: a select inside a
									    button is invalid and the click would open the picker. */}
									<select
										aria-label={`Running style for ${uma?.name ?? `uma ${position + 1}`}`}
										value={member.style}
										onChange={(change) => onStyleChange(position, change.target.value as MemberStyle)}
										className="absolute inset-x-0 bottom-0 w-full cursor-pointer appearance-none border-0 bg-gray-950/85 py-0.5 text-center text-[10px] font-semibold text-brand outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-xs"
									>
										{MEMBER_STYLES.map((style) => (
											<option key={style} value={style}>
												{STYLE_LABELS[style]}
											</option>
										))}
									</select>
								</div>
							) : (
								<button
									type="button"
									className={EMPTY_CELL}
									aria-label={`Add uma ${position + 1}`}
									onClick={() => onPickUma(position)}
								>
									<Plus className="h-5 w-5" />
								</button>
							)}
						</div>
						{SLOTS.map((slot) => {
							const entry = member?.cards.find((card) => card.slot === slot)
							const card = entry ? cardsById.get(entry.support_card) : undefined
							const borrow = slot === PVP_BORROW_SLOT
							const slotName = borrow ? "the borrowed card" : `card ${slot}`
							return (
								<div key={slot} role="cell" className="min-w-0">
									{entry ? (
										<div className={`${CELL} group border-gray-600 bg-gray-700`}>
											<button
												type="button"
												className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-brand"
												aria-label={`Change ${slotName} for ${uma?.name ?? `uma ${position + 1}`}: ${card?.name ?? "unknown"}`}
												title={card?.name}
												onClick={() => onPickCard(position, slot)}
											>
												<CellArt src={card?.image ?? null} />
											</button>
											<ClearButton label={`Remove ${card?.name ?? "this card"}`} onClick={() => onClearCard(position, slot)} />
											{borrow && <BorrowRibbon />}
										</div>
									) : (
										<button
											type="button"
											className={EMPTY_CELL}
											disabled={!member}
											title={member ? undefined : "Pick an uma first"}
											aria-label={`Add ${slotName} for ${uma?.name ?? `uma ${position + 1}`}`}
											onClick={() => onPickCard(position, slot)}
										>
											<Plus className="h-4 w-4" />
											{borrow && <BorrowRibbon />}
										</button>
									)}
								</div>
							)
						})}
					</div>
				)
			})}
		</div>
	)
}

function CellArt({ src }: { src: string | null }) {
	return src ? (
		<img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
	) : (
		<span className="block h-full w-full bg-gray-700" aria-hidden="true" />
	)
}

/** The small x in a filled cell's corner. Shown on hover and keyboard focus; on a touch screen the picker's Remove does the same. */
function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-gray-600 bg-gray-900/90 text-gray-300 opacity-0 transition hover:text-gray-100 focus-visible:opacity-100 group-hover:opacity-100"
		>
			<X className="h-3 w-3" />
		</button>
	)
}

function BorrowRibbon() {
	return (
		<span className="pointer-events-none absolute inset-x-0 bottom-0 bg-brand/90 py-px text-center text-[9px] font-bold uppercase tracking-wide text-black">
			Borrow
		</span>
	)
}
