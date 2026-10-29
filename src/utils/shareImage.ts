/**
 * Turn a piece of the page into a PNG, and hand it to the player: copy it,
 * send it through the device's share sheet, or download it.
 *
 * Generic on purpose (notes/share-plan-image-plan.md): the pull plan's picture
 * uses it now, and the PvP team's picture will draw a different component
 * through the same pipe.
 *
 * Every function here touches `navigator` or `document`, so call them from an
 * event handler or an effect, never while rendering (the /app pages are
 * prerendered; frontend-ui.md).
 */

/**
 * Draw `node` as a PNG at twice its CSS size, so it stays sharp on a phone.
 *
 * `html-to-image` is imported on first use: it never runs during the prerender
 * and stays out of the main bundle. It hands the HTML to the browser to draw
 * (an SVG foreignObject), which is why Tailwind 4's oklch() and color-mix()
 * colours come out right; html2canvas re-implements CSS and can't read them.
 *
 * Drawn twice, keeping the second. Safari decodes the inlined card art during
 * the first pass and draws it blank; by the second it has it.
 */
export async function renderNodeToPng(node: HTMLElement): Promise<Blob> {
	const { toBlob } = await import("html-to-image")
	const options = { pixelRatio: 2 }
	await toBlob(node, options)
	const blob = await toBlob(node, options)
	if (!blob) throw new Error("The picture came out empty.")
	return blob
}

/** What this browser can do with a picture. Download always works. */
export interface ShareSupport {
	copy: boolean
	share: boolean
}

export function shareSupport(): ShareSupport {
	const copy = typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function"
	let share = false
	try {
		// Desktop browsers often have navigator.share but refuse files, so ask
		// about a file specifically.
		share =
			typeof navigator.canShare === "function" &&
			navigator.canShare({ files: [new File([], "plan.png", { type: "image/png" })] })
	} catch {
		share = false
	}
	return { copy, share }
}

/** Put the picture on the clipboard, ready to paste into Discord or a post. */
export async function copyImage(blob: Blob): Promise<void> {
	await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
}

/** Open the device's share sheet with the picture. Rejects if the player cancels. */
export async function shareImageFile(blob: Blob, filename: string, title: string): Promise<void> {
	await navigator.share({ files: [new File([blob], filename, { type: blob.type })], title })
}

/** Save the picture as a file. */
export function downloadImage(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	link.download = filename
	document.body.append(link)
	link.click()
	link.remove()
	// After the click has had its turn: revoking at once can cancel the save.
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}
