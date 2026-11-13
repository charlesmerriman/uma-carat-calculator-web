/**
 * What an uma's or a card's page shows about it: the aptitude grid, the stats
 * with their star switch, the release dates, the banners, and the related
 * outfits and cards as link rows. The look is encyclopedia.css.
 *
 * Rules that bite here: every uma is FramedUma from its `portrait`; every
 * card is FramedCard from its frameless art, as in the Collection (the visual
 * overhaul settled the owner's first-round answer 5 that way), and a card
 * with no frameless art yet draws its bordered picture; every date goes
 * through formatDate.
 */

import { useState, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import PredictedBadge from "../PredictedBadge"
import { FramedCard } from "../FramedCard"
import { FramedUma } from "../FramedUma"
import { StatusPill } from "../rankings/kit/StatusPill"
import { useOshiIds } from "../../hooks/useOshiIds"
import type { PageCard, PageOutfit, StarStats, StatKey } from "../../types/encyclopedia"
import type { AptitudeKey } from "../../types/pvpTeam"
import { aptitudeLetter } from "../../utils/courseAptitude"
import { formatDate } from "../../utils/dateFormat"
import { bannerStatus, cardLine, isWeakAptitude } from "../../utils/encyclopedia"
import type { BannerLink } from "../../utils/encyclopediaBanners"
import { cardHref, umaHref } from "../../utils/encyclopediaRoutes"
import { APTITUDE_GROUPS, STAT_KEYS, STAT_LABELS } from "../../utils/trainedUmas"
import { Fact, JpTag, Section, Switch } from "./pieces"

/**
 * The ten aptitudes as the game groups them: surface, distance, style. Each
 * letter sits on the game's colour for it; one she can't use (D or worse)
 * steps back so the A's lead.
 */
export function AptitudeGrid({ apt }: { apt: Record<AptitudeKey, number | null> }) {
	return (
		<div className="enc-apt">
			{APTITUDE_GROUPS.map((group) => (
				<div key={group.label} className="enc-apt__row">
					<span className="enc-apt__group">{group.label}</span>
					<div className="enc-apt__cells">
						{group.keys.map(({ key, label }) => {
							const letter = aptitudeLetter(apt[key])
							return (
								<div key={key} className="enc-apt__cell" data-weak={isWeakAptitude(apt[key])}>
									<span>{label}</span>
									<b className="apt-letter" data-rank={letter ?? undefined}>{letter ?? "–"}</b>
								</div>
							)
						})}
					</div>
				</div>
			))}
		</div>
	)
}

/**
 * Base stats at the chosen star level, and the growth bonuses, as a section
 * whose heading carries the star switch. Opens at the outfit's own starting
 * stars when the game lists them, else its lowest. A bar is measured against
 * the tallest stat at ANY star, so stepping up a star visibly fills them.
 */
export function StatsSection({ id, stars, growth, initialStar }: {
	id?: string
	stars: StarStats[]
	growth: Record<StatKey, number | null>
	initialStar: number | null
}) {
	const [picked, setPicked] = useState<number | null>(null)
	const star = picked ?? (stars.some((row) => row.star === initialStar) ? initialStar : stars[0]?.star) ?? null
	const row = stars.find((entry) => entry.star === star)
	const top = Math.max(1, ...stars.flatMap((entry) => STAT_KEYS.map((key) => entry[key])))
	return (
		<Section
			id={id}
			title="Stats"
			aside={stars.length > 1 && star !== null && (
				<Switch
					label="Star level"
					options={stars.map((entry) => ({ value: entry.star, label: `★${entry.star}` }))}
					value={star}
					onChange={setPicked}
				/>
			)}
		>
			<ul className="enc-stats">
				{STAT_KEYS.map((key) => (
					<li key={key} className="enc-stat" data-stat={key}>
						<span className="enc-stat__label">{STAT_LABELS[key]}</span>
						{row && <b className="enc-stat__value">{row[key]}</b>}
						{row && (
							<span className="enc-stat__bar" aria-hidden="true">
								<span style={{ width: `${Math.round((row[key] / top) * 100)}%` } as CSSProperties} />
							</span>
						)}
						<span className="enc-stat__growth" data-bonus={Boolean(growth[key])}>
							<i>Growth</i> +{growth[key] ?? 0}%
						</span>
					</li>
				))}
			</ul>
		</Section>
	)
}

/**
 * When it came out, as two facts for the hero: "JP release" from the first JP
 * banner, and "Global release" from the first banner's date, with the site's
 * badge when that date is predicted. A card on no banner shows its own Global
 * date. Only what is known: null when neither is.
 */
export function ReleaseFacts({ jpDate, globalDate, predicted }: {
	jpDate: string | null
	globalDate: string | null
	predicted: boolean
}) {
	if (!jpDate && !globalDate) return null
	return (
		<>
			{jpDate && <Fact label="JP release">{formatDate(jpDate)}</Fact>}
			{globalDate && (
				<Fact label="Global release">
					{formatDate(globalDate)}
					{predicted && <PredictedBadge />}
				</Fact>
			)}
		</>
	)
}

/** The banners this outfit or card is on, as the site already dated them, each a way into the Timeline. */
export function BannerLinks({ banners }: { banners: BannerLink[] }) {
	// Read once per page, never at render time: a banner's status is a fact about today.
	const [now] = useState(() => new Date())
	return (
		<ul className="enc-banners">
			{banners.map((banner) => (
				<li key={banner.timelineId}>
					<Link to={banner.href} className="enc-banner">
						<StatusPill status={bannerStatus(banner.start, banner.end, now)} />
						<span className="enc-banner__name">{banner.name}</span>
						<span className="enc-banner__dates">{formatDate(banner.start)} to {formatDate(banner.end)}</span>
						{banner.predicted && <PredictedBadge />}
					</Link>
				</li>
			))}
		</ul>
	)
}

/** Other outfits: each a FramedUma linking to its own page. */
export function OutfitList({ outfits }: { outfits: PageOutfit[] }) {
	const oshiIds = useOshiIds()
	return (
		<ul className="enc-rows">
			{outfits.map((outfit) => (
				<li key={outfit.game_id}>
					<Link to={umaHref(outfit.game_id)} className="enc-row">
						<FramedUma src={outfit.portrait} oshi={oshiIds.has(outfit.id)} className="enc-row__art" />
						<span className="enc-row__text">
							<span className="enc-row__name">{outfit.name}</span>
							{outfit.title && <span className="enc-row__sub">{outfit.title}</span>}
						</span>
						{!outfit.on_global && <JpTag />}
						<ChevronRight className="enc-row__go" aria-hidden="true" />
					</Link>
				</li>
			))}
		</ul>
	)
}

/** Support cards, each in the site's frame and linking to its page. */
export function CardList({ cards }: { cards: PageCard[] }) {
	return (
		<ul className="enc-rows">
			{cards.map((card) => (
				<li key={card.game_id}>
					<Link to={cardHref(card.game_id)} className="enc-row">
						<FramedCard card={card} className="enc-row__art--card" />
						<span className="enc-row__text">
							<span className="enc-row__name">{card.title || card.name}</span>
							<span className="enc-row__sub">{cardLine(card)}</span>
						</span>
						{!card.on_global && <JpTag />}
						<ChevronRight className="enc-row__go" aria-hidden="true" />
					</Link>
				</li>
			))}
		</ul>
	)
}
