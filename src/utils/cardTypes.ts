/** A support card type's name, as the site writes it ("Friend", where the sheet says "Pal"). */
export const CARD_TYPE_LABELS: Record<string, string> = {
	speed: "Speed", stamina: "Stamina", power: "Power", guts: "Guts", wit: "Wit", friend: "Friend", group: "Group",
}

/**
 * A support card's type as a hue (index.css :root, the stat colours plus
 * Friend and Group): a dot beside the type's name, a bar or a fill, never
 * text, so one set serves every theme. Shared by the Collection's Support
 * cards tab and the Rankings page's card rows.
 */
export const CARD_TYPE_COLORS: Record<string, string> = {
	speed: "var(--color-stat-speed)",
	stamina: "var(--color-stat-stamina)",
	power: "var(--color-stat-power)",
	guts: "var(--color-stat-guts)",
	wit: "var(--color-stat-wit)",
	friend: "var(--color-card-friend)",
	group: "var(--color-card-group)",
}
