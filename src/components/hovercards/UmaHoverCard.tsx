/**
 * THE UMA CARD: what hovering an uma shows, the skill card's sibling
 * (notes/uma-card-hover-plan.md, the canvas the owner approved on 2026-11-17).
 *
 * Top to bottom: a header in her character's main colour (her framed
 * portrait, name, title, starting stars and running style), her ten
 * aptitudes with the race's ones ringed, her stats boxed with Growth, her
 * skills, and "Open its page".
 *
 * It only draws. HoverCardLayer works out which uma, fetches her page and
 * passes it in; the guide's tiles draw it with their note on top (`top`).
 * While the page is on its way, the header comes from the catalogue entry
 * and the body is a loading line.
 */

import type { ReactNode } from "react"
import type { UmaPageData } from "../../types/encyclopedia"
import type { AptitudeKey } from "../../types/pvpTeam"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"
import { aptitudeLetter } from "../../utils/courseAptitude"
import { colourStyle, isTopAptitude, RUNNING_STYLE_WORDS } from "../../utils/encyclopedia"
import { statRow } from "../../utils/hoverCards"
import { STAT_ICON_PATHS } from "../../utils/statIcons"
import { APTITUDE_GROUPS, STAT_KEYS, STAT_LABELS } from "../../utils/trainedUmas"
import { CardFoot, CardHead, ChipRow, Label, Loading } from "./parts"
import type { PortraitLayers } from "../../types/portraitLayers"

export interface UmaHoverCardProps {
	/** The catalogue's entry: draws the header before the page arrives. */
	uma: { id: number; name: string; portrait: string | null; portrait_layers?: PortraitLayers | null; image: string | null }
	/** Her page (GET /encyclopedia/umas/<game_id>); undefined while loading, null when there is none. */
	page: UmaPageData | null | undefined
	/** Her page's address, or null to draw no link (links off, or no page). */
	href: string | null
	/** The aptitudes this race asks of her, ringed (utils/hoverCards.ts ringFor). */
	ring?: readonly AptitudeKey[]
	/** The stars the player owns her at (the Collection), else her starting stars are shown. */
	ownedStars?: number | null
	/** False: skill chips are plain text (where leaving would drop an edit). */
	links?: boolean
	/** Above the body, under the header: a guide's note for this uma. */
	top?: ReactNode
}

export function UmaHoverCard({ uma, page, href, ring = [], ownedStars = null, links = true, top = null }: UmaHoverCardProps) {
	const oshiIds = useOshiIds()
	const name = page?.name ?? uma.name
	const meta = page
		? [page.title, page.rarity ? `★${page.rarity}` : "", page.running_style ? RUNNING_STYLE_WORDS[page.running_style] : ""]
				.filter(Boolean)
				.join(" · ")
		: ""
	return (
		<div className="skill-card hover-card">
			<CardHead
				name={name}
				meta={meta}
				style={colourStyle(page?.colours)}
				art={<FramedUma src={page?.portrait ?? uma.portrait ?? uma.image} layers={page ? page.portrait_layers : uma.portrait_layers} oshi={oshiIds.has(uma.id)} className="w-full" />}
			/>
			{top && <div className="skill-card__note">{top}</div>}
			{page === undefined ? (
				<Loading what={name} />
			) : page === null ? null : (
				<UmaBody page={page} ring={ring} ownedStars={ownedStars} links={links} />
			)}
			<CardFoot href={href} credit={Boolean(page?.uses_translation)} />
		</div>
	)
}

function UmaBody({ page, ring, ownedStars, links }: {
	page: UmaPageData
	ring: readonly AptitudeKey[]
	ownedStars: number | null
	links: boolean
}) {
	const row = statRow(page.star_stats, ownedStars, page.rarity)
	const owned = ownedStars != null && row?.star === ownedStars
	const skills = (source: string) => page.skills.filter((skill) => skill.source === source)
	return (
		<>
			<div>
				<Label>{ring.length > 0 ? "Aptitudes · this race ringed" : "Aptitudes"}</Label>
				<div className="hover-card__apt">
					{APTITUDE_GROUPS.map((group) => (
						<div key={group.label} className="hover-card__apt-row" aria-label={group.label}>
							{group.keys.map(({ key, label }) => {
								const letter = aptitudeLetter(page.apt[key])
								return (
									<span key={key} className="hover-card__apt-cell" data-top={isTopAptitude(page.apt[key])} data-race={ring.includes(key)}>
										<span>{label}</span>
										<b className="apt-letter" data-rank={letter ?? undefined}>{letter ?? "–"}</b>
									</span>
								)
							})}
						</div>
					))}
				</div>
			</div>
			{row && (
				<div className="skill-card__block">
					<Label>{`Stats at ★${row.star}${owned ? ", yours" : ""}`}</Label>
					<ul className="hover-card__stats">
						{STAT_KEYS.map((key) => {
							const growth = page.growth[key] ?? 0
							return (
								<li key={key} className="hover-card__stat">
									<span className="hover-card__stat-value">
										<img src={STAT_ICON_PATHS[key]} alt={STAT_LABELS[key]} width={14} height={14} loading="lazy" decoding="async" />
										{row[key]}
									</span>
									<span className="hover-card__stat-growth" data-bonus={growth > 0}>
										Growth<b>+{growth}%</b>
									</span>
								</li>
							)
						})}
					</ul>
				</div>
			)}
			{page.skills.length > 0 && (
				<div className="skill-card__block">
					<ChipRow label="Unique" skills={skills("unique")} links={links} />
					<ChipRow label="Innate" skills={skills("innate")} links={links} />
					<ChipRow label="Awakening" skills={skills("awakening")} links={links} levels />
					<ChipRow label="Evolves" skills={skills("evolved")} links={links} />
				</div>
			)}
		</>
	)
}
