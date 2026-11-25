/**
 * The umadump folder CM Runs watches (notes/cm-runs-plan-2.md, PR 6): Chrome
 * and Edge's File System Access API, which lets a page read a folder the
 * player picks. Firefox and Safari don't have it, so the button isn't drawn
 * there (canWatchFolder, read in an effect, never at render: /app is
 * prerendered).
 *
 * The folder's handle isn't JSON, so it can't go in localStorage; it is kept
 * in IndexedDB through idb-keyval, a tiny get/set over it, per device. On a
 * later visit, queryPermission says whether the browser kept the grant ("Allow
 * on every visit"); if not, one click re-grants (requestPermission needs the
 * click).
 *
 * Only reads, and only the folder picked: nothing is written to the player's
 * disk.
 */

import { del, get, set } from "idb-keyval"

/** A folder, as much of FileSystemDirectoryHandle as this uses (not in TypeScript's DOM lib). */
export interface DirectoryHandle {
	kind: "directory"
	name: string
	getDirectoryHandle(name: string): Promise<DirectoryHandle>
	values(): AsyncIterable<DirectoryHandle | FileHandle>
	queryPermission?(options: { mode: "read" }): Promise<PermissionState>
	requestPermission?(options: { mode: "read" }): Promise<PermissionState>
}

export interface FileHandle {
	kind: "file"
	name: string
	getFile(): Promise<File>
}

const STORE_KEY = "uma-runs-replay-folder"

/** Whether this browser can watch a folder (Chrome and Edge). Call it in an effect or a handler. */
export function canWatchFolder(): boolean {
	return typeof window !== "undefined" && "showDirectoryPicker" in window
}

/** The player picks the folder (umadump's, or the replay folder inside it); kept for the next visit. Null when they cancel. */
export async function pickFolder(): Promise<DirectoryHandle | null> {
	const picker = (window as unknown as { showDirectoryPicker(options: object): Promise<DirectoryHandle> }).showDirectoryPicker
	try {
		const handle = await picker({ id: "umadump", mode: "read" })
		// Storage blocked: it works for this visit only.
		await set(STORE_KEY, handle).catch(() => undefined)
		return handle
	} catch {
		// The player closed the picker (AbortError), or the browser refused.
		return null
	}
}

/** The folder picked on an earlier visit, or null. */
export async function savedFolder(): Promise<DirectoryHandle | null> {
	try {
		return (await get<DirectoryHandle>(STORE_KEY)) ?? null
	} catch {
		return null
	}
}

export async function forgetFolder(): Promise<void> {
	await del(STORE_KEY).catch(() => undefined)
}

/** Whether the page may read the folder; with `ask`, the browser asks the player (needs a click). */
export async function folderPermission(handle: DirectoryHandle, ask = false): Promise<PermissionState> {
	try {
		const check = ask ? handle.requestPermission : handle.queryPermission
		return check ? await check.call(handle, { mode: "read" }) : "granted"
	} catch {
		return "denied"
	}
}

/**
 * Where the replays are, whichever folder was picked: umadump's own (they're
 * in `race_replays/champions_race`; owner's files, 2026-11-25), an older
 * layout's `champions_race`, or the replay folder itself. Looked up on every
 * read, since the folder only appears after the first race.
 */
export async function replayFolderOf(picked: DirectoryHandle): Promise<DirectoryHandle> {
	for (const path of [["race_replays", "champions_race"], ["champions_race"]]) {
		try {
			let folder = picked
			for (const name of path) folder = await folder.getDirectoryHandle(name)
			return folder
		} catch {
			// Not this layout: try the next.
		}
	}
	return picked
}

/** The folder's .json files, with their modified times. Opening a File's text is the caller's (only new ones need it). */
export async function listReplayFiles(folder: DirectoryHandle): Promise<File[]> {
	const files: File[] = []
	for await (const entry of folder.values()) {
		if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".json")) files.push(await entry.getFile())
	}
	return files
}
