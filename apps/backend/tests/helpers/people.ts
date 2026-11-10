import { expect } from "bun:test";
import { createUser, type TestUser, testDb } from "./auth";
import { api } from "./client";

export const DAY_MS = 24 * 60 * 60 * 1000;

export async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `People Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		latitude: 43.85,
		longitude: 18.41,
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string; slug: string | null };
}

export async function createEvent(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const now = Date.now();
	const response = await api(owner.cookie).post("/api/events", {
		clubId,
		name: `People Event ${crypto.randomUUID().slice(0, 8)}`,
		description: "An event created by the integration test suite",
		costPerPerson: 12,
		location: "Sarajevo, Igman",
		dateStart: new Date(now + 7 * DAY_MS).toISOString(),
		dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
		dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
		dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
		allowFreelancers: true,
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.event as { id: string; name: string; slug: string | null };
}

export async function register(attendee: TestUser, eventId: string) {
	const response = await api(attendee.cookie).post(`/api/events/${eventId}/registrations`, {
		type: "solo",
		paymentMethod: "cash",
	});
	expect(response.status).toBe(200);
}

export async function backdateEvent(eventId: string) {
	await testDb`UPDATE "Event" SET "dateStart" = NOW() - INTERVAL '2 days', "dateEnd" = NOW() - INTERVAL '1 day' WHERE id = ${eventId}`;
}

/** The attendee takes a place at a fresh event of the club, and the event then finishes. */
export async function playFinishedGame(owner: TestUser, clubId: string, attendee: TestUser) {
	const event = await createEvent(owner, clubId);
	await register(attendee, event.id);
	await backdateEvent(event.id);
	return event;
}

export async function addMember(userId: string, clubId: string, role = "USER", status = "ACTIVE") {
	await testDb`INSERT INTO "ClubMembership" (id, "userId", "clubId", role, status, "updatedAt")
		VALUES (${crypto.randomUUID()}, ${userId}, ${clubId}, ${role}::"Role", ${status}::"MembershipStatus", NOW())`;
}

export async function addUserReview(authorId: string, userId: string, rating: number) {
	await testDb`INSERT INTO "Review" (id, type, rating, content, "authorId", "userId", "updatedAt")
		VALUES (${crypto.randomUUID()}, 'USER', ${rating}, 'Good teammate', ${authorId}, ${userId}, NOW())`;
}

export async function addClubReview(authorId: string, clubId: string, rating: number, content = "Great club") {
	await testDb`INSERT INTO "Review" (id, type, rating, content, "authorId", "clubId", "updatedAt")
		VALUES (${crypto.randomUUID()}, 'CLUB', ${rating}, ${content}, ${authorId}, ${clubId}, NOW())`;
}

/** A user whose name carries a unique marker, so a test can find exactly its own users. */
export async function createMarkedUser(marker: string, suffix: string) {
	return createUser({ name: `${marker} ${suffix}` });
}
