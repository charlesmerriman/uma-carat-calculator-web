/**
 * The answer a Rankings tab opens on (notes/rankings-polish-plan.md; canvas
 * shots 04, 08, 12, 14 in notes/rankings-polish/canvas/shots/): the tab's
 * first place, large, on her two colours, with the tab's figures ruled off
 * beside her. The Encyclopedia's own hero (Hero in encyclopedia/pieces.tsx),
 * a size smaller (`enc-hero--rank` in rankings.css), its name an h2 under
 * the page's h1. It replaced the band (StatBand) of the 2026-10-28 redesign.
 *
 * NO DESCRIPTION LINE (the owner, 2026-11-25: "users can understand what's
 * going on without the extra text"): the eyebrow names what is ranked, the
 * line under the name says the figure, and that is all the prose it has.
 *
 * A region named by `title`, so the figures are found by the tab's own words.
 * With nothing ranked yet (`top` null) it still draws the title and figures,
 * on the page's accent, with no art.
 */

import type { CSSProperties, ReactNode } from "react"
import { Link } from "react-router-dom"
import { Fact, Hero } from "../../encyclopedia/pieces"
import { CARD_LINK_TITLE } from "../../../utils/hoverCards"
import { colourStyle } from "../../../utils/encyclopedia"

export interface StatFigure {
	label: string
	value: ReactNode
	/** Small, after the value: a name, a month. */
	suffix?: string
}

export interface HeroTop {
	/** "#1 overall", "#1 most built": the hero's number plate. */
	place: string
	name: string
	/** The figure under the name, its numbers in <b>. */
	line: ReactNode
	/** Sized by the hero: give it `enc-hero__art` (an uma, a face) or `enc-hero__art--card` (a card). */
	art: ReactNode
	/** One uma, one card, or a banner's faces side by side. */
	shape: "uma" | "card" | "pair"
	/** Her two colours (`character_colours`), or none for the page's accent. */
	colours?: readonly string[] | null
	/** Under the line: a card's type chip and how often it was the borrowed card. */
	tags?: ReactNode
	/** Her Encyclopedia page (useEncyclopediaHrefs): the art links to it. */
	href?: string | null
	/** Her card (utils/hoverCards.ts hoverCardProps): a click on the art opens it. */
	hover?: Record<string, string>
}

export function RankHero({ title, top, figures }: {
	/** What is ranked ("What the guides recommend"): the eyebrow and the region's name. */
	title: string
	top: HeroTop | null
	figures: StatFigure[]
}) {
	const art = top?.href ? (
		<Link to={top.href} {...top.hover} title={top.hover ? CARD_LINK_TITLE : "Open in the Encyclopedia"} className="flex rounded-[14%] focus-visible:outline-2 focus-visible:outline-brand">
			{top.art}
		</Link>
	) : (
		top?.art
	)
	return (
		<section aria-label={title} className="rk-paint" style={colourStyle(top?.colours) as CSSProperties | undefined}>
			<Hero
				level={2}
				shape={top?.shape === "card" ? "card" : "uma"}
				className={`enc-hero--rank rk-hero--${top?.shape ?? "uma"}`}
				entry={top?.place}
				eyebrow={top ? title : ""}
				name={top?.name ?? title}
				title={top?.line}
				tags={top?.tags}
				art={art}
				facts={figures.map((figure) => (
					<Fact key={figure.label} label={figure.label}>
						{figure.value}
						{figure.suffix && <small>{figure.suffix}</small>}
					</Fact>
				))}
			/>
		</section>
	)
}
