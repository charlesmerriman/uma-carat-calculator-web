import { useState } from "react"
import { NotebookPen } from "lucide-react"

/**
 * The cap on a planned banner's note. Mirrors NOTE_MAX_LENGTH in the API's
 * views/user_planned_banner.py, which is the one that is enforced: a longer
 * note is a 400 there. The textarea's maxLength stops the field ever holding
 * more, so an auto-save can't fail on it. Change both numbers together.
 */
export const NOTE_MAX_LENGTH = 500

/** The counter stays hidden until the note is this close to the cap. */
const COUNTER_THRESHOLD = NOTE_MAX_LENGTH - 100

interface BannerNoteButtonProps {
	/** The saved note, so the button can show whether the row has one. */
	note: string
	open: boolean
	onToggle: () => void
	disabled?: boolean
	/** Sizing and placement differ between the mobile card and the desktop cell. */
	className: string
}

/**
 * Toggles a row's note editor. Bright and filled in when the row already has a
 * note, dim and hollow when it doesn't, so notes can be spotted down the sheet
 * without opening every row. Grays rather than a hue on purpose: the gray scale
 * is remapped per theme, whereas a stock amber measures ~1.7:1 on the light
 * theme's card fill (see --color-staging in index.css). The label and tooltip
 * change too (WCAG 1.4.1), and the tooltip carries the note itself so a quick
 * hover reads it.
 */
export const BannerNoteButton = ({
	note,
	open,
	onToggle,
	disabled = false,
	className,
}: BannerNoteButtonProps) => {
	const hasNote = note.length > 0
	const label = hasNote ? "Edit note" : "Add a note"

	return (
		<button
			type="button"
			onClick={onToggle}
			disabled={disabled}
			aria-label={label}
			aria-expanded={open}
			title={hasNote ? note : disabled ? "Pick a banner first" : label}
			className={`${className} ${
				hasNote ? "text-gray-100" : "text-gray-500"
			} disabled:cursor-not-allowed disabled:opacity-40`}
		>
			<NotebookPen
				className="h-4 w-4"
				// A note that exists reads as "inked in".
				fill={hasNote ? "currentColor" : "none"}
				fillOpacity={0.3}
			/>
		</button>
	)
}

interface BannerNoteEditorProps {
	note: string
	/** Names the banner in the field's accessible label. */
	bannerName: string
	/** Called once, with the trimmed text, when the field loses focus. */
	onCommit: (note: string) => void
	className?: string
}

/**
 * The note field itself, shown under a row while its note button is open.
 *
 * The text lives in LOCAL state while the person types and reaches the plan
 * only on blur. Every change to the plan schedules an auto-save of the whole
 * row list, so committing per keystroke would PATCH the entire plan once per
 * character.
 *
 * Rendered as a plain string in a textarea, never as HTML.
 */
export const BannerNoteEditor = ({
	note,
	bannerName,
	onCommit,
	className = "",
}: BannerNoteEditorProps) => {
	const [draft, setDraft] = useState(note)

	// Reset the draft when the saved note changes underneath it (the other
	// form factor's editor committed, or a reload brought new data). This is
	// React's "adjust state during render" pattern, used instead of an effect
	// so there is no frame where the old draft shows against the new note.
	const [syncedNote, setSyncedNote] = useState(note)
	if (note !== syncedNote) {
		setSyncedNote(note)
		setDraft(note)
	}

	const handleBlur = (): void => {
		// Trimmed here because the server trims too: committing the raw text
		// would leave local state differing from what was saved.
		const trimmed = draft.trim()
		if (trimmed !== draft) setDraft(trimmed)
		if (trimmed !== note) onCommit(trimmed)
	}

	return (
		<div className={`flex flex-col gap-1 ${className}`}>
			<textarea
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={handleBlur}
				maxLength={NOTE_MAX_LENGTH}
				rows={2}
				aria-label={`Note for ${bannerName}`}
				placeholder="A reminder for yourself. Only you can see it."
				className="w-full resize-y rounded-md border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-gray-400 focus:outline-none"
			/>
			{draft.length >= COUNTER_THRESHOLD && (
				<span className="self-end text-[10px] text-gray-400">
					{draft.length}/{NOTE_MAX_LENGTH}
				</span>
			)}
		</div>
	)
}
