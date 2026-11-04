/**
 * What "My veterans' skills" needs, gathered from what the reader already set
 * up on the PvP tab (owner, 2026-11-02: "these features in the pvp tab
 * integrate with each other"): their team for this event (the pinned one,
 * else the one edited last, `preferredTeam`), the veterans linked to its spots
 * (at most three), their learned skills, and the catalogue for names and
 * portraits. Nothing is asked again.
 *
 * A component, not a hook, so it can be mounted only while the layer is on:
 * the catalogue and the veterans are fetched only then. It renders nothing
 * and hands its result up through `onData`.
 */
import { useContext, useEffect, useMemo, type ReactNode } from "react"
import { FramedUma } from "../FramedUma"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { PvpTeamsContext } from "../../services/PvpTeamsContext"
import { useTrainedUmas } from "../../services/trainedUmaQueries"
import type { RaceEvent } from "../../types"
import type { VeteranInLayer } from "../../utils/courseLayers"
import { refForRaceEvent } from "../../utils/pvpEvent"
import { preferredTeam } from "../../utils/pvpTeams"

export interface VeteranLayerData {
	veterans: VeteranInLayer[]
	/** Skill id -> its name, for the labels. */
	names: Map<number, string>
	/** Skill id -> its icon, for the spans. */
	images: Map<number, string | null>
	/** Veteran key -> her avatar, for the head of her lanes and her row in the Layers menu. */
	heads: Map<string, ReactNode>
	/** Veteran key -> her uma's name, for her row in the Layers menu. */
	umaNames: Map<string, string>
	/** Why nothing is drawn, when nothing is ("Make a team..."). */
	note: string | null
}

export default function VeteranLayerSource({ event, onData }: {
	event: RaceEvent
	onData: (data: VeteranLayerData | null) => void
}) {
	const teams = useContext(PvpTeamsContext)
	const trained = useTrainedUmas(true)
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()

	useEffect(() => {
		teams?.ensureLoaded()
	}, [teams])

	const data = useMemo<VeteranLayerData | null>(() => {
		if (!teams || teams.status !== "ready" || !trained.data || catalogue.status !== "ready") return null
		const ref = refForRaceEvent(event)
		const team = preferredTeam(teams.teams.filter((candidate) => candidate.kind === ref.kind && candidate.event === ref.id))
		const empty = (note: string): VeteranLayerData => ({ veterans: [], names: new Map(), images: new Map(), heads: new Map(), umaNames: new Map(), note })
		if (!team) return empty("Make a team for this event in My team, then link your veterans to its spots.")
		const byId = new Map(trained.data.map((veteran) => [veteran.id, veteran]))
		const veterans: VeteranInLayer[] = []
		const heads = new Map<string, ReactNode>()
		const umaNames = new Map<string, string>()
		for (const member of [...team.members].sort((a, b) => a.position - b.position)) {
			const veteran = member.trained_uma ? byId.get(member.trained_uma) : undefined
			if (!veteran) continue
			const key = `spot-${member.position}`
			const uma = catalogue.umasById.get(member.uma)
			veterans.push({ key, veteranId: veteran.id, umaId: member.uma, style: member.style, skillIds: veteran.skills.map((skill) => skill.skill) })
			umaNames.set(key, uma?.name ?? veteran.label)
			heads.set(key, (
				<FramedUma
					src={uma?.portrait ?? null}
					oshi={oshiIds.has(member.uma)}
					alt=""
					title={uma?.name ?? veteran.label}
					className="h-5 w-5"
				/>
			))
		}
		if (veterans.length === 0) return empty("Link a veteran to a spot on your team in My team to see her skills here.")
		const names = new Map([...catalogue.skillsById].map(([id, skill]) => [id, skill.name]))
		const images = new Map([...catalogue.skillsById].map(([id, skill]) => [id, skill.image ?? null]))
		return { veterans, names, images, heads, umaNames, note: null }
	}, [teams, trained.data, catalogue, event, oshiIds])

	useEffect(() => {
		onData(data)
	}, [data, onData])
	// Unmounted (the layer turned off): nothing to draw.
	useEffect(() => () => onData(null), [onData])

	return null
}
