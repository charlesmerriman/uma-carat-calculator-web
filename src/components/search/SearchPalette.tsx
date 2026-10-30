/**
 * The search box Ctrl+K opens (cmdk for the list's keyboard handling, Fuse for
 * the matching: utils/siteSearch.ts). Its data loads when it opens. Inside /app
 * the banners and events are already in context. Outside, they come from the
 * same prefetch the navbar's links start, so opening search on the home page
 * and then going to the calculator costs one request, not two. The skills come
 * from the public PvP catalogue, cached for the session.
 *
 * Either source failing only leaves its results out: pages always work.
 */

import { useEffect, useMemo, useState } from "react"
import { Command } from "cmdk"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, CalendarDays, FileText, Loader2, Search, Sparkles, Swords } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { readCalculatorCatalogue } from "../../services/calculatorFetchCalls"
import { loadPvpCatalogue } from "../../services/pvpTeamFetchCalls"
import { useOshiIds } from "../../hooks/useOshiIds"
import { raceEventsInOrder } from "../../utils/pvpGuide"
import { buildSearchEntries, createSearcher, pageEntries, skillTeachers, type SearchEntry, type SearchSources } from "../../utils/siteSearch"
import { FramedUma } from "../FramedUma"
import type { CalculatorData } from "../../types"
import type { PvpCatalogue } from "../../types/pvpTeam"

const ICONS = { page: FileText, banner: CalendarDays, event: Swords, skill: Sparkles, uma: Sparkles, card: Sparkles }

const ITEM = "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left data-[selected=true]:bg-gray-700"

function EntryArt({ entry, oshiIds }: { entry: SearchEntry; oshiIds: ReadonlySet<number> }) {
	if (entry.umaId !== undefined) return <FramedUma src={entry.image ?? null} oshi={oshiIds.has(entry.umaId)} alt="" className="w-9 shrink-0" />
	if (entry.image) return <img src={entry.image} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-md object-contain" />
	const Icon = ICONS[entry.kind]
	return (
		<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-900/70 text-gray-400">
			<Icon className="h-4 w-4" aria-hidden="true" />
		</span>
	)
}

/** A skill has no page, so picking one shows this. */
function SkillPanel({ entry, catalogue, onBack }: { entry: SearchEntry; catalogue: PvpCatalogue | null; onBack: () => void }) {
	const teachers = catalogue && entry.skillId !== undefined ? skillTeachers(entry.skillId, catalogue) : { umas: [], cards: [] }
	return (
		<div className="flex flex-col gap-3 p-4">
			<button type="button" onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm text-gray-300 transition hover:text-gray-100">
				<ArrowLeft className="h-4 w-4" aria-hidden="true" />
				Back to results
			</button>
			<div>
				<h2 className="font-semibold text-gray-50">{entry.title}</h2>
				<p className="mt-1 text-sm text-gray-300">{entry.detail}</p>
			</div>
			{teachers.umas.length > 0 && (
				<p className="text-sm text-gray-300">
					<span className="font-semibold text-gray-100">Umas: </span>
					{teachers.umas.join(", ")}
				</p>
			)}
			{teachers.cards.length > 0 && (
				<p className="text-sm text-gray-300">
					<span className="font-semibold text-gray-100">Support cards: </span>
					{teachers.cards.join(", ")}
				</p>
			)}
		</div>
	)
}

export default function SearchPalette({ onClose }: { onClose: () => void }) {
	const navigate = useNavigate()
	const { account } = useAccount()
	const earlyAccess = Boolean(account?.early_access)
	const inApp = useCalculatorDataSafe()
	const oshiIds = useOshiIds()
	const [query, setQuery] = useState("")
	const [payload, setPayload] = useState<CalculatorData | null>(null)
	const [catalogue, setCatalogue] = useState<PvpCatalogue | null>(null)
	const [loading, setLoading] = useState(true)
	const [openSkill, setOpenSkill] = useState<SearchEntry | null>(null)
	const needsPayload = inApp === null

	useEffect(() => {
		let live = true
		Promise.allSettled([
			needsPayload ? readCalculatorCatalogue().then((data) => live && setPayload(data)) : null,
			loadPvpCatalogue().then((loaded) => live && setCatalogue(loaded)),
		]).then(() => {
			if (live) setLoading(false)
		})
		return () => {
			live = false
		}
	}, [needsPayload])

	const search = useMemo(() => {
		const sources: SearchSources = {
			umaBanners: inApp?.umaBannerData ?? payload?.banner_uma_data ?? [],
			supportBanners: inApp?.supportBannerData ?? payload?.banner_support_data ?? [],
			stepUps: inApp?.stepUpBannerData ?? payload?.banner_step_up_data ?? [],
			events: raceEventsInOrder(
				inApp?.championsMeetingData ?? payload?.champions_meeting_data ?? [],
				inApp?.leagueOfHeroesData ?? payload?.league_of_heroes_event_data ?? []
			),
			scenarios: inApp?.scenarioData ?? payload?.scenario_data ?? [],
			campaigns: inApp?.anniversaryEventData ?? payload?.anniversary_event_data ?? [],
			skills: catalogue?.skills ?? [],
		}
		return createSearcher(buildSearchEntries(sources, new Date(), earlyAccess))
	}, [inApp, payload, catalogue, earlyAccess])

	const trimmed = query.trim()
	const results = trimmed ? search(trimmed) : pageEntries(earlyAccess)

	const pick = (entry: SearchEntry) => {
		if (entry.href) {
			onClose()
			navigate(entry.href)
		} else {
			setOpenSkill(entry)
		}
	}

	return (
		<Command.Dialog
			open
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose()
			}}
			label="Search the site"
			shouldFilter={false}
			overlayClassName="fixed inset-0 z-[60] bg-black/60"
			contentClassName="fixed left-1/2 top-[10vh] z-[60] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-edge bg-gray-800 shadow-2xl"
		>
			{openSkill ? (
				<SkillPanel entry={openSkill} catalogue={catalogue} onBack={() => setOpenSkill(null)} />
			) : (
				<>
					<div className="flex items-center gap-2.5 border-b border-gray-700 px-3.5">
						<Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
						<Command.Input
							value={query}
							onValueChange={setQuery}
							placeholder="Umas, cards, skills, events, pages"
							className="h-12 min-w-0 flex-1 bg-transparent text-base text-gray-100 outline-none placeholder:text-gray-500 focus-visible:outline-none!"
						/>
						{loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" aria-label="Loading" />}
					</div>
					<Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto p-1.5">
						{!loading && <Command.Empty className="px-3 py-6 text-center text-sm text-gray-400">Nothing found.</Command.Empty>}
						{results.map((entry) => (
							<Command.Item key={entry.id} value={entry.id} onSelect={() => pick(entry)} className={ITEM}>
								<EntryArt entry={entry} oshiIds={oshiIds} />
								<span className="min-w-0">
									<span className="block truncate text-sm font-medium text-gray-100">{entry.title}</span>
									<span className="block truncate text-xs text-gray-400">{entry.detail}</span>
								</span>
							</Command.Item>
						))}
					</Command.List>
				</>
			)}
		</Command.Dialog>
	)
}
