/**
 * "Recommended skills": every skill the event's guide recommends, beside the
 * team builder, grouped by category and each listed once (utils/pvpGuide.ts
 * guideSkillsByCategory), however many positions the guide names it for.
 *
 * A tick marks a skill the selected team can already get: an uma's own skill
 * (unique, innate, awakening) or a card's hint or event, from the builder's
 * catalogue. Each category heading counts how many of its skills that is.
 *
 * A row opens in place to show the game's description, the positions, the
 * guide's notes and where the team gets it. In place rather than a hover
 * tooltip, so it works on a touch screen.
 *
 * Docked in the right column from 2xl, a drawer from the right below that
 * (components/pvp/SidePanel.tsx has both placements).
 */

import { useMemo, useState } from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { SKILL_CATEGORY_LABELS, STYLE_LABELS, guideSkillsByCategory, type GuideSkillPick } from "../../utils/pvpGuide"
import type { PvpGuideState } from "../../hooks/usePvpGuide"

interface GuideSkillsProps {
	guideState: PvpGuideState
	/** Skill id -> where the selected team gets it ("Kitasan Black (hint)"). */
	teamSkillSources: Map<number, string[]>
}

export function GuideSkillsBody({ guideState, teamSkillSources }: GuideSkillsProps) {
	const groups = useMemo(
		() => (guideState.status === "ready" ? guideSkillsByCategory(guideState.guide) : []),
		[guideState]
	)
	const [openId, setOpenId] = useState<number | null>(null)

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
	if (groups.length === 0) return <p className="text-sm text-gray-400">This event's guide has no skill picks yet.</p>

	return (
		<div className="flex flex-col gap-4">
			{groups.map((group) => {
				const covered = group.skills.filter((pick) => teamSkillSources.has(pick.skill.id)).length
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
									sources={teamSkillSources.get(pick.skill.id) ?? null}
									open={openId === pick.skill.id}
									onToggle={() => setOpenId(openId === pick.skill.id ? null : pick.skill.id)}
								/>
							))}
						</ul>
					</section>
				)
			})}
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

function SkillRow({ pick, sources, open, onToggle }: {
	pick: GuideSkillPick
	sources: string[] | null
	open: boolean
	onToggle: () => void
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
				{pick.tier !== null && (
					<span className="shrink-0 rounded border border-gray-600 bg-gray-900 px-1 text-[10px] font-bold text-gray-300" title={`Tier ${pick.tier}`}>
						T{pick.tier}
					</span>
				)}
				{sources && (
					<span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand text-black" title="Your team can get this">
						<Check className="h-3 w-3" aria-label="Your team can get this" />
					</span>
				)}
				<ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			</button>
			{open && (
				<div className="flex flex-col gap-1 border-t border-gray-700/70 px-2 py-1.5 text-xs leading-snug text-gray-300">
					{skill.description && <p>{skill.description}</p>}
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
				</div>
			)}
		</li>
	)
}
