/**
 * The pieces both hover cards share (UmaHoverCard, CardHoverCard): a header in
 * the character's colours, a small caps label, a labelled row of skill chips,
 * a loading line and the foot. They wear the skill card's classes
 * (encyclopedia.css, ".skill-card"), so the three cards read as one family;
 * ".hover-card__*" adds only what a skill card has no use for.
 *
 * A link inside the drawn popup takes clicks but stays out of the Tab order,
 * as on the skill card (InsidePopupContext, components/pvp/hoverPopup.tsx).
 */

import { useContext, type CSSProperties, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { InsidePopupContext } from "../pvp/hoverPopup"
import type { PageSkill } from "../../types/encyclopedia"
import { skillHref } from "../../utils/skillSearch"
import { nameLang } from "../../utils/skillList"

/** The header: the art, the name and one line of facts, tinted by `style` (colourStyle). */
export function CardHead({ art, name, meta, style }: { art: ReactNode; name: string; meta: string; style?: CSSProperties }) {
	return (
		<div className="skill-card__head hover-card__head" style={style}>
			<span className="hover-card__art">{art}</span>
			<span className="skill-card__title">
				<span className="skill-card__name" lang={nameLang(name)}>{name}</span>
				{meta && <span className="skill-card__meta">{meta}</span>}
			</span>
		</div>
	)
}

/** A section's small caps label ("Aptitudes", "Training effects"). */
export function Label({ children }: { children: ReactNode }) {
	return <span className="skill-card__label hover-card__label">{children}</span>
}

/**
 * "Innate  [Hydrate] [Steadfast]": the label leads the row and the chips flow
 * after it. Nothing when there are no skills, so a card with no awakening
 * row simply has none.
 */
export function ChipRow({ label, skills, links, levels = false }: {
	label: string
	skills: PageSkill[]
	links: boolean
	/** Show each skill's level ("Lv 3"): an awakening's rank. */
	levels?: boolean
}) {
	if (skills.length === 0) return null
	return (
		<div className="skill-card__chips hover-card__chips">
			<span className="skill-card__label">{label}</span>
			{skills.map((skill) => (
				<SkillChip key={`${skill.id}-${skill.source}-${skill.level ?? ""}`} skill={skill} links={links} level={levels ? skill.level : null} />
			))}
		</div>
	)
}

/**
 * One skill as a chip, its icon and name. It links to the skill's page: a
 * popup never opens a popup of its own (InsideHoverContext), so the chip
 * can't show the skill card, and the page is one click away instead.
 */
function SkillChip({ skill, links, level }: { skill: PageSkill; links: boolean; level: number | null }) {
	const inPopup = useContext(InsidePopupContext)
	const body = (
		<>
			{skill.image ? <img src={skill.image} alt="" loading="lazy" decoding="async" /> : null}
			<span lang={nameLang(skill.name)}>{skill.name}</span>
			{level != null && <span className="hover-card__level">Lv {level}</span>}
		</>
	)
	return links ? (
		<Link to={skillHref(skill.game_id)} tabIndex={inPopup ? -1 : undefined} className="skill-card__chip">
			{body}
		</Link>
	) : (
		<span className="skill-card__chip">{body}</span>
	)
}

/**
 * While the page is on its way: the header is already drawn from the
 * catalogue. The block holds about a card's height (.hover-card__loading), so
 * the box is placed once and doesn't jump up the window when the facts land.
 */
export function Loading({ what }: { what: string }) {
	return (
		<div role="status" aria-label={`Loading ${what}`} className="hover-card__loading">
			<span className="enc-skeleton hover-card__skeleton" style={{ width: "80%" }} />
			<span className="enc-skeleton hover-card__skeleton" style={{ width: "60%" }} />
			<span className="enc-skeleton hover-card__skeleton" style={{ width: "70%" }} />
		</div>
	)
}

/** The foot: UmaTL's credit when the page uses its words, and the way to the page. */
export function CardFoot({ href, credit }: { href: string | null; credit: boolean }) {
	const inPopup = useContext(InsidePopupContext)
	if (!href && !credit) return null
	return (
		<div className="skill-card__foot">
			{credit ? <span>English text: UmaTL fan translation.</span> : <span />}
			{href && (
				// Never wraps: beside the UmaTL credit it would break to "Open its / page".
				<Link to={href} tabIndex={inPopup ? -1 : undefined} className="skill-card__open inline-flex shrink-0 items-center gap-1 whitespace-nowrap transition hover:opacity-80">
					Open its page
					<ArrowRight className="h-3 w-3" aria-hidden="true" />
				</Link>
			)}
		</div>
	)
}
