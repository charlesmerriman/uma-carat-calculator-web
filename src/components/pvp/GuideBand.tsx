/**
 * The top of a guide, above the styles (release 3 of guide-visuals-plan.md):
 * what the guide says before a reader picks a style.
 *
 * Left, the style ranking as a ladder (parseStyleRanking: "Pace>>End>Late>Front"),
 * each step a button to that style's tab with its top umas beside it, then the
 * short description and the meta analysis. Henry liked the ladder as mocked.
 * Right, one panel: the recommended stats (every row and footnote the guide
 * has; one plain row as five big tiles), the scenario, the team comps as three
 * places in each style's colour.
 *
 * Style colours are Hakuraku's (the --color-style-* tokens): on a name only
 * through .style-ink, which leaves text alone on the light themes; always
 * beside the word.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Users } from "lucide-react"
import { MarkdownContent } from "../info/MarkdownContent"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"
import { InlineNote, SkillMention } from "./PvpTiles"
import { HEADING, PARAGRAPH, SECTION, SUBHEADING } from "./guideStyles"
import { STYLE_LABELS, parseStyleRanking, parseTeamComp, styleColor, umasByStars, type RankingStep } from "../../utils/pvpGuide"
import type { PvpGuide, PvpStatConfig, PvpStyle, PvpStyleTab } from "../../types/pvpGuide"

// Module scope, so MarkdownContent's memoised components keep one identity.
const renderSkill = (name: string, { scenarioLink }: { scenarioLink: boolean }) => (
	<SkillMention name={name} scenarioLink={scenarioLink} />
)

type RankedStyle = Exclude<PvpStyle, "everyone">

/** A style's colour as the CSS variable .style-ink and the fills read. */
function styleVar(style: RankedStyle): CSSProperties {
	return { "--style-color": styleColor(style) } as CSSProperties
}

/**
 * The mark between two steps, as the mock drew it: "≫" over a small "gap" in
 * the brand gold for a clear gap, "=" / "≥" over "level", "›" for an ordinary
 * step. On a phone's list only a gap or a level shows, as a line between rows.
 * Words for a screen reader either way.
 */
function GapMark({ gap }: { gap: RankingStep["gap"] }) {
	if (!gap) return null
	const big = gap === ">>"
	const level = gap === "=" || gap === ">="
	const glyph = big ? "≫" : gap === ">=" ? "≥" : gap === "=" ? "=" : "›"
	const words = big ? "A clear gap, then" : level ? "Level with it" : "Then"
	return (
		<span
			className={`shrink-0 items-center font-display @xl:flex-col @xl:justify-center @xl:px-1.5 ${
				big || level ? "flex gap-1.5 py-0.5 pl-3 @xl:py-0 @xl:pl-1.5" : "hidden @xl:flex"
			} ${big ? "text-brand" : "text-gray-500"}`}
		>
			<span aria-hidden="true" className={big ? "text-xl leading-none @xl:text-2xl" : "text-lg leading-none"}>
				{glyph}
			</span>
			{(big || level) && (
				<span aria-hidden="true" className="font-sans text-[9px] font-semibold uppercase tracking-wider text-gray-500">
					{big ? "gap" : "level"}
				</span>
			)}
			<span className="sr-only">{words}</span>
		</span>
	)
}

/**
 * The ranking ladder, as mocked and approved (Henry: "style ranking portion
 * looks great"): a row of equal steps once it has 36rem (a container query on
 * the wrapper: a query reads an ANCESTOR), each the rank, the style's name in
 * its colour and up to three of its top-starred umas, with the gap marks
 * between; on a phone, a list, one line a step. A step for a style is a
 * button to its tab; a word that names no style (CM 20's "Blaze") is a plain
 * step.
 */
function Ladder({ guide, steps, active, onStyleChange }: {
	guide: PvpGuide
	steps: RankingStep[]
	active: PvpStyleTab | null
	onStyleChange: (style: PvpStyleTab) => void
}) {
	const oshiIds = useOshiIds()
	const faces = (style: RankedStyle) =>
		umasByStars(guide.uma_recommendations.filter((row) => row.style === style))
			.flatMap((group) => group.rows)
			.slice(0, 3)
	return (
		<div className="@container mt-2">
			<ol aria-label="Style ranking" className="flex flex-col gap-1 @xl:flex-row @xl:items-stretch @xl:gap-0">
				{steps.map((step, index) => {
					const style = step.style
					const first = index === 0
					const shown = style ? faces(style) : []
					const rung = `flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border bg-gray-800 px-2.5 py-1.5 text-left @xl:flex-col @xl:items-start @xl:gap-1.5 @xl:p-2.5 ${
						style && active === style ? "border-(--style-color) ring-1 ring-inset ring-(--style-color)" : "border-gray-700"
					}`
					const body = (
						<>
							<span className="w-7 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-400 @xl:w-auto">#{index + 1}</span>
							<span className="flex min-w-0 flex-1 items-center gap-1.5 @xl:flex-none">
								{/* The colour on a dot only where the name can't carry it (the light themes, .style-dot). */}
								{style && <span aria-hidden="true" className="style-dot h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: styleColor(style) }} />}
								<span
									className={`truncate font-display font-semibold leading-tight ${style ? "style-ink" : "text-gray-200"} ${
										first ? "text-[19px] @xl:text-2xl" : "text-[17px] @xl:text-xl"
									}`}
								>
									{step.label}
								</span>
							</span>
							{shown.length > 0 && (
								<span className="flex shrink-0 gap-1">
									{shown.map((row) => (
										<FramedUma
											key={row.uma.id}
											src={row.uma.portrait ?? row.uma.image}
											alt=""
											title={row.uma.name}
											oshi={oshiIds.has(row.uma.id)}
											className={first ? "w-[1.875rem] @xl:w-10" : "w-7 @xl:w-[2.125rem]"}
										/>
									))}
								</span>
							)}
						</>
					)
					return (
						<li key={index} className="flex min-w-0 flex-col @xl:flex-1 @xl:flex-row @xl:items-stretch">
							<GapMark gap={step.gap} />
							{style ? (
								<button
									type="button"
									aria-label={`${step.label}, rank ${index + 1}`}
									aria-pressed={active === style}
									onClick={() => onStyleChange(style)}
									style={styleVar(style)}
									className={`${rung} transition hover:border-gray-500`}
								>
									{body}
								</button>
							) : (
								<div className={rung}>{body}</div>
							)}
						</li>
					)
				})}
			</ol>
		</div>
	)
}

/**
 * The short description and the meta analysis. On a phone they start at about
 * three lines with "Read more", when they run longer than that (measured once
 * the text is on screen); from sm, in full.
 */
function GuideText({ guide }: { guide: PvpGuide }) {
	const boxRef = useRef<HTMLDivElement>(null)
	const [long, setLong] = useState(false)
	const [open, setOpen] = useState(false)
	useEffect(() => {
		const box = boxRef.current
		if (box) setLong(box.scrollHeight > box.clientHeight + 1)
	}, [guide.short_description, guide.meta_analysis])
	if (!guide.short_description && !guide.meta_analysis) return null
	return (
		<>
			{/* Faded at the cut on a phone, so the clamp never ends on half a line. */}
			<div
				ref={boxRef}
				className={`text-sm ${open ? "" : "max-h-[5.25rem] overflow-hidden sm:max-h-none"} ${
					long && !open ? "max-sm:[mask-image:linear-gradient(to_bottom,black_55%,transparent)]" : ""
				}`}
			>
				{guide.short_description && (
					<MarkdownContent markdown={guide.short_description} paragraphClassName={PARAGRAPH} renderSkill={renderSkill} />
				)}
				{guide.meta_analysis && (
					<div className={guide.short_description ? "mt-3" : "mt-2"}>
						<h4 className={SUBHEADING}>Meta analysis</h4>
						<MarkdownContent markdown={guide.meta_analysis} paragraphClassName={PARAGRAPH} renderSkill={renderSkill} />
					</div>
				)}
			</div>
			{long && !open && (
				<button type="button" onClick={() => setOpen(true)} className="mt-1 text-xs font-semibold text-brand sm:hidden">
					Read more
				</button>
			)}
		</>
	)
}

// The five stats in game order, headed by the game's own stat icons
// (public/0N_CM*.png, 84px squares).
const STAT_COLUMNS: Array<{ key: keyof PvpStatConfig; label: string; icon: string }> = [
	{ key: "speed", label: "Speed", icon: "/00_CMSPEED1.png" },
	{ key: "stamina", label: "Stamina", icon: "/01_CMStamina1.png" },
	{ key: "power", label: "Power", icon: "/02_CMPOWER1.png" },
	{ key: "guts", label: "Guts", icon: "/03_CMGUTS1.png" },
	{ key: "wit", label: "Wit", icon: "/04_CMWits1.png" },
]

/**
 * "1100+" -> 1100, marks "+"; "901*+1 Gold" -> 901, marks "*", extra
 * "+1 Gold". Marks (+ and *) sit beside the number as a superscript; anything
 * longer drops to a second line. Every number therefore lands on the same
 * line across a row, whatever the cells carry besides it.
 */
function splitStat(value: string): { number: string; marks: string; extra: string } {
	// A "+" right before a digit starts the extra ("901*+1 Gold"), not a mark.
	const match = /^(\d[\d,]*)((?:[+*](?!\d))*)(.*)$/.exec(value.trim())
	return match ? { number: match[1], marks: match[2], extra: match[3].trim() } : { number: "", marks: "", extra: value.trim() }
}

function StatValue({ value, label, large = false }: { value: string; label: string; large?: boolean }) {
	// An en dash for a stat the guide says nothing about.
	if (!value) return <span className="text-gray-600">–</span>
	const { number, marks, extra } = splitStat(value)
	return (
		<span title={`${label}: ${value}`}>
			{number && (
				<span className={`font-semibold tabular-nums text-gray-100 ${large ? "font-display text-lg" : "text-[13px] sm:text-sm"}`}>
					{number}
					{marks && <sup className="ml-px text-[10px] font-medium text-gray-400">{marks}</sup>}
				</span>
			)}
			{extra && (
				<span className={number ? "block text-[10px] leading-tight text-gray-400" : "text-sm text-gray-100"}>{extra}</span>
			)}
		</span>
	)
}

/** One plain row (the whole team, no variant, no footnote): five big tiles. */
function StatTiles({ row }: { row: PvpStatConfig }) {
	return (
		<div className="mt-2 grid grid-cols-5 gap-1.5">
			{STAT_COLUMNS.map((column) => (
				<div key={column.key} className="flex flex-col items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 px-0.5 py-2 text-center">
					<img src={column.icon} alt={column.label} width={28} height={28} className="h-7 w-7" />
					<StatValue value={row[column.key] as string} label={column.label} large />
				</div>
			))}
		</div>
	)
}

/**
 * Every row the guide gives (per style, or a labelled variant such as "+ 1
 * GOLD" or "Monster": Henry, 2026-10-23, "as long as I can add more than 1 stat
 * requirement"). Squeezed to a phone's width the five columns were about 50px
 * beside the style column (design polish item 26): below sm the style column is
 * 4.75rem and the numbers 13px, and under 20rem the table scrolls sideways
 * inside the panel rather than squeezing them together.
 */
function StatTable({ rows }: { rows: PvpStatConfig[] }) {
	return (
		<div className="mt-2 overflow-x-auto">
			<table className="w-full min-w-[20rem] table-fixed border-collapse text-left">
				<thead>
					<tr className="border-b border-gray-600">
						<th className="w-[4.75rem] pb-2 align-middle text-xs font-bold uppercase tracking-wider text-gray-300 sm:w-[5.5rem]">Style</th>
						{STAT_COLUMNS.map((column) => (
							<th key={column.key} className="pb-2 text-center" title={column.label}>
								<img src={column.icon} alt={column.label} width={28} height={28} className="mx-auto h-7 w-7" />
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, index) => (
						<tr key={index} className="border-b border-gray-700/80 last:border-b-0">
							{/* align-top on every cell: the numbers share one line even
							    when a cell or the label wraps below it. */}
							<th scope="row" className="py-2 pr-1 align-top font-normal">
								<span className="block text-sm font-semibold leading-5 text-gray-100">{STYLE_LABELS[row.style]}</span>
								{row.label && <span className="block text-[11px] leading-tight text-gray-400">{row.label}</span>}
							</th>
							{STAT_COLUMNS.map((column) => (
								<td key={column.key} className="py-2 text-center align-top leading-5">
									<StatValue value={row[column.key] as string} label={column.label} />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

function Stats({ rows }: { rows: PvpStatConfig[] }) {
	// One line each under the stats, in order of first appearance.
	const footnotes = [...new Set(rows.map((row) => row.footnote).filter(Boolean))]
	const plain = rows.length === 1 && rows[0].style === "everyone" && !rows[0].label && !rows[0].footnote
	return (
		<div aria-labelledby="pvp-stats" role="group">
			<h3 id="pvp-stats" className={HEADING}>Recommended stats</h3>
			{plain ? <StatTiles row={rows[0]} /> : <StatTable rows={rows} />}
			{footnotes.length > 0 && (
				<ul className="mt-2 space-y-0.5 border-t border-gray-700/70 pt-2 text-xs text-gray-400">
					{footnotes.map((footnote) => (
						<li key={footnote}>
							<InlineNote text={footnote} />
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

/** A comp's places, each in its style's colour; a place two styles share is split corner to corner. */
function CompPlaces({ text }: { text: string }) {
	const places = parseTeamComp(text)
	if (!places) return null
	return (
		<span aria-hidden="true" className="flex shrink-0 gap-0.5">
			{places.map((styles, index) => (
				<span
					key={index}
					className="grid h-5 w-5 place-items-center rounded text-[9px] font-bold text-black/75"
					style={{
						background:
							styles.length > 1
								? `linear-gradient(135deg, ${styleColor(styles[0])} 50%, ${styleColor(styles[1])} 50%)`
								: styleColor(styles[0]),
					}}
				>
					{styles.map((style) => STYLE_LABELS[style][0]).join("")}
				</span>
			))}
		</span>
	)
}

export function GuideBand({ guide, active, onStyleChange }: {
	guide: PvpGuide
	/** The style tab on screen, for the ladder's pressed step. */
	active: PvpStyleTab | null
	onStyleChange: (style: PvpStyleTab) => void
}) {
	const steps = parseStyleRanking(guide.style_ranking)
	const hasLeft = steps.length > 0 || Boolean(guide.short_description || guide.meta_analysis)
	const hasRight = guide.stat_configs.length > 0 || guide.scenario !== null || guide.team_comps.length > 0
	if (!hasLeft && !hasRight) return null
	return (
		<div className={hasLeft && hasRight ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : "flex flex-col gap-4"}>
			{hasLeft && (
				<section className={SECTION} aria-labelledby="pvp-ranking">
					<h3 id="pvp-ranking" className={HEADING}>{steps.length > 0 ? "Style ranking" : "About this guide"}</h3>
					{steps.length > 0 && <Ladder guide={guide} steps={steps} active={active} onStyleChange={onStyleChange} />}
					<div className={steps.length > 0 ? "mt-1" : ""}>
						<GuideText guide={guide} />
					</div>
				</section>
			)}
			{hasRight && (
				<section className={`${SECTION} flex flex-col divide-y divide-gray-700/70 [&>*]:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0`} aria-label="For the whole team">
					{guide.stat_configs.length > 0 && <Stats rows={guide.stat_configs} />}
					{guide.scenario && (
						<div role="group" aria-labelledby="pvp-scenario">
							<h3 id="pvp-scenario" className={HEADING}>Scenario</h3>
							<div className="mt-2 flex items-center gap-3">
								{guide.scenario.image && (
									<img src={guide.scenario.image} alt="" className="h-12 w-20 shrink-0 rounded-md border border-gray-700 object-cover" loading="lazy" decoding="async" />
								)}
								<div className="min-w-0">
									<div className="font-semibold text-gray-100">{guide.scenario.name}</div>
									<div className="text-xs text-gray-400">
										Cards marked{" "}
										<span className="rounded bg-brand px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-black">Link</span>{" "}
										are linked to it.
									</div>
								</div>
							</div>
						</div>
					)}
					{guide.team_comps.length > 0 && (
						<div role="group" aria-labelledby="pvp-team-comps">
							<h3 id="pvp-team-comps" className={`flex items-center gap-1.5 ${HEADING}`}>
								<Users className="h-4 w-4" />
								Team comps
							</h3>
							<ul className="mt-2 space-y-1.5 text-sm text-gray-300">
								{guide.team_comps.map((comp, index) => (
									<li key={index} className="flex items-center gap-2.5">
										<CompPlaces text={comp.text} />
										<span className="min-w-0">
											<span className="font-medium text-gray-100">{comp.text}</span>
											{comp.note && (
												<>
													<span className="text-gray-500"> · </span>
													<InlineNote text={comp.note} />
												</>
											)}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</section>
			)}
		</div>
	)
}
