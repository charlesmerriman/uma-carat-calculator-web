import { describe, expect, it, vi } from "vitest"
import { folderPermission, listReplayFiles, replayFolderOf, type DirectoryHandle } from "../services/replayFolder"

vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }))

/**
 * services/replayFolder.ts with the File System Access API faked: a folder is
 * a name, its children and its files.
 */
function folder(name: string, children: DirectoryHandle[] = [], files: string[] = []): DirectoryHandle {
	return {
		kind: "directory",
		name,
		getDirectoryHandle: async (child: string) => {
			const found = children.find((entry) => entry.name === child)
			if (!found) throw new DOMException("not found", "NotFoundError")
			return found
		},
		values: async function* () {
			yield* children
			for (const file of files) yield { kind: "file" as const, name: file, getFile: async () => new File(["{}"], file, { lastModified: 1 }) }
		},
	}
}

describe("replayFolderOf", () => {
	it("finds the replays whichever folder the player picked", async () => {
		const champions = folder("champions_race")
		// umadump's own folder: race_replays/champions_race (the owner's 2026-11-25 files).
		expect(await replayFolderOf(folder("umadump", [folder("race_replays", [champions])]))).toBe(champions)
		// An older layout, and the replay folder itself.
		const older = folder("champions_race")
		expect(await replayFolderOf(folder("umadump", [older]))).toBe(older)
		expect(await replayFolderOf(champions)).toBe(champions)
	})
})

describe("listReplayFiles", () => {
	it("lists the .json files only, with their times", async () => {
		const files = await listReplayFiles(folder("champions_race", [folder("old")], ["a.json", "notes.txt", "B.JSON"]))
		expect(files.map((file) => file.name)).toEqual(["a.json", "B.JSON"])
		expect(files[0].lastModified).toBe(1)
	})
})

describe("folderPermission", () => {
	it("asks only when told to, and reads a refusal as denied", async () => {
		const query = vi.fn(async () => "prompt" as PermissionState)
		const request = vi.fn(async () => "granted" as PermissionState)
		const handle = { ...folder("umadump"), queryPermission: query, requestPermission: request }
		expect(await folderPermission(handle)).toBe("prompt")
		expect(request).not.toHaveBeenCalled()
		expect(await folderPermission(handle, true)).toBe("granted")
		expect(await folderPermission({ ...handle, queryPermission: async () => Promise.reject(new Error("gone")) })).toBe("denied")
	})
})
