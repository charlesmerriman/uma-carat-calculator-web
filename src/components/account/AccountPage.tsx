import { useEffect, useState } from "react"
import type React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ArrowUpRight, Heart, ImagePlus, Lock, LogOut, Star, Trash2, X } from "lucide-react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { OguriSpinner } from "../OguriSpinner"
import { Avatar } from "./Avatar"
import { OshiPicker } from "./OshiPicker"
import { PROVIDERS } from "../../constants/providers"
import { useAccount } from "../../services/AuthContext"
import { SOCIAL_PROVIDERS, type SocialProvider } from "../../services/socialAuth"
import { startAccountLink, unlinkProvider } from "../../services/accountLinking"
import { accountDelete, accountPatch } from "../../services/accountFetchCalls"
import { clearAuthToken } from "../../services/authToken"
import { ApiError } from "../../services/userServices"
import { PATREON_URL } from "../../constants/links"
import { formatDate } from "../../utils/dateFormat"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"
import type { Account, AccountPreferencesPatch, OshiOption } from "../../types/account"

/**
 * /account — the signed-in person's account: their display name, their oshis
 * (the supporter perk whose first pick is their picture), which providers are
 * connected, whether they are a Patreon supporter, and sign-out.
 *
 * THE PICTURE IS THE PERK. A free account has no picture and the navbar shows
 * the quiet default; the oshi card below is where that is explained and where
 * a supporter fills their slots. The server says how many slots the current
 * tier covers (`oshi_slots`) and lists every stored oshi whether covered or
 * not, so a downgrade greys tiles out rather than deleting them. What may be
 * ADDED is the server's decision (it refuses a list that grows past the count
 * unless every id is already held); this page only avoids offering the
 * buttons that would be refused, so the rule has one home.
 *
 * This is what makes linking REACHABLE. The link endpoints shipped with Patreon
 * sign-in and sat unused until this page called them; before it, someone with a
 * Google account who pledged on Patreon had no way to be recognised.
 *
 * No route requires an account, and this one is no exception: a guest sees a
 * card inviting them to sign in, not a redirect. `noindex` because it is
 * plumbing — the same class as /login — and it is deliberately NOT in
 * PRERENDER_ROUTES: a static render of it is a guest card, which is not the page.
 *
 * Render-time code here touches no browser globals (the navbar above it renders
 * on every prerendered page); `window.location.assign` only runs in a handler.
 */

/**
 * How a benefit KEY from the API reads to a person. Keys arrive from
 * `account.supporter.benefits`; the server decides who holds which (see
 * calculatorapi/benefits.py). A key with no label here is skipped rather than
 * shown raw — a benefit should not appear on this page before it has a name.
 */
const BENEFIT_LABELS: Record<string, string> = {
	ad_free: "Ad-free browsing",
	oshi: "Oshi picture",
}

const CARD = "rounded-xl border border-gray-700 bg-gray-800 p-5"
const CARD_TITLE = "text-base font-semibold text-gray-100"
const BUTTON_PRIMARY =
	"rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
const BUTTON_GHOST =
	"rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-600 disabled:hover:bg-transparent disabled:hover:text-gray-300"
// Red is the one status colour that means the same thing in every theme here,
// and it is used only for this button — see the semantic-colour note in
// frontend/docs/ui-conventions.md.
const BUTTON_DANGER =
	"rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-red-500/10"

const INPUT =
	"rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 outline-none transition focus:border-brand"

/** What the person has to type before the delete button arms. */
const DELETE_PHRASE = "delete"

/** The server's cap (CustomUser.display_name); mirrored on the input so the field stops at it. */
const DISPLAY_NAME_MAX = 32

function messageFrom(e: unknown, fallback: string): string {
	return e instanceof ApiError ? e.message : fallback
}

/**
 * The message to show for a refused PATCH /account. DRF answers a form with
 * per-field errors ({"display_name": ["…"]}); the first message of the first
 * field is the one worth a toast. Anything else falls back to a generic line.
 */
async function patchErrorMessage(response: Response): Promise<string> {
	try {
		const data = (await response.json()) as Record<string, unknown>
		for (const value of Object.values(data)) {
			if (Array.isArray(value) && typeof value[0] === "string") return value[0]
		}
	} catch {
		// Not JSON: a proxy error page, or an empty body.
	}
	return "Could not save your changes. Please try again."
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	// Same shell as Feedback and NotFound: flex-1 on <main> absorbs leftover
	// viewport height so the footer keeps its band at the bottom of a short page.
	<div className="flex min-h-dvh flex-col bg-gray-900">
		<Navbar />
		<main className="flex-1">
			<div className="mx-auto max-w-2xl px-4 py-8">
				<h1 className="text-3xl font-bold text-gray-100">Account</h1>
				{children}
			</div>
		</main>
		<Footer />
	</div>
)

const GuestCard: React.FC = () => (
	<div className={`${CARD} mt-6`}>
		<h2 className={CARD_TITLE}>You're not signed in</h2>
		<p className="mt-2 text-sm leading-relaxed text-gray-400">
			Sign in to manage the providers connected to your account and to be recognised as a
			Patreon supporter. The calculator itself works without an account.
		</p>
		<div className="mt-4 flex flex-wrap gap-3">
			<Link to="/login" className={BUTTON_PRIMARY}>
				Sign in
			</Link>
			<Link to="/app" className={BUTTON_GHOST}>
				Open the calculator
			</Link>
		</div>
	</div>
)

const Loading: React.FC = () => (
	<div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
		<OguriSpinner />
		<span className="sr-only">Loading your account…</span>
	</div>
)

const LoadError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
	<div className={`${CARD} mt-6`}>
		<h2 className={CARD_TITLE}>Couldn't load your account</h2>
		<p className="mt-2 text-sm text-gray-400">The server may be down. Please try again.</p>
		<button type="button" onClick={onRetry} className={`${BUTTON_PRIMARY} mt-4`}>
			Retry
		</button>
	</div>
)

interface DetailsProps {
	account: Account
	refresh: () => void
	signOut: () => Promise<void>
}

const AccountDetails: React.FC<DetailsProps> = ({ account, refresh, signOut }) => {
	// Which provider has an action in flight, so only that row shows it.
	const [pending, setPending] = useState<SocialProvider | null>(null)
	const [signingOut, setSigningOut] = useState(false)
	const [deletePhrase, setDeletePhrase] = useState("")
	const [deleting, setDeleting] = useState(false)
	const deleteArmed = deletePhrase.trim().toLowerCase() === DELETE_PHRASE

	// The display-name field is a draft of the stored value. Re-seeded when the
	// account re-reads (after a save, or a refresh from elsewhere) so the field
	// never shows a stale edit as if it were saved.
	const [nameDraft, setNameDraft] = useState(account.display_name ?? "")
	useEffect(() => setNameDraft(account.display_name ?? ""), [account.display_name])
	const [savingName, setSavingName] = useState(false)
	// Which slot the picker is open for (null: closed). Slot 0 is the picture.
	const [pickerSlot, setPickerSlot] = useState<number | null>(null)
	const [savingOshis, setSavingOshis] = useState(false)
	const trimmedName = nameDraft.trim()
	// `?? ""` / `?? []` / `?? 0`: an API from before these fields exist sends
	// none of them, and the page must read that as "nothing set, no slots",
	// not crash. Same tolerance CalculatorProvider gives keys that arrived
	// after the rest — it is what dev:live shows until the deploy.
	const storedName = account.display_name ?? ""
	const oshis = account.oshis ?? []
	const oshiSlots = account.oshi_slots ?? 0
	const oshiIds = oshis.map((oshi) => oshi.id)
	const nameChanged = trimmedName !== storedName
	// What the header and the avatar fallback go by: the chosen name, else the handle.
	const shownName = storedName || account.username

	const linkedFor = (provider: SocialProvider) =>
		account.linked_providers.find((row) => row.provider === provider)
	// The server refuses to remove the last sign-in method of a password-less
	// account (there is no email to recover through). Disabling the button is a
	// courtesy so the refusal is not a surprise; the rule itself lives there.
	const isOnlyMethod = account.linked_providers.length <= 1
	const patreonLinked = linkedFor("patreon") !== undefined
	const supporter = account.supporter

	const handleConnect = async (provider: SocialProvider): Promise<void> => {
		setPending(provider)
		try {
			// On success the browser navigates to the provider; nothing below runs.
			await startAccountLink(provider)
		} catch (e: unknown) {
			toast.error(messageFrom(e, `Could not start connecting ${PROVIDERS[provider].label}.`))
			setPending(null)
		}
	}

	const handleDisconnect = async (provider: SocialProvider): Promise<void> => {
		setPending(provider)
		try {
			await unlinkProvider(provider)
			toast.success(`${PROVIDERS[provider].label} disconnected.`)
			// Entitlement may have changed too (Patreon), so re-read the whole
			// account rather than patching the list locally.
			refresh()
		} catch (e: unknown) {
			toast.error(messageFrom(e, `Could not disconnect ${PROVIDERS[provider].label}.`))
		} finally {
			setPending(null)
		}
	}

	/**
	 * One writer for both preferences. Resolves true on success, after asking
	 * AuthProvider to re-read the account so the navbar picks the change up too.
	 */
	const savePreferences = async (body: AccountPreferencesPatch, success: string): Promise<boolean> => {
		try {
			const response = await accountPatch(body)
			if (!response.ok) {
				toast.error(await patchErrorMessage(response))
				return false
			}
			toast.success(success)
			refresh()
			return true
		} catch (err) {
			console.error(err)
			toast.error("Could not save your changes. Please try again.")
			return false
		}
	}

	const handleSaveName = async (): Promise<void> => {
		if (!nameChanged) return
		setSavingName(true)
		try {
			await savePreferences(
				{ display_name: trimmedName },
				trimmedName ? "Display name saved." : "Display name cleared."
			)
		} finally {
			setSavingName(false)
		}
	}

	/** One writer for the oshi list: the whole ordered list, every time. */
	const saveOshis = async (ids: number[], success: string): Promise<boolean> => {
		setSavingOshis(true)
		try {
			return await savePreferences({ oshis: ids }, success)
		} finally {
			setSavingOshis(false)
		}
	}

	// Resolves to whether it saved: the picker closes itself only on true.
	// Fills the slot it was opened for, replacing what was there or appending.
	const handleChooseOshi = async (uma: OshiOption): Promise<boolean> => {
		if (pickerSlot === null) return false
		const ids = [...oshiIds]
		if (pickerSlot < ids.length) ids[pickerSlot] = uma.id
		else ids.push(uma.id)
		return saveOshis(
			ids,
			pickerSlot === 0 ? `Your picture is now ${uma.name}.` : `${uma.name} added to your oshis.`
		)
	}

	// Reordering is how the picture changes: the first oshi is the picture.
	const handleMakePicture = async (id: number): Promise<void> => {
		const chosen = oshis.find((oshi) => oshi.id === id)
		await saveOshis(
			[id, ...oshiIds.filter((other) => other !== id)],
			`Your picture is now ${chosen?.name ?? "that uma"}.`
		)
	}

	const handleRemoveOshi = async (id: number): Promise<void> => {
		const removed = oshis.find((oshi) => oshi.id === id)
		await saveOshis(
			oshiIds.filter((other) => other !== id),
			`${removed?.name ?? "That uma"} removed from your oshis.`
		)
	}

	const handleSignOut = async (): Promise<void> => {
		setSigningOut(true)
		await signOut()
		// A full load so every provider starts over as a guest; the home page is
		// the natural place to land from here.
		window.location.assign("/")
	}

	const handleDelete = async (): Promise<void> => {
		if (!deleteArmed) return
		setDeleting(true)
		try {
			const response = await accountDelete()
			if (response.status === 403) {
				toast.error("Staff accounts are managed in the admin.")
				return
			}
			if (!response.ok) throw new Error(`Account delete failed: ${response.status}`)
			// The token now refers to nothing. Clearing it through the token
			// module tells AuthProvider, and the full load below starts every
			// provider over as a guest on the home page.
			clearAuthToken()
			window.location.assign("/")
		} catch (err) {
			console.error(err)
			toast.error("Could not delete your account. Please try again.")
		} finally {
			setDeleting(false)
		}
	}

	const benefitLabels = (supporter.benefits ?? [])
		.filter((key) => key in BENEFIT_LABELS)
		.map((key) => BENEFIT_LABELS[key])

	return (
		<>
			{/* Identity: the picture, the name they go by, the tier. */}
			<div className="mt-6 flex items-start gap-4">
				<Avatar src={account.avatar_url} size="lg" />
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span className="truncate text-lg font-semibold text-gray-100">{shownName}</span>
						{supporter.is_supporter && supporter.tier && (
							<span className="rounded-full border border-brand/55 bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
								{supporter.tier}
							</span>
						)}
					</div>
					{/* The handle stays on the page when a chosen name is shown: it is
					    the account's identity, and what to quote when asking for help. */}
					{storedName && (
						<div className="mt-0.5 font-mono text-xs text-gray-500">{account.username}</div>
					)}
					<p className="mt-1 text-xs leading-relaxed text-gray-500">
						{account.avatar_url && oshis[0]
							? `Your picture is ${oshis[0].name}, your first oshi.`
							: oshiSlots > 0
								? "Pick an oshi below and it becomes your picture."
								: "Pictures are a Patreon supporter perk."}{" "}
						We never store your real name, email or provider picture.
					</p>
				</div>
			</div>

			<OshiPicker
				open={pickerSlot !== null}
				currentId={pickerSlot !== null ? (oshiIds[pickerSlot] ?? null) : null}
				takenIds={oshiIds}
				description={pickerSlot === 0 ? "This one is your picture." : "Added to your oshis."}
				onClose={() => setPickerSlot(null)}
				onChoose={handleChooseOshi}
			/>

			{/* Display name */}
			<section className={`${CARD} mt-6`} aria-labelledby="display-name">
				<h2 id="display-name" className={CARD_TITLE}>
					Display name
				</h2>
				<p className="mt-1 text-sm text-gray-400">
					Shown to you alone, in the menu and on this page. Leave it blank to go by your
					handle, <span className="font-mono text-gray-300">{account.username}</span>.
				</p>
				<form
					className="mt-4 flex flex-wrap items-end gap-3"
					onSubmit={(event) => {
						event.preventDefault()
						void handleSaveName()
					}}
				>
					<label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
						Display name
						<input
							type="text"
							value={nameDraft}
							onChange={(event) => setNameDraft(event.target.value)}
							maxLength={DISPLAY_NAME_MAX}
							autoComplete="nickname"
							spellCheck={false}
							className={INPUT}
						/>
					</label>
					<button type="submit" disabled={!nameChanged || savingName} className={BUTTON_PRIMARY}>
						{savingName ? "Saving…" : "Save"}
					</button>
				</form>
			</section>

			{/* Oshis: the supporter perk. One tile per covered slot, plus any held
			    oshis a downgrade stopped covering (greyed), plus one locked tile
			    for a free account with nothing held. */}
			<section className={`${CARD} mt-4`} aria-labelledby="oshis">
				<h2 id="oshis" className={`${CARD_TITLE} flex items-center gap-2`}>
					<Star className="h-4 w-4 text-brand" aria-hidden="true" />
					{oshiSlots === 1 ? "Your oshi" : "Your oshis"}
				</h2>
				<p className="mt-1 text-sm leading-relaxed text-gray-400">
					{oshiSlots > 0 ? (
						<>
							Your favourite umas. The first one is your picture in the menu and on this page.
							Your tier covers {oshiSlots === 1 ? "one" : oshiSlots}.
							{oshis.length > oshiSlots &&
								" The greyed ones are kept, but not shown, until your tier covers them again."}
						</>
					) : oshis.length > 0 ? (
						<>
							Your pledge isn't active right now, so your oshis are on hold. They're kept, and
							they come back the day a pledge is seen again. You can still remove them.
						</>
					) : (
						<>
							Patreon supporters pick their favourite umas here, and the first one becomes their
							picture. Higher tiers get more slots.
						</>
					)}
				</p>
				<ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
					{Array.from({ length: Math.max(oshiSlots, oshis.length) }, (_, slot) => {
						const oshi = oshis[slot]
						const covered = slot < oshiSlots
						if (!oshi) {
							return (
								<li key={`empty-${slot}`}>
									<button
										type="button"
										onClick={() => setPickerSlot(slot)}
										disabled={savingOshis}
										className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-600 p-3 text-xs font-medium text-gray-400 transition hover:border-brand/60 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
									>
										<ImagePlus className="h-6 w-6" aria-hidden="true" />
										{slot === 0 ? "Pick your picture" : "Pick an oshi"}
									</button>
								</li>
							)
						}
						return (
							<li
								key={oshi.id}
								className={`flex flex-col items-center rounded-lg border p-3 text-center ${
									covered ? "border-gray-600 bg-gray-700/50" : "border-gray-700 bg-gray-800 opacity-60"
								}`}
							>
								<Avatar src={oshi.image || null} size="lg" />
								<span className="mt-2 line-clamp-2 min-h-8 text-xs font-medium leading-tight text-gray-100">
									{oshi.name}
								</span>
								<span className="mt-1 min-h-4 text-[10px] uppercase tracking-wider text-gray-500">
									{slot === 0 && covered ? "Your picture" : !covered ? "Not covered" : ""}
								</span>
								<div className="mt-2 flex flex-wrap justify-center gap-1.5">
									{covered && slot > 0 && (
										<button
											type="button"
											onClick={() => void handleMakePicture(oshi.id)}
											disabled={savingOshis}
											aria-label={`Make ${oshi.name} your picture`}
											className="rounded border border-gray-600 px-1.5 py-1 text-[11px] text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50"
										>
											Make picture
										</button>
									)}
									{covered && (
										<button
											type="button"
											onClick={() => setPickerSlot(slot)}
											disabled={savingOshis}
											aria-label={`Change ${oshi.name}`}
											className="rounded border border-gray-600 px-1.5 py-1 text-[11px] text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50"
										>
											Change
										</button>
									)}
									<button
										type="button"
										onClick={() => void handleRemoveOshi(oshi.id)}
										disabled={savingOshis}
										aria-label={`Remove ${oshi.name}`}
										className="rounded border border-gray-600 p-1 text-gray-400 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50"
									>
										<X className="h-3.5 w-3.5" aria-hidden="true" />
									</button>
								</div>
							</li>
						)
					})}
					{oshiSlots === 0 && oshis.length === 0 && (
						<li className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-700 p-3 text-center text-xs text-gray-500">
							<Lock className="h-6 w-6" aria-hidden="true" />
							Supporters only
						</li>
					)}
				</ul>
				{oshiSlots === 0 && (
					<a
						href={PATREON_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="mt-4 inline-flex items-center gap-1 text-sm text-brand underline-offset-2 hover:underline"
					>
						{oshis.length > 0 ? "Renew on Patreon" : "Support the site on Patreon"}
						<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
					</a>
				)}
			</section>

			{/* Sign-in methods */}
			<section className={`${CARD} mt-4`} aria-labelledby="sign-in-methods">
				<h2 id="sign-in-methods" className={CARD_TITLE}>
					Sign-in methods
				</h2>
				<p className="mt-1 text-sm text-gray-400">
					Connect more than one so you can sign in either way. Each provider can be
					connected to one account.
				</p>
				<ul className="mt-4 divide-y divide-gray-700">
					{SOCIAL_PROVIDERS.map((provider) => {
						const { label, Mark } = PROVIDERS[provider]
						const linked = linkedFor(provider)
						const busy = pending === provider
						return (
							<li key={provider} className="flex flex-wrap items-center justify-between gap-3 py-3">
								<div className="flex min-w-0 items-center gap-3">
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-700 text-gray-100">
										<Mark />
									</span>
									<div className="min-w-0">
										<div className="text-sm font-medium text-gray-100">{label}</div>
										<div className="text-xs text-gray-400">
											{linked ? `Connected ${formatDate(linked.linked_at)}` : "Not connected"}
										</div>
										{linked && provider === "patreon" && (
											<div className="mt-0.5 text-xs text-gray-500">
												Disconnecting also removes your supporter status here until you reconnect.
											</div>
										)}
									</div>
								</div>
								{linked ? (
									<button
										type="button"
										onClick={() => void handleDisconnect(provider)}
										disabled={busy || isOnlyMethod}
										title={
											isOnlyMethod
												? "This is the only way to sign in to this account. Connect another provider first."
												: undefined
										}
										className={BUTTON_GHOST}
									>
										{busy ? "Disconnecting…" : "Disconnect"}
									</button>
								) : (
									<button
										type="button"
										onClick={() => void handleConnect(provider)}
										disabled={pending !== null}
										className={BUTTON_PRIMARY}
									>
										{busy ? "Redirecting…" : "Connect"}
									</button>
								)}
							</li>
						)
					})}
				</ul>
			</section>

			{/* Patreon supporter */}
			<section className={`${CARD} mt-4`} aria-labelledby="supporter-status">
				<h2 id="supporter-status" className={`${CARD_TITLE} flex items-center gap-2`}>
					<Heart className="h-4 w-4 text-brand" aria-hidden="true" />
					Patreon supporter
				</h2>
				{supporter.is_supporter ? (
					<>
						<p className="mt-2 text-sm leading-relaxed text-gray-300">
							Thank you for supporting the site
							{supporter.tier ? ` on the ${supporter.tier} tier` : ""}.
						</p>
						{benefitLabels.length > 0 && (
							<>
								<h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
									Your benefits
								</h3>
								<ul className="mt-1.5 flex flex-wrap gap-2">
									{benefitLabels.map((label) => (
										<li
											key={label}
											className="rounded-full border border-gray-600 bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-200"
										>
											{label}
										</li>
									))}
								</ul>
							</>
						)}
						{/* Honest about timing: the key is real, the ads are not yet. */}
						<p className="mt-3 text-xs leading-relaxed text-gray-500">
							Ads aren't running on the site yet. When they start, supporters won't see them.
						</p>
					</>
				) : patreonLinked ? (
					<>
						<p className="mt-2 text-sm leading-relaxed text-gray-300">
							Your Patreon is connected, but we don't see an active pledge on it. Pledges
							sync once a day, so if you pledged in the last 24 hours, check back tomorrow.
						</p>
						<a
							href={PATREON_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-3 inline-flex items-center gap-1 text-sm text-brand underline-offset-2 hover:underline"
						>
							Support the site on Patreon
							<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
						</a>
					</>
				) : (
					<>
						<p className="mt-2 text-sm leading-relaxed text-gray-300">
							Connect the Patreon account you pledge with and you'll be recognised as a
							supporter here.
						</p>
						<div className="mt-3 flex flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={() => void handleConnect("patreon")}
								disabled={pending !== null}
								className={BUTTON_PRIMARY}
							>
								{pending === "patreon" ? "Redirecting…" : "Connect Patreon"}
							</button>
							<a
								href={PATREON_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-sm text-gray-400 underline-offset-2 hover:text-brand hover:underline"
							>
								Not a patron yet?
								<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
							</a>
						</div>
					</>
				)}
			</section>

			{/* Session */}
			<section className={`${CARD} mt-4`} aria-labelledby="session">
				<h2 id="session" className={CARD_TITLE}>
					Session
				</h2>
				<p className="mt-1 text-sm text-gray-400">
					Signing out only affects this browser. Your plan stays saved to your account.
				</p>
				<button
					type="button"
					onClick={() => void handleSignOut()}
					disabled={signingOut}
					className={`${BUTTON_GHOST} mt-4 inline-flex items-center gap-2`}
				>
					<LogOut className="h-4 w-4" aria-hidden="true" />
					{signingOut ? "Signing out…" : "Sign out"}
				</button>
			</section>

			{/* Delete account. Irreversible, so the button arms only after the
			    phrase is typed — there is no email on file to send a recovery
			    link to, by design, which makes the confirmation the only guard. */}
			<section className={`${CARD} mt-4 border-red-500/30`} aria-labelledby="delete-account">
				<h2 id="delete-account" className={CARD_TITLE}>
					Delete account
				</h2>
				<p className="mt-1 text-sm leading-relaxed text-gray-400">
					This permanently removes your saved plan, your connected sign-in methods, your
					display name and your oshis. It can't be undone. Feedback you've sent stays, with no
					link to you. A Patreon pledge is unaffected, since it belongs to your Patreon
					account, not to this one.
				</p>
				<form
					className="mt-4 flex flex-wrap items-end gap-3"
					onSubmit={(event) => {
						event.preventDefault()
						void handleDelete()
					}}
				>
					<label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-400">
						Type <span className="font-mono text-gray-200">{DELETE_PHRASE}</span> to confirm
						<input
							type="text"
							value={deletePhrase}
							onChange={(event) => setDeletePhrase(event.target.value)}
							autoComplete="off"
							spellCheck={false}
							className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 outline-none transition focus:border-red-400/70"
						/>
					</label>
					<button
						type="submit"
						disabled={!deleteArmed || deleting}
						className={`${BUTTON_DANGER} inline-flex items-center gap-2`}
					>
						<Trash2 className="h-4 w-4" aria-hidden="true" />
						{deleting ? "Deleting…" : "Delete my account"}
					</button>
				</form>
			</section>
		</>
	)
}

export const AccountPage: React.FC = () => {
	useDocumentMeta(
		"Account",
		"Manage the sign-in providers connected to your Uma Musume Carat Calculator account and see your Patreon supporter status.",
		true
	)

	const { isLoggedIn, status, account, refresh, signOut } = useAccount()

	let body: React.ReactNode
	if (!isLoggedIn) {
		body = <GuestCard />
	} else if (status === "error") {
		body = <LoadError onRetry={refresh} />
	} else if (account === null) {
		// "loading", or a token that has not been checked yet.
		body = <Loading />
	} else {
		body = <AccountDetails account={account} refresh={refresh} signOut={signOut} />
	}

	return <Shell>{body}</Shell>
}
