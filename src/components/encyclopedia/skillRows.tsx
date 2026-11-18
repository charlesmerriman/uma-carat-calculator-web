/**
 * A skill as a row that links to its page, and the card that opens when the
 * row is hovered or focused. Used by an uma's page, a card's page, a skill's
 * page (its versions and evolutions) and the Skills list.
 *
 * The row is quiet on purpose (encyclopedia.css, ".enc-skill"): the theme's
 * own surface, with the skill's kind as a thin spine, a faint wash and a
 * small pill in the game's colour. A list of two thousand solid gold and
 * pink rows was the loudest thing on the site; the solid gold stays on the
 * PvP guides' chips, where there are a handful.
 *
 * THE HOVER CARD is the guide's own (pvp/SkillDetail.tsx). A row knows only
 * the list's facts, so the card's body is fetched the first time the row is
 * hovered (useSkillPage, TanStack Query: one request per skill, shared with
 * the skill's page, kept for the session). Until it lands the card shows its
 * header and a line of shimmer. The row is the link, so the card carries no
 * "Open its page" of its own and ignores the pointer; a tap follows the link.
 */

import { useState, type ReactNode } from "react"
import type { SkillOwnerUma, UnlockCondition } from "../../types/skills"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"
import { Link } from "react-router-dom"
import { useSkillPage } from "../../services/encyclopediaQueries"
import { detailToCardSkill, rowToCardSkill } from "../../utils/skillCard"
import { nameLang } from "../../utils/skillList"
import { SKILL_TYPE_WORDS, skillHref, skillKind } from "../../utils/skillSearch"
import { KindPill, SkillDetail } from "../pvp/SkillDetail"
import { useHoverPopup } from "../pvp/hoverPopup"

/** What a row needs: the Skills list's row, or a page's skill (which adds how it is had). */
export interface RowSkill {
	id: number
	game_id: number
	name: string
	image: string | null
	rarity: number
	tier: number
	version: string
	is_evolved: boolean
	availability: string
	cost?: number | null
	type?: string
	owners?: string[]
	owner_umas?: SkillOwnerUma[]
}

/** The card's body: the full skill once fetched, the row's own header until then. */
function HoverCard({ skill, wanted }: { skill: RowSkill; wanted: boolean }) {
	const page = useSkillPage(wanted ? skill.game_id : null)
	if (page.data) return <SkillDetail skill={detailToCardSkill(page.data)} link={false} />
	return (
		<>
			<SkillDetail skill={rowToCardSkill(skill)} link={false} />
			{!page.isError && <span className="enc-skeleton mt-1 block h-3 w-3/4 rounded" role="status" aria-label="Loading the skill" />}
		</>
	)
}

/**
 * The highest hint level whose discount we know. Daptrius, Discord, 2026-11-18:
 * "Each discount level is a 10% discount", off the BASE cost (not compounding),
 * so Left-Handed's 90 SP is 81 at 1, 72 at 2 and "at the max 3, 63".
 */
const TOP_HINT_LEVEL = 3

/** What a skill costs at the player's hint level, or the plain cost when the level's discount isn't known. */
function hintedCost(cost: number, hintLevel: number | undefined): number {
	if (hintLevel == null || hintLevel < 1 || hintLevel > TOP_HINT_LEVEL) return cost
	// Every cost in the game files is a multiple of 10 (checked 2026-11-18,
	// 1,195 skills), so a 10% step is always whole; the round only guards that.
	return Math.round((cost * (10 - hintLevel)) / 10)
}

/**
 * One skill, linking to its page. `sub` is the row's second line: how this
 * uma or card has it ("Awakening level 3"), or its type and owner in a list.
 */
export function SkillRow({ skill, sub, hint, face = false, after, hintLevel }: {
	skill: RowSkill
	/** The player's hint level for this skill on the uma they own, from their imported Collection. */
	hintLevel?: number
	/** Draw the outfit the skill belongs to at the end of the row (the Skills list): a unique or evolved skill is found by her face. */
	face?: boolean
	sub?: string
	/** Said to a screen reader only, where the page draws the same fact as a picture: "Awakening level 3" beside the track's post. */
	hint?: string
	/** Drawn under the row, outside its link: an evolution's unlock conditions on an uma page. */
	after?: ReactNode
}) {
	// Fetch on the first hover and keep asking after it closes, so the card
	// doesn't empty while it fades out.
	const [wanted, setWanted] = useState(false)
	const { referenceProps, popup } = useHoverPopup("bottom-start", {
		tap: false,
		onOpenChange: (open) => open && setWanted(true),
	})
	const kind = skillKind(skill)
	// True when the shown cost has the player's hint discount taken off.
	const discounted = skill.cost != null && hintedCost(skill.cost, hintLevel) !== skill.cost
	const oshiIds = useOshiIds()
	const owner = face ? skill.owner_umas?.[0] : undefined
	const line = sub ?? [SKILL_TYPE_WORDS[skill.type ?? ""], skill.owners?.join(", ")].filter(Boolean).join(" · ")
	return (
		<li>
			<Link {...referenceProps} to={skillHref(skill.game_id)} className="enc-skill" data-kind={kind}>
				{skill.image ? (
					<img src={skill.image} alt="" className="enc-skill__icon" loading="lazy" decoding="async" />
				) : (
					<span className="enc-skill__icon bg-gray-700" aria-hidden="true" />
				)}
				<span className="enc-skill__text">
					<span className="enc-skill__name" lang={nameLang(skill.name)}>{skill.name}</span>
					<span className="enc-skill__sub">
						<KindPill kind={kind} />
						{line && <span>{line}</span>}
						{hint && <span className="sr-only">{hint}</span>}
						{skill.availability === "jp" && <span className="enc-skill__jp">JP only</span>}
						{hintLevel != null && (
							<span className="enc-skill__hint" title="Your hint level for this skill, from your Collection">
								Hint Lv {hintLevel}
								{discounted && ` (-${hintLevel * 10}%)`}
							</span>
						)}
					</span>
				</span>
				{/* Skill points on the right (Daptrius's list, item 4); a unique has none.
				    On an owned uma it is what she pays at the player's hint level. */}
				{skill.cost != null && (
					<span className="enc-skill__cost" title={discounted ? `${skill.cost} SP before your hint discount` : undefined}>
						{hintedCost(skill.cost, hintLevel)} <small>SP</small>
					</span>
				)}
				{owner && <FramedUma src={owner.portrait} oshi={oshiIds.has(owner.id)} className="enc-skill__face" />}
			</Link>
			{popup(<HoverCard skill={skill} wanted={wanted} />, "w-80")}
			{after}
		</li>
	)
}

/**
 * An uma's unique skill, leading her skills: the icon, its name and what it
 * does, under the game's rainbow edge. A link to the skill's page, like a
 * row. An outfit that starts below three stars has two (the weaker one until
 * she reaches three), so `from` says which star each applies from.
 */
export function UniquePlate({ skill, from }: { skill: RowSkill & { description?: string }; from?: string }) {
	return (
		<Link to={skillHref(skill.game_id)} className="enc-uniq">
			{skill.image
				? <img src={skill.image} alt="" className="enc-uniq__icon" loading="lazy" decoding="async" />
				: <span className="enc-uniq__icon bg-gray-700" aria-hidden="true" />}
			<span className="enc-uniq__text">
				<span className="enc-uniq__name" lang={nameLang(skill.name)}>{skill.name}</span>
				{skill.description && <span className="enc-uniq__what">{skill.description}</span>}
			</span>
			<span className="enc-uniq__side">
				{from && <span>{from}</span>}
				{SKILL_TYPE_WORDS[skill.type ?? ""] && <b>{SKILL_TYPE_WORDS[skill.type ?? ""]}</b>}
				{skill.availability === "jp" && <span className="enc-skill__jp">JP only</span>}
			</span>
		</Link>
	)
}

export function SkillList<T extends RowSkill>({ skills, sub, after, hintLevel, faces = false, className = "enc-skills" }: {
	skills: T[]
	/** Each row shows the outfit its skill belongs to (see SkillRow's `face`). */
	faces?: boolean
	sub?: (skill: T) => string | undefined
	after?: (skill: T) => ReactNode
	hintLevel?: (skill: T) => number | undefined
	className?: string
}) {
	return (
		<ul className={className}>
			{skills.map((skill, index) => (
				<SkillRow
					key={`${skill.game_id}-${index}`}
					skill={skill}
					sub={sub?.(skill)}
					face={faces}
					after={after?.(skill)}
					hintLevel={hintLevel?.(skill)}
				/>
			))}
		</ul>
	)
}

/**
 * What unlocks an evolved skill, one line each: on the skill's page and
 * under each evolution on an uma's page (Daptrius, 2026-11-13: they were
 * "hidden at the bottom of a nested menu"). A condition with no English yet
 * shows the game's Japanese and says so.
 */
export function UnlockConditions({ conditions }: { conditions: UnlockCondition[] }) {
	return (
		<ul className="enc-unlock">
			{conditions.map((condition, index) => (
				<li key={index}>
					{condition.is_japanese ? <span lang="ja">{condition.text}</span> : condition.text}
					{condition.is_japanese && <span className="text-gray-400"> (in Japanese, no translation yet)</span>}
				</li>
			))}
		</ul>
	)
}
