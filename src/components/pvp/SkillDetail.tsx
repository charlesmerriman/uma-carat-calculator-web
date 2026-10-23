/**
 * What a skill's hover detail says, shared by a recommended skill's chip and
 * a `[[mention]]` in guide text (PvpTiles.tsx), and by the Skills page.
 *
 * In order: the name (with whose unique it is and a "JP only" tag), the
 * description, when it fires and what it does, where a player gets it, the
 * other versions, and the UmaTL credit when the text shown is theirs.
 *
 * The readable text comes from the API (skill_text.describe), built from the
 * game's own data. A phrase marked `raw` is a clause nobody has confirmed the
 * meaning of yet, so it is shown as the game's code rather than guessed.
 */

import type { ReactNode } from "react"
import type { PvpSkillRef, PvpSkillSources, SkillCondition, SkillPhrase, SkillReadable, SkillSlot } from "../../types/pvpGuide"
import { skillColour } from "../../utils/pvpGuide"

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

function hasCondition(condition: SkillCondition): boolean {
	return condition.all.length > 0 || condition.any.length > 0
}

/** "for 2.4 s, once per race" after the effects; nothing for an instant one. */
function timing(slot: SkillSlot): string {
	const parts: string[] = []
	if (slot.duration === "Whole race") parts.push("for the whole race")
	else if (slot.duration) parts.push(`for ${slot.duration}`)
	if (slot.cooldown === "Once per race") parts.push("once per race")
	else if (slot.cooldown) parts.push(`can fire again after ${slot.cooldown}`)
	return parts.length > 0 ? ` ${parts.join(", ")}` : ""
}

/** When it fires and what it does, a short block per effect slot. */
export function ReadableText({ readable }: { readable: SkillReadable }) {
	if (readable.slots.length === 0) return null
	const many = readable.slots.length > 1
	return (
		<span className="block space-y-0.5">
			{readable.slots.map((slot, index) => (
				<span key={index} className="block">
					{many && <span className="block font-medium text-gray-300">Part {index + 1}</span>}
					{hasCondition(slot.after) && (
						<span className="block">
							<span className="text-gray-400">Only after: </span>
							<ConditionText condition={slot.after} />
						</span>
					)}
					<span className="block">
						<span className="text-gray-400">When: </span>
						<ConditionText condition={slot.when} />
					</span>
					{slot.effects.length > 0 && (
						<span className="block">
							<span className="text-gray-400">Does: </span>
							{joined(slot.effects, "; ")}
							{timing(slot)}
						</span>
					)}
				</span>
			))}
			{readable.wit_check && <span className="block text-gray-400">Rolls against Wit before it fires.</span>}
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
		<span className="block text-gray-300">
			{sources.uma_count > 0 && (
				<span className="block">
					<span className="text-gray-400">Umas: </span>
					{sources.umas.map((row) => `${row.name} (${sourceLabel(row.source, row.level)}${row.on_global ? "" : ", JP"})`).join(", ")}
					{more(sources.umas.length, sources.uma_count)}
				</span>
			)}
			{sources.card_count > 0 && (
				<span className="block">
					<span className="text-gray-400">Cards: </span>
					{sources.cards.map((row) => `${row.name} (${sourceLabel(row.source, null)}${row.on_global ? "" : ", JP"})`).join(", ")}
					{more(sources.cards.length, sources.card_count)}
				</span>
			)}
		</span>
	)
}

/** A small "JP only" tag: the skill isn't in the global game yet. */
export function JpOnlyTag({ className = "" }: { className?: string }) {
	return (
		<span className={`rounded border border-gray-500 px-1 text-[0.85em] font-medium uppercase tracking-wide text-gray-300 ${className}`}>
			JP only
		</span>
	)
}

/** The other versions of a skill (white, gold, evolved). Nothing when it has none.
 *
 * No heading: an "Also as" heading read as unclear (Daptrius, 2026-10-17).
 * The rule above the list and each line's colour word say what they are. */
function SkillVersions({ skill }: { skill: PvpSkillRef }) {
	if (skill.versions.length === 0) return null
	return (
		<span className="mt-1 block border-t border-gray-700/70 pt-1 text-gray-300">
			{skill.versions.map((version) => (
				<span key={version.id} className="mt-0.5 flex items-start gap-1">
					{version.image ? (
						<img src={version.image} alt="" className="mt-px h-3.5 w-3.5 shrink-0" loading="lazy" decoding="async" />
					) : (
						<span className="mt-px h-3.5 w-3.5 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
					)}
					<span>
						<span className="font-medium text-gray-100">{version.name}</span>
						<span className="text-gray-400"> {skillColour(version)}</span>
						{version.description && <span className="block text-gray-400">{version.description}</span>}
					</span>
				</span>
			))}
		</span>
	)
}

/** The whole hover detail of one skill. `note` is a guide row's note, if any. */
export function SkillDetail({ skill, note }: { skill: PvpSkillRef; note?: ReactNode }) {
	return (
		<>
			<span className="block font-semibold text-gray-100">
				{skill.name}
				{skill.unique_of && <span className="font-normal text-gray-400"> ({skill.unique_of})</span>}
				{skill.availability === "jp" && <JpOnlyTag className="ml-1.5 align-middle" />}
			</span>
			{skill.description}
			{note && <span className="mt-1 block text-gray-300">{note}</span>}
			{skill.readable && (
				<span className="mt-1 block border-t border-gray-700/70 pt-1">
					<ReadableText readable={skill.readable} />
				</span>
			)}
			{skill.sources && (
				<span className="mt-1 block">
					<SourcesText sources={skill.sources} />
				</span>
			)}
			<SkillVersions skill={skill} />
			{skill.uses_translation && <span className="mt-1 block text-[0.9em] text-gray-500">English text: UmaTL fan translation.</span>}
		</>
	)
}
