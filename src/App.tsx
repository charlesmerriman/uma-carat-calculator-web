import "./App.css"
import { useEffect } from "react"
import { Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { ApplicationViews } from "./views/ApplicationViews.js"
import { Login } from "./components/auth/Login.js"
import { OAuthCallback } from "./components/auth/OAuthCallback.js"
import { AccountPage } from "./components/account/AccountPage.js"
import { CalculatorProvider } from "./services/CalculatorProvider.js"
import { ErrorBoundary } from "./components/ErrorBoundary.js"
import { ApiSourceBadge } from "./components/ApiSourceBadge.js"
import { CookieConsentBanner } from "./components/consent/CookieConsentBanner.js"
import { ThemeProvider } from "./services/ThemeProvider.js"
import { AuthProvider } from "./services/AuthProvider.js"
import { useTheme } from "./services/ThemeContext.js"
import { HomePage } from "./components/home/HomePage.js"
import { PrivacyPolicy } from "./components/legal/PrivacyPolicy.js"
import { Terms } from "./components/legal/Terms.js"
import { Changelog } from "./components/info/Changelog.js"
import { About } from "./components/info/About.js"
import { Faq } from "./components/info/Faq.js"
import { CaratIncomeGuide } from "./components/info/CaratIncomeGuide.js"
import { Feedback } from "./components/info/Feedback.js"
import { NotFound } from "./components/NotFound.js"
import { recordVisit } from "./services/visitBeacon.js"
import { useScrollReset } from "./hooks/useScrollReset.js"

const ThemedToaster = () => {
	const { activeTheme } = useTheme()
	return <Toaster theme={activeTheme === "light" ? "light" : "dark"} position="bottom-right" richColors />
}

function App() {
	// Gives every page its own scroll position instead of one shared by the whole
	// site. Here rather than in ApplicationViews because the sharing crosses the
	// two halves of the app: /app scrolls a div, /about and /terms scroll the
	// document, and a navigation between them carried the offset either way.
	useScrollReset()

	// Traffic beacon. Deliberately here rather than inside a route element: this
	// is the only place that sees EVERY visitor, since CalculatorProvider
	// below only wraps /app. Counting further in would miss everyone who lands
	// on the home page, the FAQ or the changelog and leaves.
	//
	// Empty deps = once per mount, and recordVisit() is itself idempotent per
	// session, so StrictMode's double-invoke in development counts once.
	useEffect(() => {
		recordVisit()
	}, [])

	return (
		<ThemeProvider>
			<ErrorBoundary>
				<ThemedToaster />
				{/* On every route, the calculator included: a visitor who lands on
				    /app straight from a link has to be asked too. */}
				<CookieConsentBanner />
				{/* Dev-only, and only when VITE_API_URL points somewhere remote.
				    Compiles away entirely in production builds. */}
				<ApiSourceBadge />
				{/* Wraps every route, not just /app: the navbar needs it on the
				    home page and the FAQ, and the Phase 3 ad loader needs it
				    everywhere. A guest costs no request — see AuthProvider. */}
				<AuthProvider>
					<Routes>
						<Route path="/" element={<HomePage />} />
						<Route path="/login" element={<Login />} />
						{/* Where Google/Discord send the browser back to. Must match
						    OAUTH_REDIRECT_URI on the backend and the redirect URI
						    registered in each provider's console, exactly. */}
						<Route path="/auth/callback" element={<OAuthCallback />} />
						{/* Connected providers, supporter status, sign-out. Not prerendered
						    and noindex, like /login: it describes one signed-in person, and
						    a guest gets a sign-in card rather than a redirect. */}
						<Route path="/account" element={<AccountPage />} />
						<Route path="/privacy-policy" element={<PrivacyPolicy />} />
						<Route path="/terms" element={<Terms />} />
						<Route path="/about" element={<About />} />
						<Route path="/changelog" element={<Changelog />} />
						<Route path="/faq" element={<Faq />} />
						{/* Long-form companion to the FAQ. Its words are the admin's "carat-income-guide" page. */}
						<Route path="/guides/carat-income" element={<CaratIncomeGuide />} />
						<Route path="/feedback" element={<Feedback />} />
						{/* Public since guest mode: the calculator works without an
						    account; logging in is only needed to save a plan. The
						    closed-beta passcode wall that used to wrap this route
						    was removed at open-beta launch. */}
						<Route
							path="/app/*"
							element={
								<CalculatorProvider>
									<ApplicationViews />
								</CalculatorProvider>
							}
						/>
						{/* A real 404 rather than a redirect home — see NotFound for why the
						    old redirect was a soft 404. Only reached for paths OUTSIDE /app:
						    /app/* matches above and ApplicationViews carries its own. */}
						<Route path="*" element={<NotFound />} />
					</Routes>
				</AuthProvider>
			</ErrorBoundary>
		</ThemeProvider>
	)
}

export default App
