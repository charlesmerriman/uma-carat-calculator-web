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
 * On Safari's engine it is drawn twice, keeping the second: Safari decodes the
 * inlined card art during the first pass and draws it blank, and by the second
 * it has it. Every other browser draws it right the first time, so it draws
 * once (it used to draw twice everywhere, twice the work for nothing).
 *
 * `fonts` keeps the embedded-font CSS between the redraws of one panel opening,
 * so the site's fonts are gathered once rather than on every redraw.
 * html-to-image embeds only the font families the picture uses, and a checkbox
 * can add text in another family, so the CSS is kept per set of families.
 */
export async function renderNodeToPng(node: HTMLElement, fonts?: Map<string, string>): Promise<Blob> {
	const { getFontEmbedCSS, toBlob } = await import("html-to-image")
	const options: { pixelRatio: number; fontEmbedCSS?: string } = { pixelRatio: 2 }
	if (fonts) {
		const families = fontFamiliesIn(node)
		let css = fonts.get(families)
		if (css === undefined) {
			css = await getFontEmbedCSS(node)
			fonts.set(families, css)
		}
		options.fontEmbedCSS = css
	}
	if (needsSecondPass()) await toBlob(node, options)
	const blob = await toBlob(node, options)
	if (!blob) throw new Error("The picture came out empty.")
	return blob
}

/** Every font family `node` draws with, as one key: what html-to-image's
 *  font embedding depends on. */
function fontFamiliesIn(node: HTMLElement): string {
	const families = new Set<string>()
	for (const element of [node, ...node.querySelectorAll("*")]) {
		families.add(getComputedStyle(element).fontFamily)
	}
	return [...families].sort().join("|")
}

/**
 * Whether this browser runs Safari's engine (WebKit), the one that draws inlined
 * art blank on the first pass. Every browser on an iPhone or iPad does, since
 * Apple requires it (Chrome there says "CriOS", Firefox "FxiOS"); an iPad asking
 * for the desktop site calls itself a Mac but has a touch screen; and Safari on
 * a Mac is WebKit without Chrome's or Edge's name in its user agent.
 */
export function needsSecondPass(userAgent = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
	const apple = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)
	const safari = /AppleWebKit/.test(userAgent) && !/Chrome|Chromium|Android|Edg|OPR/.test(userAgent)
	return apple || safari
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
