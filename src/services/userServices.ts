/**
 * User authentication API services.
 *
 * Sign-in itself lives in socialAuth.ts — accounts are created and
 * authenticated through Google/Discord, so there is no password login or
 * registration call here any more. What remains is logout (shared by every
 * kind of account) and the ApiError class both services throw.
 *
 * TYPESCRIPT CONCEPT: File Extensions (.ts vs .tsx)
 *
 * This file was originally .tsx but contains no JSX — only fetch calls
 * and type definitions. The .tsx extension tells the TypeScript compiler
 * to enable JSX parsing, which is unnecessary overhead here and can cause
 * subtle parsing differences (e.g., `<Type>value` is ambiguous in .tsx).
 * Rule of thumb: use .tsx ONLY for files that contain JSX elements.
 */

import { authHeaders } from "./authToken"

const API_URL = import.meta.env.VITE_API_URL

/**
 * Error type shared by the auth services, carrying a user-safe message.
 *
 * `fieldErrors` dates from the registration form's per-field validation. No
 * current caller populates it (social sign-in has no form fields to attach
 * errors to), but it is kept so the shape stays stable for any future form.
 */
export class ApiError extends Error {
	fieldErrors: Partial<Record<string, string>>

	constructor(message: string, fieldErrors: Partial<Record<string, string>> = {}) {
		super(message)
		this.fieldErrors = fieldErrors
	}
}

/**
 * TYPESCRIPT CONCEPT: Modeling API Contracts
 *
 * These interfaces document what the API expects (request) and returns
 * (response). Even though TypeScript can't verify the server response
 * at runtime, having these types means:
 *   1. Callers get autocomplete on the response
 *   2. If you refactor the API, the types guide you to update all callers
 *   3. New team members can read the types to understand the API shape
 */

interface LogoutResponse {
	message: string
}

export async function userLogout(): Promise<LogoutResponse> {
	const response = await fetch(`${API_URL}/logout`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...authHeaders()
		}
	})

	const data: LogoutResponse = await response.json()

	if (!response.ok) {
		/**
		 * TYPESCRIPT CONCEPT: The `in` Operator for Runtime Type Checking
		 *
		 * LogoutResponse only has `message`, not `error`. But the server
		 * might return an error object on failure. We use `in` to safely
		 * check if the property exists on the untyped error response.
		 * This is a runtime check, not a type-level one.
		 */
		const errorMessage =
			"error" in data && typeof data.error === "string"
				? data.error
				: "Logout failed"
		throw new Error(errorMessage)
	}

	return data
}
