/**
 * Drag to reorder, on dnd-kit, for the editor's tiles, chips and decks.
 *
 * WHY DND-KIT. Framer Motion's Reorder (already installed) orders along one
 * axis; the uma tiles wrap into a grid and the chips too. dnd-kit handles a
 * grid, a list, keyboard dragging (Space, arrows, Space) and screen-reader
 * announcements, and loads only with the editor's chunk.
 *
 * Items are named by their index in the document's section (as a string),
 * in the order the group shows them. A drop hands the caller the two
 * document indices and it moves the row (utils/guideDocumentEdits.moveRow).
 */

import type { ReactNode } from "react"
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

export function SortableGroup({ ids, layout = "grid", onMove, children }: {
	/** The group's items as document indices, in display order. */
	ids: number[]
	layout?: "grid" | "list"
	onMove: (from: number, to: number) => void
	children: ReactNode
}) {
	const sensors = useSensors(
		// A few pixels of travel before a drag starts, so a click on a tile's
		// button is still a click.
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	)
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return
		onMove(Number(active.id), Number(over.id))
	}
	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
			<SortableContext items={ids.map(String)} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
				{children}
			</SortableContext>
		</DndContext>
	)
}

/**
 * One draggable item. `handle` is where the drag starts (the grip button
 * it renders); the rest of the item stays clickable.
 */
export function SortableItem({ id, label, className = "", children }: {
	id: number
	/** What the grip is called for a screen reader: "Move Maruzensky". */
	label: string
	className?: string
	children: (handle: ReactNode) => ReactNode
}) {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: String(id) })
	const style = { transform: CSS.Transform.toString(transform), transition }
	const handle = (
		<button
			ref={setActivatorNodeRef}
			type="button"
			aria-label={label}
			title="Drag to reorder"
			className="flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-700 hover:text-gray-100 active:cursor-grabbing"
			{...attributes}
			{...listeners}
		>
			<GripVertical className="h-4 w-4" aria-hidden="true" />
		</button>
	)
	return (
		<div ref={setNodeRef} style={style} className={`${className} ${isDragging ? "z-20 opacity-80" : ""}`}>
			{children(handle)}
		</div>
	)
}
