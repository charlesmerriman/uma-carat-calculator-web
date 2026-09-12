import type React from "react"
import { Link } from "react-router-dom"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"

// Same text-style vocabulary as PrivacyPolicy and Faq, so the public content pages stay
// visually consistent without a shared layout component.
const heading = "mt-8 text-xl font-semibold text-gray-100"
const paragraph = "mt-3 leading-relaxed text-gray-300"
const list = "mt-3 list-disc space-y-1 pl-6 leading-relaxed text-gray-300"
const link = "text-brand transition hover:text-brand/75"

// Duplicated from HomePage rather than shared: two constants in two files is cheaper than
// a constants module whose only job is to hold a URL, and the comment there about NOT
// using the vanity domain applies here too.
const HENRY_SHEET_URL =
	"https://docs.google.com/spreadsheets/d/100t3hnYl5Qm2UR8RtPlH-8Xd9KQbBlxEdXUOIR4d394/"
const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@HenryHandsomeDerby"

/**
 * Public About page (route: /about).
 *
 * Deliberately short. It exists to answer the three questions a first-time visitor (or an
 * ad-network reviewer) asks about an unfamiliar site — what is this, who runs it, and is it
 * official — and to point at the pages that answer everything else. Anything longer belongs
 * in the FAQ, which is where the detail already lives.
 *
 * Every factual claim here is one the FAQ or the privacy policy already makes. Keep it that
 * way: three pages disagreeing about what the site stores is worse than no About page.
 */
export const About: React.FC = () => {
	useDocumentMeta("About", "What the Uma Musume Carat Calculator is, who makes it, and where its carat and ticket numbers come from. An unofficial fan project, not affiliated with Cygames.")

	return (
		// Mirrors PrivacyPolicy: flex-1 on <main> absorbs leftover viewport height so the
		// footer keeps its fixed band at the bottom of a short page, and there is no
		// overflow-y-auto, so long content scrolls the page rather than a nested region.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-3xl px-4 py-8">
					<h1 className="text-3xl font-bold text-gray-100">About</h1>

					<p className={paragraph}>
						The Uma Musume Carat Calculator is a free, unofficial planning tool for
						players of Cygames&apos; <em>Uma Musume Pretty Derby</em>. It answers one
						question the game makes surprisingly hard to answer in your head:{" "}
						<strong>will I be able to afford the banner I actually want?</strong>
					</p>

					<h2 className={heading}>What it does</h2>
					<p className={paragraph}>
						Carats arrive from dozens of separate sources, each on its own schedule —
						daily logins, Team Trials on Mondays, club rank on the 1st, Champions
						Meeting when finals open, League of Heroes on its end date, plus every
						event, login bonus and mission the game runs. Banners come and go on a
						two-week cycle that lines up with none of it.
					</p>
					<p className={paragraph}>
						You tell the calculator what you hold right now and which income applies to
						your account. It walks the calendar forward day by day and shows what your
						wallet looks like on the day each banner you care about ends — before you
						spend, rather than after. It also plans step-up banners, tracks which
						characters and support cards a selector ticket can still reach, and shows
						the upcoming banner and event schedule on a timeline.
					</p>

					<h2 className={heading}>Where the numbers come from</h2>
					<p className={paragraph}>
						Banner dates, event rewards and income rates are maintained here by hand and
						updated as the game announces them. The underlying methodology follows{" "}
						<a href={HENRY_SHEET_URL} target="_blank" rel="noopener noreferrer" className={link}>
							Henry&apos;s resource spreadsheet
						</a>
						, the community reference this site grew out of. Recent data and feature
						changes are listed on the{" "}
						<Link to="/changelog" className={link}>
							Changelog
						</Link>
						, the{" "}
						<Link to="/faq" className={link}>
							FAQ
						</Link>{" "}
						explains each income source, and the{" "}
						<Link to="/guides/carat-income" className={link}>
							carat income guide
						</Link>{" "}
						walks through the projection step by step.
					</p>
					<p className={paragraph}>
						Everything the site produces is an <strong>estimate</strong>. Reward amounts
						and schedules are announced late or change, and one toggle set differently
						from how you actually play moves the total. Treat a projection as a
						well-informed forecast, not a promise.
					</p>

					<h2 className={heading}>Who makes it</h2>
					<p className={paragraph}>
						It is a small fan project, run alongside the{" "}
						<a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className={link}>
							Henry Handsome Derby
						</a>{" "}
						YouTube channel and the spreadsheet above. There is no company behind it —
						just a couple of players:
					</p>
					<ul className={list}>
						<li>
							<strong>Daboochy</strong> — built the site and keeps it running: the
							calculator itself, the projection engine behind it, and the banner and
							event data it runs on.
						</li>
						<li>
							<strong>Daptrius</strong> — the person behind the resource spreadsheet this
							site grew out of, and the source of much of the maths and data its numbers
							rest on.
						</li>
					</ul>
					<p className={paragraph}>
						Corrections and bug reports genuinely do get read and acted on.
					</p>

					<h2 className={heading}>What it costs, and what it asks of you</h2>
					<ul className={list}>
						<li>
							It is free, and it always has been. Advertising, if and when it runs, is
							what pays for hosting.
						</li>
						<li>
							No account is needed. The full calculator works as a guest; signing in
							only lets you save a plan and pick it up on another device.
						</li>
						<li>
							If you do sign in, we hold no email address, no real name and no
							password — see the{" "}
							<Link to="/privacy-policy" className={link}>
								Privacy Policy
							</Link>{" "}
							for exactly what is stored and why.
						</li>
					</ul>

					<h2 className={heading}>Not affiliated with Cygames</h2>
					<p className={paragraph}>
						This site is unofficial and has no connection to Cygames or{" "}
						<em>Uma Musume Pretty Derby</em>. All game names, characters and assets
						belong to their respective owners. Nothing here is an official statement
						about the game, and no projection it produces should be read as one.
					</p>

					<h2 className={heading}>Get in touch</h2>
					<p className={paragraph}>
						Bug reports, data corrections and feature ideas are best sent through the{" "}
						<Link to="/feedback" className={link}>
							Feedback
						</Link>{" "}
						form — no account required. For anything else, including press or business
						enquiries, email{" "}
						<a href="mailto:Henryhandsomederby@gmail.com" className={link}>
							Henryhandsomederby@gmail.com
						</a>
						.
					</p>

					<p className={`${paragraph} text-sm text-gray-500`}>
						See also our{" "}
						<Link to="/terms" className={link}>
							Terms of Service
						</Link>
						.
					</p>
				</div>
			</main>
			<Footer />
		</div>
	)
}
