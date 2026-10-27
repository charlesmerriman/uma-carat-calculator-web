/**
 * The Collection's veterans as tiles, with the search, the Uma filter, the
 * sort and the "A or better at" chips above them. A tile is a button: tapping
 * one opens her card (VeteranCard.tsx) beside the list on a wide screen, in
 * its place on a phone. The filtering is utils/veteranList.ts.
 *
 * A tile tells two veterans of one uma apart at a glance: her label or game
 * memo (else the uma's name, with the outfit on its own line so a narrow tile
 * never cuts it off), the game's grade and score (the way the game names
 * one), and her five stats in their colours. Every uma is FramedUma, the
 * rainbow frame for a favorite.
 */

import { Search } from "lucide-react"
import { FramedUma } from "../FramedUma"
import { FlagChip, GradeBadge } from "./veteranBadges"
import { STAT_COLORS, tileFlag, tileLines } from "../../utils/veteranLook"
import { formatScore, gradeLabel, statsTitle } from "../../utils/veteranGrade"
import { STAT_KEYS, STAT_LABELS } from "../../utils/trainedUmas"
import { GOOD_AT, VETERAN_SORTS, umaChoices, type VeteranFilter, type VeteranSort } from "../../utils/veteranList"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import type { TrainedUma } from "../../types/trainedUma"

const CONTROL =
	"min-h-9 rounded-lg border border-gray-600 bg-gray-800 px-2.5 text-sm text-gray-100 focus:border-brand focus:outline-none"

export function VeteranList({ veterans, shown, filter, onFilter, index, oshiIds, openId, onOpen }: {
	/** Every veteran, for the Uma filter's choices and the count. */
	veterans: TrainedUma[]
	/** The ones the filter lets through, in order (utils/veteranList.ts shownVeterans). */
	shown: TrainedUma[]
	filter: VeteranFilter
	onFilter: (filter: VeteranFilter) => void
	index: PvpCatalogueIndex
	oshiIds: ReadonlySet<number>
	/** The veteran whose card is open, ringed. */
	openId: number | null
	onOpen: (veteran: TrainedUma) => void
}) {
	const umaName = (uma: number) => index.umasById.get(uma)?.name ?? "Unknown uma"
	const choices = umaChoices(veterans, umaName)
	return (
		<section className="flex min-w-0 flex-col gap-3" aria-label="Your veterans">
			<div className="flex flex-wrap items-center gap-2">
				<label className="relative min-w-0 flex-[1_1_15rem]">
					<span className="sr-only">Search veterans</span>
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
					<input
						type="search"
						value={filter.query}
						onChange={(change) => onFilter({ ...filter, query: change.target.value })}
						placeholder="Search a name, label or memo"
						className={`${CONTROL} w-full pl-9`}
					/>
				</label>
				<label className="flex items-center gap-2 text-sm text-gray-400">
					Uma
					<select
						value={filter.uma ?? ""}
						onChange={(change) => onFilter({ ...filter, uma: change.target.value ? Number(change.target.value) : null })}
						className={`${CONTROL} max-w-48`}
					>
						<option value="">All umas</option>
						{choices.map((choice) => (
							<option key={choice.uma} value={choice.uma}>
								{choice.name} ({choice.count})
							</option>
						))}
					</select>
				</label>
				<label className="flex items-center gap-2 text-sm text-gray-400">
					Sort
					<select
						value={filter.sort}
						onChange={(change) => onFilter({ ...filter, sort: change.target.value as VeteranSort })}
						className={CONTROL}
					>
						{VETERAN_SORTS.map((sort) => (
							<option key={sort.key} value={sort.key}>
								{sort.label}
							</option>
						))}
					</select>
				</label>
			</div>
			<div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="A or better at">
				<span className="mr-0.5 text-xs text-gray-400">A or better at</span>
				{GOOD_AT.map((entry) => {
					const on = filter.goodAt === entry.key
					return (
						<button
							key={entry.key}
							type="button"
							aria-pressed={on}
							onClick={() => onFilter({ ...filter, goodAt: on ? null : entry.key })}
							className={`min-h-8 rounded-full border px-3 text-xs font-semibold transition ${
								on ? "border-brand bg-brand/15 text-brand" : "border-gray-600 text-gray-200 hover:border-gray-500"
							}`}
						>
							{entry.label}
						</button>
					)
				})}
				<span className="ml-auto text-xs text-gray-400">
					{shown.length === veterans.length ? `Showing all ${veterans.length}` : `Showing ${shown.length} of ${veterans.length}`}
				</span>
			</div>

			{shown.length === 0 ? (
				<p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">
					No veteran matches. Clear the search or the filter to see them all.
				</p>
			) : (
				<ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2.5">
					{shown.map((veteran) => (
						<li key={veteran.id}>
							<VeteranTile
								veteran={veteran}
								umaName={umaName(veteran.uma)}
								portrait={index.umasById.get(veteran.uma)?.portrait ?? null}
								oshi={oshiIds.has(veteran.uma)}
								open={veteran.id === openId}
								onOpen={() => onOpen(veteran)}
							/>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}

function VeteranTile({ veteran, umaName, portrait, oshi, open, onOpen }: {
	veteran: TrainedUma
	umaName: string
	portrait: string | null
	oshi: boolean
	open: boolean
	onOpen: () => void
}) {
	const grade = gradeLabel(veteran.rank_grade)
	const flag = tileFlag(veteran)
	const { title, sub } = tileLines(veteran, umaName)
	return (
		<button
			type="button"
			id={`veteran-${veteran.id}`}
			aria-pressed={open}
			onClick={onOpen}
			className={`flex w-full min-w-0 items-center gap-3 rounded-xl border p-2.5 pr-3 text-left transition ${
				open ? "border-brand bg-brand/10 ring-1 ring-brand" : "border-edge bg-(--card-fill) hover:border-gray-500"
			}`}
		>
			<span className="relative shrink-0">
				<FramedUma src={portrait} oshi={oshi} alt="" className="w-15" />
				{grade && (
					<GradeBadge
						grade={grade}
						className={`absolute -bottom-1.5 -left-1.5 h-7 w-8 ${grade.length > 2 ? "text-[10px]" : "text-xs"}`}
					/>
				)}
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-px">
				<span className="truncate text-sm font-semibold text-gray-100">{title}</span>
				<span className="truncate text-xs text-gray-400">{sub}</span>
				{veteran.rank_score != null && (
					<span className="font-display mt-0.5 text-[15px] font-bold text-gray-100">{formatScore(veteran.rank_score)}</span>
				)}
				{/* Her stats in the game's order, each over its colour, so they fit one line. */}
				<span className="mt-1 grid grid-cols-5 gap-0.5" title={statsTitle(veteran)}>
					{STAT_KEYS.map((key) => (
						<span
							key={key}
							className="border-t-2 pt-0.5 text-center text-[10.5px] font-semibold tabular-nums text-gray-200"
							style={{ borderTopColor: STAT_COLORS[key] }}
						>
							<span className="sr-only">{STAT_LABELS[key]} </span>
							{veteran[key]}
						</span>
					))}
				</span>
				{flag && (
					<FlagChip tone={flag.tone} title={flag.title} className="mt-1 self-start">
						{flag.text}
					</FlagChip>
				)}
			</span>
		</button>
	)
}
