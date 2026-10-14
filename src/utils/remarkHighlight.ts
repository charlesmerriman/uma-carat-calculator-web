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
 */

const TOKEN = /==([^=\n]+)==|\[\[([^[\]\n]+)\]\]/g
const MENTION = /\[\[([^[\]\n]+)\]\]/g

export type NotePiece =
	| { kind: "text"; text: string }
	| { kind: "highlight"; pieces: NotePiece[] }
	| { kind: "skill"; name: string }

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

/** "Take ==[[Groundwork]] first==" -> text, then a highlight holding a skill and text. */
export function splitNoteText(text: string): NotePiece[] {
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
				data: { hName: "span", hProperties: { dataSkill: piece.name } },
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
