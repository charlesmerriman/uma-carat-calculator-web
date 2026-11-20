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
import PredictedBadge from "../PredictedBadge"
import { FramedCard } from "../FramedCard"
import { FramedUma } from "../FramedUma"
import { StatusPill } from "../rankings/kit/StatusPill"
import { useOshiIds } from "../../hooks/useOshiIds"
import type { PageCard, PageOutfit, StarStats, StatKey } from "../../types/encyclopedia"
import type { AptitudeKey } from "../../types/pvpTeam"
import { aptitudeLetter } from "../../utils/courseAptitude"
import { formatDate } from "../../utils/dateFormat"
import { bannerStatus, cardLine, isTopAptitude } from "../../utils/encyclopedia"
import type { BannerLink } from "../../utils/encyclopediaBanners"
import { cardHref, umaHref } from "../../utils/encyclopediaRoutes"
import { STAT_ICON_PATHS } from "../../utils/statIcons"
import { APTITUDE_GROUPS, STAT_KEYS, STAT_LABELS } from "../../utils/trainedUmas"
import { Fact, JpTag, Section, Switch } from "./pieces"

/**
 * The ten aptitudes as the game groups them: surface, distance, style. Every
 * cell reads at full strength whatever the grade (the owner, 2026-11-17:
 * "faded out and hard to read is generally not a good idea"); the letter
 * wears the game's colour for it, and A or better is filled in the page's
 * colour, so her range shows by what is lit, not by what is dimmed.
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
								<div key={key} className="enc-apt__cell" data-top={isTopAptitude(apt[key])}>
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
						<span className="enc-stat__label">
							<img src={STAT_ICON_PATHS[key]} alt="" width={20} height={20} loading="lazy" decoding="async" />
							{/* On a phone the icon alone says which; the word stays for a screen reader. */}
							<span className="enc-stat__name">{STAT_LABELS[key]}</span>
						</span>
						{row && <b className="enc-stat__value">{row[key]}</b>}
						{row && (
							<span className="enc-stat__bar" aria-hidden="true">
								<span style={{ width: `${Math.round((row[key] / top) * 100)}%` } as CSSProperties} />
							</span>
						)}
						<span className="enc-stat__growth" data-bonus={Boolean(growth[key])}>
							<i>Growth</i> <b>+{growth[key] ?? 0}%</b>
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
 *
 * `pending` while /calculator-data is still loading: both facts are drawn
 * with a blank bar for a value, so the dates landing don't push the page down
 * (on a phone the facts are a row under the name). A built document carries
 * this state too, because a build-time render has no calculator data.
 */
export function ReleaseFacts({ jpDate, globalDate, predicted, pending = false }: {
	jpDate: string | null
	globalDate: string | null
	predicted: boolean
	pending?: boolean
}) {
	if (pending) {
		return (
			<>
				<Fact label="JP release"><PendingValue /></Fact>
				<Fact label="Global release"><PendingValue /></Fact>
			</>
		)
	}
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

/** A fact's value still on its way: a blank bar one line tall (the no-break space gives it the line's height). */
function PendingValue() {
	return <span className="enc-skeleton inline-block w-28 rounded-md" aria-hidden="true">{" "}</span>
}

/** How many of a banner's other faces a row draws before it says "and N more". */
const BANNER_FACES = 7

/**
 * The banners this outfit or card is on, as the site already dated them, each
 * a way into the Timeline: the banner's own picture, its name, who else is on
 * it, and when. The faces are the banner's other umas (framed, as every uma
 * is) or its other cards.
 */
export function BannerLinks({ banners }: { banners: BannerLink[] }) {
	// Read once per page, never at render time: a banner's status is a fact about today.
	const [now] = useState(() => new Date())
	const oshiIds = useOshiIds()
	return (
		<ul className="enc-banners">
			{banners.map((banner) => {
				const faces = banner.featured.slice(0, BANNER_FACES)
				const more = banner.featured.length - faces.length
				return (
					<li key={banner.timelineId}>
						<Link to={banner.href} className="enc-banner">
							{banner.image
								? <img src={banner.image} alt="" className="enc-banner__art" loading="lazy" decoding="async" />
								: <span className="enc-banner__art" aria-hidden="true" />}
							<span className="enc-banner__text">
								<span className="enc-banner__name">{banner.name}</span>
								{faces.length > 0 && (
									<span className="enc-banner__with">
										With
										{faces.map((face) => (banner.kind === "uma"
											? <FramedUma key={face.id} src={face.art} oshi={oshiIds.has(face.id)} alt={face.name} className="enc-banner__face" />
											: face.art && <img key={face.id} src={face.art} alt={face.name} className="enc-banner__face enc-banner__face--card" loading="lazy" decoding="async" />
										))}
										{more > 0 && <span>and {more} more</span>}
									</span>
								)}
							</span>
							<span className="enc-banner__when">
								<StatusPill status={bannerStatus(banner.start, banner.end, now)} />
								<span className="enc-banner__dates">
									{formatDate(banner.start)} to {formatDate(banner.end)}
									{banner.predicted && <PredictedBadge />}
								</span>
							</span>
						</Link>
					</li>
				)
			})}
		</ul>
	)
}

/** Other outfits: each a FramedUma tile linking to its own page, the art first. */
export function OutfitList({ outfits }: { outfits: PageOutfit[] }) {
	const oshiIds = useOshiIds()
	return (
		<ul className="enc-tiles">
			{outfits.map((outfit) => (
				<li key={outfit.game_id}>
					<Link to={umaHref(outfit.game_id)} className="enc-pic">
						<FramedUma src={outfit.portrait} oshi={oshiIds.has(outfit.id)} className="enc-pic__art" />
						<span className="enc-pic__name">{outfit.name}</span>
						{outfit.title && <span className="enc-pic__sub">{outfit.title}</span>}
						{!outfit.on_global && <JpTag />}
					</Link>
				</li>
			))}
		</ul>
	)
}

/** Support cards, each in the site's frame and linking to its page, the art first. */
export function CardList({ cards }: { cards: PageCard[] }) {
	return (
		<ul className="enc-tiles">
			{cards.map((card) => (
				<li key={card.game_id}>
					<Link to={cardHref(card.game_id)} className="enc-pic enc-pic--card">
						<FramedCard card={card} className="enc-pic__art" />
						<span className="enc-pic__name">{card.title || card.name}</span>
						<span className="enc-pic__sub">{cardLine(card)}</span>
						{!card.on_global && <JpTag />}
					</Link>
				</li>
			))}
		</ul>
	)
}
