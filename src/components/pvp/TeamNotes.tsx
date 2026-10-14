/**
 * A team's sticky notes: up to ten coloured notes, each read-only until its
 * pen is pressed. Shown under the team on the PvP page's My team view and in
 * the team window, and written in either (both save through
 * PvpTeamsProvider, like every team edit).
 *
 *   Add note   a new yellow note, already open for writing. Off at ten.
 *   Pen        opens a note: a growing textarea, a colour row, and from 900
 *              characters a counter (the cap is 1000). Clicking away, Done or
 *              Escape closes it; a note closed blank is removed.
 *   Eraser     rubs a note out at once; the toast's Undo puts it back in its
 *              place. One click, as the button suggests, no "are you sure".
 *
 * A closed note is plain text with its line breaks kept, and `==words==`
 * shown red (splitHighlights), the same marking the guide uses.
 *
 * Limits mirror the server's (views/pvp_team.py NoteSerializer) and the guest
 * store's: ten notes, 1000 characters, four colours.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Check, Eraser, Pencil, StickyNote } from "lucide-react"
import { PVP_NOTE_CAP, PVP_NOTE_MAX_LENGTH } from "../../services/guestPvpTeamStore"
import { splitHighlights } from "../../utils/remarkHighlight"
import type { PvpNote, PvpNoteColor } from "../../types/pvpTeam"

const COLORS: PvpNoteColor[] = ["yellow", "pink", "blue", "green"]
const COLOR_LABELS: Record<PvpNoteColor, string> = { yellow: "Yellow", pink: "Pink", blue: "Blue", green: "Green" }
// Literal class strings so Tailwind sees each one. Tokens in index.css.
const PAPER: Record<PvpNoteColor, string> = {
	yellow: "bg-note-yellow border-note-yellow-edge",
	pink: "bg-note-pink border-note-pink-edge",
	blue: "bg-note-blue border-note-blue-edge",
	green: "bg-note-green border-note-green-edge",
}
/** The counter shows from here up to the cap. */
const COUNTER_FROM = 900

export function TeamNotes({ notes, onChange, disabledReason = null }: {
	notes: PvpNote[]
	onChange: (notes: PvpNote[]) => void
	/** Why notes can't be added yet (no team), or null. */
	disabledReason?: string | null
}) {
	const [openIndex, setOpenIndex] = useState<number | null>(null)
	// The latest notes and writer, for the Undo a toast runs seconds later.
	const latest = useRef({ notes, onChange })
	useEffect(() => {
		latest.current = { notes, onChange }
	}, [notes, onChange])

	const full = notes.length >= PVP_NOTE_CAP
	const add = () => {
		onChange([...notes, { text: "", color: "yellow" }])
		setOpenIndex(notes.length)
	}
	const update = (index: number, change: Partial<PvpNote>) =>
		onChange(notes.map((note, at) => (at === index ? { ...note, ...change } : note)))
	const close = (index: number) => {
		setOpenIndex(null)
		// Nobody should have to erase a note they never wrote in.
		if (notes[index] && notes[index].text.trim() === "") onChange(notes.filter((_, at) => at !== index))
	}
	const erase = (index: number) => {
		const removed = notes[index]
		setOpenIndex(null)
		onChange(notes.filter((_, at) => at !== index))
		if (!removed.text.trim()) return
		toast("Note erased", {
			action: {
				label: "Undo",
				onClick: () => {
					const { notes: now, onChange: write } = latest.current
					if (now.length >= PVP_NOTE_CAP) return
					write([...now.slice(0, index), removed, ...now.slice(index)])
				},
			},
		})
	}

	return (
		<section aria-label="Notes" className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
					Notes{notes.length > 0 && <span className="font-normal normal-case tracking-normal"> ({notes.length} of {PVP_NOTE_CAP})</span>}
				</h3>
				<button
					type="button"
					onClick={add}
					disabled={full || disabledReason !== null}
					title={disabledReason ?? (full ? `A team holds up to ${PVP_NOTE_CAP} notes. Erase one first.` : undefined)}
					className="flex items-center gap-1.5 rounded-md border border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-200 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-600 disabled:hover:text-gray-200"
				>
					<StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
					Add note
				</button>
			</div>
			{notes.length > 0 && (
				<ul className="flex flex-col gap-2">
					{notes.map((note, index) => (
						<NoteCard
							// Position, not content: a note's text changes as it is typed.
							key={index}
							note={note}
							open={openIndex === index}
							onOpen={() => setOpenIndex(index)}
							onClose={() => close(index)}
							onChange={(change) => update(index, change)}
							onErase={() => erase(index)}
						/>
					))}
				</ul>
			)}
		</section>
	)
}

function NoteCard({ note, open, onOpen, onClose, onChange, onErase }: {
	note: PvpNote
	open: boolean
	onOpen: () => void
	onClose: () => void
	onChange: (change: Partial<PvpNote>) => void
	onErase: () => void
}) {
	const cardRef = useRef<HTMLLIElement>(null)
	const textRef = useRef<HTMLTextAreaElement>(null)

	// Grow the textarea with its text, so a long note never scrolls inside
	// a scrolling window.
	useLayoutEffect(() => {
		const area = textRef.current
		if (!area) return
		area.style.height = "auto"
		area.style.height = `${area.scrollHeight}px`
	}, [open, note.text])

	return (
		<li
			ref={cardRef}
			className={`rounded-lg border p-2 text-sm text-gray-100 shadow-sm ${PAPER[note.color]}`}
			onBlur={(blur) => {
				// Clicking away closes it; moving between its own controls does not.
				if (open && !cardRef.current?.contains(blur.relatedTarget as Node | null)) onClose()
			}}
			onKeyDown={(keydown) => {
				if (open && keydown.key === "Escape") {
					keydown.stopPropagation()
					onClose()
				}
			}}
		>
			{open ? (
				<div className="flex flex-col gap-2">
					<textarea
						ref={textRef}
						autoFocus
						aria-label="Note"
						value={note.text}
						maxLength={PVP_NOTE_MAX_LENGTH}
						rows={2}
						onChange={(change) => onChange({ text: change.target.value })}
						placeholder="Write a note. ==Like this== shows in red."
						className="w-full resize-none overflow-hidden rounded border border-gray-500/60 bg-gray-950/20 px-2 py-1.5 text-sm text-gray-100 outline-none placeholder:text-gray-300 focus:border-brand"
					/>
					<div className="flex items-center gap-1.5">
						<div className="flex gap-1" role="group" aria-label="Colour">
							{COLORS.map((color) => (
								<button
									key={color}
									type="button"
									aria-label={COLOR_LABELS[color]}
									aria-pressed={note.color === color}
									// Keep focus in the textarea: Safari does not focus a clicked
									// button, so the blur would see "nothing" and close the note.
									onMouseDown={(press) => press.preventDefault()}
									onClick={() => onChange({ color })}
									className={`h-5 w-5 rounded-full border-2 ${PAPER[color]} ${note.color === color ? "ring-2 ring-brand ring-offset-1 ring-offset-gray-900" : ""}`}
								/>
							))}
						</div>
						{note.text.length >= COUNTER_FROM && (
							<span className="ml-1 text-[11px] text-gray-300" aria-live="polite">
								{note.text.length} / {PVP_NOTE_MAX_LENGTH}
							</span>
						)}
						<button
							type="button"
							onClick={onClose}
							className="ml-auto flex items-center gap-1 rounded-md border border-gray-500/60 px-2 py-0.5 text-xs font-medium text-gray-100 transition hover:border-brand hover:text-brand"
						>
							<Check className="h-3.5 w-3.5" aria-hidden="true" />
							Done
						</button>
					</div>
				</div>
			) : (
				<div className="flex items-start gap-2">
					<p className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-snug">
						{splitHighlights(note.text).map((piece, index) =>
							piece.highlighted ? (
								<mark key={index} className="bg-transparent font-semibold text-highlight">
									{piece.text}
								</mark>
							) : (
								<span key={index}>{piece.text}</span>
							)
						)}
					</p>
					<div className="flex shrink-0 gap-0.5">
						<button
							type="button"
							aria-label="Write in note"
							title="Write in note"
							onClick={onOpen}
							className="flex h-7 w-7 items-center justify-center rounded-md text-gray-300 transition hover:bg-gray-950/20 hover:text-gray-100"
						>
							<Pencil className="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							aria-label="Erase note"
							title="Erase note"
							onClick={onErase}
							className="flex h-7 w-7 items-center justify-center rounded-md text-gray-300 transition hover:bg-gray-950/20 hover:text-gray-100"
						>
							<Eraser className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			)}
		</li>
	)
}
