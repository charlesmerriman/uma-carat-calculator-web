/**
 * One skill in full on the Skills page: GET /skills/<game_id>, fetched when
 * the reader opens it. When it fires and what it does, every uma and card
 * that gives it, what it evolves from and into, and what unlocks it.
 */

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { fetchSkillDetail } from "../../services/skillsFetchCalls"
import type { SkillDetailData, SkillListRow, SkillSourceCard, SkillSourceUma } from "../../types/skills"
import { skillColour } from "../../utils/pvpGuide"
import { UMATL_URL, skillHref } from "../../utils/skillSearch"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { JpOnlyTag, ReadableText } from "../pvp/SkillDetail"

type DetailState =
	| { status: "loading"; gameId: number }
	| { status: "missing"; gameId: number }
	| { status: "error"; gameId: number }
	| { status: "ready"; gameId: number; skill: SkillDetailData }

function SkillIcon({ image, className = "h-6 w-6" }: { image: string | null; className?: string }) {
	return image ? (
		<img src={image} alt="" className={`${className} shrink-0`} loading="lazy" decoding="async" />
	) : (
		<span className={`${className} shrink-0 rounded-full bg-gray-700`} aria-hidden="true" />
	)
}

/** A skill named inside the card (its base, an evolution, a version), as a link. */
function SkillLink({ skill }: { skill: Omit<SkillListRow, "other_names"> }) {
	return (
		<Link to={skillHref(skill.game_id)} className="inline-flex items-center gap-1 text-brand transition hover:text-brand/75">
			<SkillIcon image={skill.image} className="h-4 w-4" />
			{skill.name}
			<span className="text-gray-400">({skillColour(skill)})</span>
		</Link>
	)
}

const UMA_SOURCE: Record<string, string> = {
	unique: "Unique skill",
	innate: "Innate",
	awakening: "Awakening",
	evolved: "Evolution",
}
const CARD_SOURCE: Record<string, string> = { hint: "Hint", event: "Event" }

function umaHow(row: SkillSourceUma): string {
	const how = UMA_SOURCE[row.source] ?? row.source
	return row.level !== null && row.source !== "unique" ? `${how}, level ${row.level}` : how
}

function UmaSources({ rows }: { rows: SkillSourceUma[] }) {
	const oshiIds = useOshiIds()
	if (rows.length === 0) return null
	return (
		<section>
			<h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Umas</h3>
			<ul className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
				{rows.map((row) => (
					<li key={`${row.id}-${row.source}`} className="flex items-center gap-2 text-sm">
						<FramedUma src={row.image} oshi={oshiIds.has(row.id)} className="h-9 w-9 shrink-0" />
						<span className="min-w-0">
							<span className="block truncate text-gray-100">{row.name}</span>
							<span className="block text-xs text-gray-400">
								{umaHow(row)}
								{!row.on_global && " · JP"}
							</span>
						</span>
					</li>
				))}
			</ul>
		</section>
	)
}

function CardSources({ rows }: { rows: SkillSourceCard[] }) {
	if (rows.length === 0) return null
	return (
		<section>
			<h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Support cards</h3>
			<ul className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
				{rows.map((row) => (
					<li key={`${row.id}-${row.source}`} className="flex items-center gap-2 text-sm">
						{row.image ? (
							<img src={row.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" loading="lazy" decoding="async" />
						) : (
							<span className="h-9 w-9 shrink-0 rounded bg-gray-700" aria-hidden="true" />
						)}
						<span className="min-w-0">
							<span className="block truncate text-gray-100">{row.name}</span>
							<span className="block text-xs text-gray-400">
								{CARD_SOURCE[row.source] ?? row.source}
								{!row.on_global && " · JP"}
							</span>
						</span>
					</li>
				))}
			</ul>
		</section>
	)
}

function Evolution({ skill }: { skill: SkillDetailData }) {
	const { evolution } = skill
	if (!evolution.from && evolution.into.length === 0 && evolution.conditions.length === 0) return null
	return (
		<section className="space-y-1 text-sm text-gray-300">
			<h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Evolution</h3>
			{evolution.from && (
				<p>
					Evolves from <SkillLink skill={evolution.from} />
				</p>
			)}
			{evolution.into.length > 0 && (
				<p>
					Evolves into{" "}
					{evolution.into.map((row, index) => (
						<span key={row.id}>
							{index > 0 && ", "}
							<SkillLink skill={row} />
						</span>
					))}
				</p>
			)}
			{evolution.conditions.length > 0 && (
				<>
					<p className="text-gray-400">To unlock it:</p>
					<ul className="list-disc space-y-0.5 pl-5">
						{evolution.conditions.map((condition, index) => (
							<li key={index}>
								{condition.text}
								{condition.is_japanese && <span className="text-gray-500"> (in Japanese, no translation yet)</span>}
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	)
}

export function SkillDetailCard({ gameId, onClose }: { gameId: number; onClose: () => void }) {
	const [fetched, setFetched] = useState<DetailState>({ status: "loading", gameId })
	// An answer for another skill (the reader opened a new one) reads as
	// loading until this one's lands: derived here, never reset in the effect.
	const state: DetailState = fetched.gameId === gameId ? fetched : { status: "loading", gameId }

	useEffect(() => {
		let live = true
		fetchSkillDetail(gameId)
			.then((skill) => {
				if (live) setFetched(skill ? { status: "ready", gameId, skill } : { status: "missing", gameId })
			})
			.catch((error: unknown) => {
				console.error(error)
				if (live) setFetched({ status: "error", gameId })
			})
		return () => {
			live = false
		}
	}, [gameId])

	const close = (
		<button type="button" onClick={onClose} className="text-sm text-gray-400 transition hover:text-gray-200">
			Close
		</button>
	)

	if (state.status !== "ready") {
		return (
			<div className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-400" role="status">
				{state.status === "loading" ? (
					<span className="flex items-center gap-2">
						<Loader2 className="h-4 w-4 animate-spin" /> Loading the skill...
					</span>
				) : state.status === "missing" ? (
					"There's no skill with that link."
				) : (
					"The skill didn't load. Try again in a moment."
				)}
				{close}
			</div>
		)
	}

	const { skill } = state
	const credit = skill.uses_translation || skill.evolution.conditions.some((condition) => condition.uses_translation)
	return (
		<article aria-labelledby="skill-detail-name" className="space-y-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
			<header className="flex items-start gap-3">
				<SkillIcon image={skill.image} className="h-10 w-10" />
				<div className="min-w-0 flex-1">
					<h2 id="skill-detail-name" className="flex flex-wrap items-center gap-x-2 text-lg font-semibold text-gray-100">
						{skill.name}
						{skill.availability === "jp" && <JpOnlyTag className="text-xs" />}
						{skill.availability === "announced" && (
							<span className="rounded border border-gray-500 px-1 text-xs font-medium text-gray-300">Coming to global</span>
						)}
					</h2>
					<p className="text-xs text-gray-400">{skillColour(skill)}</p>
				</div>
				{close}
			</header>

			{skill.description && <p className="text-sm text-gray-200">{skill.description}</p>}

			<div className="rounded border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200">
				<ReadableText readable={skill.readable} />
			</div>

			<UmaSources rows={skill.sources.umas} />
			<CardSources rows={skill.sources.cards} />
			<Evolution skill={skill} />

			{skill.versions.length > 0 && (
				<section className="text-sm text-gray-300">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Other versions</h3>
					<ul className="mt-1 space-y-0.5">
						{skill.versions.map((version) => (
							<li key={version.id}>
								<SkillLink skill={version} />
							</li>
						))}
					</ul>
				</section>
			)}

			{skill.availability === "jp" && (
				<p className="text-xs text-gray-400">
					Not in the global game yet. Its numbers come from the JP game and may change when it reaches global.
				</p>
			)}
			{credit && (
				<p className="text-xs text-gray-400">
					English text from{" "}
					<a href={UMATL_URL} target="_blank" rel="noreferrer" className="text-brand transition hover:text-brand/75">
						UmaTL
					</a>
					's fan translation.
				</p>
			)}
		</article>
	)
}
