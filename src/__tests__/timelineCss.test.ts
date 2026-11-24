// @vitest-environment node
//
// The Timeline's layout lives in src/timeline.css, and jsdom applies no
// stylesheets, so no component test can see it. These read the file as text
// and fail on the handful of declarations that have each broken the page
// before. Each test names the incident it guards.
//
// The other half of the guard is the geometry check (the notes repo's
// .claude/skills/verify/timeline/geometry.mjs), which measures the real page
// before and after a change. This file is the part CI can run.
import { describe, expect, it } from "vitest"

// Read from disk: Vitest stubs every CSS import to an empty string, `?raw`
// included. The app's tsconfig is browser code with no Node types, so the
// module name is a plain string and the one function used is typed here.
const nodeFs: string = "node:fs"
const { readFileSync } = (await import(/* @vite-ignore */ nodeFs)) as {
	readFileSync: (path: URL, encoding: "utf8") => string
}
const css = readFileSync(new URL("../timeline.css", import.meta.url), "utf8")
const themeCss = readFileSync(new URL("../personalityThemes.css", import.meta.url), "utf8")

type Rule = { selector: string; body: string; media: string | null }

/** Every style rule in the file, with the @media it sits in (if any). */
function parseRules(source: string): Rule[] {
	const text = source.replace(/\/\*[\s\S]*?\*\//g, "")
	const rules: Rule[] = []
	// The at-rules we are inside, innermost last.
	const stack: string[] = []
	let i = 0
	while (i < text.length) {
		const open = text.indexOf("{", i)
		const close = text.indexOf("}", i)
		if (close !== -1 && (open === -1 || close < open)) {
			stack.pop()
			i = close + 1
			continue
		}
		if (open === -1) break
		const head = text.slice(i, open).trim()
		if (head.startsWith("@")) {
			stack.push(head)
			i = open + 1
			continue
		}
		const end = text.indexOf("}", open)
		rules.push({
			selector: head,
			body: text.slice(open + 1, end),
			media: stack.find((at) => at.startsWith("@media")) ?? null,
		})
		i = end + 1
	}
	return rules
}

const rules = parseRules(css)
const matching = (pattern: RegExp) => rules.filter((rule) => pattern.test(rule.selector))

describe("timeline.css", () => {
	it("is parsed (the guards below are not passing on an empty list)", () => {
		expect(matching(/\.tl-band\b/).length).toBeGreaterThan(0)
		expect(matching(/\.tl-row\b/).length).toBeGreaterThan(3)
		expect(matching(/\.tl-tile\b/).length).toBeGreaterThan(0)
	})

	it("never caps, clips or contains a panel or its grid", () => {
		// The panel once carried grid-rows-1, xl:overflow-hidden and
		// xl:[contain:size], pinned to the art's height: an eleven-uma revival
		// showed two umas and silently hid nine.
		for (const rule of matching(/\.tl-(panel|grid|grid-cell)\b/)) {
			expect(rule.body, rule.selector).not.toMatch(/\bcontain\s*:/)
			expect(rule.body, rule.selector).not.toMatch(/grid-template-rows/)
			expect(rule.body, rule.selector).not.toMatch(/overflow(-[xy])?\s*:\s*(hidden|clip)/)
			expect(rule.body, rule.selector).not.toMatch(/max-height/)
		}
	})

	it("keeps a band one line at every width: no band rule sits in a breakpoint", () => {
		// The first band was built from xl-only grid columns, so below 1280px a
		// ten-card batch fell back to a 2x5 tower.
		for (const rule of matching(/\.tl-band(-row|-cell)?\b/)) {
			expect(rule.media, rule.selector).toBeNull()
			expect(rule.body, rule.selector).not.toMatch(/flex-wrap\s*:\s*wrap/)
			expect(rule.body, rule.selector).not.toMatch(/display\s*:\s*grid/)
		}
	})

	it("scrolls a band sideways inside itself, and only there", () => {
		const band = matching(/^\.tl-band$/)
		expect(band).toHaveLength(1)
		expect(band[0].body).toMatch(/overflow-x\s*:\s*auto/)
		// Centring a row that overflows strands its first tile off the left
		// edge, where no scrolling reaches it.
		for (const rule of matching(/\.tl-band-row\b/)) {
			expect(rule.body, rule.selector).not.toMatch(/justify-content/)
		}
	})

	it("never clips a tile, so a layered uma's ears and hat can leave her frame", () => {
		// The owner, 2026-11-24. A clip moves no box, so nothing else would notice.
		for (const rule of matching(/\.tl-(tile|plate|plate-skirt|band-cell|grid-cell|panel|card)\b/)) {
			expect(rule.body, rule.selector).not.toMatch(/overflow(-[xy])?\s*:\s*(hidden|clip)/)
			expect(rule.body, rule.selector).not.toMatch(/clip-path/)
			expect(rule.body, rule.selector).not.toMatch(/\bcontain\s*:/)
		}
	})

	it("caps the art on its width, never its height", () => {
		// max-height with a percentage width squashes the picture
		// (measured: 1030x580 became 1030x368).
		for (const rule of matching(/\.tl-art\b/)) {
			expect(rule.body, rule.selector).not.toMatch(/max-height/)
		}
		const art = matching(/^\.tl-art$/)
		expect(art).toHaveLength(1)
		expect(art[0].body).toMatch(/aspect-ratio\s*:\s*16\s*\/\s*9/)
		expect(art[0].body).toMatch(/object-fit\s*:\s*contain/)
	})

	it("gives every template the same art track", () => {
		// One art width down the whole list: each template's first track is
		// the shared floor and the shared width.
		const templates = rules.filter((rule) => /grid-template-columns/.test(rule.body) && /\.tl-(row|race-row)/.test(rule.selector) && rule.media?.includes("80rem"))
		expect(templates).toHaveLength(4)
		for (const rule of templates) {
			expect(rule.body.replace(/\s+/g, " "), rule.selector).toContain("minmax(var(--tl-art-floor), var(--timeline-art-width))")
		}
	})

	it("keeps the layout rules layered and the chips' display unset", () => {
		// Unlayered CSS beats every Tailwind utility. The layout must not; and
		// the two title-line chips hide and show through container-query
		// utilities, which a `display` here would outrank.
		expect(css).toMatch(/@layer components\s*\{/)
		for (const rule of matching(/^\.(recommended|free-pulls)-chip$/)) {
			expect(rule.body, rule.selector).not.toMatch(/(^|[;\s])display\s*:/)
		}
	})
})

// A theme may repaint the Timeline through its hooks (personalityThemes.css).
// It is held to the same promises as the layout: paint, never clip, and never
// split a tile's picture from its name.
describe("personalityThemes.css, on the Timeline's hooks", () => {
	const allThemeRules = parseRules(themeCss).filter((rule) => /\.tl-/.test(rule.selector))
	// A ::before or ::after is a shape laid behind or over a part, not the part.
	const isPseudo = (rule: Rule) => /::(before|after)/.test(rule.selector)
	const themeRules = allThemeRules.filter((rule) => !isPseudo(rule))
	const pseudoRules = allThemeRules.filter(isPseudo)

	it("scopes every default-family rule by excluding the two palette themes, and reads roles, not colours", () => {
		// The family's rules draw twelve palettes, so one may never name a colour
		// of its own; and a bare rule would leak into Winning Live and Tracen.
		const SCOPE = ':root:not([data-theme="tracen"], [data-theme="winning-live"])'
		const family = parseRules(themeCss).filter((rule) => rule.selector.includes(":root:not("))
		expect(family.length).toBeGreaterThan(20)
		for (const rule of family) {
			// Split the selector list on its own commas, not the one inside :not(a, b).
			for (const selector of rule.selector.split(/,(?![^(]*\))/)) expect(selector.trim().startsWith(SCOPE), selector).toBe(true)
			expect(rule.body, rule.selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
			expect(rule.body.replace(/var\([^)]*\)/g, ""), rule.selector).not.toMatch(/\brgb\(/)
		}
	})

	it("has Timeline rules to check", () => {
		expect(themeRules.length).toBeGreaterThan(10)
	})

	it("never clips or contains a Timeline part, so layered ears and hats still leave their frames", () => {
		for (const rule of themeRules) {
			expect(rule.body, rule.selector).not.toMatch(/overflow(-[xy])?\s*:/)
			expect(rule.body, rule.selector).not.toMatch(/clip-path/)
			expect(rule.body, rule.selector).not.toMatch(/\bcontain\s*:/)
		}
	})

	it("paints and never sizes: no width, height, display or position on a Timeline part", () => {
		// Padding may only appear with a margin in the same rule that gives it
		// back (the title strip, the stat header); the geometry check holds the sum.
		for (const rule of themeRules) {
			expect(rule.body, rule.selector).not.toMatch(/(^|[;\s])(min-|max-)?(width|height)\s*:/)
			expect(rule.body, rule.selector).not.toMatch(/(^|[;\s])(display|position|flex|grid[a-z-]*|gap|font-size|line-height|border-width)\s*:/)
			if (/(^|[;\s])padding[a-z-]*\s*:/.test(rule.body)) expect(rule.body, rule.selector).toMatch(/(^|[;\s])margin[a-z-]*\s*:/)
		}
	})

	it("keeps a decorative pseudo-element out of the flow, so it cannot move a box", () => {
		// Tracen's slanted tab behind a month heading. It may be clipped to a
		// shape (it IS the shape); what it may not do is take up room.
		for (const rule of pseudoRules.filter((r) => /content\s*:/.test(r.body))) {
			expect(rule.body, rule.selector).toMatch(/position\s*:\s*absolute/)
		}
		for (const rule of pseudoRules) {
			expect(rule.body, rule.selector).not.toMatch(/overflow(-[xy])?\s*:/)
			expect(rule.body, rule.selector).not.toMatch(/\bcontain\s*:/)
		}
	})

	it("never gives a tile's name block a fill its skirt doesn't share", () => {
		// The picture and the name are one plane (the owner, 2026-11-24): the
		// strip behind the art and the name block always have the same fill.
		for (const rule of themeRules) {
			if (!/background/.test(rule.body)) continue
			const paintsPlate = /\.tl-plate(?![-\w])/.test(rule.selector)
			const paintsSkirt = /\.tl-plate-skirt\b/.test(rule.selector)
			expect(paintsPlate, rule.selector).toBe(paintsSkirt)
		}
	})

	it("draws nothing across the top of a tile's name block", () => {
		// A top edge on the plate is a line between the picture and its name.
		for (const rule of themeRules.filter((r) => /\.tl-plate(?![-\w])/.test(r.selector))) {
			expect(rule.body, rule.selector).not.toMatch(/border(-top)?(-color|-width|-style)?\s*:/)
			expect(rule.body, rule.selector).not.toMatch(/outline/)
			// An inset shadow with a positive y offset is a line along the top.
			expect(rule.body.replace(/\s+/g, " "), rule.selector).not.toMatch(/inset 0 [1-9]/)
		}
	})

	it("restates hover or focus for every control it repaints", () => {
		// An unlayered rule beats the element's own hover: and focus: utilities
		// on the properties it sets.
		for (const hook of [".tl-stage", ".tl-control"]) {
			const states = themeRules.filter((r) => r.selector.includes(hook) && /:(hover|focus)/.test(r.selector))
			expect(states.length, hook).toBeGreaterThan(0)
		}
	})
})
