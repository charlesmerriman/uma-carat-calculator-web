/**
 * One style's example decks, editable: each deck is the reader's six-slot
 * grid with the controls under every slot (pick or change the card, a note,
 * the borrow mark, an "or" alternative), a label and a note on top, and
 * duplicate / delete. Decks drag to reorder. A card comes from the team
 * builder's picker, which blocks a card already in the deck and notes a
 * release date beside the event.
 */

import { useState } from "react"
import { Copy, Plus, Trash2, X } from "lucide-react"
import { PvpCardPicker } from "../PvpCardPicker"
import { NoteOnlyTile, SupportTile } from "../PvpTiles"
import { useFieldErrors, useGuideEditor } from "./GuideEditorContext"
import { MentionField } from "./MentionField"
import { SortableGroup, SortableItem } from "./Sortable"
import { ADD_BUTTON, FIELD_ERROR, ICON_BUTTON, INPUT, SECTION_HEADING, SMALL_BUTTON, SUBTLE } from "./editorStyles"
import {
	addAlternative,
	addDeck,
	clearSlot,
	duplicateDeck,
	moveDeck,
	removeDeck,
	setBorrowSlot,
	setSlotCard,
	updateDeck,
	updateSlot,
} from "../../../utils/guideDocumentEdits"
import { DECK_SLOTS, MAX_LENGTH } from "../../../utils/guideDocument"
import { STYLE_LABELS } from "../../../utils/pvpGuide"
import { releaseBlockReason, releaseNote } from "../../../utils/cardRelease"
import type { GuideDeckRow, GuideSlotRow } from "../../../types/guideDocument"
import type { MemberStyle } from "../../../types/pvpTeam"

const EMPTY_SET = new Set<number>()
// The reader's gold box colour (PvpGuideView's DeckGrid): the recommended
// gold, a theme token, so it reads on light themes too.
const GOLD_BOX = "border-recommended"
const SLOT_NUMBERS = Array.from({ length: DECK_SLOTS }, (_, i) => i + 1)

/** Which slot row a picker is for: the main card, or a new or existing alternative. */
type Target = { deck: number; slot: number; order: number | "new" }

export function DeckSection({ style }: { style: MemberStyle }) {
	const { document, update } = useGuideEditor()
	const decks = document.decks.map((deck, i) => ({ deck, i })).filter(({ deck }) => deck.style === style)
	return (
		<section id={`editor-${style}-decks`} aria-label="Example decks" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h4 className={SECTION_HEADING}>Example decks</h4>
				<span className={SUBTLE}>Six slots; slot 6 is usually the borrow. Drag a deck's grip to reorder.</span>
			</div>
			<SortableGroup ids={decks.map(({ i }) => i)} layout="list" onMove={(from, to) => update((doc) => moveDeck(doc, from, to))}>
				<div className="flex flex-col gap-3" role="list" aria-label={`${STYLE_LABELS[style]} decks`}>
					{decks.map(({ deck, i }) => (
						<DeckEditor key={deck.id ?? `new-${i}`} deck={deck} index={i} />
					))}
				</div>
			</SortableGroup>
			<button type="button" className={`${ADD_BUTTON} w-fit`} onClick={() => update((doc) => addDeck(doc, style))}>
				<Plus className="h-4 w-4" />
				Add a deck
			</button>
		</section>
	)
}

function DeckEditor({ deck, index: i }: { deck: GuideDeckRow; index: number }) {
	const { update, index, event, releaseFor } = useGuideEditor()
	const [target, setTarget] = useState<Target | null>(null)
	const deckErrors = useFieldErrors(`decks[${i}]`)
	const labelErrors = useFieldErrors(`decks[${i}].label`)
	const noteErrors = useFieldErrors(`decks[${i}].note`)
	const inDeck = new Set(deck.slots.map((row) => row.support_card).filter((card): card is number => card !== null))
	const borrowSlot = deck.slots.find((row) => row.is_borrow)?.slot ?? null

	const targetRow = target
		? deck.slots.find((row) => row.slot === target.slot && row.order === target.order) ?? null
		: null

	return (
		// The gold box shows here as it will on the guide, so an editor sees
		// which decks carry it.
		<SortableItem
			id={i}
			label={`Move deck ${deck.label || i + 1}`}
			className={`rounded-xl border bg-gray-900/30 p-3 ${deck.is_highlighted ? GOLD_BOX : "border-gray-700"}`}
		>
			{(handle) => (
				<>
					<div className="flex flex-wrap items-start gap-2">
						{handle}
						<div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start">
							<div className="flex flex-col sm:w-44">
								<label className="sr-only" htmlFor={`deck-${i}-label`}>
									Deck label
								</label>
								<input
									id={`deck-${i}-label`}
									type="text"
									value={deck.label}
									maxLength={MAX_LENGTH.deck_label}
									placeholder="Label: Standard, Whale…"
									aria-invalid={labelErrors.length > 0 || undefined}
									onChange={(change) => update((doc) => updateDeck(doc, i, { label: change.target.value }))}
									className={`${INPUT} w-full font-semibold`}
								/>
								{labelErrors.map((message) => (
									<p key={message} className={FIELD_ERROR} role="alert">
										{message}
									</p>
								))}
							</div>
							<MentionField
								label="Deck note"
								value={deck.note}
								maxLength={MAX_LENGTH.deck_note}
								placeholder="A note beside the label, like Stats + FCM"
								errors={noteErrors}
								onChange={(note) => update((doc) => updateDeck(doc, i, { note }))}
								className="min-w-0 flex-1"
							>
								<span />
							</MentionField>
						</div>
						<div className="flex items-center gap-1">
							<button
								type="button"
								className={`${SMALL_BUTTON} whitespace-nowrap ${deck.is_highlighted ? "text-brand" : ""}`}
								aria-pressed={Boolean(deck.is_highlighted)}
								title="Draw this deck in a gold box, to set it apart from the others"
								onClick={() => update((doc) => updateDeck(doc, i, { is_highlighted: !deck.is_highlighted }))}
							>
								Gold box
							</button>
							<button type="button" className={ICON_BUTTON} aria-label="Duplicate deck" title="Duplicate" onClick={() => update((doc) => duplicateDeck(doc, i))}>
								<Copy className="h-4 w-4" />
							</button>
							<button type="button" className={ICON_BUTTON} aria-label="Delete deck" title="Delete" onClick={() => update((doc) => removeDeck(doc, i))}>
								<Trash2 className="h-4 w-4" />
							</button>
						</div>
					</div>

					{/* Row gap and top margin leave room for the borrow tab above its card. */}
					<div className="mt-4 grid max-w-3xl grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6">
						{SLOT_NUMBERS.map((slot) => (
							<SlotEditor
								key={slot}
								deckIndex={i}
								slot={slot}
								rows={deck.slots.filter((row) => row.slot === slot).sort((a, b) => a.order - b.order)}
								isBorrow={borrowSlot === slot}
								onPick={(order) => setTarget({ deck: i, slot, order })}
							/>
						))}
					</div>
					{deckErrors.map((message) => (
						<p key={message} className={`${FIELD_ERROR} mt-2`} role="alert">
							{message}
						</p>
					))}

					{target && (
						<PvpCardPicker
							pool="support"
							items={index.catalogue.support_cards}
							title={target.order === 0 ? `Card ${target.slot} of ${deck.label || "this deck"}` : `An alternative for slot ${target.slot}`}
							skillsById={index.skillsById}
							event={event}
							style={deck.style === "everyone" ? null : deck.style}
							recommended={EMPTY_SET}
							blockReason={(id) =>
								releaseBlockReason(releaseFor("support", id)) ?? (inDeck.has(id) && id !== targetRow?.support_card ? "Already in this deck" : null)
							}
							noteFor={(id) => releaseNote(releaseFor("support", id))}
							selectedId={targetRow?.support_card ?? null}
							onPick={(id) => {
								update((doc) => {
									if (target.order === "new") return addAlternative(doc, target.deck, target.slot, id)
									if (target.order === 0) return setSlotCard(doc, target.deck, target.slot, id)
									return updateSlot(doc, target.deck, target.slot, target.order, { support_card: id })
								})
								setTarget(null)
							}}
							onRemove={
								targetRow?.support_card !== null && targetRow !== null && target.order !== "new"
									? () => {
											update((doc) => clearSlot(doc, target.deck, target.slot, target.order === "new" ? 0 : target.order))
											setTarget(null)
										}
									: undefined
							}
							onClose={() => setTarget(null)}
						/>
					)}
				</>
			)}
		</SortableItem>
	)
}

function SlotEditor({ deckIndex, slot, rows, isBorrow, onPick }: {
	deckIndex: number
	slot: number
	rows: GuideSlotRow[]
	isBorrow: boolean
	onPick: (order: number | "new") => void
}) {
	const { document, update, index } = useGuideEditor()
	const main = rows.find((row) => row.order === 0)
	const alternatives = rows.filter((row) => row.order > 0)
	const mainErrors = useFieldErrorsFor(deckIndex, main ? document.decks[deckIndex].slots.indexOf(main) : -1)
	const card = main?.support_card === null || main?.support_card === undefined ? null : index.cardsById.get(main.support_card)
	const [noting, setNoting] = useState(false)

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<div className="relative">
				{main ? (
					card ? (
						<SupportTile card={{ id: card.id, name: card.name, image: card.image, card_type: card.card_type, rarity: card.rarity }} note="" borrow={isBorrow} />
					) : main.support_card !== null ? (
						<NoteOnlyTile note={`Card ${main.support_card}`} borrow={isBorrow} />
					) : (
						<NoteOnlyTile note={main.note || "Note only"} borrow={isBorrow} />
					)
				) : (
					<button
						type="button"
						onClick={() => onPick(0)}
						className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-600 text-xs text-gray-400 transition hover:border-brand hover:text-brand"
					>
						<Plus className="h-4 w-4" />
						Slot {slot}
					</button>
				)}
			</div>
			<div className="flex flex-wrap items-center justify-center gap-0.5 [&>button]:whitespace-nowrap">
				<button type="button" className={SMALL_BUTTON} onClick={() => onPick(0)} title={main?.support_card ? "Change the card" : "Pick a card"}>
					{main?.support_card ? "Change" : "Card"}
				</button>
				<button type="button" className={`${SMALL_BUTTON} ${noting || main?.note ? "text-brand" : ""}`} aria-pressed={noting} onClick={() => setNoting(!noting)}>
					Note
				</button>
				<button
					type="button"
					className={`${SMALL_BUTTON} ${isBorrow ? "text-brand" : ""}`}
					aria-pressed={isBorrow}
					title="The borrowed card"
					onClick={() => update((doc) => setBorrowSlot(doc, deckIndex, isBorrow ? null : slot))}
				>
					Borrow
				</button>
				{main && (
					<button type="button" className={ICON_BUTTON} aria-label={`Clear slot ${slot}`} title="Clear" onClick={() => update((doc) => clearSlot(doc, deckIndex, slot))}>
						<X className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			{(noting || (main && main.support_card === null)) && (
				<MentionField
					label={`Slot ${slot} note`}
					value={main?.note ?? ""}
					maxLength={MAX_LENGTH.slot_note}
					placeholder={main?.support_card ? "2SP, Gold + Link…" : "or any speed"}
					onChange={(note) =>
						update((doc) => {
							// A note on an empty slot makes a note-only row ("or any speed").
							const withRow = main ? doc : setSlotCard(doc, deckIndex, slot, null)
							return updateSlot(withRow, deckIndex, slot, 0, { note })
						})
					}
				>
					<span />
				</MentionField>
			)}
			{mainErrors.map((message) => (
				<p key={message} className={FIELD_ERROR} role="alert">
					{message}
				</p>
			))}
			{alternatives.map((row) => {
				const altCard = row.support_card === null ? null : index.cardsById.get(row.support_card)
				return (
					<div key={row.order} className="flex items-center gap-1 text-[11px] leading-tight text-gray-400">
						<span className="shrink-0">or</span>
						{row.support_card !== null ? (
							<button type="button" className="min-w-0 truncate text-left text-gray-200 underline-offset-2 hover:underline" onClick={() => onPick(row.order)}>
								{altCard?.name ?? `Card ${row.support_card}`}
							</button>
						) : (
							<input
								type="text"
								aria-label={`Alternative note for slot ${slot}`}
								value={row.note}
								maxLength={MAX_LENGTH.slot_note}
								placeholder="any speed"
								onChange={(change) => update((doc) => updateSlot(doc, deckIndex, slot, row.order, { note: change.target.value }))}
								className={`${INPUT} min-w-0 flex-1 px-1 py-0.5 text-[11px]`}
							/>
						)}
						<button type="button" className={ICON_BUTTON} aria-label={`Remove alternative for slot ${slot}`} onClick={() => update((doc) => clearSlot(doc, deckIndex, slot, row.order))}>
							<X className="h-3 w-3" />
						</button>
					</div>
				)
			})}
			{main && (
				<div className="flex flex-wrap items-center justify-center gap-0.5">
					<button type="button" className={`${SMALL_BUTTON} whitespace-nowrap`} onClick={() => onPick("new")} title="An alternative card for this slot">
						+ or card
					</button>
					<button type="button" className={`${SMALL_BUTTON} whitespace-nowrap`} onClick={() => update((doc) => addAlternative(doc, deckIndex, slot, null, "any"))} title="An alternative note for this slot">
						+ or note
					</button>
				</div>
			)}
		</div>
	)
}

/** The messages on one slot row: the row itself, its card, its note. */
function useFieldErrorsFor(deckIndex: number, rowIndex: number): string[] {
	const { errors } = useGuideEditor()
	if (rowIndex < 0) return []
	const base = `decks[${deckIndex}].slots[${rowIndex}]`
	return errors.filter((error) => error.path === base || error.path === `${base}.support_card` || error.path === `${base}.note`).map((error) => error.message)
}
