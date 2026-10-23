/**
 * The two inline marks a PvP guide's text may carry:
 *
 *   ==words==        red text, the sheet's "must have"
 *   [[Skill name]]   a link to a skill in the skill database, shown as a chip
 *                    with the skill's icon and its description on hover
 *
 * Two halves, one rule:
 * - `remarkHighlight`, a remark plugin for markdown blocks. It splits text
 *   nodes on both patterns and emits nodes that remark-rehype turns into
 *   <mark> and <span data-skill="Name"> (`data.hName` / `hProperties`).
 *   MarkdownContent styles the first and hands the second to whoever renders
 *   skills. No new dependency, and raw HTML stays off: the nodes are built from
 *   the syntax tree, never from a string.
 * - `splitNoteText` / `splitHighlights`, for one-line notes that are not
 *   markdown (a deck slot's "2SP", a skill's note). InlineNote renders them.
 *
 * A lone `=` and `a == b` with spaces are left alone: a highlight needs at
 * least one character that is not `=` or a newline between the pairs. A
 * mention inside a highlight (`==Take [[Groundwork]]==`) is still a mention.
 *
 * One more reading on top: a mention followed by "& Scenario Link" is flagged
 * `scenarioLink` (see SCENARIO_LINK_AFTER), so it can be marked out.
 */

const TOKEN = /==([^=\n]+)==|\[\[([^[\]\n]+)\]\]/g
const MENTION = /\[\[([^[\]\n]+)\]\]/g

export type NotePiece =
	| { kind: "text"; text: string }
	| { kind: "highlight"; pieces: NotePiece[] }
	// `scenarioLink` is set (true) only on a flagged mention, so pieces
	// compare equal to a plain `{ kind, name }` everywhere else.
	| { kind: "skill"; name: string; scenarioLink?: true }

function splitMentions(text: string): NotePiece[] {
	const pieces: NotePiece[] = []
	let last = 0
	for (const match of text.matchAll(MENTION)) {
		const index = match.index ?? 0
		if (index > last) pieces.push({ kind: "text", text: text.slice(last, index) })
		pieces.push({ kind: "skill", name: match[1].trim() })
		last = index + match[0].length
	}
	if (last < text.length) pieces.push({ kind: "text", text: text.slice(last) })
	return pieces
}

/**
 * What follows a skill that the guide means as "this skill, from the Scenario
 * Link" (Daptrius, 2026-10-17): a chain of "& ..." clauses that includes
 * "Scenario Link". The live guides write it three ways, all matched:
 *   ==[[See Ya Later!]] & Scenario Link==
 *   [[See Ya Later!]] ==& Scenario Link==
 *   ==[[Unstoppable]] & 2SP & Scenario Link==
 * and `[[Sharp Streak]] ==& 1SP==` (no Scenario Link) stays a plain mention.
 */
const SCENARIO_LINK_AFTER = /^\s*(?:&[^&]*?)*&\s*scenario link\b/i

/**
 * Flags each mention whose following text, up to the next mention and read
 * across highlight edges, matches SCENARIO_LINK_AFTER. Mutates the pieces.
 */
function flagScenarioLinks(pieces: NotePiece[]): NotePiece[] {
	// The note in reading order, highlights flattened: mentions and text.
	const leaves: NotePiece[] = []
	const walk = (list: NotePiece[]) => {
		for (const piece of list) {
			if (piece.kind === "highlight") walk(piece.pieces)
			else leaves.push(piece)
		}
	}
	walk(pieces)
	leaves.forEach((leaf, index) => {
		if (leaf.kind !== "skill") return
		let after = ""
		for (const next of leaves.slice(index + 1)) {
			if (next.kind !== "text") break
			after += next.text
		}
		if (SCENARIO_LINK_AFTER.test(after)) leaf.scenarioLink = true
	})
	return pieces
}

/**
 * A note as plain words: highlights unmarked, mentions as their names
 * ("with ==[[564 Escapades]]==" -> "with 564 Escapades"). For a one-line
 * caption where a chip or red would not fit; the full note stays on hover.
 */
export function plainNoteText(text: string): string {
	return text.replace(TOKEN, (_, highlight: string | undefined, skill: string | undefined) =>
		highlight !== undefined ? highlight.replace(MENTION, (__, name: string) => name.trim()) : (skill ?? "").trim()
	)
}

/** "Take ==[[Groundwork]] first==" -> text, then a highlight holding a skill and text. */
export function splitNoteText(text: string): NotePiece[] {
	return flagScenarioLinks(splitTokens(text))
}

function splitTokens(text: string): NotePiece[] {
	const pieces: NotePiece[] = []
	let last = 0
	for (const match of text.matchAll(TOKEN)) {
		const index = match.index ?? 0
		if (index > last) pieces.push({ kind: "text", text: text.slice(last, index) })
		if (match[1] !== undefined) pieces.push({ kind: "highlight", pieces: splitMentions(match[1]) })
		else pieces.push({ kind: "skill", name: match[2].trim() })
		last = index + match[0].length
	}
	if (last < text.length) pieces.push({ kind: "text", text: text.slice(last) })
	return pieces
}

export interface HighlightPiece {
	text: string
	highlighted: boolean
}

/** Highlights only, with mentions flattened to their names. */
export function splitHighlights(text: string): HighlightPiece[] {
	const flatten = (pieces: NotePiece[]): string =>
		pieces.map((piece) => (piece.kind === "text" ? piece.text : piece.kind === "skill" ? piece.name : flatten(piece.pieces))).join("")
	return splitNoteText(text).reduce<HighlightPiece[]>((out, piece) => {
		const highlighted = piece.kind === "highlight"
		const value = piece.kind === "text" ? piece.text : piece.kind === "skill" ? piece.name : flatten(piece.pieces)
		const previous = out[out.length - 1]
		if (previous && previous.highlighted === highlighted) previous.text += value
		else out.push({ text: value, highlighted })
		return out
	}, [])
}

// The few mdast shapes the plugin touches, typed locally so it needs no
// @types/mdast import.
interface MdNode {
	type: string
	value?: string
	data?: unknown
	children?: MdNode[]
}

function toNodes(pieces: NotePiece[]): MdNode[] {
	return pieces.map((piece): MdNode => {
		if (piece.kind === "text") return { type: "text", value: piece.text }
		if (piece.kind === "skill") {
			return {
				type: "skillMention",
				data: {
					hName: "span",
					hProperties: piece.scenarioLink ? { dataSkill: piece.name, dataScenarioLink: "" } : { dataSkill: piece.name },
				},
				children: [{ type: "text", value: piece.name }],
			}
		}
		return { type: "highlight", data: { hName: "mark" }, children: toNodes(piece.pieces) }
	})
}

function transform(node: MdNode): void {
	if (!node.children) return
	// Adjacent text nodes are joined first: the markdown parser may cut
	// "[[Slick Surge]](On Your Left)" at its brackets, and a mention split
	// across two nodes would never match.
	const merged: MdNode[] = []
	for (const child of node.children) {
		const previous = merged[merged.length - 1]
		if (child.type === "text" && previous?.type === "text") previous.value = (previous.value ?? "") + (child.value ?? "")
		else merged.push(child.type === "text" ? { ...child } : child)
	}
	const next: MdNode[] = []
	for (const child of merged) {
		if (child.type === "text" && typeof child.value === "string") {
			next.push(...toNodes(splitNoteText(child.value)))
		} else {
			// Code spans and blocks keep their marks literally: they have a
			// `value`, not text children, and are never split.
			if (child.type !== "inlineCode" && child.type !== "code") transform(child)
			next.push(child)
		}
	}
	node.children = next
}

/** The remark plugin. Use: `remarkPlugins={[remarkGfm, remarkHighlight]}`. */
export function remarkHighlight() {
	return (tree: unknown) => transform(tree as MdNode)
}
