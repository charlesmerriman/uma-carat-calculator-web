/**
 * What a feature panel's one button can say: the banner can be staged, is
 * already staged or in the calculator, or has ended. Written to the button as
 * `data-status` (the `tl-stage` hook), so a theme can paint each state.
 */
export type BannerCardStatus = "available" | "planned" | "staged" | "expired"

export function getBannerCardStatus(
	hasBanner: boolean,
	expired: boolean,
	planned: boolean,
	staged: boolean
): BannerCardStatus {
	if (!hasBanner || expired) return "expired"
	if (planned) return "planned"
	if (staged) return "staged"
	return "available"
}

export function getBannerStatusLabel(status: BannerCardStatus): string {
	if (status === "planned") return "Already in calculator"
	if (status === "staged") return "Already staged"
	if (status === "expired") return "Banner ended"
	return "Stage banner"
}

export function getBannerStatusClasses(status: BannerCardStatus): string {
	if (status === "available") return "border-brand text-brand hover:bg-brand/10"
	if (status === "planned" || status === "staged") return "border-gray-600 text-gray-300"
	return "border-gray-600 text-gray-500"
}
