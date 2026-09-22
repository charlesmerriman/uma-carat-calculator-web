/**
 * Cookie consent: the visitor's Accept/Reject choice and the prompt that asks.
 *
 * WHAT IT GATES. Only third-party cookies: Google Analytics today, the ad
 * network's cookies once ads run. Nothing first-party depends on it (the
 * sign-in token and the theme live in localStorage and are strictly
 * necessary), so a "denied" visitor gets the whole calculator.
 *
 * HOW IT REACHES GOOGLE. The choice is handed to gtag as a Consent Mode
 * 'update'. Two places do that:
 *   1. The inline script in index.html, on every page load, BEFORE
 *      gtag('config'), from the same localStorage key. That is what makes a
 *      stored "denied" hold for the first page_view of the next visit; an
 *      update pushed from React would arrive after that hit had gone out.
 *   2. writeConsentChoice() below, at the moment of the click, so the current
 *      page changes behaviour without a reload.
 * The key is duplicated in index.html for the same reason the theme keys are
 * (it runs before any module does); consentMode.test.ts is the drift guard.
 *
 * WHY THIS IS NOT A CERTIFIED CMP. Google's EU User Consent Policy requires a
 * TCF-registered consent platform before ADS serve in the EEA/UK, and the ad
 * network (AdSense or Raptive) ships one with its ad script. This banner
 * covers the interval before that, when Analytics is the only thing to gate,
 * and is expected to be replaced or wrapped by the network's CMP.
 *
 * Same store shape as themeStore.ts: module state, subscribe/notify, a client
 * snapshot that reads localStorage lazily, and a server snapshot with
 * `isReady: false` so a prerender and a hydration render agree on "nothing".
 */

export const COOKIE_CONSENT_STORAGE_KEY = "uma-planner-cookie-consent"

export type ConsentChoice = "granted" | "denied"

export type ConsentState = {
	/** The stored decision, or null when the visitor has not been asked yet. */
	choice: ConsentChoice | null
	/** True while the prompt should be on screen (no choice yet, or reopened from the footer). */
	isPromptOpen: boolean
	/** False on the server and during hydration, when localStorage is unknown. */
	isReady: boolean
}

// Consent Mode v2's four storage types. Every one is set to the same value:
// the banner offers one decision, not per-purpose toggles.
const CONSENT_TYPES = ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage"] as const

const SERVER_STATE: ConsentState = { choice: null, isPromptOpen: false, isReady: false }

type Listener = () => void
const listeners = new Set<Listener>()

// Lazily initialised on the first client read, so importing this module in
// Node (the prerender) touches no browser API.
let state: ConsentState | null = null

function notify(): void {
	for (const listener of listeners) listener()
}

function isChoice(value: string | null): value is ConsentChoice {
	return value === "granted" || value === "denied"
}

/** A storage read that cannot throw: blocked or absent localStorage reads as unset. */
function readStoredChoice(): ConsentChoice | null {
	try {
		const stored = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
		return isChoice(stored) ? stored : null
	} catch {
		return null
	}
}

function setState(next: ConsentState): void {
	state = next
	notify()
}

export function subscribeToConsent(listener: Listener): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

/** The client snapshot. A visitor with no stored choice sees the prompt. */
export function getConsentSnapshot(): ConsentState {
	if (state === null) {
		const choice = readStoredChoice()
		state = { choice, isPromptOpen: choice === null, isReady: true }
	}
	return state
}

export function getServerConsentSnapshot(): ConsentState {
	return SERVER_STATE
}

/** Push the choice to gtag for the current page. A no-op where the tag is absent (tests, blocked). */
function pushConsentUpdate(choice: ConsentChoice): void {
	const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
	if (typeof gtag !== "function") return
	gtag("consent", "update", Object.fromEntries(CONSENT_TYPES.map((type) => [type, choice])))
}

/** Record the visitor's decision: store it, tell gtag, close the prompt. */
export function writeConsentChoice(choice: ConsentChoice): void {
	try {
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice)
	} catch {
		// Storage blocked: the choice still applies to this page, and the
		// prompt will simply ask again next visit.
	}
	pushConsentUpdate(choice)
	setState({ choice, isPromptOpen: false, isReady: true })
}

/** Reopen the prompt, for the "Cookie settings" link in the footer. */
export function openConsentPrompt(): void {
	setState({ ...getConsentSnapshot(), isPromptOpen: true })
}

/** Close a reopened prompt without changing anything. Only offered when a choice exists. */
export function closeConsentPrompt(): void {
	const current = getConsentSnapshot()
	if (current.choice === null) return
	setState({ ...current, isPromptOpen: false })
}

/** Test hook: forget the in-memory state so the next read hits localStorage again. */
export function resetConsentStoreForTests(): void {
	state = null
}
