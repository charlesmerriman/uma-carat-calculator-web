/**
 * TYPESCRIPT CONCEPT: Barrel Files
 *
 * A barrel file re-exports everything from multiple modules through
 * a single entry point. This means consumers can write:
 *   import type { Uma, ClubRank, UserStats } from "../types"
 * instead of:
 *   import type { Uma } from "../types/banner"
 *   import type { ClubRank } from "../types/ranks"
 *   import type { UserStats } from "../types/user"
 *
 * Barrel files keep imports clean while letting you organize types
 * into logical groupings internally.
 */

export type {
	BannerTimeline,
	BannerCategory,
	Uma,
	SupportCard,
	BannerUma,
	BannerSupport,
	BannerStepUp,
	BannerStepUpSummary,
	BannerTimelineForViewing
} from "./banner"

export type {
	ClubRank,
	TeamTrialsRank,
	TeamTrailsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank
} from "./ranks"

export type {
	UserStats,
	UserPlannedBanner,
	SavedPlannedBanner,
	LocalPlannedBanner,
	UserStepUpSelection
} from "./user"

export { isSavedBanner, isLocalBanner } from "./user"

export type {
	GameEvent,
	ChampionsMeeting,
	LeagueOfHeroes,
	RaceEvent
} from "./events"

export type {
	CalculatorData,
	OrganizedTimelineData,
	TimelineEvent,
	CalculatorContextType
} from "./calculator"

export { isRaceEvent, isBannerTimeline } from "./calculator"

export type { CalculationConstants } from "./constants"

export type {
	IncomeLedgerRow,
	LedgerRowKind,
	ParsedLedgerRow
} from "./ledger"

export type {
	ChangeCategory,
	ChangelogChange,
	ChangelogEntry
} from "./changelog"

export type {
	FeedbackCategory,
	FeedbackPayload
} from "./feedback"

export type {
	PatreonTier,
	PatreonSupporter,
	SupportersResponse
} from "./supporters"

export type {
	Account,
	AccountStatus,
	LinkedProvider,
	SupporterStatus
} from "./account"

export type {
	AnniversaryEvent,
	AnniversaryEventType,
	AnniversaryEventProduct,
	AnniversaryEventPart,
	AttachedAnniversaryEvent,
	UserPlannedPurchase,
	SavedPlannedPurchase,
	LocalPlannedPurchase
} from "./anniversary"

export type { Scenario } from "./scenario"

export type { Plan, PlanWithRows } from "./plan"
export { PLAN_CAP, PLAN_NAME_MAX_LENGTH } from "./plan"

export {
	isSavedPurchase,
	isLocalPurchase,
	isSelectorProduct
} from "./anniversary"

export type {
	SiteContent,
	SitePage,
	SitePageSlug,
	FaqCategory,
	FaqItem
} from "./siteContent"
