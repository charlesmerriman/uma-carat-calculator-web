/**
 * Add or edit one veteran by hand: the uma, a label, her five stats, her ten
 * aptitude letters and the skills she learned. An inline panel on the
 * Collection page, never a modal: the uma picker it opens (PvpCardPicker) is
 * an overlay, and a native <dialog> would sit above it in the top layer.
 *
 * Picking the uma fills her aptitudes from her own (utils/trainedUmas.ts
 * withUma), so the player only changes what training changed. A veteran read
 * from the game keeps the game's numbers: only its label can change here.
 *
 * The checks under each field are the API's rules, shown before Save; the
 * API's own refusal comes back as `error`.
 */

import { useState } from "react"
import { Loader2, Search, X } from "lucide-react"
import { FramedUma } from "../FramedUma"
import { PvpCardPicker } from "../pvp/PvpCardPicker"
import { ACTION_BUTTON, PRIMARY_BUTTON } from "../pvp/gallery/galleryStyles"
import { aptitudeLetter } from "../../utils/courseAptitude"
import {
	APTITUDE_GROUPS,
	LABEL_MAX_LENGTH,
	STAT_KEYS,
	STAT_LABELS,
	STAT_MAX,
	draftProblems,
	isUniqueSkill,
	searchSkills,
	toggleSkill,
	withUma,
	type VeteranDraft,
} from "../../utils/trainedUmas"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"

/** No course: the picker draws no aptitude badges and blocks nothing. */
const NO_COURSE = { surface_type: "", distance: "", length: "" }
const NOTHING = new Set<number>()
/** The levels a unique skill reaches (one per star of the uma). */
const UNIQUE_LEVELS = [1, 2, 3, 4, 5, 6]

const INPUT =
	"w-full rounded-md border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-gray-100 focus:border-brand focus:outline-none disabled:opacity-50"
const LABEL = "flex flex-col gap-1 text-xs font-medium text-gray-400"
const PROBLEM = "text-[11px] text-highlight"

export function VeteranForm({ title, initial, fromGame, index, oshiIds, saving, error, onSave, onCancel }: {
	title: string
	initial: VeteranDraft
	/** A veteran read from the game: only its label may change. */
	fromGame: boolean
	index: PvpCatalogueIndex
	oshiIds: ReadonlySet<number>
	saving: boolean
	/** The API's refusal of the last Save, or null. */
	error: string | null
	onSave: (draft: VeteranDraft) => void
	onCancel: () => void
}) {
	const [draft, setDraft] = useState(initial)
	const [picking, setPicking] = useState(false)
	const [query, setQuery] = useState("")
	// Problems show once Save has been tried, not while the form is first filled.
	const [tried, setTried] = useState(false)
	const problems = tried ? draftProblems(draft) : {}
	const uma = draft.uma !== null ? index.umasById.get(draft.uma) : undefined
	const locked = fromGame
	const picked = new Set(draft.skills.map((entry) => entry.skill))
	const results = locked ? [] : searchSkills(index.catalogue.skills, query, picked)

	const save = () => {
		setTried(true)
		if (Object.keys(draftProblems(draft)).length === 0) onSave(draft)
	}

	return (
		<section className="card-panel flex flex-col gap-4 p-4" aria-label={title}>
			<h3 className="text-sm font-semibold text-gray-100">{title}</h3>
			{fromGame && (
				<p className="text-xs text-gray-400">
					This one came from your game, so its stats and skills stay as the game has them. You can change its label.
				</p>
			)}

			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium text-gray-400">Uma</span>
					<button
						type="button"
						disabled={initial.uma !== null}
						onClick={() => setPicking(true)}
						className="flex items-center gap-2 rounded-md border border-gray-600 px-2 py-1.5 text-sm text-gray-100 transition enabled:hover:border-brand disabled:cursor-default"
					>
						{uma ? (
							<>
								<FramedUma src={uma.portrait ?? uma.image} oshi={oshiIds.has(uma.id)} alt="" className="w-8" />
								{uma.name}
							</>
						) : (
							"Pick the uma"
						)}
					</button>
					{problems.uma && <span className={PROBLEM}>{problems.uma}</span>}
				</div>
				<label className={`${LABEL} min-w-48 flex-1`}>
					Label (optional)
					<input
						className={INPUT}
						value={draft.label}
						maxLength={LABEL_MAX_LENGTH}
						placeholder={uma?.name ?? "Your name for her"}
						onChange={(change) => setDraft({ ...draft, label: change.target.value })}
					/>
					{problems.label && <span className={PROBLEM}>{problems.label}</span>}
				</label>
			</div>

			<label className={`${LABEL} w-48`}>
				Rank score (optional)
				<input
					className={INPUT}
					inputMode="numeric"
					disabled={locked}
					value={draft.rankScore}
					placeholder="The number the game shows"
					onChange={(change) => setDraft({ ...draft, rankScore: change.target.value })}
				/>
				{problems.rankScore && <span className={PROBLEM}>{problems.rankScore}</span>}
			</label>

			<fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-5" disabled={locked}>
				<legend className="mb-1 text-xs font-medium text-gray-400">Stats</legend>
				{STAT_KEYS.map((key) => (
					<label key={key} className={LABEL}>
						{STAT_LABELS[key]}
						<input
							className={INPUT}
							inputMode="numeric"
							type="number"
							min={0}
							max={STAT_MAX}
							value={draft.stats[key]}
							onChange={(change) => setDraft({ ...draft, stats: { ...draft.stats, [key]: change.target.value } })}
						/>
						{problems[key] && <span className={PROBLEM}>{problems[key]}</span>}
					</label>
				))}
			</fieldset>

			<fieldset className="flex flex-col gap-2" disabled={locked}>
				<legend className="mb-1 text-xs font-medium text-gray-400">Aptitudes</legend>
				{APTITUDE_GROUPS.map((group) => (
					<div key={group.label} className="grid grid-cols-4 gap-2">
						{group.keys.map(({ key, label }) => (
							<label key={key} className={LABEL}>
								{label}
								<select
									className={INPUT}
									value={draft.apt[key] ?? ""}
									onChange={(change) =>
										setDraft({ ...draft, apt: { ...draft.apt, [key]: change.target.value ? Number(change.target.value) : null } })
									}
								>
									<option value="">?</option>
									{[8, 7, 6, 5, 4, 3, 2, 1].map((value) => (
										<option key={value} value={value}>
											{aptitudeLetter(value)}
										</option>
									))}
								</select>
							</label>
						))}
					</div>
				))}
			</fieldset>

			<fieldset className="flex flex-col gap-2" disabled={locked}>
				<legend className="mb-1 text-xs font-medium text-gray-400">Skills (optional)</legend>
				{draft.skills.length > 0 && (
					<ul className="flex flex-wrap gap-1.5">
						{draft.skills.map((entry) => {
							const skill = index.skillsById.get(entry.skill)
							return (
								<li key={entry.skill} className="flex items-center gap-1 rounded-full border border-gray-600 py-0.5 pl-2.5 pr-1 text-xs text-gray-200">
									{skill?.name ?? "Unknown skill"}
									{skill && isUniqueSkill(skill) && (
										<select
											aria-label={`${skill.name} level`}
											className="rounded bg-gray-800 px-1 text-xs text-gray-200"
											value={entry.level}
											onChange={(change) =>
												setDraft({
													...draft,
													skills: draft.skills.map((each) =>
														each.skill === entry.skill ? { ...each, level: Number(change.target.value) } : each
													),
												})
											}
										>
											{UNIQUE_LEVELS.map((level) => (
												<option key={level} value={level}>
													Lv {level}
												</option>
											))}
										</select>
									)}
									{!locked && (
										<button
											type="button"
											aria-label={`Remove ${skill?.name ?? "skill"}`}
											onClick={() => setDraft(toggleSkill(draft, entry.skill))}
											className="rounded-full p-0.5 text-gray-400 hover:text-highlight"
										>
											<X className="h-3 w-3" />
										</button>
									)}
								</li>
							)
						})}
					</ul>
				)}
				{!locked && (
					<>
						<label className="relative">
							<span className="sr-only">Search skills</span>
							<Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-gray-500" aria-hidden="true" />
							<input
								className={`${INPUT} pl-8`}
								value={query}
								placeholder="Search a skill to add it"
								onChange={(change) => setQuery(change.target.value)}
							/>
						</label>
						{results.length > 0 && (
							<ul className="flex flex-wrap gap-1.5" aria-label="Matching skills">
								{results.map((skill) => (
									<li key={skill.id}>
										<button
											type="button"
											onClick={() => {
												setDraft(toggleSkill(draft, skill.id))
												setQuery("")
											}}
											className="rounded-full border border-dashed border-gray-600 px-2.5 py-0.5 text-xs text-gray-300 transition hover:border-brand hover:text-brand"
										>
											+ {skill.name}
										</button>
									</li>
								))}
							</ul>
						)}
					</>
				)}
			</fieldset>

			{error && (
				<p className="text-sm text-highlight" role="alert">
					{error}
				</p>
			)}
			<div className="flex justify-end gap-2">
				<button type="button" onClick={onCancel} className={ACTION_BUTTON}>
					Cancel
				</button>
				<button
					type="button"
					onClick={save}
					disabled={saving}
					className={PRIMARY_BUTTON}
				>
					{saving && <Loader2 className="h-4 w-4 animate-spin" />}
					Save
				</button>
			</div>

			{picking && (
				<PvpCardPicker
					title="Which uma is she?"
					skillsById={index.skillsById}
					event={NO_COURSE}
					style={null}
					selectedId={draft.uma}
					pool="uma"
					items={index.catalogue.umas}
					recommended={NOTHING}
					blockReason={() => null}
					onPick={(id) => {
						const chosen = index.umasById.get(id)
						if (chosen) setDraft(withUma(draft, chosen))
						setPicking(false)
					}}
					onClose={() => setPicking(false)}
				/>
			)}
		</section>
	)
}
