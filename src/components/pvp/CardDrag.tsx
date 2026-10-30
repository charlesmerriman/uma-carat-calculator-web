/**
 * Dragging support cards on My team: from the docked Guide picks panel into a
 * slot, or from one slot to another. The picker stays the keyboard's way in,
 * so this has no keyboard sensor. What a drop does is utils/pvpTeams.ts
 * `dropCard`; this file only reports where a card landed.
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
import type { CatalogueSupportCard } from "../../types/pvpTeam"
import type { CardDrag, CardDropTarget } from "../../utils/pvpTeams"

export function CardDragProvider({ cardsById, onDrop, children }: {
	cardsById: Map<number, CatalogueSupportCard>
	onDrop: (drag: CardDrag, target: CardDropTarget) => void
	children: ReactNode
}) {
	const [active, setActive] = useState<CardDrag | null>(null)
	const sensors = useSensors(
		// A few pixels of travel first, so a click on a tile is still a click.
		useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
		// A press and hold on touch: a plain swipe has to keep scrolling the page.
		useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
	)
	const onDragStart = ({ active: started }: DragStartEvent) => {
		setActive((started.data.current?.drag as CardDrag | undefined) ?? null)
	}
	const onDragEnd = ({ active: ended, over }: DragEndEvent) => {
		setActive(null)
		const drag = ended.data.current?.drag as CardDrag | undefined
		const target = over?.data.current?.target as CardDropTarget | undefined
		if (drag && target) onDrop(drag, target)
	}
	const image = active ? cardsById.get(active.cardId)?.image : null
	return (
		<DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
			{children}
			<DragOverlay dropAnimation={null}>
				{active && (
					<div className="aspect-[3/4] w-20 overflow-hidden rounded-lg bg-gray-700 shadow-2xl ring-2 ring-brand">
						{image && <img src={image} alt="" className="h-full w-full object-cover" />}
					</div>
				)}
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

/** One team slot a card can land on, ringed while a card hovers over it. */
export function CardDropSlot({ position, slot, className = "", children }: {
	position: number
	slot: number
	className?: string
	children: ReactNode
}) {
	const target: CardDropTarget = { position, slot }
	const { setNodeRef, isOver } = useDroppable({ id: `slot-${position}-${slot}`, data: { target } })
	return (
		<div ref={setNodeRef} className={`${className} ${isOver ? "rounded-lg ring-2 ring-brand" : ""}`}>
			{children}
		</div>
	)
}
