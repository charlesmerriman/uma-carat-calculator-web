/**
 * The small pieces the Encyclopedia's pages share (notes/encyclopedia-plan.md,
 * PR 4): a section, the aptitude grid, the stats table with its star switch,
 * a skill row that links to the skill, an outfit or card row that links to
 * its page, the release line and the banner links.
 *
 * Functionality first (owner, 2026-11-12): today's styles, nothing new. The
 * visual overhaul is another agent's, later, on the same branch.
 */

import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import PredictedBadge from "../PredictedBadge"
import { FramedUma } from "../FramedUma"
import { JpOnlyTag } from "../pvp/SkillDetail"
import { useOshiIds } from "../../hooks/useOshiIds"
import type { PageCard, PageOutfit, PageSkill, StarStats, StatKey } from "../../types/encyclopedia"
import type { AptitudeKey } from "../../types/pvpTeam"
import { aptitudeLetter } from "../../utils/courseAptitude"
import { formatDate } from "../../utils/dateFormat"
import type { BannerLink } from "../../utils/encyclopediaBanners"
import { cardLine } from "../../utils/encyclopedia"
import { cardHref, umaHref } from "../../utils/encyclopediaRoutes"
import { GOLD_SKILL_RARITY } from "../../utils/pvpGuide"
import { nameLang } from "../../utils/skillList"
import { skillHref, skillKind } from "../../utils/skillSearch"
import { APTITUDE_GROUPS, STAT_KEYS, STAT_LABELS } from "../../utils/trainedUmas"

const INSET = "border border-edge bg-gray-900/40"

/** A titled block. Leave a section out when it has nothing: never draw it empty. */
export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
	return (
		<section className="flex flex-col gap-2">
			<h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-200">
				{title}
				{aside}
			</h2>
			{children}
		</section>
	)
}

/** "From the JP game. May change on global." beside facts global doesn't have yet. */
export function JpDataNote() {
	return <p className="text-xs text-gray-400">From the JP game. May change on global.</p>
}

function letterTone(value: number | null): string {
	if (value == null) return "text-gray-500"
	if (value >= 7) return "text-brand"
	if (value <= 4) return "text-highlight"
	return "text-gray-200"
}

/** The ten aptitudes as the game groups them: surface, distance, style. */
export function AptitudeGrid({ apt }: { apt: Record<AptitudeKey, number | null> }) {
	return (
		<div className={`flex flex-col gap-2 rounded-lg p-3 ${INSET}`}>
			{APTITUDE_GROUPS.map((group) => (
				<div key={group.label} className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
					<span className="text-xs text-gray-400">{group.label}</span>
					<div className="grid grid-cols-4 gap-1.5">
						{group.keys.map(({ key, label }) => (
							<div key={key} className="flex min-w-0 items-center justify-between gap-1 rounded-md bg-gray-800/60 px-2 py-1 text-xs text-gray-200">
								<span className="truncate">{label}</span>
								<b className={`font-display text-sm ${letterTone(apt[key])}`}>{aptitudeLetter(apt[key]) ?? "–"}</b>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	)
}

/**
 * Base stats at the chosen star level, and the growth bonuses. Opens at the
 * outfit's own starting stars when the game lists them, else its lowest.
 */
export function StarStatsTable({ stars, growth, initialStar }: {
	stars: StarStats[]
	growth: Record<StatKey, number | null>
	initialStar: number | null
}) {
	const [picked, setPicked] = useState<number | null>(null)
	const star = picked ?? (stars.some((row) => row.star === initialStar) ? initialStar : stars[0]?.star) ?? null
	const row = stars.find((entry) => entry.star === star)
	return (
		<div className="flex flex-col gap-2">
			{stars.length > 1 && (
				<div role="group" aria-label="Star level" className="flex flex-wrap gap-1">
					{stars.map((entry) => (
						<button
							key={entry.star}
							type="button"
							aria-pressed={entry.star === star}
							onClick={() => setPicked(entry.star)}
							className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
								entry.star === star ? "border-brand bg-brand/15 text-gray-100" : "border-gray-600 text-gray-300 hover:border-gray-500"
							}`}
						>
							★{entry.star}
						</button>
					))}
				</div>
			)}
			<div className={`overflow-x-auto rounded-lg ${INSET}`}>
				<table className="w-full text-center text-xs text-gray-200">
					<thead>
						<tr className="text-gray-400">
							<th className="px-2 py-1.5 text-left font-medium"><span className="sr-only">Row</span></th>
							{STAT_KEYS.map((key) => <th key={key} className="px-2 py-1.5 font-medium">{STAT_LABELS[key]}</th>)}
						</tr>
					</thead>
					<tbody>
						{row && (
							<tr>
								<td className="px-2 py-1.5 text-left text-gray-400">Base</td>
								{STAT_KEYS.map((key) => <td key={key} className="px-2 py-1.5 font-semibold">{row[key]}</td>)}
							</tr>
						)}
						<tr>
							<td className="px-2 py-1.5 text-left text-gray-400">Growth</td>
							{STAT_KEYS.map((key) => (
								<td key={key} className="px-2 py-1.5">{growth[key] ? `+${growth[key]}%` : "0"}</td>
							))}
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	)
}

function skillSurface(skill: PageSkill): string {
	if (skill.is_evolved) return "skill-evolved"
	if (skill.rarity === GOLD_SKILL_RARITY) return "skill-gold"
	return "border-edge bg-(--card-fill) text-gray-100 hover:border-gray-500"
}

/** One skill, linking to its page. `note` is how this uma or card has it ("level 3"). */
export function SkillLinkRow({ skill, note }: { skill: PageSkill; note?: string }) {
	return (
		<li>
			<Link
				to={skillHref(skill.game_id)}
				className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition ${skillSurface(skill)}`}
			>
				{skill.image ? (
					<img src={skill.image} alt="" className="h-6 w-6 shrink-0" loading="lazy" decoding="async" />
				) : (
					<span className="h-6 w-6 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
				)}
				<span className="min-w-0 flex-1 truncate" lang={nameLang(skill.name)}>{skill.name}</span>
				{skill.availability === "jp" && <JpOnlyTag className="shrink-0 text-[10px]" />}
				<span className="shrink-0 text-xs opacity-70">
					{[note, skill.cost != null ? `${skill.cost} SP` : null, skillKind(skill)].filter(Boolean).join(" · ")}
				</span>
			</Link>
		</li>
	)
}

export function SkillList({ skills, note }: { skills: PageSkill[]; note?: (skill: PageSkill) => string | undefined }) {
	return (
		<ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
			{skills.map((skill) => <SkillLinkRow key={`${skill.source}-${skill.game_id}`} skill={skill} note={note?.(skill)} />)}
		</ul>
	)
}

const PERSON_ROW = "flex items-center gap-2.5 rounded-lg border border-edge bg-(--card-fill) px-2 py-1.5 text-sm text-gray-100 transition hover:border-gray-500"

/** Other outfits: each a FramedUma linking to its own page. */
export function OutfitList({ outfits }: { outfits: PageOutfit[] }) {
	const oshiIds = useOshiIds()
	return (
		<ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
			{outfits.map((outfit) => (
				<li key={outfit.game_id}>
					<Link to={umaHref(outfit.game_id)} className={PERSON_ROW}>
						<FramedUma src={outfit.portrait} oshi={oshiIds.has(outfit.id)} className="h-10 w-10 shrink-0" />
						<span className="min-w-0 flex-1">
							<span className="block truncate">{outfit.name}</span>
							<span className="block truncate text-xs text-gray-400">{outfit.title}</span>
						</span>
						{!outfit.on_global && <JpOnlyTag className="shrink-0 text-[10px]" />}
					</Link>
				</li>
			))}
		</ul>
	)
}

/** Support cards: the bordered picture (owner's answer 5), linking to each page. */
export function CardList({ cards }: { cards: PageCard[] }) {
	return (
		<ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
			{cards.map((card) => (
				<li key={card.game_id}>
					<Link to={cardHref(card.game_id)} className={PERSON_ROW}>
						{card.image ? (
							<img src={card.image} alt="" className="h-12 w-9 shrink-0 rounded object-cover" loading="lazy" decoding="async" />
						) : (
							<span className="h-12 w-9 shrink-0 rounded bg-gray-700" aria-hidden="true" />
						)}
						<span className="min-w-0 flex-1">
							<span className="block truncate">{card.title || card.name}</span>
							<span className="block truncate text-xs text-gray-400">{cardLine(card)}</span>
						</span>
						{!card.on_global && <JpOnlyTag className="shrink-0 text-[10px]" />}
					</Link>
				</li>
			))}
		</ul>
	)
}

/** The banners this outfit or card is on, as the site already dated them. */
export function BannerLinks({ banners }: { banners: BannerLink[] }) {
	return (
		<ul className="flex flex-col gap-1.5">
			{banners.map((banner) => (
				<li key={banner.timelineId}>
					<Link to={banner.href} className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${PERSON_ROW}`}>
						<span className="min-w-0 flex-1 truncate">{banner.name}</span>
						<span className="text-xs text-gray-400">{formatDate(banner.start)} to {formatDate(banner.end)}</span>
						{banner.predicted && <PredictedBadge />}
					</Link>
				</li>
			))}
		</ul>
	)
}

/**
 * When it came out: "JP release" from the first JP banner, and "Global" from
 * the first banner's date, with the site's badge when that date is predicted.
 * A card on no banner shows its own Global date. Only what is known.
 */
export function ReleaseLine({ jpDate, globalDate, predicted }: {
	jpDate: string | null
	globalDate: string | null
	predicted: boolean
}) {
	if (!jpDate && !globalDate) return null
	return (
		<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
			{jpDate && <span>JP release {formatDate(jpDate)}</span>}
			{globalDate && (
				<span className="flex items-center gap-1.5">
					Global {formatDate(globalDate)}
					{predicted && <PredictedBadge />}
				</span>
			)}
		</p>
	)
}

/** The Japanese name under the English one, marked as Japanese for screen readers and fonts. */
export function JapaneseName({ name, title }: { name: string; title: string }) {
	if (!name && !title) return null
	return <p className="text-xs text-gray-400" lang="ja">{[title, name].filter(Boolean).join(" ")}</p>
}

/**
 * "You own this" with the player's stars or limit break, and a way to their
 * Collection. Read from the Collection (useOwned); nothing here writes, so no
 * "saved" wording. Nothing for a guest or for something they don't own.
 */
export function OwnedLine({ detail, tab }: { detail: string; tab: "umas" | "cards" }) {
	return (
		<p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm text-gray-100">
			<span className="font-semibold text-brand">You own this</span>
			{detail && <span>{detail}</span>}
			<Link to={`/app/collection?tab=${tab}`} className="ml-auto text-xs text-brand transition hover:text-brand/75">
				Open your Collection
			</Link>
		</p>
	)
}

/** A small "Owned" mark on a list tile. */
export function OwnedMark() {
	return <span className="rounded border border-brand/50 px-1 text-[10px] font-semibold uppercase tracking-wide text-brand">Owned</span>
}

export function Stars({ count }: { count: number | null }) {
	if (!count) return null
	return <span className="text-sm text-highlight" aria-label={`${count} stars`}>{"★".repeat(count)}</span>
}
