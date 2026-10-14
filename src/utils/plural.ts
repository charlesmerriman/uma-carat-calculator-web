/**
 * "1 view", "2 views". Counts a visitor reads go through here so a count of
 * one never reads "1 comments". `plural` is for the irregular ones
 * ("copy" / "copies"); everything else adds an s.
 */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : plural}`
}
