/**
 * The furniture every Encyclopedia page is built from: the breadcrumbs, the
 * hero and its facts and tags, the jump bar, a section card, a segmented
 * switch, and the loading, missing and failed states.
 *
 * The look is encyclopedia.css (the visual overhaul, canvas of 2026-11-12:
 * https://claude.ai/artifact/Y3TX7fU71C5ppw7FpGSmm6). This file holds
 * structure and wording only; what an aptitude grid or a skill row looks like
 * lives beside it in facts.tsx and skillRows.tsx.
 */

import type { CSSProperties, ReactNode } from "react"
import { Link } from "react-router-dom"
import { useReducedMotion } from "framer-motion"
import { Check, ChevronRight } from "lucide-react"
import { CARD_TYPE_COLORS, CARD_TYPE_LABELS } from "../../utils/cardTypes"
import { RARITY_TAG_CLASS, RARITY_WORDS } from "../../utils/encyclopedia"
import { UMA_LIST_PATH } from "../../utils/encyclopediaRoutes"

// ── Finding your way ────────────────────────────────────────────────────────

export function Crumbs({ list, listPath, name }: { list: string; listPath: string; name: string }) {
	return (
		<nav aria-label="Breadcrumb" className="enc-crumbs">
			<Link to={UMA_LIST_PATH}>Encyclopedia</Link>
			<ChevronRight aria-hidden="true" />
			<Link to={listPath}>{list}</Link>
			<ChevronRight aria-hidden="true" />
			<span className="truncate">{name}</span>
		</nav>
	)
}

export interface JumpItem {
	/** The section's element id. */
	id: string
	label: string
	count?: number
}

/**
 * One chip per section the page has, stuck to the top of the scroller so a
 * long page is one tap from any part of it. A button, not a #hash link: a
 * hash would add a history entry per jump, and Back should leave the page.
 */
export function JumpBar({ items }: { items: JumpItem[] }) {
	const reducedMotion = useReducedMotion()
	// A page with one or two sections has nothing to jump between.
	if (items.length < 3) return null
	return (
		<nav aria-label="On this page" className="enc-jump">
			{items.map((item) => (
				<button
					key={item.id}
					type="button"
					onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })}
				>
					{item.label}
					{item.count !== undefined && <span className="enc-jump__count">{item.count}</span>}
				</button>
			))}
		</nav>
	)
}

// ── The hero ────────────────────────────────────────────────────────────────

/**
 * The top of a detail page: the art, the name, a line of tags, and the facts
 * (release dates, cost) beside them. `accent` tints the corner the art sits
 * in: the brand by default, a card's type colour, a skill's own.
 */
export function Hero({ accent, art, eyebrow, name, nameId, nameLang, title, japanese, tags, lead, owned, facts }: {
	accent?: string
	art: ReactNode
	/** What kind of thing this is: "Trainee", "Support card", "Skill". */
	eyebrow: ReactNode
	name: string
	nameId?: string
	nameLang?: string
	title?: string
	japanese?: ReactNode
	tags?: ReactNode
	lead?: ReactNode
	/** The "You own this" line, when the player does. */
	owned?: ReactNode
	/** <Fact> elements. */
	facts?: ReactNode
}) {
	return (
		<header className="enc-hero" style={accent ? ({ "--enc-accent": accent } as CSSProperties) : undefined}>
			{art}
			<div className="enc-hero__body">
				<span className="enc-hero__eyebrow">{eyebrow}</span>
				<h1 id={nameId} className="enc-hero__name" lang={nameLang}>{name}</h1>
				{title && <p className="enc-hero__title">{title}</p>}
				{japanese}
				{tags && <div className="enc-hero__tags">{tags}</div>}
				{lead && <p className="enc-hero__lead">{lead}</p>}
				{owned}
			</div>
			{facts && <dl className="enc-hero__facts">{facts}</dl>}
		</header>
	)
}

/** One fact in the hero: a small caps label over its value. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="enc-fact">
			<dt className="enc-fact__label">{label}</dt>
			<dd className="enc-fact__value">{children}</dd>
		</div>
	)
}

/** A small pill. `dot` is a kind's own colour, always beside its word. */
export function Tag({ children, dot, className = "" }: { children: ReactNode; dot?: string; className?: string }) {
	return (
		<span className={`enc-tag ${className}`}>
			{dot && <span className="enc-dot" style={{ "--dot": dot } as CSSProperties} aria-hidden="true" />}
			{children}
		</span>
	)
}

/** "SSR", "SR" or "R" in the game's metals. Nothing for a card with no rarity. */
export function RarityTag({ rarity }: { rarity: number | null }) {
	const word = RARITY_WORDS[rarity ?? 0]
	if (!word) return null
	return <span className={`enc-tag ${RARITY_TAG_CLASS[rarity ?? 0]}`}>{word}</span>
}

/** A card's type with its colour dot. */
export function TypeTag({ type }: { type: string | null }) {
	const word = CARD_TYPE_LABELS[type ?? ""]
	if (!word) return null
	return <Tag dot={CARD_TYPE_COLORS[type ?? ""]}>{word}</Tag>
}

/** "On global" with the running green, or the "JP only" tag. */
export function WhereTag({ onGlobal }: { onGlobal: boolean }) {
	return onGlobal ? <Tag dot="var(--color-status-running)">On global</Tag> : <JpTag />
}

export function JpTag() {
	return <span className="enc-tag enc-tag--jp">JP only</span>
}

/** The Japanese name under the English one, marked as Japanese for screen readers and fonts. */
export function JapaneseName({ name, title }: { name: string; title: string }) {
	if (!name && !title) return null
	return <p className="enc-hero__jp" lang="ja">{[title, name].filter(Boolean).join(" ")}</p>
}

/**
 * "You own this" with the player's stars or limit break, and a way to their
 * Collection. Read from the Collection (useOwned); nothing here writes, so no
 * "saved" wording. Nothing for a guest or for something they don't own.
 */
export function OwnedLine({ detail, tab }: { detail: string; tab: "umas" | "cards" }) {
	return (
		<p className="enc-owned">
			<b><Check aria-hidden="true" />You own this</b>
			{detail && <span>{detail}</span>}
			<Link to={`/app/collection?tab=${tab}`} className="transition hover:opacity-75">Open your Collection</Link>
		</p>
	)
}

/** The tick in an owned tile's corner. The word is for a screen reader. */
export function OwnedMark() {
	return (
		<span className="enc-tile__owned" title="Owned">
			<Check aria-hidden="true" />
			<span className="sr-only">Owned</span>
		</span>
	)
}

export function Stars({ count }: { count: number | null }) {
	if (!count) return null
	return <span className="text-sm text-highlight" aria-label={`${count} stars`}>{"★".repeat(count)}</span>
}

// ── A section ───────────────────────────────────────────────────────────────

/**
 * A titled card. Leave a section out when it has nothing: never draw it
 * empty. `count` sits small beside the title; `aside` (a switch) on its right.
 */
export function Section({ id, title, count, aside, children }: {
	id?: string
	title: string
	count?: number | string
	aside?: ReactNode
	children: ReactNode
}) {
	return (
		<section id={id} className="enc-section">
			<div className="enc-section__head">
				<h2 className="enc-section__title">
					{title}
					{/* The space keeps the heading's name readable ("Skills 11"); the gap is the CSS's. */}
					{count !== undefined && <>{" "}<span className="enc-section__count">{count}</span></>}
				</h2>
				{aside}
			</div>
			{children}
		</section>
	)
}

/** A group's heading inside a section ("Innate skills"), ruled off to the right. */
export function SubHeading({ children }: { children: ReactNode }) {
	return <h3 className="enc-sub">{children}</h3>
}

export function SectionNote({ children }: { children: ReactNode }) {
	return <p className="enc-section__note">{children}</p>
}

/** "From the JP game. May change on global." beside facts global doesn't have yet. */
export function JpDataNote() {
	return <SectionNote>From the JP game. May change on global.</SectionNote>
}

/** A segmented switch for a section's heading: the star level, "Hide R". */
export function Switch<T extends string | number>({ label, options, value, onChange }: {
	label: string
	options: { value: T; label: string }[]
	value: T
	onChange: (value: T) => void
}) {
	return (
		<div role="group" aria-label={label} className="enc-switch">
			{options.map((option) => (
				<button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
					{option.label}
				</button>
			))}
		</div>
	)
}

// ── States ──────────────────────────────────────────────────────────────────

/** The page's shape while its data loads: a hero and two cards, shimmering. */
export function PageSkeleton({ label }: { label: string }) {
	return (
		<div role="status" aria-label={label} className="flex flex-col gap-4">
			<div className="enc-skeleton h-4 w-56" />
			<div className="enc-skeleton h-44 sm:h-52" />
			<div className="enc-skeleton h-36" />
			<div className="enc-skeleton h-56" />
		</div>
	)
}

/** A list's shape while it loads: a grid of blank tiles. */
export function GridSkeleton({ label, tall = false }: { label: string; tall?: boolean }) {
	return (
		<div role="status" aria-label={label} className="enc-grid">
			{Array.from({ length: 14 }, (_, index) => <div key={index} className={`enc-skeleton ${tall ? "h-52" : "h-40"}`} />)}
		</div>
	)
}

/** One line in a dashed box: nothing matched, or the page didn't load. */
export function EmptyNote({ children }: { children: ReactNode }) {
	return <p className="enc-empty">{children}</p>
}

export function NotFound() {
	return (
		<EmptyNote>
			There's no page for that.{" "}
			<Link to={UMA_LIST_PATH} className="text-brand transition hover:text-brand/75">Back to the Encyclopedia</Link>
		</EmptyNote>
	)
}
