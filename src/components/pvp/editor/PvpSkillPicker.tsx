/**
 * The guide editor's skill picker: one skill from the catalogue (skills on
 * global, the only ones a guide may name), with the category and tier the
 * row gets. The same dialog shape as PvpCardPicker: Escape and the backdrop
 * close it, search on top, the list below.
 *
 * Each row shows the skill's icon, name, version tag ("○ white", "◎ gold")
 * and the game's description, so "Right-Handed ○" and "Right-Handed ◎" can
 * be told apart at pick time, not after a save.
 */

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Search, X } from "lucide-react"
import type { CatalogueSkill } from "../../../types/pvpTeam"
import type { PvpSkillCategory } from "../../../types/pvpGuide"
import { SKILL_CATEGORY_LABELS } from "../../../utils/pvpGuide"
import { CATEGORY_CHOICES, TIER_CHOICES } from "../../../utils/guideDocument"
import { SELECT } from "./editorStyles"

export function PvpSkillPicker({ title, skills, category: initialCategory, tier: initialTier, blockReason, onPick, onClose }: {
	title: string
	skills: CatalogueSkill[]
	category: PvpSkillCategory
	tier: number | null
	/** Why a skill can't be added here, or null. */
	blockReason: (id: number, category: PvpSkillCategory) => string | null
	onPick: (id: number, category: PvpSkillCategory, tier: number | null) => void
	onClose: () => void
}) {
	const [search, setSearch] = useState("")
	const [category, setCategory] = useState(initialCategory)
	const [tier, setTier] = useState<number | null>(initialTier)

	useEffect(() => {
		const closeOnEscape = (keydown: KeyboardEvent) => {
			if (keydown.key === "Escape") onClose()
		}
		window.addEventListener("keydown", closeOnEscape)
		return () => window.removeEventListener("keydown", closeOnEscape)
	}, [onClose])

	const query = search.trim().toLowerCase()
	const shown = useMemo(
		() =>
			skills
				.filter((skill) => !query || skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query))
				.sort((a, b) => a.name.localeCompare(b.name))
				.slice(0, 120),
		[skills, query]
	)

	return createPortal(
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/75 p-4"
			onMouseDown={(mouse) => {
				if (mouse.target === mouse.currentTarget) onClose()
			}}
		>
			<section
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className="flex max-h-[min(44rem,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-edge bg-gray-800 shadow-2xl"
			>
				<header className="flex flex-wrap items-center gap-3 border-b border-gray-700 px-4 py-3">
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-base font-semibold text-gray-100">{title}</h2>
						<p className="text-xs text-gray-400">Skills on global only. Pick the version the guide means.</p>
					</div>
					<label className="relative w-full sm:w-64">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
						<input
							autoFocus
							type="search"
							aria-label="Search skills"
							value={search}
							onChange={(change) => setSearch(change.target.value)}
							placeholder="Name or description…"
							className="w-full rounded border border-gray-600 bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand"
						/>
					</label>
					<button type="button" aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-600 text-gray-300 transition hover:bg-gray-700 hover:text-gray-100" onClick={onClose}>
						<X className="h-5 w-5" />
					</button>
				</header>
				<div className="flex flex-wrap items-center gap-3 border-b border-gray-700 bg-gray-900/35 px-4 py-2 text-sm">
					<label className="flex items-center gap-2 text-gray-300">
						Category
						<select aria-label="Category" value={category} onChange={(change) => setCategory(change.target.value as PvpSkillCategory)} className={SELECT}>
							{CATEGORY_CHOICES.map((choice) => (
								<option key={choice} value={choice}>
									{SKILL_CATEGORY_LABELS[choice]}
								</option>
							))}
						</select>
					</label>
					<label className="flex items-center gap-2 text-gray-300">
						Tier
						<select aria-label="Tier" value={tier === null ? "" : String(tier)} onChange={(change) => setTier(change.target.value === "" ? null : Number(change.target.value))} className={SELECT}>
							{TIER_CHOICES.map((choice) => (
								<option key={choice.label} value={choice.value === null ? "" : String(choice.value)}>
									{choice.label}
								</option>
							))}
						</select>
					</label>
				</div>
				<div className="min-h-0 overflow-y-auto p-2">
					{shown.length === 0 ? (
						<p className="py-12 text-center text-sm text-gray-400">Nothing matches that search.</p>
					) : (
						<ul className="flex flex-col">
							{shown.map((skill) => {
								const reason = blockReason(skill.id, category)
								return (
									<li key={skill.id}>
										<button
											type="button"
											disabled={reason !== null}
											title={reason ?? skill.name}
											onClick={() => onPick(skill.id, category, tier)}
											className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
										>
											{skill.image ? (
												<img src={skill.image} alt="" className="mt-0.5 h-7 w-7 shrink-0" loading="lazy" decoding="async" />
											) : (
												<span className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
											)}
											<span className="min-w-0 flex-1">
												<span className="flex flex-wrap items-center gap-x-2">
													<span className="text-sm font-medium text-gray-100">{skill.name}</span>
													{skill.version && <span className="rounded border border-gray-600 px-1 text-[10px] text-gray-300">{skill.version}</span>}
													{reason && <span className="text-[11px] text-gray-400">{reason}</span>}
												</span>
												<span className="line-clamp-2 text-xs text-gray-400">{skill.description}</span>
											</span>
										</button>
									</li>
								)
							})}
						</ul>
					)}
				</div>
			</section>
		</div>,
		document.body
	)
}
