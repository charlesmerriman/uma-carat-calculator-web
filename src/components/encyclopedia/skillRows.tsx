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

import { useState } from "react"
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
 * One skill, linking to its page. `sub` is the row's second line: how this
 * uma or card has it ("Awakening level 3"), or its type and owner in a list.
 */
export function SkillRow({ skill, sub }: { skill: RowSkill; sub?: string }) {
	// Fetch on the first hover and keep asking after it closes, so the card
	// doesn't empty while it fades out.
	const [wanted, setWanted] = useState(false)
	const { referenceProps, popup } = useHoverPopup("bottom-start", {
		tap: false,
		onOpenChange: (open) => open && setWanted(true),
	})
	const kind = skillKind(skill)
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
						{skill.availability === "jp" && <span className="enc-skill__jp">JP only</span>}
					</span>
				</span>
				{/* Skill points on the right (Daptrius's list, item 4); a unique has none. */}
				{skill.cost != null && <span className="enc-skill__cost">{skill.cost} <small>SP</small></span>}
			</Link>
			{popup(<HoverCard skill={skill} wanted={wanted} />, "w-80")}
		</li>
	)
}

export function SkillList<T extends RowSkill>({ skills, sub, className = "enc-skills" }: {
	skills: T[]
	sub?: (skill: T) => string | undefined
	className?: string
}) {
	return (
		<ul className={className}>
			{skills.map((skill, index) => <SkillRow key={`${skill.game_id}-${index}`} skill={skill} sub={sub?.(skill)} />)}
		</ul>
	)
}
