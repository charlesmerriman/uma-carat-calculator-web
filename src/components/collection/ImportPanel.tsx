/**
 * "Import from the game": read umadump's files in the browser, preview them,
 * save. Up to three files at once, each recognised by its shape, never by its
 * name (utils/gameImport):
 *
 *   trained_chara_data.json   veterans      (umadumpVeterans.ts)
 *   card_data.json            umas owned    (umadumpRoster.ts)
 *   support_card_data.json    cards owned   (umadumpRoster.ts)
 *
 * An inline panel on the Collection page, like the add form. Everything each
 * file says is sent, the player's own game account id and memos included;
 * other players' account ids are stripped first (owner, 2026-10-26).
 *
 * Veterans: the preview ticks every one, newest first, borrowed ones marked,
 * and saving REPLACES the last import (one imported before and unticked now is
 * removed, unless a logged CM run uses her). Umas and cards: each file REPLACES
 * that list, hand edits included, and what the file lacks is removed (owner,
 * 2026-10-26: "if it doesn't exist in the file, it doesn't exist"); a list with
 * no file is left alone. The panel says both before Save. No limit on how many
 * an account keeps.
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { FileUp, Loader2 } from "lucide-react"
import { useImportVeterans } from "../../services/trainedUmaQueries"
import { useImportRoster } from "../../services/rosterQueries"
import { failureText } from "../../services/galleryQueries"
import { readVeteranFile, toImportItem, type ImportedVeteran } from "../../utils/gameImport/umadumpVeterans"
import {
	detectExportFile,
	readOwnedCards,
	readOwnedUmas,
	type OwnedCardItem,
	type OwnedUmaItem,
	type RosterFileResult,
} from "../../utils/gameImport/umadumpRoster"
import { statLine } from "../../utils/trainedUmas"
import { ACTION_BUTTON, PRIMARY_BUTTON } from "../pvp/gallery/galleryStyles"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"

/** Where umadump is published: a community tool the site does not make. */
const UMADUMP_URL = "https://github.com/Werseter/umadump"

interface ReadVeterans {
	veterans: ImportedVeteran[]
	unknownUmas: number
	unknownSkills: number
}

/** What the chosen files held, by kind; a kind is absent until its file is chosen. */
interface ReadFiles {
	veterans?: ReadVeterans
	umas?: RosterFileResult<OwnedUmaItem>
	supportCards?: RosterFileResult<OwnedCardItem>
	/** One sentence per file that was not one of the three. */
	problems: string[]
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export function ImportPanel({ index, onDone }: { index: PvpCatalogueIndex; onDone: () => void }) {
	const saveVeterans = useImportVeterans()
	const saveRoster = useImportRoster()
	const [read, setRead] = useState<ReadFiles>({ problems: [] })
	const [ticked, setTicked] = useState<Set<number>>(new Set())
	const [saving, setSaving] = useState(false)

	// The game's ids to the site's, from the catalogue already loaded.
	const lookups = useMemo(() => {
		const byGameId = <T extends { id: number; game_id?: number | null }>(rows: T[]) =>
			new Map(rows.filter((row) => row.game_id != null).map((row) => [row.game_id as number, row.id]))
		return {
			umas: byGameId(index.catalogue.umas),
			cards: byGameId(index.catalogue.support_cards),
			skills: byGameId(index.catalogue.skills),
		}
	}, [index])

	const open = async (files: FileList | null) => {
		if (!files || files.length === 0) return
		const next: ReadFiles = { problems: [] }
		for (const file of Array.from(files)) {
			let json: unknown
			try {
				json = JSON.parse(await file.text())
			} catch {
				next.problems.push(`${file.name} isn't JSON.`)
				continue
			}
			const kind = detectExportFile(json)
			if (kind === "veterans") {
				const result = readVeteranFile(json, lookups.umas, lookups.skills)
				if (result.ok) next.veterans = result
				else next.problems.push(`${file.name}: ${result.error}`)
			} else if (kind === "umas") {
				next.umas = readOwnedUmas(json as Array<Record<string, unknown>>, lookups.umas)
			} else if (kind === "support_cards") {
				next.supportCards = readOwnedCards(json as Array<Record<string, unknown>>, lookups.cards)
			} else {
				next.problems.push(
					`${file.name} isn't one of the files this reads. Pick trained_chara_data.json, card_data.json or support_card_data.json.`
				)
			}
		}
		setRead(next)
		setTicked(new Set((next.veterans?.veterans ?? []).map((veteran) => veteran.import_key)))
	}

	const toggle = (key: number) =>
		setTicked((current) => {
			const next = new Set(current)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})

	const hasSomething = Boolean(read.veterans || read.umas || read.supportCards)

	/** Veterans first, then the roster; each says how it went in one toast. */
	const submit = async () => {
		setSaving(true)
		const lines: string[] = []
		try {
			if (read.veterans) {
				const items = read.veterans.veterans.filter((veteran) => ticked.has(veteran.import_key)).map(toImportItem)
				const outcome = await saveVeterans.mutateAsync(items)
				const parts = [
					outcome.created && `${outcome.created} added`,
					outcome.updated && `${outcome.updated} updated`,
					outcome.removed && `${outcome.removed} removed`,
					outcome.kept && `${outcome.kept} kept for your CM runs`,
				].filter(Boolean)
				lines.push(`Veterans: ${parts.length ? parts.join(", ") : "no change"}.`)
			}
			if (read.umas || read.supportCards) {
				// Only the lists with a file: a list left out is not replaced.
				const outcome = await saveRoster.mutateAsync({
					...(read.umas ? { umas: read.umas.items } : {}),
					...(read.supportCards ? { support_cards: read.supportCards.items } : {}),
				})
				for (const [label, counts] of [
					["Umas", outcome.umas],
					["Support cards", outcome.support_cards],
				] as const) {
					if (!counts) continue
					const parts = [
						counts.added && `${counts.added} added`,
						counts.updated && `${counts.updated} updated`,
						counts.removed && `${counts.removed} removed`,
					].filter(Boolean)
					lines.push(`${label}: ${parts.length ? parts.join(", ") : "no change"}.`)
				}
			}
			toast.success("Imported from the game.", { description: lines.join(" ") })
			onDone()
		} catch {
			// The mutation's error is shown below the preview.
		} finally {
			setSaving(false)
		}
	}

	const error = saveVeterans.error ?? saveRoster.error
	const maxed = read.supportCards?.items.filter((item) => item.limit_break >= 4).length ?? 0

	return (
		<section className="card-panel flex flex-col gap-3 p-4" aria-label="Import from the game">
			<h3 className="text-sm font-semibold text-gray-100">Import from the game</h3>
			<p className="text-xs text-gray-400">
				Pick the files that{" "}
				<a href={UMADUMP_URL} target="_blank" rel="noreferrer" className="text-brand hover:text-brand/75">
					umadump
				</a>{" "}
				wrote (a community tool we don&apos;t make, for the Steam version): <code className="text-gray-300">trained_chara_data.json</code>{" "}
				for veterans, <code className="text-gray-300">card_data.json</code> for your umas,{" "}
				<code className="text-gray-300">support_card_data.json</code> for your cards. One or all three. The files are read here, in
				your browser. Everything they say is kept on your account, your memos and game account id included. Other players&apos;
				account ids are removed before anything is sent.
			</p>

			<label className={`${ACTION_BUTTON} w-fit cursor-pointer`}>
				<FileUp className="h-4 w-4" aria-hidden="true" />
				Choose the files
				<input
					type="file"
					multiple
					accept=".json,application/json"
					className="sr-only"
					onChange={(change) => void open(change.target.files)}
				/>
			</label>

			{read.problems.map((problem) => (
				<p key={problem} className="text-sm text-highlight" role="alert">
					{problem}
				</p>
			))}

			{read.veterans && (
				<section className="flex flex-col gap-2" aria-label="Veterans in the files">
					<p className="text-sm text-gray-300">{plural(read.veterans.veterans.length, "veteran", "veterans")} in the file.</p>
					{(read.veterans.unknownUmas > 0 || read.veterans.unknownSkills > 0) && (
						<p className="text-xs text-gray-400">
							{[
								read.veterans.unknownUmas > 0 && `${plural(read.veterans.unknownUmas, "uma", "umas")} the site doesn't have yet, left out`,
								read.veterans.unknownSkills > 0 && `${plural(read.veterans.unknownSkills, "skill", "skills")} the site doesn't know yet, left off`,
							]
								.filter(Boolean)
								.join(". ")}
							.
						</p>
					)}
					<ul className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
						{read.veterans.veterans.map((veteran) => {
							const uma = index.umasById.get(veteran.uma)
							return (
								<li key={veteran.import_key}>
									<label className="flex items-center gap-2 rounded-md px-1 py-0.5 text-sm text-gray-200 hover:bg-gray-800">
										<input type="checkbox" checked={ticked.has(veteran.import_key)} onChange={() => toggle(veteran.import_key)} />
										<span className="min-w-0 flex-1 truncate">
											{uma?.name ?? "Unknown uma"}
											{veteran.borrowed && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-500">Borrowed</span>}
										</span>
										<span className="text-xs text-gray-400">{statLine(veteran)}</span>
										<span className="w-16 text-right text-xs text-gray-500">{plural(veteran.skills.length, "skill", "skills")}</span>
									</label>
								</li>
							)
						})}
					</ul>
					<p className="text-xs text-gray-400">
						Saving replaces your last veteran import. A veteran you imported before and don&apos;t tick now is removed, unless a CM
						run you logged used her. Veterans you added by hand stay.
					</p>
				</section>
			)}

			{(read.umas || read.supportCards) && (
				<section className="flex flex-col gap-1 text-sm text-gray-300" aria-label="Umas and cards in the files">
					{read.umas && (
						<p>
							{plural(read.umas.items.length, "uma", "umas")} you own.
							{read.umas.unknown > 0 && ` ${plural(read.umas.unknown, "is", "are")} not on the site yet, left out.`}
						</p>
					)}
					{read.supportCards && (
						<p>
							{plural(read.supportCards.items.length, "support card", "support cards")} you own, {maxed} at MLB.
							{read.supportCards.unknown > 0 && ` ${plural(read.supportCards.unknown, "is", "are")} not on the site yet, left out.`}
						</p>
					)}
					<p className="text-xs text-gray-400">
						Saving replaces {read.umas && read.supportCards ? "both lists" : read.umas ? "your umas list" : "your support cards list"} with
						the file, including anything you set by hand. Anything not in the file is removed. You can edit after.
					</p>
				</section>
			)}

			{error && (
				<p className="text-sm text-highlight" role="alert">
					{failureText(error, "The import wasn't saved.")}
				</p>
			)}
			<div className="flex justify-end gap-2">
				<button type="button" className={ACTION_BUTTON} onClick={onDone}>
					Cancel
				</button>
				<button type="button" className={PRIMARY_BUTTON} disabled={!hasSomething || saving} onClick={() => void submit()}>
					{saving && <Loader2 className="h-4 w-4 animate-spin" />}
					Save
				</button>
			</div>
		</section>
	)
}
