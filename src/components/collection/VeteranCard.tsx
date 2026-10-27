/**
 * One veteran's card on the Collection page, laid out like the game's own
 * veteran screen (owner, 2026-10-27; the mockup is linked from
 * notes/collection-redesign-plan.md): who she is and her grade, her five
 * stats, her ten aptitudes, then three tabs, Skills, Sparks and Training.
 *
 * Opening her card fetches her full record once (useVeteran: her raw game
 * data and the names of her sparks, GET /trained-umas/<id>); the list never
 * carries it. Everything read from the game data goes through
 * utils/veteranGameData.ts. A hand entry has no game data, so its Sparks and
 * Training tabs say so and offer the import.
 *
 * The per-stat letters the game prints (an "A" beside 850 Speed) are left out
 * until the owner confirms the ladder: the game data has no table for them,
 * and a wrong letter is worse than none (utils/veteranGrade.ts says the same
 * of the overall grade).
 *
 * Inside the /app loading gate, so the Copy link handler may read `window`.
 */

import { useId, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { ArrowLeft, ChevronUp, FileUp, Link2, Loader2, Pencil, Trash2 } from "lucide-react"
import { FramedUma } from "../FramedUma"
import { ACTION_BUTTON } from "../pvp/gallery/galleryStyles"
import { FlagChip, GradeBadge } from "./veteranBadges"
import { STAT_COLORS, cardFlags, gradeTier } from "../../utils/veteranLook"
import { useVeteran } from "../../services/trainedUmaQueries"
import { aptitudeLetter } from "../../utils/courseAptitude"
import { formatDate } from "../../utils/dateFormat"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import { limitBreakLabel } from "../../utils/roster"
import { APTITUDE_GROUPS, STAT_KEYS, STAT_LABELS, isUniqueSkill } from "../../utils/trainedUmas"
import { formatScore, gradeLabel } from "../../utils/veteranGrade"
import { legacyOf, readVeteranGame, statSpark, type Parent, type Spark, type VeteranGame } from "../../utils/veteranGameData"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import type { CatalogueSkill, CatalogueSupportCard, CatalogueUma } from "../../types/pvpTeam"
import type { TrainedUma } from "../../types/trainedUma"

/** The catalogue by the GAME's ids: her lineage names outfits, her deck cards, by those. */
export interface GameIdIndex {
	umas: ReadonlyMap<number, CatalogueUma>
	cards: ReadonlyMap<number, CatalogueSupportCard>
}

type CardTab = "skills" | "sparks" | "training"

/** Where a stat bar is full: the cap in most scenarios. Higher stats fill it. */
const STAT_BAR_FULL = 1200

/** An inset surface inside the card; each use adds its own corner. */
const INSET = "border border-edge bg-gray-900/40"
/** A section heading inside a tab; each use adds its own spacing. */
const HEADING = "text-[11px] font-bold uppercase tracking-wider text-gray-400"

export function VeteranCard({ veteran, index, byGameId, oshiIds, onBack, onEdit, onDelete, onImport }: {
	veteran: TrainedUma
	index: PvpCatalogueIndex
	byGameId: GameIdIndex
	oshiIds: ReadonlySet<number>
	/** Back to the list, on a phone (the list and her card don't fit side by side). */
	onBack: () => void
	onEdit: () => void
	onDelete: () => void
	onImport: () => void
}) {
	const [tab, setTab] = useState<CardTab>("skills")
	const ids = useId()
	const detail = useVeteran(veteran.has_game_data ? veteran.id : null)
	const game = useMemo(
		() => (detail.data ? readVeteranGame(detail.data.game_data, detail.data.sparks) : null),
		[detail.data]
	)
	const uma = index.umasById.get(veteran.uma)
	const name = uma?.name ?? "Unknown uma"
	const grade = gradeLabel(veteran.rank_grade)
	const fromGame = veteran.source === "import"

	const tabs: Array<{ id: CardTab; label: string; count: string }> = [
		{ id: "skills", label: "Skills", count: String(veteran.skills.length) },
		{ id: "sparks", label: "Sparks", count: game ? String(game.sparks.length) : "" },
		{ id: "training", label: "Training", count: "" },
	]

	return (
		<article className="card-panel overflow-hidden" aria-labelledby={`${ids}-name`}>
			<div className="grade-band h-1" data-tier={gradeTier(grade)} />
			<div className="px-4 pt-3 lg:hidden">
				<button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-brand">
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					All veterans
				</button>
			</div>

			<div className="flex items-start gap-4 px-4 pb-3 pt-4 sm:px-5">
				<FramedUma src={uma?.portrait ?? null} oshi={oshiIds.has(veteran.uma)} alt="" className="w-20 shrink-0 sm:w-26" />
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<h2 id={`${ids}-name`} className="font-display text-xl font-bold leading-tight text-gray-100 sm:text-2xl">
						{name}
					</h2>
					{veteran.label && (
						<span className="self-start rounded-md bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">{veteran.label}</span>
					)}
					<p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-300">
						{game?.runningStyle && (
							<span className="inline-flex items-center gap-1.5">
								<span
									className="h-2 w-2 rounded-full"
									style={{ background: `var(--color-style-${game.runningStyle})` }}
									aria-hidden="true"
								/>
								{STYLE_LABELS[game.runningStyle]}
							</span>
						)}
						{game?.scenario && <span>{game.scenario}</span>}
						<span>{veteran.trained_at ? `Trained ${formatDate(veteran.trained_at)}` : `Added ${formatDate(veteran.created_at)}`}</span>
					</p>
				</div>
				{veteran.rank_score != null && (
					<div className="flex min-w-16 shrink-0 flex-col items-center gap-0.5">
						{grade && <GradeBadge grade={grade} className={`h-12 w-14 sm:h-14 sm:w-16 ${grade.length > 2 ? "text-base" : "text-2xl"}`} />}
						<span className="font-display mt-1 text-base font-bold text-gray-100">{formatScore(veteran.rank_score)}</span>
						<span className="text-[11px] text-gray-400">Evaluation</span>
					</div>
				)}
			</div>

			<div className="flex flex-wrap gap-1.5 px-4 pb-3 sm:px-5">
				{cardFlags(veteran).map((flag) => (
					<FlagChip key={flag.text} tone={flag.tone} title={flag.title}>
						{flag.text}
					</FlagChip>
				))}
			</div>
			{veteran.memo && (
				<p className="px-4 pb-3 text-sm text-gray-200 sm:px-5">
					<span className="text-gray-400">Your memo in the game: </span>
					<em>{veteran.memo}</em>
				</p>
			)}

			<Stats veteran={veteran} />
			<Aptitudes veteran={veteran} uma={uma} />

			<div role="tablist" aria-label="Her details" className="flex gap-1 border-b border-edge px-4 sm:px-5">
				{tabs.map((entry) => (
					<button
						key={entry.id}
						type="button"
						role="tab"
						id={`${ids}-tab-${entry.id}`}
						aria-selected={tab === entry.id}
						aria-controls={`${ids}-panel`}
						onClick={() => setTab(entry.id)}
						className={`-mb-px min-h-11 border-b-2 px-3 text-sm font-semibold transition ${
							tab === entry.id ? "border-brand text-brand" : "border-transparent text-gray-300 hover:text-gray-100"
						}`}
					>
						{entry.label} {entry.count && <span className="text-xs font-medium text-gray-400">{entry.count}</span>}
					</button>
				))}
			</div>
			<div role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-tab-${tab}`} className="px-4 py-4 sm:px-5">
				{tab === "skills" ? (
					<Skills veteran={veteran} index={index} />
				) : !fromGame ? (
					<FromTheGame onImport={onImport}>
						{tab === "sparks"
							? "Sparks and lineage come from the game's export, so a hand entry doesn't have them."
							: "Her training deck and race results come from the game's export, so a hand entry doesn't have them."}
					</FromTheGame>
				) : detail.isError ? (
					<p className="text-sm text-gray-300">Her details didn&apos;t load. Open her again to retry.</p>
				) : !game ? (
					<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading her details…
					</p>
				) : tab === "sparks" ? (
					<Sparks game={game} byGameId={byGameId} oshiIds={oshiIds} />
				) : (
					<Training veteran={veteran} game={game} byGameId={byGameId} />
				)}
			</div>

			{/* Keyed so a "Delete her?" left open on one veteran never carries to the next. */}
			<Footer key={veteran.id} veteran={veteran} onEdit={onEdit} onDelete={onDelete} />
		</article>
	)
}

function Stats({ veteran }: { veteran: TrainedUma }) {
	return (
		<div className="grid grid-cols-5 gap-1.5 px-4 sm:px-5">
			{STAT_KEYS.map((key) => (
				<div key={key} className={`min-w-0 overflow-hidden rounded-xl border-t-2 ${INSET}`} style={{ borderTopColor: STAT_COLORS[key] }}>
					<div className="truncate pt-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">{STAT_LABELS[key]}</div>
					<div className="font-display text-center text-base font-bold tabular-nums text-gray-100 sm:text-lg">{veteran[key]}</div>
					<div className="mx-2 mb-2 mt-1 h-1 overflow-hidden rounded-full bg-gray-700" aria-hidden="true">
						<div
							className="h-full rounded-full"
							style={{ width: `${Math.min(100, (veteran[key] / STAT_BAR_FULL) * 100)}%`, background: STAT_COLORS[key] }}
						/>
					</div>
				</div>
			))}
		</div>
	)
}

/** The game's tone for a letter: A and S stand out, D and below warn. */
function letterTone(value: number | null): string {
	if (value == null) return "text-gray-500"
	if (value >= 7) return "text-brand"
	if (value <= 4) return "text-highlight"
	return "text-gray-200"
}

function Aptitudes({ veteran, uma }: { veteran: TrainedUma; uma: CatalogueUma | undefined }) {
	return (
		<div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
			{APTITUDE_GROUPS.map((group) => (
				<div key={group.label} className="flex flex-col gap-1 sm:grid sm:grid-cols-[4.5rem_1fr] sm:items-center sm:gap-2">
					<span className="text-xs text-gray-400">{group.label}</span>
					<div className="grid grid-cols-4 gap-1.5">
						{group.keys.map(({ key, label }) => {
							const value = veteran.apt[key]
							const base = uma?.apt[key] ?? null
							const letter = aptitudeLetter(value) ?? "–"
							const raised = value != null && base != null && value > base
							return (
								<div
									key={key}
									title={raised ? `${label} ${letter}, raised from ${aptitudeLetter(base)} by inheritance` : `${label} ${letter}`}
									className={`flex min-w-0 items-center justify-between gap-1 rounded-lg px-2 py-1 text-xs text-gray-200 ${INSET}`}
								>
									<span className="truncate">{label}</span>
									<span className="flex items-center">
										{raised && (
											<>
												<ChevronUp className="h-3 w-3 text-brand" strokeWidth={3} aria-hidden="true" />
												<span className="sr-only">raised by inheritance, </span>
											</>
										)}
										<b className={`font-display text-sm ${letterTone(value)}`}>{letter}</b>
									</span>
								</div>
							)
						})}
					</div>
				</div>
			))}
		</div>
	)
}

/** Unique first, then evolved, gold, white: the order the game lists a veteran's skills in. */
function skillRank(skill: CatalogueSkill): number {
	if (isUniqueSkill(skill)) return 0
	if (skill.rarity === 6) return 1
	if (skill.rarity === 2) return 2
	return 3
}

const SKILL_SURFACES = [
	"col-span-full border border-step-up-border/70 bg-step-up/10 text-gray-100",
	"skill-evolved border",
	"skill-gold border",
	"border border-edge bg-gray-900/40 text-gray-200",
]

function Skills({ veteran, index }: { veteran: TrainedUma; index: PvpCatalogueIndex }) {
	const skills = veteran.skills
		.flatMap((entry) => {
			const skill = index.skillsById.get(entry.skill)
			return skill ? [{ skill, level: entry.level, rank: skillRank(skill) }] : []
		})
		.sort((a, b) => a.rank - b.rank)
	if (skills.length === 0) return <p className="text-sm text-gray-400">No skills on her.</p>
	const count = (rank: number) => skills.filter((entry) => entry.rank === rank).length
	const parts = [
		`${count(0)} unique`,
		...(count(1) ? [`${count(1)} evolved`] : []),
		`${count(2)} gold`,
		`${count(3)} white`,
	]
	return (
		<div className="flex flex-col gap-2.5">
			<p className="text-xs text-gray-400">
				{skills.length} {skills.length === 1 ? "skill" : "skills"}: {parts.join(", ")}
			</p>
			<ul className="grid gap-1.5 sm:grid-cols-2">
				{skills.map(({ skill, level, rank }) => (
					<li
						key={skill.id}
						title={skill.description || skill.name}
						className={`flex min-w-0 items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 ${SKILL_SURFACES[rank]}`}
					>
						{skill.image ? (
							<img src={skill.image} alt="" loading="lazy" decoding="async" className="h-7 w-7 shrink-0" />
						) : (
							<span className="h-7 w-7 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
						)}
						<span className="min-w-0 flex-1 truncate text-sm">{skill.name}</span>
						{rank === 0 && <span className="shrink-0 text-[11px] font-bold text-gray-300">Unique · Lv {level}</span>}
					</li>
				))}
			</ul>
		</div>
	)
}

function Stars({ count }: { count: number }) {
	return (
		<>
			<span className="tracking-tighter text-brand" aria-hidden="true">
				{"★".repeat(count)}
			</span>
			<span className="sr-only">, {count === 1 ? "1 star" : `${count} stars`}</span>
		</>
	)
}

function SparkChip({ spark, small = false }: { spark: Spark; small?: boolean }) {
	return (
		<span
			className={`spark-chip inline-flex max-w-full items-center gap-1 rounded-full text-gray-100 ${small ? "px-2 py-px text-[11px]" : "px-2.5 py-0.5 text-xs"}`}
			data-spark={spark.kind}
		>
			<span className="truncate">{spark.name}</span>
			<Stars count={spark.stars} />
		</span>
	)
}

/** The colored ones (stat, aptitude, unique): what a parent's row shows by name. */
const isColored = (spark: Spark) => spark.kind === "stat" || spark.kind === "aptitude" || spark.kind === "unique"
const sparkCount = (count: number, what: string) => `${count} ${what} ${count === 1 ? "spark" : "sparks"}`

function Sparks({ game, byGameId, oshiIds }: { game: VeteranGame; byGameId: GameIdIndex; oshiIds: ReadonlySet<number> }) {
	const legacy = legacyOf(game)
	const across = game.parents.length === 2 ? "across the three of them" : game.parents.length === 1 ? "across the two of them" : "on her own"
	return (
		<div className="flex flex-col gap-4">
			<section>
				<h3 className={`mb-2 ${HEADING}`}>Her sparks</h3>
				<div className="flex flex-wrap gap-1.5">
					{game.sparks.map((spark) => (
						<SparkChip key={spark.id} spark={spark} />
					))}
				</div>
				{game.unknownSparks > 0 && (
					<p className="mt-2 text-xs text-gray-400">
						{game.unknownSparks === 1 ? "1 spark" : `${game.unknownSparks} sparks`} the site doesn&apos;t know yet, from a new uma or skill.
					</p>
				)}
			</section>

			<section className={`rounded-xl p-3 ${INSET}`}>
				<h3 className={`mb-0.5 ${HEADING}`}>As a parent she passes on</h3>
				<p className="mb-2.5 text-xs text-gray-400">Her sparks plus her two parents&apos;, the way the game counts a legacy.</p>
				<div className="flex flex-wrap gap-1.5">
					{legacy.totals.map((total) => (
						<span key={`${total.kind}:${total.name}`} className="spark-chip inline-flex items-baseline gap-1.5 rounded-lg px-3 py-1 text-sm text-gray-100" data-spark={total.kind}>
							<b className="font-display text-base">{total.stars}★</b>
							{total.name}
						</span>
					))}
				</div>
				<p className="mt-2.5 text-xs text-gray-300">
					{sparkCount(legacy.uniques, "unique")} and {sparkCount(legacy.whites, "white")} {across}
				</p>
			</section>

			{game.parents.length > 0 && (
				<section>
					<h3 className={`mb-2 ${HEADING}`}>Lineage</h3>
					<div className="grid gap-2.5 sm:grid-cols-2">
						{game.parents.map((parent) => (
							<ParentCard key={parent.position} parent={parent} byGameId={byGameId} oshiIds={oshiIds} />
						))}
					</div>
				</section>
			)}

			<ul className="flex flex-wrap gap-3 text-[11px] text-gray-400" aria-label="Spark colours">
				{([["stat", "Stat"], ["aptitude", "Aptitude"], ["unique", "Unique skill"], ["skill", "Skill, race or scenario"]] as const).map(([kind, label]) => (
					<li key={kind} className="inline-flex items-center gap-1.5" data-spark={kind}>
						<span className="spark-dot h-2 w-2 rounded-full" aria-hidden="true" />
						{label}
					</li>
				))}
			</ul>
		</div>
	)
}

function ParentCard({ parent, byGameId, oshiIds }: { parent: Parent; byGameId: GameIdIndex; oshiIds: ReadonlySet<number> }) {
	const uma = parent.cardId === null ? undefined : byGameId.umas.get(parent.cardId)
	const grade = gradeLabel(parent.grade)
	const whites = parent.sparks.filter((spark) => !isColored(spark)).length
	return (
		<div className={`flex min-w-0 flex-col gap-2 rounded-xl p-2.5 ${INSET}`}>
			<div className="flex min-w-0 items-center gap-2.5">
				<FramedUma src={uma?.portrait ?? null} oshi={uma ? oshiIds.has(uma.id) : false} alt="" className="w-11 shrink-0" />
				<span className="flex min-w-0 flex-col">
					<span className="truncate text-sm font-semibold text-gray-100">{uma?.name ?? "Unknown uma"}</span>
					<span className="text-xs text-gray-400">{grade ? `Parent · ${grade}` : "Parent"}</span>
				</span>
			</div>
			<div className="flex flex-wrap gap-1">
				{parent.sparks.filter(isColored).map((spark) => (
					<SparkChip key={spark.id} spark={spark} small />
				))}
			</div>
			{whites > 0 && <span className="text-[11px] text-gray-400">+ {sparkCount(whites, "white")}</span>}
			{parent.grandparents.length > 0 && (
				<ul className="flex flex-col gap-1.5 border-t border-edge pt-2">
					{parent.grandparents.map((grandparent) => {
						const gpUma = grandparent.cardId === null ? undefined : byGameId.umas.get(grandparent.cardId)
						const blue = statSpark(grandparent)
						return (
							<li key={grandparent.position} className="flex min-w-0 items-center gap-2 text-xs text-gray-300">
								<FramedUma src={gpUma?.portrait ?? null} oshi={gpUma ? oshiIds.has(gpUma.id) : false} alt="" className="w-6.5 shrink-0" />
								<span className="min-w-0 flex-1 truncate">{gpUma?.name ?? "Unknown uma"}</span>
								{blue && (
									<span className="shrink-0 whitespace-nowrap">
										{blue.name} <Stars count={blue.stars} />
									</span>
								)}
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}

function Training({ veteran, game, byGameId }: { veteran: TrainedUma; game: VeteranGame; byGameId: GameIdIndex }) {
	const wins = game.places.filter((place) => place === 1).length
	const facts = [
		{ label: "Scenario", value: game.scenario },
		{ label: "Fans", value: game.fans === null ? null : game.fans.toLocaleString("en-US") },
		{ label: "Titles won", value: game.titles === null ? null : String(game.titles) },
		{ label: "Trained", value: veteran.trained_at ? formatDate(veteran.trained_at) : null },
	].filter((fact): fact is { label: string; value: string } => fact.value !== null)
	return (
		<div className="flex flex-col gap-4">
			{game.deck.length > 0 && (
				<section>
					<h3 className={`mb-2 ${HEADING}`}>Training deck</h3>
					<ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
						{game.deck.map((slot) => {
							const card = byGameId.cards.get(slot.cardId)
							const label = limitBreakLabel(slot.limitBreak)
							return (
								<li key={slot.position} className="flex min-w-0 flex-col items-center gap-1">
									{card?.image ? (
										<img
											src={card.image}
											alt={`${card.name}${card.title ? ` (${card.title})` : ""}, ${label}`}
											loading="lazy"
											decoding="async"
											className="aspect-[3/4] w-full rounded object-cover"
										/>
									) : (
										<span className="flex aspect-[3/4] w-full items-center justify-center rounded bg-gray-700 p-1 text-center text-[10px] text-gray-400">
											{card?.name ?? "Unknown card"}
										</span>
									)}
									<span className="flex gap-1 py-0.5" aria-hidden="true">
										{[0, 1, 2, 3].map((pip) => (
											<span key={pip} className={`h-1.5 w-1.5 rotate-45 ${pip < slot.limitBreak ? "bg-brand" : "bg-gray-600"}`} />
										))}
									</span>
									<span className={`text-[11px] font-bold ${slot.limitBreak >= 4 ? "text-brand" : "text-gray-400"}`} aria-hidden="true">
										{label}
									</span>
								</li>
							)
						})}
					</ul>
				</section>
			)}

			<section>
				<h3 className={`mb-2 ${HEADING}`}>Career</h3>
				{game.places.length === 0 ? (
					<p className="text-sm text-gray-400">No races in the file.</p>
				) : (
					<>
						<p className="mb-2 flex items-baseline gap-2">
							<span className="font-display text-xl font-bold text-gray-100">{wins === 1 ? "1 win" : `${wins} wins`}</span>
							<span className="text-sm text-gray-400">from {game.places.length} races</span>
						</p>
						<div role="img" aria-label={`Finishing places, in order: ${game.places.join(", ")}`} className="flex flex-wrap gap-1">
							{game.places.map((place, position) => (
								<span
									key={position}
									className="place-square flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold"
									data-place={place <= 3 ? place : undefined}
									aria-hidden="true"
								>
									{place}
								</span>
							))}
						</div>
					</>
				)}
			</section>

			{facts.length > 0 && (
				<dl className="grid grid-cols-2 gap-2">
					{facts.map((fact) => (
						<div key={fact.label} className={`rounded-xl px-3 py-2 ${INSET}`}>
							<dt className="text-[11px] text-gray-400">{fact.label}</dt>
							<dd className="text-sm font-semibold text-gray-100">{fact.value}</dd>
						</div>
					))}
				</dl>
			)}
		</div>
	)
}

function FromTheGame({ onImport, children }: { onImport: () => void; children: ReactNode }) {
	return (
		<div className="flex flex-col items-start gap-2.5 rounded-xl border border-dashed border-gray-600 p-4">
			<p className="text-sm text-gray-200">{children}</p>
			<button type="button" className={ACTION_BUTTON} onClick={onImport}>
				<FileUp className="h-4 w-4" />
				Import from the game
			</button>
		</div>
	)
}

function Footer({ veteran, onEdit, onDelete }: { veteran: TrainedUma; onEdit: () => void; onDelete: () => void }) {
	const [confirming, setConfirming] = useState(false)
	const copyLink = async () => {
		// Read at click time, so a link copied on a local dev server points at it.
		const url = `${window.location.origin}/app/collection?veteran=${veteran.id}`
		try {
			await navigator.clipboard.writeText(url)
			toast.success("Link copied.")
		} catch {
			// No clipboard access (an insecure origin, or a refused permission).
			toast(url)
		}
	}
	return (
		<div className="flex flex-wrap items-center gap-2 border-t border-edge bg-gray-900/40 px-4 py-3 sm:px-5">
			<button type="button" className={ACTION_BUTTON} onClick={onEdit}>
				<Pencil className="h-4 w-4" />
				{veteran.source === "import" ? "Edit label" : "Edit"}
			</button>
			<button type="button" className={ACTION_BUTTON} onClick={() => void copyLink()}>
				<Link2 className="h-4 w-4" />
				Copy link
			</button>
			<span className="flex-1" />
			{confirming ? (
				<button
					type="button"
					className={`${ACTION_BUTTON} border-highlight/60 text-highlight`}
					onClick={onDelete}
					onBlur={() => setConfirming(false)}
				>
					Delete her?
				</button>
			) : (
				<button type="button" className={`${ACTION_BUTTON} border-highlight/50 text-highlight`} onClick={() => setConfirming(true)}>
					<Trash2 className="h-4 w-4" />
					Delete
				</button>
			)}
		</div>
	)
}
