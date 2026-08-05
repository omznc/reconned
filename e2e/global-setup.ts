import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { authDir, BACKEND_URL, consentOrigin, type Fixtures } from "./fixtures";

// Runs after Playwright's webServer entries are up (backend on 3202, web on 3100), so it
// only creates the API-level fixtures the specs need: a pre-authenticated storage state,
// and an organizer-owned club + open event to browse and apply to.

const CAPTCHA_HEADER = { "x-captcha-response": "e2e-token" };
// better-auth rejects auth POSTs without a trusted Origin; impersonate the web app.
const ORIGIN_HEADER = { origin: "http://localhost:3100" };

function sessionCookie(response: Response): string {
	const cookie = response.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.filter(Boolean)
		.join("; ");
	if (!cookie.includes("session_token")) {
		throw new Error("Sign-up response did not include a session cookie");
	}
	return cookie;
}

async function signUp(name: string, email: string, password: string): Promise<string> {
	const response = await fetch(`${BACKEND_URL}/api/auth/sign-up/email`, {
		method: "POST",
		headers: { "content-type": "application/json", ...CAPTCHA_HEADER, ...ORIGIN_HEADER },
		body: JSON.stringify({ name, email, password }),
	});
	if (!response.ok) {
		throw new Error(`E2E sign-up failed (${response.status}): ${await response.text()}`);
	}
	return sessionCookie(response);
}

async function apiPost(cookie: string, apiPath: string, body: unknown): Promise<Record<string, unknown>> {
	const response = await fetch(`${BACKEND_URL}${apiPath}`, {
		method: "POST",
		headers: { "content-type": "application/json", cookie, ...ORIGIN_HEADER },
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		throw new Error(`E2E fixture POST ${apiPath} failed (${response.status}): ${await response.text()}`);
	}
	return (await response.json()) as Record<string, unknown>;
}

/** Converts a raw `name=value; name2=value2` cookie string to a Playwright storage state. */
function storageStateFromCookie(cookie: string) {
	const cookies = cookie.split("; ").map((pair) => {
		const separator = pair.indexOf("=");
		return {
			name: pair.slice(0, separator),
			value: pair.slice(separator + 1),
			domain: "localhost",
			path: "/",
			expires: -1,
			httpOnly: true,
			secure: false,
			sameSite: "Lax" as const,
		};
	});
	// Pin the UI locale so specs can rely on English copy regardless of defaults.
	cookies.push({
		name: "NEXT_LOCALE",
		value: "en",
		domain: "localhost",
		path: "/",
		expires: -1,
		httpOnly: false,
		secure: false,
		sameSite: "Lax" as const,
	});
	return { cookies, origins: [consentOrigin()] };
}

export default async function globalSetup(): Promise<void> {
	mkdirSync(authDir, { recursive: true });

	// The "public" project signs in for itself, so it gets no cookies — but it
	// still needs the consent decision, or the banner covers the sign-up form.
	writeFileSync(
		path.join(authDir, "anonymous.json"),
		JSON.stringify({ cookies: [], origins: [consentOrigin()] }, null, "\t"),
	);

	const DAY_MS = 24 * 60 * 60 * 1000;
	const now = Date.now();

	// Organizer owns the club + event the authed specs browse and apply to.
	const organizerCookie = await signUp("E2E Organizer", `e2e-organizer-${now}@example.com`, "e2e-password-123");

	const countriesResponse = await fetch(`${BACKEND_URL}/api/countries`, {
		headers: { cookie: organizerCookie },
	});
	const countries = (await countriesResponse.json()) as Array<{ id: number }>;

	const clubBody = await apiPost(organizerCookie, "/api/clubs", {
		name: `E2E Club ${now}`,
		countryId: countries[0]?.id,
		location: "Sarajevo",
	});
	const club = clubBody.club as { id: string; name: string };

	const eventBody = await apiPost(organizerCookie, "/api/events", {
		clubId: club.id,
		name: `E2E Open Event ${now}`,
		description: "Event created for the Playwright E2E suite",
		costPerPerson: 10,
		location: "Sarajevo",
		dateStart: new Date(now + 7 * DAY_MS).toISOString(),
		dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
		dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
		dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
		allowFreelancers: true,
	});
	const event = eventBody.event as { id: string; name: string };

	// The user the "authed" Playwright project runs as.
	const user = {
		name: "E2E User",
		email: `e2e-user-${now}@example.com`,
		password: "e2e-password-123",
	};
	const userCookie = await signUp(user.name, user.email, user.password);
	writeFileSync(path.join(authDir, "user.json"), JSON.stringify(storageStateFromCookie(userCookie), null, "\t"));

	const fixtures: Fixtures = {
		user,
		event: { id: event.id, name: event.name },
		club: { id: club.id, name: club.name },
	};
	writeFileSync(path.join(authDir, "fixtures.json"), JSON.stringify(fixtures, null, "\t"));
}
