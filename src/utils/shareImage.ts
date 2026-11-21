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

/** What one panel opening keeps between its redraws (renderNodeToPng). */
export interface DrawCache {
	/** Embedded-font CSS, per set of font families. */
	fonts: Map<string, string>
	/** Each picture's inlined copy by URL, or null when it couldn't be loaded. */
	images: Map<string, string | null>
}

export function newDrawCache(): DrawCache {
	return { fonts: new Map(), images: new Map() }
}

/** A drawn picture, and how many of its pictures (card art, the avatar) were
 *  left out because they couldn't be loaded. */
export interface DrawnPicture {
	blob: Blob
	missingArt: number
}

/**
 * The most canvas pixels an iPhone or iPad will draw: WebKit caps a canvas at
 * 16,777,216 (4096 x 4096) and draws nothing past it. Kept a little under.
 * Desktop browsers allow far more, so this is the one that binds.
 */
const MAX_CANVAS_PIXELS = 16_000_000

/**
 * The widest picture we make, in real pixels. A one-column picture (960 CSS
 * px: a plan up to 30 banners, a PvP team) still draws at 2x, 1,920 wide. A
 * two-column plan (1,880 CSS px) drew at up to 2x before, capped only by
 * MAX_CANVAS_PIXELS: Daptrius's 41-banner plan came out 3,246 x 4,928 (16
 * million pixels), far more than any screen shows, and slow on a phone, which
 * draws it up to MAX_WEBKIT_PASSES times. Capped, it is about 2,000 x 3,030
 * (6 million): the same text, a third of the drawing (board post "Plan
 * Images Export", 2026-11-20).
 */
const MAX_OUTPUT_WIDTH = 2000

/**
 * The scale to draw a `width` x `height` (CSS px) picture at: twice its size,
 * so it stays sharp on a phone, but never wider than MAX_OUTPUT_WIDTH and
 * never past MAX_CANVAS_PIXELS. A very long plan then draws a little softer
 * rather than failing on an iPhone (notes/v2-10-feedback-plan.md, item 2).
 */
export function pixelRatioFor(width: number, height: number): number {
	return Math.min(
		2,
		MAX_OUTPUT_WIDTH / Math.max(1, width),
		Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height))
	)
}

/** At most this many passes on Safari's engine (see drawUntilSettled). */
const MAX_WEBKIT_PASSES = 8

/** A pass "adds art" when its PNG is at least this much bigger (0.5%). */
const GROWTH = 0.005

/** Passes in a row that add nothing before the picture counts as finished. */
const SETTLED_AFTER = 2

/**
 * Draw until the picture stops changing, for Safari's engine, which decodes
 * the inlined art only once asked to draw it, a few pictures per pass. Blank
 * art compresses smaller, so a pass that adds art makes a bigger file.
 *
 * It used to stop at the FIRST pass that didn't grow the file by 1%, at most
 * 4 passes. A long plan on an iPhone then came out with no art at all (board
 * post "Plan Images Export", 2026-11-20, iOS 27): measured in WebKit, a
 * 3-banner plan needs 2 passes to show its art and a 7-banner plan 3, so a
 * 41-banner plan on a phone can stall for a pass and stop blank, or run out.
 * Now one quiet pass isn't enough: it stops after SETTLED_AFTER quiet passes
 * in a row, or at `maxPasses`. The growth bar is lower too (GROWTH), since on
 * a big picture one card's art is a small share of the file.
 *
 * Each pass is kept unless it came out smaller than the best so far: a later
 * pass has at least as much art decoded. Exported for its tests.
 */
export async function drawUntilSettled(draw: () => Promise<Blob | null>, maxPasses = MAX_WEBKIT_PASSES): Promise<Blob | null> {
	let blob = await draw()
	let quiet = 0
	for (let pass = 2; pass <= maxPasses && quiet < SETTLED_AFTER; pass++) {
		const next = await draw()
		if (!next) break
		const grew = next.size > (blob?.size ?? 0) * (1 + GROWTH)
		quiet = grew ? 0 : quiet + 1
		if (!blob || next.size >= blob.size) blob = next
	}
	return blob
}

/**
 * Draw `node` as a PNG, at pixelRatioFor its size.
 *
 * `html-to-image` is imported on first use: it never runs during the prerender
 * and stays out of the main bundle. It hands the HTML to the browser to draw
 * (an SVG foreignObject), which is why Tailwind 4's oklch() and color-mix()
 * colours come out right; html2canvas re-implements CSS and can't read them.
 *
 * The art is inlined first (inlineImages), so html-to-image fetches nothing
 * and a picture that can't be loaded is counted, never left out silently.
 *
 * On Safari's engine the first pass draws the inlined art blank (it decodes
 * the pictures inside the SVG only once asked to draw them), so it draws
 * until the picture settles (drawUntilSettled). Every other browser draws
 * once.
 *
 * `cache` keeps the embedded-font CSS and the inlined art between the redraws
 * of one panel opening. html-to-image embeds only the font families the
 * picture uses, and a checkbox can add text in another family, so the CSS is
 * kept per set of families.
 */
export async function renderNodeToPng(node: HTMLElement, cache: DrawCache = newDrawCache()): Promise<DrawnPicture> {
	const { getFontEmbedCSS, toBlob } = await import("html-to-image")
	const missingArt = await inlineImages(node, cache.images)
	const families = fontFamiliesIn(node)
	let fontEmbedCSS = cache.fonts.get(families)
	if (fontEmbedCSS === undefined) {
		fontEmbedCSS = await getFontEmbedCSS(node)
		cache.fonts.set(families, fontEmbedCSS)
	}
	const options = { pixelRatio: pixelRatioFor(node.offsetWidth, node.offsetHeight), fontEmbedCSS }

	const draw = () => toBlob(node, options)
	const blob = needsSecondPass() ? await drawUntilSettled(draw) : await draw()
	if (!blob) throw new Error("The picture came out empty.")
	return { blob, missingArt }
}

/**
 * Swap every <img> in `node` for an inlined copy and wait until each one is
 * decoded. Returns how many couldn't be loaded (those keep their address, and
 * html-to-image draws them blank).
 *
 * Each file is fetched afresh (`cache: "reload"`), never from the page's
 * cache. The image CDN sends its CORS header only to a request that carries
 * an Origin, and the page's own <img> tags send none, so a cached copy may
 * lack the header and fail a CORS read: one of the two suspects for the blank
 * art on iPhones (v2.10). `images` keeps the results for one panel opening.
 *
 * This edits the off-screen copy of the picture in place. It exists only to
 * be drawn and is unmounted when the panel closes, and React leaves an
 * attribute alone until its prop changes, so the inlined copy stays put
 * across redraws. Lazy images are made eager first: an off-screen lazy image
 * never loads, and decode() would wait for it forever.
 */
async function inlineImages(node: HTMLElement, images: Map<string, string | null>): Promise<number> {
	const results = await Promise.all(
		[...node.querySelectorAll("img")].map(async (img) => {
			const url = img.getAttribute("src")
			if (!url || url.startsWith("data:")) return true
			let inlined = images.get(url)
			if (inlined === undefined) {
				inlined = await fetchAsDataUrl(url)
				images.set(url, inlined)
			}
			if (inlined === null) return false
			img.loading = "eager"
			img.src = inlined
			try {
				await img.decode()
				return true
			} catch {
				return false
			}
		})
	)
	return results.filter((loaded) => !loaded).length
}

/** `url` as a data: URL, read with a fresh CORS request, or null if it fails. */
async function fetchAsDataUrl(url: string): Promise<string | null> {
	try {
		const response = await fetch(url, { mode: "cors", cache: "reload" })
		if (!response.ok) return null
		const blob = await response.blob()
		return await new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(reader.result as string)
			reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the picture."))
			reader.readAsDataURL(blob)
		})
	} catch {
		return null
	}
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
	const safari = /AppleWebKit/.test(userAgent) && !/Chrome|Chromium|Android|Edg|OPR/.test(userAgent)
	return isAppleTouch(userAgent, touchPoints) || safari
}

/** What this browser can do with a picture. Download always works. */
export interface ShareSupport {
	copy: boolean
	share: boolean
	/** An iPhone or iPad that can Share: the share sheet's "Save Image" is the
	 *  only way into Photos (Download lands in Files), so the panel leads with
	 *  Share and leaves Download out. */
	preferShare: boolean
}

/** An iPhone or iPad, the desktop-site iPad included (it calls itself a Mac
 *  but has a touch screen). */
function isAppleTouch(userAgent: string, touchPoints: number): boolean {
	return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)
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
	return { copy, share, preferShare: share && isAppleTouch(navigator.userAgent, navigator.maxTouchPoints) }
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
