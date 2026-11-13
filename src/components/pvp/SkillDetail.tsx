/**
 * THE SKILL CARD: what hovering a skill shows, wherever a skill is drawn. A
 * recommended skill's chip, a `[[mention]]` in guide text and a deck's skill
 * cell (PvpTiles.tsx), and every skill row in the Encyclopedia
 * (encyclopedia/SkillHover.tsx).
 *
 * Top to bottom: a header in the skill's own colour (icon, name, kind, and
 * the type and cost where the caller knows them), the description, a guide's
 * note, when it fires and what it does, where a player gets it, its other
 * versions, and a footer with the UmaTL credit and the way to its page. The
 * look is encyclopedia.css, ".skill-card" (the overhaul canvas, 2026-11-12).
 *
 * The readable text comes from the API (skill_text.describe), built from the
 * game's own data. A phrase marked `raw` is a clause nobody has confirmed the
 * meaning of yet, so it is shown as the game's code rather than guessed.
 *
 * EVERY ELEMENT IS A SPAN: the card is drawn inside inline hosts (a mention
 * sits in a sentence), where a <div> is invalid HTML. The CSS makes them
 * blocks. A label's colon is there for a screen reader and for copied text,
 * and hidden from sight, where the small caps label already reads as one.
 */

import { useContext, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { SKILL_TYPE_WORDS, skillHref, skillKind } from "../../utils/skillSearch"
import type { PvpSkillRef, PvpSkillSources, SkillCondition, SkillPhrase, SkillReadable } from "../../types/pvpGuide"
import { skillColour } from "../../utils/pvpGuide"
import { cooldownWords, durationWords, hasCondition } from "../../utils/skillWords"
import { useSkillsPreview } from "../../hooks/useSkillsPreview"
import { nameLang } from "../../utils/skillList"
import { InsidePopupContext } from "./hoverPopup"

/** The game's own code for a clause, in a quiet code box. */
function Phrase({ phrase }: { phrase: SkillPhrase }) {
	if (!phrase.raw) return <>{phrase.text}</>
	return <code className="rounded bg-gray-800 px-1 font-mono text-[0.9em] text-gray-400">{phrase.text}</code>
}

function joined(phrases: SkillPhrase[], separator: string): ReactNode[] {
	return phrases.flatMap((phrase, index) => [
		index > 0 ? <span key={`s${index}`}>{separator}</span> : null,
		<Phrase key={index} phrase={phrase} />,
	])
}

/** "a, b, and one of: (c) or (d, e)" */
export function ConditionText({ condition }: { condition: SkillCondition }) {
	const parts: ReactNode[] = []
	if (condition.all.length > 0) parts.push(<span key="all">{joined(condition.all, ", ")}</span>)
	if (condition.any.length > 0) {
		parts.push(
			<span key="any">
				{condition.all.length > 0 ? ", and one of: " : "One of: "}
				{condition.any.map((alternative, index) => (
					<span key={index}>
						{index > 0 && " or "}({joined(alternative, ", ")})
					</span>
				))}
			</span>
		)
	}
	return parts.length > 0 ? <>{parts}</> : <>Any time</>
}

/** A small caps label with a colon only a screen reader (and a copy) gets. */
function Label({ children }: { children: ReactNode }) {
	return (
		<span className="skill-card__label">
			{children}
			<span className="sr-only">: </span>
		</span>
	)
}

/**
 * When it fires and what it does: a row per fact, a block per effect slot,
 * then how long it lasts and how often it can fire as chips.
 */
export function ReadableText({ readable }: { readable: SkillReadable }) {
	if (readable.slots.length === 0) return null
	const many = readable.slots.length > 1
	return (
		<>
			<span className="skill-card__rows">
				{readable.slots.map((slot, index) => {
					const timing = [durationWords(slot), cooldownWords(slot)].filter(Boolean).join(", ")
					return (
						<span key={index} className="contents">
							{many && <span className="skill-card__part">Part {index + 1}</span>}
							{hasCondition(slot.after) && (
								<>
									<Label>Only after</Label>
									<span><ConditionText condition={slot.after} /></span>
								</>
							)}
							<Label>When</Label>
							<span><ConditionText condition={slot.when} /></span>
							{slot.effects.length > 0 && (
								<>
									<Label>Does</Label>
									<span className="skill-card__does">{joined(slot.effects, "; ")}</span>
								</>
							)}
							{/* With one slot the timing is the chips below; with two, each part says its own. */}
							{many && timing && (
								<>
									<Label>Timing</Label>
									<span>{timing}</span>
								</>
							)}
						</span>
					)
				})}
			</span>
			<ReadableChips readable={readable} single={!many} />
		</>
	)
}

function ReadableChips({ readable, single }: { readable: SkillReadable; single: boolean }) {
	const slot = single ? readable.slots[0] : undefined
	const chips = [slot && durationWords(slot), slot && cooldownWords(slot), readable.wit_check ? "Rolls Wit check" : null]
		.filter((chip): chip is string => Boolean(chip))
	if (chips.length === 0) return null
	return (
		<span className="skill-card__chips">
			{chips.map((chip) => <span key={chip} className="skill-card__chip">{chip}</span>)}
		</span>
	)
}

const SOURCE_WORDS: Record<string, string> = {
	unique: "unique",
	innate: "innate",
	awakening: "awakening",
	evolved: "evolution",
	hint: "hint",
	event: "event",
}

function sourceLabel(source: string, level: number | null): string {
	const word = SOURCE_WORDS[source] ?? source
	return level !== null && (source === "awakening" || source === "evolved") ? `${word}, level ${level}` : word
}

function more(shown: number, total: number): string {
	return total > shown ? `, +${total - shown} more` : ""
}

/** "Umas: Special Week (evolution, level 3)" and "Cards: Kitasan Black (hint), +11 more". */
export function SourcesText({ sources }: { sources: PvpSkillSources }) {
	if (sources.uma_count === 0 && sources.card_count === 0) return null
	return (
		<span className="skill-card__rows">
			{sources.uma_count > 0 && (
				<>
					<Label>Umas</Label>
					<span>
						{sources.umas.map((row) => `${row.name} (${sourceLabel(row.source, row.level)}${row.on_global ? "" : ", JP"})`).join(", ")}
						{more(sources.umas.length, sources.uma_count)}
					</span>
				</>
			)}
			{sources.card_count > 0 && (
				<>
					<Label>Cards</Label>
					<span>
						{sources.cards.map((row) => `${row.name} (${sourceLabel(row.source, null)}${row.on_global ? "" : ", JP"})`).join(", ")}
						{more(sources.cards.length, sources.card_count)}
					</span>
				</>
			)}
		</span>
	)
}

/** A small "JP only" tag: the skill isn't in the global game yet. In the
 * colour of whatever it sits on (border-current), so it reads on a plain
 * row, the gold and the pink alike. */
export function JpOnlyTag({ className = "" }: { className?: string }) {
	return (
		<span className={`rounded border border-current px-1 text-[0.85em] font-medium uppercase tracking-wide opacity-75 ${className}`}>
			JP only
		</span>
	)
}

/** A skill's colour as a small pill in the game's own colours (encyclopedia.css, ".kind-pill"). */
export function KindPill({ kind }: { kind: string }) {
	return <span className="kind-pill" data-kind={kind}>{kind}</span>
}

/**
 * The other versions of a skill (white, gold, evolved), each with its colour
 * as a pill and its description. Nothing when it has none. No heading: an
 * "Also as" heading read as unclear (Daptrius, 2026-10-17); the pills say
 * what the list is.
 */
function SkillVersions({ skill }: { skill: PvpSkillRef }) {
	if (skill.versions.length === 0) return null
	return (
		<span className="skill-card__block">
			<span className="skill-card__rows">
				{skill.versions.map((version) => (
					<span key={version.id} className="contents">
						{/* The lone spaces are for the screen reader's copy and copied text: blocks
						    set end to end would read as one word ("goldGroundwork"). */}
						<span><KindPill kind={skillColour(version)} />{" "}</span>
						<span>
							<span className="font-medium text-gray-100" lang={nameLang(version.name)}>{version.name}</span>{" "}
							{version.description && <span className="block text-gray-400">{version.description}</span>}{" "}
						</span>
					</span>
				))}
			</span>
		</span>
	)
}

/**
 * The whole card for one skill. `note` is a guide row's note, if any.
 * `link` false leaves out "Open its page" where the thing hovered is already
 * the link (an Encyclopedia row).
 */
export function SkillDetail({ skill, note, link = true }: {
	skill: PvpSkillRef
	note?: ReactNode
	link?: boolean
}) {
	// The skills work shows to early access only (useSkillsPreview, the
	// Encyclopedia's supporters-first rule); everyone else gets the card with
	// its header, text and versions, as before.
	const preview = useSkillsPreview()
	// The drawn popup is aria-hidden, so its link is for the pointer only (hoverPopup.tsx).
	const inPopup = useContext(InsidePopupContext)
	const kind = skill.is_inherited ? "inherited" : skill.game_id != null ? skillKind({ ...skill, game_id: skill.game_id }) : skillColour(skill)
	// The type and the cost are part of the skills work, so early access only,
	// like the readable text below them.
	const meta = [
		kind,
		preview && skill.type ? SKILL_TYPE_WORDS[skill.type] : null,
		preview && skill.cost != null ? `${skill.cost} SP` : null,
		skill.unique_of,
	].filter(Boolean).join(" · ")
	const credit = preview && skill.uses_translation
	const page = preview && link && skill.game_id != null
	return (
		<span className="skill-card">
			<span className="skill-card__head" data-kind={kind}>
				{skill.image ? (
					<img src={skill.image} alt="" className="skill-card__icon" loading="lazy" decoding="async" />
				) : (
					<span className="skill-card__icon bg-gray-700" aria-hidden="true" />
				)}
				<span className="skill-card__title">
					<span className="skill-card__name">
						<span lang={nameLang(skill.name)}>{skill.name}</span>
						{preview && skill.availability === "jp" && <JpOnlyTag className="ml-1.5 align-middle font-medium" />}
					</span>{" "}
					<span className="skill-card__meta">{meta}</span>{" "}
				</span>
			</span>
			{skill.description && <span className="skill-card__text">{skill.description}</span>}{" "}
			{note && <span className="skill-card__note">{note}</span>}
			{preview && skill.readable && skill.readable.slots.length > 0 && (
				<span className="skill-card__block">
					<ReadableText readable={skill.readable} />
				</span>
			)}
			{preview && skill.sources && (skill.sources.uma_count > 0 || skill.sources.card_count > 0) && (
				<span className="skill-card__block">
					<SourcesText sources={skill.sources} />
				</span>
			)}
			<SkillVersions skill={skill} />
			{(credit || page) && (
				<span className="skill-card__foot">
					{credit && <span>English text: UmaTL fan translation.</span>}
					{page && (
						<Link
							to={skillHref(skill.game_id as number)}
							tabIndex={inPopup ? -1 : undefined}
							className="skill-card__open inline-flex items-center gap-1 transition hover:opacity-80"
						>
							Open its page
							<ArrowRight className="h-3 w-3" aria-hidden="true" />
						</Link>
					)}
				</span>
			)}
		</span>
	)
}
