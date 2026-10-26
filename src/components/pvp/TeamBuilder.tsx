/**
 * The PvP page's "My team" view: the player's teams for the selected event.
 *
 * A row of the event's teams ("Team 1", a name, "+ New team"), the grid, and
 * the save line. Picking a place on the grid opens PvpCardPicker; the edit
 * goes through PvpTeamsProvider, which saves it (to the device for a guest, to
 * the account after a short pause when signed in).
 *
 * An event with no team still shows an empty grid. The first pick creates
 * the team, so there is no "Start a team" step to get through.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Check, LayoutGrid, Loader2, PanelLeftOpen, PanelRightOpen, Pencil, Plus, Send, Sparkles, Star, Trash2 } from "lucide-react"
import { usePvpTeams } from "../../services/PvpTeamsContext"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { usePvpGuide } from "../../hooks/usePvpGuide"
import { pvpEventHref, refForRaceEvent, sameEvent } from "../../utils/pvpEvent"
import { useAccount } from "../../services/AuthContext"
import { useTrainedUmas } from "../../services/trainedUmaQueries"
import { PublishDialog } from "./gallery/PublishDialog"
import {
	PVP_BORROW_SLOT,
	PVP_DECK_SIZE,
	PVP_TEAM_CAP_PER_EVENT,
	PVP_TEAM_SIZE,
	firstOpenCardSlot,
	memberAt,
	preferredTeam,
	memberStyleFrom,
	teamSkillSources,
	recommendedIds,
	setCard,
	setMemberUma,
	cardBlockReason,
	deckRequestId,
	deckToMemberCards,
	umaBlockReason,
} from "../../utils/pvpTeams"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import { DECK_STAT_LABELS, noteOnlyType } from "../../utils/deckNotes"
import { plainNoteText } from "../../utils/remarkHighlight"
import { UseDeckBanner, type DeckSpot } from "./UseDeckBanner"
import { GuidePicksBody, type GuidePickActions } from "./GuidePicksPanel"
import { SaveStatus } from "./SaveStatus"
import { useCardReleases, type ReleaseCheck } from "../../hooks/useCardReleases"
import { releaseBlockReason, releaseNote } from "../../utils/cardRelease"
import { GuideSkillsBody } from "./GuideSkillsPanel"
import { DockedPanel, SideDrawer } from "./SidePanel"
import { PvpCardPicker } from "./PvpCardPicker"
import { TeamEditor } from "./TeamEditor"
import type { DeckDeal } from "./TeamGrid"
import { TeamNotes } from "./TeamNotes"
import type { RaceEvent } from "../../types"
import type { CatalogueUma, MemberStyle, PvpTeam, PvpTeamMember } from "../../types/pvpTeam"
import type { PvpTeamsContextType } from "../../services/PvpTeamsContext"

// Long enough for the six cards to deal in (TeamGrid: about 0.12s apart, 0.4s each).
const DEAL_SETTLE_MS = 1500

/** One shared empty team, so "no team yet" is the same array on every render. */
const NO_MEMBERS: PvpTeamMember[] = []

/**
 * A skill search opened from the skills panel: one spot, either pool, the
 * skill's name searched. The grid's own pickers live in TeamEditor.
 */
type SkillSearchTarget = { position: number; query: string; tab: "uma" | "support" }

const PICKS_BUTTON =
	"flex items-center gap-1.5 rounded-md border border-gray-600 px-2.5 py-1.5 text-sm font-medium text-gray-200 transition hover:border-brand hover:text-brand"

/**
 * Whether a docked side panel is open, remembered per browser. A convenience
 * only: blocked storage reads as open and a failed write is ignored. Safe to
 * read during render because this view sits inside the /app loading gate,
 * which is never prerendered.
 */
const PICKS_STORAGE_KEY = "uma-planner-pvp-guide-picks"
const SKILLS_STORAGE_KEY = "uma-planner-pvp-skills"

function readPanelOpen(key: string): boolean {
	try {
		return localStorage.getItem(key) !== "closed"
	} catch {
		return true
	}
}

function writePanelOpen(key: string, open: boolean): void {
	try {
		if (open) localStorage.removeItem(key)
		else localStorage.setItem(key, "closed")
	} catch {
		// Storage blocked: the panel opens again next visit.
	}
}

/**
 * The My team view's grid for whichever side columns are docked. Literal
 * strings so Tailwind sees each one. The builder keeps about 56rem in every
 * case; the left column docks from xl, the right from 2xl (SidePanel.tsx).
 */
function gridLayout(left: boolean, right: boolean): string {
	if (left && right) {
		return "xl:max-w-[76rem] xl:grid-cols-[19rem_minmax(0,1fr)] 2xl:max-w-[96rem] 2xl:grid-cols-[19rem_minmax(0,1fr)_19rem]"
	}
	if (left) return "xl:max-w-[76rem] xl:grid-cols-[19rem_minmax(0,1fr)]"
	if (right) return "2xl:max-w-[76rem] 2xl:grid-cols-[minmax(0,1fr)_19rem]"
	return ""
}

/** "Team 2" when the player hasn't named it. */
function teamLabel(team: PvpTeam, index: number): string {
	return team.name.trim() || `Team ${index + 1}`
}

export function TeamBuilder({ event }: { event: RaceEvent }) {
	const teamsState = usePvpTeams()
	const { status, ensureLoaded } = teamsState
	const catalogue = usePvpCatalogue()

	useEffect(() => {
		ensureLoaded()
	}, [ensureLoaded])

	if (status === "error") {
		return <Notice>Your teams didn't load. Reload the page to try again.</Notice>
	}
	if (catalogue.status === "error") {
		return <Notice>The uma and card list didn't load. Reload the page to try again.</Notice>
	}
	if (status !== "ready" || catalogue.status !== "ready") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading your teams…
			</div>
		)
	}
	// Keyed by event, so switching events starts on that event's first team.
	return <ReadyBuilder key={`${event.event_type}-${event.id}`} event={event} teamsState={teamsState} index={catalogue} />
}

function ReadyBuilder({ event, teamsState, index }: {
	event: RaceEvent
	teamsState: PvpTeamsContextType
	index: PvpCatalogueIndex
}) {
	const { teams, mode, saveState, createTeam, editTeam, renameTeam, deleteTeam, setTeamPost } = teamsState
	const { account } = useAccount()
	// The account's veterans, for each member's "which veteran" pick. Never a
	// guest's: veterans live on an account only (the Collection page).
	const veterans = useTrainedUmas(mode === "account").data
	const [publishing, setPublishing] = useState(false)
	const ref = refForRaceEvent(event)
	const eventTeams = teams.filter((team) => sameEvent({ kind: team.kind, id: team.event }, ref))

	const [selectedKey, setSelectedKey] = useState<string | null>(null)
	const [skillSearch, setSkillSearch] = useState<SkillSearchTarget | null>(null)
	// Each side panel has two switches, one per placement. The docked column
	// starts open and remembers being collapsed; the drawer starts closed
	// every time. Stable close functions, so a drawer's Escape listener is not
	// re-added on every render.
	const [picksDocked, setPicksDocked] = useState(() => readPanelOpen(PICKS_STORAGE_KEY))
	const [skillsDocked, setSkillsDocked] = useState(() => readPanelOpen(SKILLS_STORAGE_KEY))
	const [picksDrawer, setPicksDrawer] = useState(false)
	const [skillsDrawer, setSkillsDrawer] = useState(false)
	const closePicks = useCallback(() => setPicksDrawer(false), [])
	const closeSkills = useCallback(() => setSkillsDrawer(false), [])
	const dockPicks = (open: boolean) => {
		setPicksDocked(open)
		writePanelOpen(PICKS_STORAGE_KEY, open)
	}
	const dockSkills = (open: boolean) => {
		setSkillsDocked(open)
		writePanelOpen(SKILLS_STORAGE_KEY, open)
	}
	// The team the player picked here, else the one the team drawer would
	// show for this event (pinned, else edited last), so "Open in PvP" from the
	// drawer lands on the same team.
	const team = eventTeams.find((candidate) => candidate.key === selectedKey) ?? preferredTeam(eventTeams)
	const members = team?.members ?? NO_MEMBERS

	// Stars come from the event's guide; usePvpGuide caches it, so this is
	// free when the player has just read the Recommendations view.
	const guideState = usePvpGuide(ref)
	const guide = guideState.status === "ready" ? guideState.guide : null

	/** Apply an edit to the selected team, creating the team on the first one. Returns the team's key. */
	const applyMembers = (next: PvpTeamMember[]): string | null => {
		if (team) {
			editTeam(team.key, { members: next })
			return team.key
		}
		const key = createTeam(ref, { members: next })
		if (key) setSelectedKey(key)
		return key
	}

	// Only what is out by the event's last day can be added, from any of the
	// view's paths in (utils/cardRelease.ts).
	const releaseFor = useCardReleases(event, index)

	// "Use this deck" on the guide hands a deck over in the router state, never
	// the URL (guide-visuals-plan-2.md, release C). Read once, when the builder
	// mounts: the hand-over always switches from the guide's view to this one,
	// which mounts it fresh. Then cleared from the history entry, so a reload
	// or Back never offers it again. (Following the state on every render
	// instead raced the router's own transition and brought a dismissed deck
	// back.)
	const location = useLocation()
	const navigate = useNavigate()
	const [deckId, setDeckId] = useState<number | null>(() => deckRequestId(location.state))
	const handedOver = deckRequestId(location.state) !== null
	useEffect(() => {
		if (handedOver) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
	}, [handedOver, location.pathname, location.search, navigate])
	const deck = deckId !== null ? (guide?.decks.find((candidate) => candidate.id === deckId) ?? null) : null
	// The spot an uma is being picked for, to take the deck.
	const [deckUmaSpot, setDeckUmaSpot] = useState<number | null>(null)
	// The dealing animation (TeamGrid's DeckDeal): a count per spot, bumped by
	// each deck put on it, and the spot being dealt right now, cleared once
	// the six cards are in.
	const [deal, setDeal] = useState<DeckDeal>({ counts: {}, now: null })
	useEffect(() => {
		if (deal.now === null) return
		const done = window.setTimeout(() => setDeal((current) => ({ ...current, now: null })), DEAL_SETTLE_MS)
		return () => window.clearTimeout(done)
	}, [deal])
	const deckStyle = deck ? memberStyleFrom([deck.style]) : undefined
	const deckName = deck ? `${deck.style === "everyone" ? "" : `${STYLE_LABELS[deck.style]} `}${deck.label ? `${deck.label} ` : ""}deck` : ""
	const deckSpots: DeckSpot[] = [0, 1, 2].map((position) => {
		const member = memberAt(members, position)
		return { position, umaName: member ? (index.umasById.get(member.uma)?.name ?? "an uma") : null, cardCount: member?.cards.length ?? 0 }
	})
	/**
	 * The deck on the member at `position` of `base` (the selected team's
	 * members, plus the uma just picked for an empty spot): her cards
	 * replaced, her style the deck's (owner's pick). Anything the rules kept
	 * out is named in the toast, whose Undo puts the members back.
	 */
	const putDeck = (base: PvpTeamMember[], position: number) => {
		const member = memberAt(base, position)
		if (!deck || !member) return
		const fill = deckToMemberCards(deck, member, index, releaseFor)
		const before = members
		const key = applyMembers(base.map((each) => (each.position === position ? { ...each, style: deckStyle ?? each.style, cards: fill.cards } : each)))
		setDeckId(null)
		setDeal((current) => ({ counts: { ...current.counts, [position]: (current.counts[position] ?? 0) + 1 }, now: position }))
		const notes = [
			...fill.skipped.map((skip) => `Left out ${skip.name}: ${skip.reason}.`),
			...fill.open.map((open) => `${open.slot === PVP_BORROW_SLOT ? "The borrowed card" : `Card ${open.slot}`} is left ${openSlotWords(open.note)}.`),
		]
		toast.success(`${capitalise(deckName)} on spot ${position + 1}, ${index.umasById.get(member.uma)?.name ?? "your uma"}.`, {
			description: notes.length > 0 ? notes.join(" ") : undefined,
			action: key ? { label: "Undo", onClick: () => editTeam(key, { members: before }) } : undefined,
		})
	}
	const searchMember = skillSearch ? memberAt(members, skillSearch.position) : undefined
	const searchStyle = searchMember?.style ?? null

	// What Guide picks offers for a clicked uma or card. Same rules as the
	// picker (utils/pvpTeams.ts), shown as disabled buttons with a reason.
	const pickActions: GuidePickActions = {
		uma: (umaId, styles) => {
			const candidate = index.umasById.get(umaId)
			const style = memberStyleFrom(styles)
			return [0, 1, 2].map((position) => {
				const current = memberAt(members, position)
				const currentName = current ? (index.umasById.get(current.uma)?.name ?? "an uma") : null
				const reason = !candidate
					? "Not in the uma list"
					: (releaseBlockReason(releaseFor("uma", umaId)) ??
						(current?.uma === umaId
							? "Already in this spot"
							: umaBlockReason(members, position, candidate, index)))
				return {
					key: `spot-${position}`,
					label: `Spot ${position + 1} · ${currentName ?? "empty"}`,
					buttons: [
						{
							label: current ? "Replace" : "Add",
							disabledReason: reason,
							run: () => candidate && applyMembers(setMemberUma(members, position, candidate, style)),
						},
					],
				}
			})
		},
		card: (cardId) =>
			members.map((member) => {
				const name = index.umasById.get(member.uma)?.name ?? `Uma ${member.position + 1}`
				const inDeck = member.cards.find((card) => card.support_card === cardId)
				const open = firstOpenCardSlot(member)
				const known = index.cardsById.has(cardId)
					? releaseBlockReason(releaseFor("support", cardId))
					: "Not in the card list"
				return {
					key: `member-${member.position}`,
					label: name,
					buttons: [
						{
							label: "Add",
							// The deck rules first (utils/pvpTeams.ts): "already in this
							// deck" says more than "full" when both are true.
							disabledReason:
								known ??
								cardBlockReason(member, null, cardId, index) ??
								(open === null ? "Cards 1 to 5 are full" : null),
							run: () => open !== null && applyMembers(setCard(members, member.position, open, cardId)),
						},
						{
							label: "Borrow",
							disabledReason:
								known ??
								(inDeck?.slot === PVP_BORROW_SLOT
									? "Already the borrowed card"
									: cardBlockReason(member, PVP_BORROW_SLOT, cardId, index)),
							run: () => applyMembers(setCard(members, member.position, PVP_BORROW_SLOT, cardId)),
						},
					],
				}
			}),
		emptyCardHint: "Add an uma to the team first, then her cards.",
		note: (pool, id) => {
			const status = releaseFor(pool, id)
			return releaseNote(status) ?? releaseBlockReason(status)
		},
	}

	// Skill id -> where the selected team gets it, for the skills panel's ticks.
	// A few dozen links, so worked out on every render.
	const skillSources = teamSkillSources(members, index.umasById, index.cardsById)

	const picksBody = <GuidePicksBody guideState={guideState} members={members} actions={pickActions} />
	const skillSpots = [0, 1, 2].map((position) => {
		const member = memberAt(members, position)
		const name = member ? (index.umasById.get(member.uma)?.name ?? "an uma") : "empty"
		return { position, label: `Spot ${position + 1} · ${name}` }
	})
	const skillsBody = (
		<GuideSkillsBody
			guideState={guideState}
			teamSkillSources={skillSources}
			spots={skillSpots}
			onSearch={(position, skillName) => {
				// The drawer would sit over nothing useful once the picker opens.
				closeSkills()
				// An empty spot wants an uma first; a filled one most often a card.
				const tab = memberAt(members, position) ? "support" : "uma"
				setSkillSearch({ position, query: skillName, tab })
			}}
		/>
	)
	const picksIcon = <Star className="h-4 w-4 fill-highlight text-highlight" aria-hidden="true" />
	const skillsIcon = <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />

	return (
		// Guide picks docks on the left from xl, Recommended skills on the
		// right from 2xl; below those, each retracts behind a toolbar button.
		<div className={`mx-auto grid w-full max-w-4xl items-start gap-4 ${gridLayout(picksDocked, skillsDocked)}`}>
			{picksDocked && (
				<DockedPanel side="left" title="Guide picks" icon={picksIcon} onCollapse={() => dockPicks(false)}>
					{picksBody}
				</DockedPanel>
			)}
			<SideDrawer side="left" title="Guide picks" icon={picksIcon} open={picksDrawer} onClose={closePicks}>
				{picksBody}
			</SideDrawer>
			<SideDrawer side="right" title="Recommended skills" icon={skillsIcon} open={skillsDrawer} onClose={closeSkills}>
				{skillsBody}
			</SideDrawer>

			<div className="flex min-w-0 flex-col gap-3">
				{deck && (
					<UseDeckBanner
						// Per team: a pending "Replace?" never follows a switch to another
						// team. Prefixed: TeamNotes below is keyed by the bare team key, and
						// two siblings sharing a key left a dismissed banner on screen.
						key={`deck-${team?.key ?? "none"}`}
						deckName={deckName}
						spots={deckSpots}
						newTeamBlocked={eventTeams.length >= PVP_TEAM_CAP_PER_EVENT ? `You can keep up to ${PVP_TEAM_CAP_PER_EVENT} teams for one event.` : null}
						onUse={(position) => putDeck(members, position)}
						onPickUma={setDeckUmaSpot}
						onNewTeam={() => {
							const key = createTeam(ref)
							if (!key) return
							setSelectedKey(key)
							setDeckUmaSpot(0)
						}}
						onCancel={() => setDeckId(null)}
					/>
				)}
				<TeamToolbar
					leading={
						<>
							{/* Below xl: opens the drawer. From xl: only while the column is collapsed. */}
							<button type="button" aria-expanded={picksDrawer} onClick={() => setPicksDrawer(true)} className={`${PICKS_BUTTON} xl:hidden`}>
								<PanelLeftOpen className="h-4 w-4" />
								Guide picks
							</button>
							{!picksDocked && (
								<button type="button" onClick={() => dockPicks(true)} className={`${PICKS_BUTTON} hidden xl:flex`}>
									<PanelLeftOpen className="h-4 w-4" />
									Guide picks
								</button>
							)}
						</>
					}
					trailing={
						<>
							{/* The same pair for the skills panel, at 2xl. */}
							<button type="button" aria-expanded={skillsDrawer} onClick={() => setSkillsDrawer(true)} className={`${PICKS_BUTTON} 2xl:hidden`}>
								Skills
								<PanelRightOpen className="h-4 w-4" />
							</button>
							{!skillsDocked && (
								<button type="button" onClick={() => dockSkills(true)} className={`${PICKS_BUTTON} hidden 2xl:flex`}>
									Skills
									<PanelRightOpen className="h-4 w-4" />
								</button>
							)}
						</>
					}
					teams={eventTeams}
					selected={team}
					mode={mode}
					saveState={saveState}
					onSelect={setSelectedKey}
					onCreate={() => {
						const key = createTeam(ref)
						if (key) setSelectedKey(key)
					}}
					onRename={(name) => team && renameTeam(team.key, name)}
					onDelete={() => {
						if (!team) return
						deleteTeam(team.key)
						setSelectedKey(null)
					}}
				/>

				<TeamEditor
					event={event}
					members={members}
					index={index}
					guide={guide}
					deal={deal}
					veterans={mode === "account" ? veterans : undefined}
					onChange={applyMembers}
				/>
				<TeamNotes
					// Per team, so an open note never follows a switch to another team.
					key={team?.key ?? "none"}
					notes={team?.notes ?? []}
					onChange={(notes) => team && editTeam(team.key, { notes })}
					disabledReason={team ? null : "Pick an uma first to start a team"}
				/>

				{team && mode === "account" && (
					<GalleryPostBar
						team={team}
						eventHref={pvpEventHref(ref)}
						saving={saveState === "pending" || saveState === "saving"}
						onPublish={() => setPublishing(true)}
					/>
				)}
				{publishing && team?.id != null && (
					<PublishDialog
						teamId={team.id}
						displayName={account?.display_name ?? ""}
						replacing={eventTeams.some((candidate) => candidate.post)}
						ownPost={team.post ?? null}
						onPosted={(post) => setTeamPost(team.key, post.public_id)}
						onClose={() => setPublishing(false)}
					/>
				)}

				{guide && (
					<p className="flex items-center gap-1.5 text-xs text-gray-500">
						<Star className="h-3 w-3 fill-highlight text-highlight" aria-hidden="true" />
						Recommended by this event's guide for that running style.
					</p>
				)}
				{mode === "guest" && (
					<p className="text-xs text-gray-400">
						Your teams are saved on this device.{" "}
						<Link to="/login" className="font-medium text-brand transition hover:text-brand/75">
							Sign in
						</Link>{" "}
						to keep them on every device.
					</p>
				)}
			</div>

			{skillsDocked && (
				<DockedPanel side="right" title="Recommended skills" icon={skillsIcon} onCollapse={() => dockSkills(false)}>
					{skillsBody}
				</DockedPanel>
			)}

			{deck && deckUmaSpot !== null && (
				<PvpCardPicker
					title={`An uma for the ${deckName}, spot ${deckUmaSpot + 1}`}
					skillsById={index.skillsById}
					event={event}
					style={deckStyle ?? null}
					selectedId={null}
					pool="uma"
					items={index.catalogue.umas}
					recommended={recommendedIds(guide, deckStyle ?? "front").umas}
					noteFor={(id) => releaseNote(releaseFor("uma", id))}
					blockReason={(id) => {
						const candidate = index.umasById.get(id)
						if (!candidate) return null
						return releaseBlockReason(releaseFor("uma", id)) ?? umaBlockReason(members, deckUmaSpot, candidate, index)
					}}
					onPick={(id) => {
						const uma = index.umasById.get(id)
						if (!uma) return
						const position = deckUmaSpot
						setDeckUmaSpot(null)
						putDeck(setMemberUma(members, position, uma, deckStyle), position)
					}}
					onClose={() => setDeckUmaSpot(null)}
				/>
			)}

			{skillSearch && (
				<SkillSearchPicker
					target={skillSearch}
					onTab={(tab) => setSkillSearch({ ...skillSearch, tab })}
					index={index}
					event={event}
					member={searchMember}
					releaseFor={releaseFor}
					members={members}
					style={searchStyle}
					recommended={recommendedIds(guide, searchStyle ?? "front")}
					onPickUma={(uma) => {
						applyMembers(setMemberUma(members, skillSearch.position, uma))
						setSkillSearch(null)
					}}
					onPickCard={(slot, id) => {
						applyMembers(setCard(members, skillSearch.position, slot, id))
						setSkillSearch(null)
					}}
					onClose={() => setSkillSearch(null)}
				/>
			)}
		</div>
	)
}

/** A slot the guide fills with words, for the toast: "for any Wit card", "for "Gold or better"". */
function openSlotWords(note: string): string {
	const type = noteOnlyType(note)
	if (type) return `for any ${DECK_STAT_LABELS[type]} card`
	const words = plainNoteText(note).trim()
	return words ? `for \u201c${words}\u201d` : "open"
}

function capitalise(words: string): string {
	return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The picker opened from a skill in the skills panel: one team spot, the
 * skill's name already searched, and a switch between umas (for the spot)
 * and support cards (for that uma's deck). Both branches render the same
 * PvpCardPicker in the same place, so React keeps the one instance and the
 * search and pinned skills survive the switch.
 *
 * A card goes in the slot chosen under the tabs: the uma's first free slot
 * from 1 to 5 by default, else the borrow slot, else (a full deck) card 1,
 * replacing what is there. Every slot is offered, so a full deck can still
 * take a card found by skill.
 */
function SkillSearchPicker({ target, onTab, index, event, member, releaseFor, members, style, recommended, onPickUma, onPickCard, onClose }: {
	target: SkillSearchTarget
	onTab: (tab: "uma" | "support") => void
	index: PvpCatalogueIndex
	event: RaceEvent
	member: PvpTeamMember | undefined
	releaseFor: ReleaseCheck
	members: PvpTeamMember[]
	style: MemberStyle | null
	recommended: { umas: Set<number>; cards: Set<number> }
	onPickUma: (uma: CatalogueUma) => void
	onPickCard: (slot: number, cardId: number) => void
	onClose: () => void
}) {
	const umaName = member ? (index.umasById.get(member.uma)?.name ?? "this uma") : null
	const freeSlot = member
		? (firstOpenCardSlot(member) ?? (member.cards.some((card) => card.slot === PVP_BORROW_SLOT) ? null : PVP_BORROW_SLOT))
		: null
	const [chosenSlot, setChosenSlot] = useState<number | null>(null)
	const cardSlot = chosenSlot ?? freeSlot ?? 1
	const inSlot = (slot: number) => member?.cards.find((card) => card.slot === slot)
	const slotLabel = (slot: number) => {
		const entry = inSlot(slot)
		const place = slot === PVP_BORROW_SLOT ? "Borrowed card" : `Card ${slot}`
		return `${place}: ${entry ? (index.cardsById.get(entry.support_card)?.name ?? "a card") : "empty"}`
	}
	const tabs = (
		<div className="flex flex-col gap-2">
			<div className="flex gap-1 rounded-lg bg-gray-900/70 p-1" role="group" aria-label="Search for">
				{(["uma", "support"] as const).map((tab) => (
					<button
						key={tab}
						type="button"
						aria-pressed={target.tab === tab}
						onClick={() => onTab(tab)}
						className={`flex-1 rounded-md px-3 py-1 text-sm font-medium transition ${
							target.tab === tab ? "bg-gray-700 text-brand shadow-sm" : "text-gray-400 hover:text-gray-100"
						}`}
					>
						{tab === "uma" ? "Umas" : `Support cards${umaName ? ` for ${umaName}` : ""}`}
					</button>
				))}
			</div>
			{target.tab === "support" && member && (
				<label className="flex items-center gap-2 text-xs text-gray-400">
					Put it in
					<select
						value={cardSlot}
						onChange={(change) => setChosenSlot(Number(change.target.value))}
						className="min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 outline-none focus:border-brand"
					>
						{[1, 2, 3, 4, 5, PVP_BORROW_SLOT].map((slot) => (
							<option key={slot} value={slot}>
								{slotLabel(slot)}
								{inSlot(slot) ? " (replace)" : ""}
							</option>
						))}
					</select>
				</label>
			)}
		</div>
	)
	const shared = {
		title: `Find "${target.query}" for spot ${target.position + 1}`,
		skillsById: index.skillsById,
		event,
		style,
		selectedId: null,
		initialSearch: target.query,
		tabs,
		onClose,
	}
	return target.tab === "uma" ? (
		<PvpCardPicker
			{...shared}
			pool="uma"
			items={index.catalogue.umas}
			recommended={recommended.umas}
			noteFor={(id) => releaseNote(releaseFor("uma", id))}
			blockReason={(id) => {
				const candidate = index.umasById.get(id)
				if (!candidate) return null
				const late = releaseBlockReason(releaseFor("uma", id))
				if (late) return late
				if (member?.uma === id) return "Already in this spot"
				return umaBlockReason(members, target.position, candidate, index)
			}}
			onPick={(id) => {
				const uma = index.umasById.get(id)
				if (uma) onPickUma(uma)
			}}
		/>
	) : (
		<PvpCardPicker
			{...shared}
			pool="support"
			items={index.catalogue.support_cards}
			recommended={recommended.cards}
			noteFor={(id) => releaseNote(releaseFor("support", id))}
			blockReason={(id) => {
				const late = releaseBlockReason(releaseFor("support", id))
				if (late) return late
				if (!member) return "Add an uma to this spot first"
				const held = member.cards.find((card) => card.support_card === id)
				if (held) return held.slot === cardSlot ? "Already in this slot" : "Already in this deck"
				return cardBlockReason(member, cardSlot, id, index)
			}}
			onPick={(id) => onPickCard(cardSlot, id)}
		/>
	)
}

function TeamToolbar({ leading, trailing, teams, selected, mode, saveState, onSelect, onCreate, onRename, onDelete }: {
	/** Drawn first: the Guide picks button, below xl. */
	leading?: ReactNode
	/** Drawn last: the Skills button, below 2xl. */
	trailing?: ReactNode
	teams: PvpTeam[]
	selected: PvpTeam | null
	mode: PvpTeamsContextType["mode"]
	saveState: PvpTeamsContextType["saveState"]
	onSelect: (key: string) => void
	onCreate: () => void
	onRename: (name: string) => void
	onDelete: () => void
}) {
	const [renaming, setRenaming] = useState(false)
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const atCap = teams.length >= PVP_TEAM_CAP_PER_EVENT
	const selectedIndex = selected ? teams.indexOf(selected) : -1

	return (
		<div className="card-panel flex flex-wrap items-center gap-2 p-2">
			{leading}
			{teams.length === 0 ? (
				<p className="px-2 text-sm text-gray-400">Pick an uma below to start your first team for this event.</p>
			) : (
				<>
					<div className="flex flex-wrap gap-1 rounded-lg bg-gray-900/70 p-1" role="group" aria-label="Your teams for this event">
						{teams.map((team, index) => (
							<button
								key={team.key}
								type="button"
								aria-pressed={team === selected}
								onClick={() => {
									onSelect(team.key)
									setRenaming(false)
									setConfirmingDelete(false)
								}}
								className={`max-w-[12rem] truncate rounded-md px-3 py-1.5 text-sm font-medium transition ${
									team === selected
										? "bg-gray-700 text-brand shadow-sm"
										: "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
								}`}
							>
								{teamLabel(team, index)}
							</button>
						))}
					</div>
					<button
						type="button"
						disabled={atCap}
						title={atCap ? `You can keep up to ${PVP_TEAM_CAP_PER_EVENT} teams for one event.` : undefined}
						onClick={onCreate}
						className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-gray-300 transition hover:bg-gray-700 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
					>
						<Plus className="h-4 w-4" />
						New team
					</button>
				</>
			)}

			<div className="ml-auto flex items-center gap-1.5">
				<SaveStatus mode={mode} saveState={saveState} hasTeam={selected !== null} />
				{selected &&
					(renaming ? (
						<RenameField
							initial={selected.name}
							placeholder={teamLabel(selected, selectedIndex)}
							onDone={(name) => {
								if (name !== null) onRename(name)
								setRenaming(false)
							}}
						/>
					) : confirmingDelete ? (
						<span className="flex items-center gap-1.5 text-sm text-gray-300">
							Delete {teamLabel(selected, selectedIndex)}?
							<button
								type="button"
								className="rounded-md border border-highlight/60 px-2 py-1 text-highlight transition hover:bg-highlight/10"
								onClick={() => {
									onDelete()
									setConfirmingDelete(false)
								}}
							>
								Delete
							</button>
							<button
								type="button"
								className="rounded-md border border-gray-600 px-2 py-1 transition hover:bg-gray-700"
								onClick={() => setConfirmingDelete(false)}
							>
								Keep
							</button>
						</span>
					) : (
						<>
							<IconButton label="Rename team" onClick={() => setRenaming(true)}>
								<Pencil className="h-4 w-4" />
							</IconButton>
							<IconButton label="Delete team" onClick={() => setConfirmingDelete(true)}>
								<Trash2 className="h-4 w-4" />
							</IconButton>
						</>
					))}
				{trailing}
			</div>
		</div>
	)
}

/**
 * The selected team's place in the gallery, for a signed-in player: post it,
 * or, once posted, a link to the post and "Update post". A post is a frozen
 * copy (the API's gallery.publish_team), so edits made here reach it only
 * when the player updates it; the line says so. Waits for a pending save, so
 * what gets posted is what is on screen.
 */
function GalleryPostBar({ team, eventHref, saving, onPublish }: {
	team: PvpTeam
	eventHref: string
	saving: boolean
	onPublish: () => void
}) {
	const complete =
		team.members.length === PVP_TEAM_SIZE && team.members.every((member) => member.cards.length === PVP_DECK_SIZE)
	const blocked = team.id === null || saving ? "Saving your team first…" : complete ? null : "Fill all three umas and their six cards to post this team."
	const button = (
		<button
			type="button"
			disabled={blocked !== null}
			title={blocked ?? undefined}
			onClick={onPublish}
			className="flex items-center gap-1.5 rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-100 transition enabled:hover:border-brand enabled:hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Send className="h-4 w-4" aria-hidden="true" />
			{team.post ? "Update post" : "Post to gallery"}
		</button>
	)
	return (
		<div className="card-panel flex flex-wrap items-center gap-2 p-2 text-sm text-gray-300">
			{team.post ? (
				<>
					<Link
						to={`${eventHref}&view=gallery&post=${team.post}`}
						className="flex items-center gap-1.5 rounded-md bg-brand/15 px-2.5 py-1 font-medium text-brand transition hover:bg-brand/25"
					>
						<LayoutGrid className="h-4 w-4" aria-hidden="true" />
						Posted
					</Link>
					<span className="min-w-0 flex-1 text-xs text-gray-400">
						Your post shows this team as it was when you posted it.
					</span>
				</>
			) : (
				<span className="min-w-0 flex-1 text-xs text-gray-400">
					{blocked && !saving && team.id !== null ? blocked : "Share this team in the gallery for this event."}
				</span>
			)}
			{button}
		</div>
	)
}

/** Enter or the tick saves, Escape cancels (null). */
function RenameField({ initial, placeholder, onDone }: {
	initial: string
	placeholder: string
	onDone: (name: string | null) => void
}) {
	const [value, setValue] = useState(initial)
	return (
		<form
			className="flex items-center gap-1"
			onSubmit={(submit) => {
				submit.preventDefault()
				onDone(value.trim())
			}}
		>
			<input
				autoFocus
				aria-label="Team name"
				maxLength={40}
				value={value}
				placeholder={placeholder}
				onChange={(change) => setValue(change.target.value)}
				onKeyDown={(keydown) => {
					if (keydown.key === "Escape") onDone(null)
				}}
				className="w-44 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 outline-none focus:border-brand"
			/>
			<IconButton label="Save name" submit>
				<Check className="h-4 w-4" />
			</IconButton>
		</form>
	)
}

function IconButton({ label, onClick, submit = false, children }: {
	label: string
	onClick?: () => void
	submit?: boolean
	children: ReactNode
}) {
	return (
		<button
			type={submit ? "submit" : "button"}
			aria-label={label}
			title={label}
			onClick={onClick}
			className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
		>
			{children}
		</button>
	)
}

function Notice({ children }: { children: ReactNode }) {
	return <p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">{children}</p>
}
