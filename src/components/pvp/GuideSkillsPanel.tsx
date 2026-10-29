/**
 * "Recommended skills": every skill the event's guide recommends, beside the
 * team builder, grouped by category and each listed once (utils/pvpGuide.ts
 * guideSkillsByCategory), however many positions the guide names it for.
 *
 * Two filters on top: position (that position's skills plus the general
 * ones, with that position's tiers), then category.
 *
 * A tick marks a skill the selected team can already get: an uma's own skill
 * (unique, innate, awakening) or a card's hint or event, from the builder's
 * catalogue. Each category heading counts how many of its skills that is.
 *
 * A row opens in place to show the game's description, the positions, the
 * guide's notes and where the team gets it, plus a Search button per team
 * spot that opens the picker with the skill's name already searched. In
 * place rather than a hover tooltip, so it works on a touch screen.
 *
 * Docked in the right column from 2xl, a drawer from the right below that
 * (components/pvp/SidePanel.tsx has both placements).
 */

import { useMemo, useState } from "react"
import { Check, ChevronDown, Loader2, Search } from "lucide-react"
import {
	SKILL_CATEGORY_LABELS,
	SKILL_CATEGORY_ORDER,
	STYLE_LABELS,
	guideSkillsByCategory,
	familySources,
	skillPositions,
	type GuideSkillPick,
} from "../../utils/pvpGuide"
import type { PvpSkillCategory, PvpStyle } from "../../types/pvpGuide"
import type { PvpGuideState } from "../../hooks/usePvpGuide"

/** One team spot a skill can be searched for: "Spot 1 · Daiwa Scarlet". */
export interface SkillSearchSpot {
	position: number
	label: string
}

interface GuideSkillsProps {
	guideState: PvpGuideState
	/** Skill id -> where the selected team gets it ("Kitasan Black (hint)"). */
	teamSkillSources: Map<number, string[]>
	/** The team's three spots, each with a Search button in an open row. */
	spots: SkillSearchSpot[]
	/** Opens the picker for a spot with `skillName` in the search box. */
	onSearch: (position: number, skillName: string) => void
}

export function GuideSkillsBody({ guideState, teamSkillSources, spots, onSearch }: GuideSkillsProps) {
	const guide = guideState.status === "ready" ? guideState.guide : null
	// Position on top, category under it. "all" for either shows everything.
	const [position, setPosition] = useState<PvpStyle | "all">("all")
	const [category, setCategory] = useState<PvpSkillCategory | "all">("all")
	const positions = useMemo(() => (guide ? skillPositions(guide) : []), [guide])
	const groups = useMemo(
		() => (guide ? guideSkillsByCategory(guide, position === "all" ? null : position) : []),
		[guide, position]
	)
	const [openId, setOpenId] = useState<number | null>(null)
	// A category the chosen position has nothing in reads as "all", so
	// switching position never leaves the list empty behind a stale filter.
	const activeCategory = groups.some((group) => group.category === category) ? category : "all"
	const shown = activeCategory === "all" ? groups : groups.filter((group) => group.category === activeCategory)

	if (guideState.status === "loading" || guideState.status === "idle") {
		return (
			<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading the guide…
			</p>
		)
	}
	if (guideState.status === "error") return <p className="text-sm text-gray-400">The guide didn't load.</p>
	if (guideState.status === "none") return <p className="text-sm text-gray-400">No guide for this event yet.</p>
	if (groups.length === 0 && position === "all") {
		// The filters stay in view, greyed out, so the panel looks the same on
		// every event and nobody wonders where they went.
		return (
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<FilterChips
						label="Position"
						options={[{ value: "all", label: "All" }, ...FILTER_POSITIONS.map((style) => ({ value: style, label: STYLE_LABELS[style] }))]}
						value="all"
						onChange={() => {}}
						disabled
					/>
					<FilterChips
						label="Category"
						options={[
							{ value: "all", label: "All" },
							...SKILL_CATEGORY_ORDER.map((value) => ({ value, label: SKILL_CATEGORY_LABELS[value] })),
						]}
						value="all"
						onChange={() => {}}
						disabled
					/>
				</div>
				<p className="text-sm text-gray-400">This event's guide has no skill picks yet.</p>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				{positions.length > 1 && (
					<FilterChips
						label="Position"
						options={[
							{ value: "all", label: "All" },
							...positions.map((style) => ({ value: style, label: STYLE_LABELS[style] })),
						]}
						value={position}
						onChange={(value) => setPosition(value as PvpStyle | "all")}
					/>
				)}
				{groups.length > 1 && (
					<FilterChips
						label="Category"
						options={[
							{ value: "all", label: "All" },
							...groups.map((group) => ({ value: group.category, label: SKILL_CATEGORY_LABELS[group.category] })),
						]}
						value={activeCategory}
						onChange={(value) => setCategory(value as PvpSkillCategory | "all")}
					/>
				)}
				{position !== "all" && (
					<p className="text-[11px] text-gray-500">Includes the skills the guide recommends for every position.</p>
				)}
			</div>
			{shown.map((group) => {
				// Any version counts: a card teaching the white form covers a gold pick.
				const covered = group.skills.filter((pick) => familySources(teamSkillSources, pick.skill) !== null).length
				return (
					<section key={group.category} aria-label={SKILL_CATEGORY_LABELS[group.category]}>
						<h3 className="mb-1.5 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-brand">
							{SKILL_CATEGORY_LABELS[group.category]}
							<span
								className="text-[11px] font-normal normal-case tracking-normal text-gray-500"
								title="Skills your team can already get"
							>
								{covered} of {group.skills.length} on your team
							</span>
						</h3>
						<ul className="flex flex-col gap-1">
							{group.skills.map((pick) => (
								<SkillRow
									key={pick.skill.id}
									pick={pick}
									sources={familySources(teamSkillSources, pick.skill)}
									open={openId === pick.skill.id}
									onToggle={() => setOpenId(openId === pick.skill.id ? null : pick.skill.id)}
									spots={spots}
									onSearch={(position) => onSearch(position, pick.skill.name)}
								/>
							))}
						</ul>
					</section>
				)
			})}
		</div>
	)
}

/** The positions the filter offers when the guide has none to list. */
const FILTER_POSITIONS: PvpStyle[] = ["front", "pace", "late", "end"]

/** A labelled row of single-choice chips: the panel's two filters. */
function FilterChips({ label, options, value, onChange, disabled = false }: {
	label: string
	options: Array<{ value: string; label: string }>
	value: string
	onChange: (value: string) => void
	disabled?: boolean
}) {
	return (
		<div role="group" aria-label={label}>
			<p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
			<div className="flex flex-wrap gap-1">
				{options.map((option) => (
					<button
						key={option.value}
						type="button"
						aria-pressed={value === option.value}
						disabled={disabled}
						onClick={() => onChange(option.value)}
						className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
							value === option.value
								? "border-brand bg-brand/15 text-brand"
								: "border-gray-600 text-gray-300 hover:border-gray-500"
						}`}
					>
						{option.label}
					</button>
				))}
			</div>
		</div>
	)
}

// The game's rarities, as the guide view frames them (PvpTiles skillRarityClass).
function rarityClass(rarity: number): string {
	if (rarity === 2) return "border-recommended/70"
	if (rarity >= 3) return "border-step-up-border/70"
	return "border-gray-600"
}

/** The guide's markup made plain: no ==highlight== markers, [[Skill]] as its name. */
function plain(text: string): string {
	return text.replace(/==/g, "").replace(/\[\[([^\]]+)\]\]/g, "$1")
}

function SkillRow({ pick, sources, open, onToggle, spots, onSearch }: {
	pick: GuideSkillPick
	sources: string[] | null
	open: boolean
	onToggle: () => void
	spots: SkillSearchSpot[]
	onSearch: (position: number) => void
}) {
	const { skill } = pick
	return (
		<li className={`rounded-lg border bg-gray-900/50 ${rarityClass(skill.rarity)}`}>
			<button
				type="button"
				aria-expanded={open}
				onClick={onToggle}
				className="flex w-full items-center gap-2 px-1.5 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand"
			>
				{skill.image ? (
					<img src={skill.image} alt="" className="h-6 w-6 shrink-0" loading="lazy" decoding="async" />
				) : (
					<span className="h-6 w-6 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
				)}
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm text-gray-100">{skill.name}</span>
					{skill.unique_of && <span className="block truncate text-[11px] text-gray-500">{skill.unique_of}</span>}
				</span>
				{sources && (
					<span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand text-black" title="Your team can get this">
						<Check className="h-3 w-3" aria-label="Your team can get this" />
					</span>
				)}
				{pick.tier !== null && (
					<span className="shrink-0 rounded border border-gray-600 bg-gray-900 px-1 text-[10px] font-bold text-gray-300" title={`Tier ${pick.tier}`}>
						T{pick.tier}
					</span>
				)}
				<ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			</button>
			{open && (
				<div className="flex flex-col gap-1 border-t border-gray-700/70 px-2 py-1.5 text-xs leading-snug text-gray-300">
					{skill.description && <p>{skill.description}</p>}
					{skill.versions.length > 0 && (
						<p className="text-gray-400">
							Also as: {skill.versions.map((version) => `${version.name} (${version.version})`).join(", ")}
						</p>
					)}
					<p className="text-gray-400">
						For: {pick.styles.map((style) => (style === "everyone" ? "every position" : STYLE_LABELS[style])).join(", ")}
					</p>
					{pick.notes.map((note) => (
						<p key={note} className="text-gray-400">
							{plain(note)}
						</p>
					))}
					<p className={sources ? "text-brand" : "text-gray-500"}>
						{sources ? `Your team: ${sources.join(", ")}` : "Not on your team yet."}
					</p>
					<div className="mt-1 border-t border-gray-700/70 pt-1.5">
						<p className="mb-1 text-[11px] font-medium text-gray-400">Find an uma or card with it for:</p>
						<ul className="flex flex-col gap-1">
							{spots.map((spot) => (
								<li key={spot.position} className="flex items-center gap-1.5">
									<span className="min-w-0 flex-1 truncate text-gray-300" title={spot.label}>
										{spot.label}
									</span>
									<button
										type="button"
										aria-label={`Search for ${skill.name}: ${spot.label}`}
										onClick={() => onSearch(spot.position)}
										className="flex shrink-0 items-center gap-1 rounded-md border border-gray-600 px-2 py-0.5 font-medium text-gray-100 transition hover:border-brand hover:text-brand"
									>
										<Search className="h-3 w-3" aria-hidden="true" />
										Search
									</button>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</li>
	)
}
