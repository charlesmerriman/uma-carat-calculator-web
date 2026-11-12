/**
 * Dragging on My team: a support card from the docked Guide picks panel into a
 * slot, or from one slot to another; and an uma from Guide picks onto a spot
 * (Daptrius, 2026-11-04). The picker stays the keyboard's way in, so this has
 * no keyboard sensor. What a drop does is utils/pvpTeams.ts `dropCard` /
 * `dropUma`; this file only reports where something landed.
 *
 * A card and an uma travel under different keys of dnd-kit's `data`
 * (`drag` / `umaDrag`) and land on targets with different keys (`target` /
 * `umaTarget`), so a card can't land on a spot or an uma in a slot, and each
 * target rings only for what it takes.
 *
 * The moving card is a DragOverlay, a copy drawn above the page: the tile
 * itself can't leave the panel's scroller, and moving it would fight the
 * grid's dealing animation.
 */

import { useState, type ReactNode } from "react"
import {
	DndContext,
	DragOverlay,
	MouseSensor,
	TouchSensor,
	pointerWithin,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core"
import { FramedCard } from "../FramedCard"
import { FramedUma } from "../FramedUma"
import type { CatalogueSupportCard, CatalogueUma } from "../../types/pvpTeam"
import type { CardDrag, CardDropTarget, UmaDrag, UmaDropTarget } from "../../utils/pvpTeams"

/** What is in hand: a card or an uma, never both. */
type InHand = { card: CardDrag } | { uma: UmaDrag }

export function CardDragProvider({ cardsById, umasById, onDrop, onDropUma, children }: {
	cardsById: Map<number, CatalogueSupportCard>
	umasById: Map<number, CatalogueUma>
	onDrop: (drag: CardDrag, target: CardDropTarget) => void
	onDropUma: (drag: UmaDrag, target: UmaDropTarget) => void
	children: ReactNode
}) {
	const [active, setActive] = useState<InHand | null>(null)
	const sensors = useSensors(
		// A few pixels of travel first, so a click on a tile is still a click.
		useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
		// A press and hold on touch: a plain swipe has to keep scrolling the page.
		useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
	)
	const onDragStart = ({ active: started }: DragStartEvent) => {
		const card = started.data.current?.drag as CardDrag | undefined
		const uma = started.data.current?.umaDrag as UmaDrag | undefined
		setActive(card ? { card } : uma ? { uma } : null)
	}
	const onDragEnd = ({ active: ended, over }: DragEndEvent) => {
		setActive(null)
		const drag = ended.data.current?.drag as CardDrag | undefined
		const target = over?.data.current?.target as CardDropTarget | undefined
		if (drag && target) onDrop(drag, target)
		const umaDrag = ended.data.current?.umaDrag as UmaDrag | undefined
		const umaTarget = over?.data.current?.umaTarget as UmaDropTarget | undefined
		if (umaDrag && umaTarget) onDropUma(umaDrag, umaTarget)
	}
	const card = active && "card" in active ? cardsById.get(active.card.cardId) : undefined
	const uma = active && "uma" in active ? umasById.get(active.uma.umaId) : undefined
	return (
		<DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
			{children}
			<DragOverlay dropAnimation={null}>
				{/* The card in hand is the card in the slot: the same FramedCard,
				    lifted with a shadow (drop-shadow follows the frame's corners). */}
				{active &&
					(card ? (
						<FramedCard card={card} className="w-20 drop-shadow-2xl" />
					) : uma ? (
						<FramedUma src={uma.portrait ?? uma.image} className="w-20 drop-shadow-2xl" />
					) : (
						<div className="aspect-[3/4] w-20 rounded-lg bg-gray-700 shadow-2xl ring-2 ring-brand" />
					))}
			</DragOverlay>
		</DndContext>
	)
}

/** What can be picked up. No `drag` (an empty slot): the child is left as it is. */
export function DraggableCard({ id, drag, className = "", children }: {
	id: string
	drag: CardDrag | null
	className?: string
	children: ReactNode
}) {
	const { listeners, setNodeRef, isDragging } = useDraggable({ id, data: { drag }, disabled: drag === null })
	return (
		<div ref={setNodeRef} {...listeners} className={`${className} ${isDragging ? "opacity-40" : ""}`}>
			{children}
		</div>
	)
}

/** An uma that can be picked up (Guide picks). No `drag`: the child is left as it is. */
export function DraggableUma({ id, drag, children }: { id: string; drag: UmaDrag | null; children: ReactNode }) {
	const { listeners, setNodeRef, isDragging } = useDraggable({ id, data: { umaDrag: drag }, disabled: drag === null })
	return (
		<div ref={setNodeRef} {...listeners} className={isDragging ? "opacity-40" : ""}>
			{children}
		</div>
	)
}

/** A team spot an uma can land on, ringed while an uma hovers over it (never a card). */
export function UmaDropSpot({ position, className = "", children }: { position: number; className?: string; children: ReactNode }) {
	const umaTarget: UmaDropTarget = { position }
	const { setNodeRef, isOver, active } = useDroppable({ id: `spot-${position}`, data: { umaTarget } })
	const ringed = isOver && Boolean(active?.data.current?.umaDrag)
	return (
		<div ref={setNodeRef} className={`${className} ${ringed ? "rounded-xl ring-2 ring-brand" : ""}`}>
			{children}
		</div>
	)
}

/** One team slot a card can land on, ringed while a card (never an uma) hovers over it. */
export function CardDropSlot({ position, slot, className = "", children }: {
	position: number
	slot: number
	className?: string
	children: ReactNode
}) {
	const target: CardDropTarget = { position, slot }
	const { setNodeRef, isOver, active } = useDroppable({ id: `slot-${position}-${slot}`, data: { target } })
	const ringed = isOver && Boolean(active?.data.current?.drag)
	return (
		<div ref={setNodeRef} className={`${className} ${ringed ? "rounded-lg ring-2 ring-brand" : ""}`}>
			{children}
		</div>
	)
}
