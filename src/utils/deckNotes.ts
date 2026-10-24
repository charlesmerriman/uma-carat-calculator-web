/**
 * A deck slot's note, read as the parts the guide page draws (guide-visuals-plan.md,
 * release 2): the skills a card gives, whether it is linked to the scenario, a few
 * fixed tags, an "or any <type>" alternative, and whatever else the guide wrote.
 *
 * The guides write a small, steady vocabulary under their cards (CM 21, 109 notes:
 * Scenario Link 22, "or any Spd / Wit" 20, 2SP 12, Stats 9, Hints 5, 1SP 4, Initial
 * Friendship 3), joined with "&", "+" or commas: "[[Unstoppable]] & 2SP & Scenario
 * Link". The sheet-era guides say "Link" alone for the same thing. Reading the words the author already types means no new fields, no change
 * to how Henry writes, and every older guide reads the same way.
 *
 * `==highlights==` are dropped, marks and all: nothing on a card is red or bold
 * (Henry, 2026-10-23). A note with nothing recognisable in it comes back whole as
 * `rest`, so nothing an author wrote is lost.
 */

export type DeckStatType = "speed" | "stamina" | "power" | "guts" | "wit"

/** A stat type as the game prints it: "or any Wit card". */
export const DECK_STAT_LABELS: Record<DeckStatType, string> = {
	speed: "Speed",
	stamina: "Stamina",
	power: "Power",
	guts: "Guts",
	wit: "Wit",
}

export interface SlotNote {
	/** The `[[skill]]` names, in the order written. */
	skills: string[]
	/** The note says "Scenario Link": the card is linked to the guide's scenario. */
	scenarioLink: boolean
	/** Fixed tags in the guide's own words, in the order written: "2SP", "Stats", "Hints", "Initial Friendship". */
	tags: string[]
	/** "or any Wit": any card of this type will do instead. */
	anyType: DeckStatType | null
	/** Whatever else the note says, as plain text with its [[mentions]] kept; "" when nothing is left. */
	rest: string
}

const MENTION = /\[\[([^[\]\n]+)\]\]/g
// "&", "+", "," and "and/or" join the parts; spaces alone never do, so a
// sentence ("if you think it's over accel") stays one part.
const JOINER = /\s*(?:&|\+|,|\band\/or\b)\s*/i
const SP_TAG = /^(\d)\s?SP$/i
const ANY_TYPE = /^or any (spd|speed|sta|stam|stamina|pow|power|guts|wit|wis|wisdom|int)\.?$/i

const TYPE_WORDS: Record<string, DeckStatType> = {
	spd: "speed",
	speed: "speed",
	sta: "stamina",
	stam: "stamina",
	stamina: "stamina",
	pow: "power",
	power: "power",
	guts: "guts",
	wit: "wit",
	wis: "wit",
	wisdom: "wit",
	int: "wit",
}

/** One part's fixed tag, in the guide's spelling, or null. */
function tagFor(part: string): string | null {
	const sp = SP_TAG.exec(part)
	if (sp) return `${sp[1]}SP`
	if (/^stats$/i.test(part)) return "Stats"
	if (/^hints$/i.test(part)) return "Hints"
	if (/^initial friendships?$/i.test(part)) return "Initial Friendship"
	return null
}

export function parseSlotNote(note: string): SlotNote {
	const text = note.replace(/==/g, "").trim()
	const mentions = [...text.matchAll(MENTION)].map((match) => ({ raw: match[0], name: match[1].trim() }))
	// Mentions out of the way first, each swapped for one private-use character
	// (U+E000, which no note contains): a skill's own name may hold "&" ("Fast &
	// Furious"), which must not split the note. Each part then takes back its
	// own mentions, in order.
	const masked = text.replace(MENTION, "\uE000")
	const skills: string[] = []
	const tags: string[] = []
	let scenarioLink = false
	let anyType: DeckStatType | null = null
	const unread: string[] = []
	let read = 0
	let next = 0
	for (const raw of masked.split(JOINER)) {
		const count = (raw.match(/\uE000/g) ?? []).length
		const own = mentions.slice(next, next + count)
		next += count
		if (!raw.trim()) continue
		const words = raw.replace(/\uE000/g, "").trim()
		const tag = words ? tagFor(words) : null
		const any = words ? ANY_TYPE.exec(words) : null
		if (!words) {
			// Mentions only ("[[Taking the Lead]] [[Concentration]]").
		} else if (tag) {
			if (!tags.includes(tag)) tags.push(tag)
		} else if (/^(?:scenario )?link$/i.test(words)) {
			// The sheet-era guides write a bare "Link" ("Gold + Link").
			scenarioLink = true
		} else if (any) {
			anyType = TYPE_WORDS[any[1].toLowerCase()]
		} else {
			// The author's own words: kept as written, with their mentions.
			let index = 0
			unread.push(raw.replace(/\uE000/g, () => own[index++]?.raw ?? "").trim())
			continue
		}
		skills.push(...own.map((mention) => mention.name))
		read += 1
	}
	// Nothing recognised: the whole note is the author's words, joiners and all.
	if (read === 0) return { skills: [], scenarioLink: false, tags: [], anyType: null, rest: text }
	return { skills, scenarioLink, tags, anyType, rest: unread.join(" · ") }
}

/** A card's rarity as the game prints it, for anything but an SSR (which most guide cards are). */
/**
 * A note-only slot that names only a card type, "Any Wit" or "or any Spd",
 * as that type (the All tab draws it as the stat's icon); anything else null.
 * The card notes' "or any" reading stays parseSlotNote's: there, "Any Wit"
 * without the "or" is the slot's own advice and is kept as written.
 */
export function noteOnlyType(note: string): DeckStatType | null {
	const word = /^(?:or )?any (\w+)\.?$/i.exec(note.replace(/==/g, "").trim())?.[1]?.toLowerCase()
	return word ? (TYPE_WORDS[word] ?? null) : null
}

export function rarityLabel(rarity: number | null): string {
	if (rarity === 1) return "R"
	if (rarity === 2) return "SR"
	return ""
}
