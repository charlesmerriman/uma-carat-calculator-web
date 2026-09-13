import type React from "react"
import type { SocialProvider } from "../services/socialAuth"
import { DiscordMark, GoogleMark, PatreonMark } from "../components/auth/ProviderMarks"

/**
 * How each sign-in provider is presented to a person.
 *
 * Keyed by the raw provider value the API sends ("google"), so
 * `PROVIDERS[row.provider]` on an /account row is the whole lookup. How to
 * SPELL a provider for a human lives here and nowhere else — the API sends the
 * raw value on purpose (see types/account.ts), so a rewording here never has to
 * chase a string on the server.
 */
export interface ProviderPresentation {
	label: string
	Mark: React.FC
	/** Brand colours for a full "Continue with …" button on the sign-in page. */
	button: string
}

export const PROVIDERS: Record<SocialProvider, ProviderPresentation> = {
	google: { label: "Google", Mark: GoogleMark, button: "bg-white text-[#1f1f1f] hover:bg-gray-100" },
	discord: { label: "Discord", Mark: DiscordMark, button: "bg-[#5865F2] text-white hover:bg-[#4752C4]" },
	patreon: { label: "Patreon", Mark: PatreonMark, button: "bg-[#FF424D] text-white hover:bg-[#E03A44]" },
}
