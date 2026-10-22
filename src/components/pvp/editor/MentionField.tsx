/**
 * A text box that knows the guide's two marks: `==red==` and `[[Skill]]`.
 *
 * Typing `[[` offers the catalogue's skill names (skills on global, the only
 * ones a mention may name); picking one inserts `[[Name]]` where the caret
 * is. A multiline box can carry a markdown toolbar (bold, italic, red, skill,
 * link) and a Preview toggle that renders the text with the site's own
 * renderer, so what the editor sees is what the page shows.
 *
 * The field is controlled; the parent owns the value (the document).
 */

import { useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react"
import { Bold, Eye, EyeOff, Highlighter, Italic, Link2, Sparkles } from "lucide-react"
import { MarkdownContent } from "../../info/MarkdownContent"
import { SkillMention } from "../PvpTiles"
import { useGuideEditor } from "./GuideEditorContext"
import { FIELD_ERROR, ICON_BUTTON, INPUT } from "./editorStyles"

const MAX_SUGGESTIONS = 8

// Module scope, so MarkdownContent's memoised components keep one identity.
const renderSkill = (name: string, { scenarioLink }: { scenarioLink: boolean }) => (
	<SkillMention name={name} scenarioLink={scenarioLink} />
)

/** The `[[fragment` the caret sits in, or null. */
function openMention(value: string, caret: number): { start: number; query: string } | null {
	const before = value.slice(0, caret)
	const start = before.lastIndexOf("[[")
	if (start === -1) return null
	const fragment = before.slice(start + 2)
	if (fragment.includes("]]") || fragment.includes("\n") || fragment.includes("[[")) return null
	return { start, query: fragment }
}

type FieldElement = HTMLInputElement | HTMLTextAreaElement

export function MentionField({
	id,
	label,
	value,
	onChange,
	multiline = false,
	markdown = false,
	placeholder,
	maxLength,
	errors = [],
	className = "",
	rows = 4,
	children,
}: {
	id?: string
	/** The accessible name; drawn as a label only with `children` unset. */
	label: string
	value: string
	onChange: (value: string) => void
	multiline?: boolean
	/** A toolbar and a Preview toggle (multiline only). */
	markdown?: boolean
	placeholder?: string
	maxLength?: number
	errors?: string[]
	className?: string
	rows?: number
	/** Drawn as the label row's extra content (a hint, a count). */
	children?: ReactNode
}) {
	const generated = useId()
	const fieldId = id ?? generated
	const { index } = useGuideEditor()
	const fieldRef = useRef<FieldElement | null>(null)
	const [caret, setCaret] = useState<number | null>(null)
	const [highlighted, setHighlighted] = useState(0)
	const [preview, setPreview] = useState(false)

	const mention = caret === null ? null : openMention(value, caret)
	const suggestions = useMemo(() => {
		if (!mention) return []
		const query = mention.query.trim().toLowerCase()
		const names: string[] = []
		for (const skill of index.catalogue.skills) {
			if (query && !skill.name.toLowerCase().includes(query)) continue
			if (!names.includes(skill.name)) names.push(skill.name)
			if (names.length >= MAX_SUGGESTIONS) break
		}
		return names
	}, [index.catalogue.skills, mention])

	const setValue = (next: string, nextCaret: number) => {
		onChange(next)
		// Put the caret back after React re-renders the controlled value.
		requestAnimationFrame(() => {
			const field = fieldRef.current
			if (!field) return
			field.focus()
			field.setSelectionRange(nextCaret, nextCaret)
			setCaret(nextCaret)
		})
	}

	const insertMention = (name: string) => {
		if (!mention || caret === null) return
		const next = `${value.slice(0, mention.start)}[[${name}]]${value.slice(caret)}`
		setValue(next, mention.start + name.length + 4)
	}

	/** Wrap the selection (or insert the marks) for a toolbar button. */
	const wrap = (before: string, after: string, fallback = "") => {
		const field = fieldRef.current
		if (!field) return
		const start = field.selectionStart ?? value.length
		const end = field.selectionEnd ?? start
		const chosen = value.slice(start, end) || fallback
		const next = `${value.slice(0, start)}${before}${chosen}${after}${value.slice(end)}`
		setValue(next, start + before.length + chosen.length + after.length)
	}

	const onInput = (change: ChangeEvent<FieldElement>) => {
		onChange(change.target.value)
		setCaret(change.target.selectionStart)
		setHighlighted(0)
	}

	const onKeyDown = (key: KeyboardEvent<FieldElement>) => {
		if (suggestions.length === 0) return
		if (key.key === "ArrowDown") {
			key.preventDefault()
			setHighlighted((current) => (current + 1) % suggestions.length)
		} else if (key.key === "ArrowUp") {
			key.preventDefault()
			setHighlighted((current) => (current - 1 + suggestions.length) % suggestions.length)
		} else if (key.key === "Enter" || key.key === "Tab") {
			key.preventDefault()
			insertMention(suggestions[highlighted] ?? suggestions[0])
		} else if (key.key === "Escape") {
			setCaret(null)
		}
	}

	const listId = `${fieldId}-mentions`
	const shared = {
		id: fieldId,
		value,
		placeholder,
		maxLength,
		onChange: onInput,
		onKeyDown,
		onSelect: (select: { currentTarget: FieldElement }) => setCaret(select.currentTarget.selectionStart),
		onBlur: () => window.setTimeout(() => setCaret(null), 150),
		"aria-label": children ? label : undefined,
		"aria-autocomplete": "list" as const,
		"aria-controls": suggestions.length > 0 ? listId : undefined,
		"aria-invalid": errors.length > 0 || undefined,
		className: `${INPUT} w-full ${multiline ? "resize-y leading-relaxed" : ""}`,
	}

	return (
		<div className={`flex flex-col gap-1 ${className}`}>
			<div className="flex flex-wrap items-center justify-between gap-2">
				{children ? (
					<span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
				) : (
					<label htmlFor={fieldId} className="text-xs font-semibold uppercase tracking-wide text-gray-400">
						{label}
					</label>
				)}
				<div className="flex items-center gap-1">
					{children}
					{multiline && markdown && (
						<>
							<button type="button" className={ICON_BUTTON} title="Bold" aria-label="Bold" onClick={() => wrap("**", "**", "bold")}>
								<Bold className="h-4 w-4" />
							</button>
							<button type="button" className={ICON_BUTTON} title="Italic" aria-label="Italic" onClick={() => wrap("*", "*", "italic")}>
								<Italic className="h-4 w-4" />
							</button>
							<button type="button" className={ICON_BUTTON} title="Red text (a must-have)" aria-label="Red text" onClick={() => wrap("==", "==", "Must have")}>
								<Highlighter className="h-4 w-4" />
							</button>
							<button type="button" className={ICON_BUTTON} title="Skill mention" aria-label="Skill mention" onClick={() => wrap("[[", "]]", "Skill name")}>
								<Sparkles className="h-4 w-4" />
							</button>
							<button type="button" className={ICON_BUTTON} title="Link" aria-label="Link" onClick={() => wrap("[", "](/faq)", "the words")}>
								<Link2 className="h-4 w-4" />
							</button>
							<button
								type="button"
								className={`${ICON_BUTTON} ${preview ? "text-brand" : ""}`}
								aria-pressed={preview}
								title={preview ? "Back to editing" : "Preview"}
								aria-label={preview ? "Back to editing" : "Preview"}
								onClick={() => setPreview(!preview)}
							>
								{preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
							</button>
						</>
					)}
				</div>
			</div>
			{preview && multiline ? (
				<div className="min-h-16 rounded border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm">
					{value.trim() ? (
						<MarkdownContent markdown={value} paragraphClassName="mt-2 first:mt-0 leading-relaxed text-gray-300" renderSkill={renderSkill} />
					) : (
						<p className="text-gray-500">Nothing to preview yet.</p>
					)}
				</div>
			) : (
				<div className="relative">
					{multiline ? (
						<textarea ref={(node) => { fieldRef.current = node }} rows={rows} {...shared} />
					) : (
						<input ref={(node) => { fieldRef.current = node }} type="text" {...shared} />
					)}
					{suggestions.length > 0 && (
						<ul
							id={listId}
							role="listbox"
							aria-label="Skill names"
							className="absolute left-0 top-full z-30 mt-1 max-h-56 w-72 max-w-full overflow-y-auto rounded-lg border border-gray-600 bg-gray-900 py-1 text-sm shadow-lg"
						>
							{suggestions.map((name, position) => (
								<li
									key={name}
									role="option"
									aria-selected={position === highlighted}
									// mousedown, so the field's blur (which hides the list) comes after.
									onMouseDown={(mouse) => {
										mouse.preventDefault()
										insertMention(name)
									}}
									className={`cursor-pointer px-3 py-1 ${position === highlighted ? "bg-gray-700 text-brand" : "text-gray-200 hover:bg-gray-800"}`}
								>
									{name}
								</li>
							))}
						</ul>
					)}
				</div>
			)}
			{errors.map((message) => (
				<p key={message} className={FIELD_ERROR} role="alert">
					{message}
				</p>
			))}
		</div>
	)
}
