/**
 * `==words==` -> red text. The sheet marks must-haves in red; an editor writes
 * them as `==Must have==` in any PvP guide text (the admin's help text says so).
 *
 * Two halves, one rule:
 * - `remarkHighlight`, a remark plugin for markdown blocks. It splits text nodes
 *   on the pattern and emits a node that remark-rehype turns into <mark>
 *   (`data.hName`), which MarkdownContent styles. No new dependency, and raw
 *   HTML stays off: the node is built from the syntax tree, never from a string.
 * - `splitHighlights`, for one-line notes that are not markdown (a deck slot's
 *   "2SP", a skill's note). InlineNote renders its pieces.
 *
 * A lone `=` and `a == b` with spaces inside are left alone: the pattern needs
 * at least one character that is not `=` or a newline between the pairs.
 */

export const HIGHLIGHT_PATTERN = /==([^=\n]+)==/g

export interface HighlightPiece {
	text: string
	highlighted: boolean
}

/** "Take ==this== first" -> plain, highlighted, plain. */
export function splitHighlights(text: string): HighlightPiece[] {
	const pieces: HighlightPiece[] = []
	let last = 0
	for (const match of text.matchAll(HIGHLIGHT_PATTERN)) {
		const index = match.index ?? 0
		if (index > last) pieces.push({ text: text.slice(last, index), highlighted: false })
		pieces.push({ text: match[1], highlighted: true })
		last = index + match[0].length
	}
	if (last < text.length) pieces.push({ text: text.slice(last), highlighted: false })
	return pieces
}

// The few mdast shapes the plugin touches, typed locally so it needs no
// @types/mdast import.
interface TextNode {
	type: "text"
	value: string
}
interface ParentNode {
	type: string
	children?: MdNode[]
}
type MdNode = TextNode | ParentNode | { type: string; value?: string; data?: unknown; children?: MdNode[] }

function highlightNode(text: string): MdNode {
	return {
		type: "highlight",
		data: { hName: "mark" },
		children: [{ type: "text", value: text }],
	}
}

function transform(node: ParentNode): void {
	if (!node.children) return
	const next: MdNode[] = []
	for (const child of node.children) {
		if (child.type === "text" && typeof (child as TextNode).value === "string") {
			for (const piece of splitHighlights((child as TextNode).value)) {
				next.push(piece.highlighted ? highlightNode(piece.text) : { type: "text", value: piece.text })
			}
		} else {
			// Code spans and blocks keep their `==` literally: they have a
			// `value`, not text children, and are never split.
			if (child.type !== "inlineCode" && child.type !== "code") transform(child as ParentNode)
			next.push(child)
		}
	}
	node.children = next
}

/** The remark plugin. Use: `remarkPlugins={[remarkGfm, remarkHighlight]}`. */
export function remarkHighlight() {
	return (tree: unknown) => transform(tree as ParentNode)
}
