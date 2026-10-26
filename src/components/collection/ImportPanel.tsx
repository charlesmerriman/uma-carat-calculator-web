/**
 * "Import from the game": read umadump's veteran file in the browser, preview
 * it, save the ticked ones (utils/gameImport/umadumpVeterans.ts reads it and
 * says what never leaves the device).
 *
 * An inline panel on the Collection page, like the add form. The preview ticks
 * every veteran, newest first, borrowed ones marked. There is no limit on how
 * many an account keeps (owner, 2026-10-26).
 *
 * Saving REPLACES the last import: a veteran imported before and not ticked
 * now is removed, unless a logged CM run uses her (the server keeps her and
 * flags her). The panel says this before Save.
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { FileUp, Loader2 } from "lucide-react"
import { useImportVeterans } from "../../services/trainedUmaQueries"
import { failureText } from "../../services/galleryQueries"
import { readVeteranFile, toImportItem, type ImportedVeteran } from "../../utils/gameImport/umadumpVeterans"
import { statLine } from "../../utils/trainedUmas"
import { ACTION_BUTTON, PRIMARY_BUTTON } from "../pvp/gallery/galleryStyles"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"

/** Where umadump is published: a community tool the site does not make. */
const UMADUMP_URL = "https://github.com/Werseter/umadump"

type Read =
	| { status: "empty" }
	| { status: "error"; message: string }
	| { status: "ready"; veterans: ImportedVeteran[]; unknownUmas: number; unknownSkills: number }

export function ImportPanel({ index, onDone }: { index: PvpCatalogueIndex; onDone: () => void }) {
	const save = useImportVeterans()
	const [read, setRead] = useState<Read>({ status: "empty" })
	const [ticked, setTicked] = useState<Set<number>>(new Set())

	// The game's ids to the site's, from the catalogue already loaded.
	const lookups = useMemo(
		() => ({
			umas: new Map(index.catalogue.umas.filter((uma) => uma.game_id != null).map((uma) => [uma.game_id as number, uma.id])),
			skills: new Map(index.catalogue.skills.filter((skill) => skill.game_id != null).map((skill) => [skill.game_id as number, skill.id])),
		}),
		[index]
	)

	const open = async (file: File | undefined) => {
		if (!file) return
		let json: unknown
		try {
			json = JSON.parse(await file.text())
		} catch {
			setRead({ status: "error", message: "That file isn't JSON. Pick trained_chara_data.json from the folder umadump wrote." })
			return
		}
		const result = readVeteranFile(json, lookups.umas, lookups.skills)
		if (!result.ok) {
			setRead({ status: "error", message: result.error })
			return
		}
		setRead({ status: "ready", ...result })
		setTicked(new Set(result.veterans.map((veteran) => veteran.import_key)))
	}

	const toggle = (key: number) =>
		setTicked((current) => {
			const next = new Set(current)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})

	const submit = () => {
		if (read.status !== "ready") return
		const items = read.veterans.filter((veteran) => ticked.has(veteran.import_key)).map(toImportItem)
		save.mutate(items, {
			onSuccess: (outcome) => {
				const parts = [
					outcome.created && `${outcome.created} added`,
					outcome.updated && `${outcome.updated} updated`,
					outcome.removed && `${outcome.removed} removed`,
					outcome.kept && `${outcome.kept} kept for your CM runs`,
				].filter(Boolean)
				toast.success(parts.length ? `Veterans imported: ${parts.join(", ")}.` : "Nothing to change.")
				onDone()
			},
		})
	}

	return (
		<section className="card-panel flex flex-col gap-3 p-4" aria-label="Import from the game">
			<h3 className="text-sm font-semibold text-gray-100">Import from the game</h3>
			<p className="text-xs text-gray-400">
				Pick the <code className="text-gray-300">trained_chara_data.json</code> file that{" "}
				<a href={UMADUMP_URL} target="_blank" rel="noreferrer" className="text-brand hover:text-brand/75">
					umadump
				</a>{" "}
				wrote (a community tool we don&apos;t make, for the Steam version). The file is read here, in your browser.
				Everything it says about each veteran is kept on your account, your memos and game account id included. Other
				players&apos; account ids (a borrowed veteran&apos;s owner) are removed before anything is sent.
			</p>

			<label className={`${ACTION_BUTTON} w-fit cursor-pointer`}>
				<FileUp className="h-4 w-4" aria-hidden="true" />
				Choose the file
				<input
					type="file"
					accept=".json,application/json"
					className="sr-only"
					onChange={(change) => void open(change.target.files?.[0])}
				/>
			</label>

			{read.status === "error" && (
				<p className="text-sm text-highlight" role="alert">
					{read.message}
				</p>
			)}

			{read.status === "ready" && (
				<>
					<p className="text-sm text-gray-300">
						{read.veterans.length} {read.veterans.length === 1 ? "veteran" : "veterans"} in the file.
					</p>
					{(read.unknownUmas > 0 || read.unknownSkills > 0) && (
						<p className="text-xs text-gray-400">
							{[
								read.unknownUmas > 0 && `${read.unknownUmas} ${read.unknownUmas === 1 ? "uma" : "umas"} the site doesn't have yet, left out`,
								read.unknownSkills > 0 && `${read.unknownSkills} ${read.unknownSkills === 1 ? "skill" : "skills"} the site doesn't know yet, left off`,
							]
								.filter(Boolean)
								.join(". ")}
							.
						</p>
					)}
					<ul className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1" aria-label="Veterans in the file">
						{read.veterans.map((veteran) => {
							const uma = index.umasById.get(veteran.uma)
							return (
								<li key={veteran.import_key}>
									<label className="flex items-center gap-2 rounded-md px-1 py-0.5 text-sm text-gray-200 hover:bg-gray-800">
										<input
											type="checkbox"
											checked={ticked.has(veteran.import_key)}
											onChange={() => toggle(veteran.import_key)}
										/>
										<span className="min-w-0 flex-1 truncate">
											{uma?.name ?? "Unknown uma"}
											{veteran.borrowed && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-500">Borrowed</span>}
										</span>
										<span className="text-xs text-gray-400">{statLine(veteran)}</span>
										<span className="w-16 text-right text-xs text-gray-500">
											{veteran.skills.length} {veteran.skills.length === 1 ? "skill" : "skills"}
										</span>
									</label>
								</li>
							)
						})}
					</ul>
					<p className="text-xs text-gray-400">
						Saving replaces your last import. A veteran you imported before and don&apos;t tick now is removed, unless
						a CM run you logged used her. Veterans you added by hand stay.
					</p>
				</>
			)}

			{save.error && (
				<p className="text-sm text-highlight" role="alert">
					{failureText(save.error, "The import wasn't saved.")}
				</p>
			)}
			<div className="flex justify-end gap-2">
				<button type="button" className={ACTION_BUTTON} onClick={onDone}>
					Cancel
				</button>
				<button type="button" className={PRIMARY_BUTTON} disabled={read.status !== "ready" || save.isPending} onClick={submit}>
					{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
					Save {read.status === "ready" ? ticked.size : ""}
				</button>
			</div>
		</section>
	)
}
