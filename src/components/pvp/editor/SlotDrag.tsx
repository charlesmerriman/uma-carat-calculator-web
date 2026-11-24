/**
 * Dragging a card from one slot of a guide deck to another, the way My team
 * drags cards between slots (Henry, 2026-11-24). A drop swaps the two slots
 * whole, notes, limit break, "or" rows and borrow mark included; what a drop
 * does is utils/guideDocumentEdits `swapSlots`, and this file only reports
 * which slot landed where.
 *
 * WHY ITS OWN DndContext, ONE PER DECK. Each deck already sits inside the
 * deck list's SortableGroup context, whose onDragEnd turns ids into deck
 * indices. A slot draggable registered there would be read as a deck move
 * (`Number("slot-3")` is NaN). dnd-kit hooks bind to the NEAREST context, so
 * a context around each deck's six slots keeps the two drags apart, and the
 * deck grip keeps working. The cost is that a card can't cross into another
 * deck yet; that would need one shared context and the "Already in this
 * deck" check on both decks.
 *
 * The sensors match My team's (components/pvp/CardDrag.tsx): a few pixels of
 * mouse travel so a click is still a click, and press-and-hold on touch so a
 * swipe still scrolls. There is no keyboard sensor: the slot's Change and
 * Clear buttons are the keyboard's way to do the same edit.
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

export function SlotDragContext({ deckIndex, onMove, preview, children }: {
	deckIndex: number
	onMove: (from: number, to: number) => void
	/** What the moving copy looks like for a slot: its card, or its note. */
	preview: (slot: number) => ReactNode
	children: ReactNode
}) {
	const [held, setHeld] = useState<number | null>(null)
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
	)
	const onDragStart = ({ active }: DragStartEvent) => setHeld((active.data.current?.slot as number | undefined) ?? null)
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		setHeld(null)
		const from = active.data.current?.slot as number | undefined
		const to = over?.data.current?.slot as number | undefined
		if (from !== undefined && to !== undefined && from !== to) onMove(from, to)
	}
	return (
		<DndContext
			// Ids only need to be unique inside this context, but a deck index in
			// them keeps dnd-kit's screen-reader announcements distinct per deck.
			id={`deck-${deckIndex}-slots`}
			sensors={sensors}
			collisionDetection={pointerWithin}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onDragCancel={() => setHeld(null)}
		>
			{children}
			{/* The copy in hand. The overlay stays mounted and only its child
			    comes and goes, as dnd-kit asks (and as CardDrag.tsx does). */}
			<DragOverlay dropAnimation={null}>{held !== null && <div className="w-24 drop-shadow-2xl">{preview(held)}</div>}</DragOverlay>
		</DndContext>
	)
}

/** A slot's tile, picked up by dragging it. An empty slot has nothing to pick up. */
export function DraggableSlot({ deckIndex, slot, children }: { deckIndex: number; slot: number; children: ReactNode }) {
	const { listeners, setNodeRef, isDragging } = useDraggable({ id: `deck-${deckIndex}-slot-${slot}`, data: { slot } })
	return (
		<div ref={setNodeRef} {...listeners} title="Drag onto another slot to move it" className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}>
			{children}
		</div>
	)
}

/** A whole slot column a card can land on, ringed while one hovers over it. */
export function SlotDropZone({ deckIndex, slot, className = "", children }: {
	deckIndex: number
	slot: number
	className?: string
	children: ReactNode
}) {
	const { setNodeRef, isOver, active } = useDroppable({ id: `deck-${deckIndex}-drop-${slot}`, data: { slot } })
	// No ring on the slot the card came from: dropping there changes nothing.
	const ringed = isOver && active?.data.current?.slot !== slot
	return (
		<div ref={setNodeRef} className={`${className} ${ringed ? "rounded-lg ring-2 ring-brand" : ""}`}>
			{children}
		</div>
	)
}
