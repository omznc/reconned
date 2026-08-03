import { describe, expect, test } from "bun:test";
import { redis } from "../../src/lib/redis";
import { createUser, makeAdmin, type TestUser, testDb } from "../helpers/auth";
import { type ApiResponse, api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

// POST /reviews carries its own rate limit (10 requests/minute), keyed by x-forwarded-for and
// falling back to "unknown" — every request in this suite would otherwise share one bucket. Each
// call gets a distinct synthetic IP so the many separate scenarios below don't trip that limit;
// they're standing in for separate real-world clients anyway.
function postReview(cookie: string | undefined, body: unknown): Promise<ApiResponse> {
	return api(cookie).post("/api/reviews", body, { "x-forwarded-for": `10.0.${crypto.randomUUID()}` });
}

async function setReviewsFeatureEnabled(enabled: boolean) {
	const existing = await testDb`SELECT id FROM "FeatureFlag" WHERE name = 'REVIEWS' LIMIT 1`;
	if (existing.length > 0) {
		await testDb`UPDATE "FeatureFlag" SET enabled = ${enabled} WHERE name = 'REVIEWS'`;
	} else {
		await testDb`INSERT INTO "FeatureFlag" (id, name, enabled) VALUES (${crypto.randomUUID()}, 'REVIEWS', ${enabled})`;
	}
	// The route caches the flag value in Redis for 5 minutes, so the cache must be
	// invalidated for a flip to take effect on the next request.
	await redis.del("feature_flag:REVIEWS");
}

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Review Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

async function createEvent(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const now = Date.now();
	const response = await api(owner.cookie).post("/api/events", {
		clubId,
		name: `Review Event ${crypto.randomUUID().slice(0, 8)}`,
		description: "An event created by the integration test suite",
		costPerPerson: 0,
		location: "Sarajevo",
		dateStart: new Date(now + DAY_MS).toISOString(),
		dateEnd: new Date(now + 2 * DAY_MS).toISOString(),
		dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
		dateRegistrationsClose: new Date(now + DAY_MS).toISOString(),
		// The suite's attendees belong to no club; without this they hit the freelancer gate.
		allowFreelancers: true,
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.event as { id: string; name: string };
}

/** Registers `attendee` for `eventId`, then backdates the event so the review eligibility check
 * (must have attended a finished event) passes. Registering is enough on its own now: a booking
 * puts its creator on the roster as a confirmed attendee. */
async function makeEventReviewable(attendee: TestUser, eventId: string) {
	const registration = await api(attendee.cookie).post(`/api/events/${eventId}/registrations`, {
		type: "solo",
		paymentMethod: "cash",
	});
	expect(registration.status).toBe(200);

	await testDb`UPDATE "Event" SET "dateStart" = NOW() - INTERVAL '2 days', "dateEnd" = NOW() - INTERVAL '1 day' WHERE id = ${eventId}`;
}

describe("reviews", () => {
	test("creating a review is forbidden while the REVIEWS feature flag is disabled", async () => {
		await setReviewsFeatureEnabled(false);
		try {
			const author = await createUser();
			const target = await createUser();
			const response = await postReview(author.cookie, {
				type: "USER",
				rating: 5,
				content: "Great person",
				userId: target.id,
			});
			expect(response.status).toBe(403);
			expect(response.body.error.code).toBeString();
		} finally {
			await setReviewsFeatureEnabled(true);
		}
	});

	test("an unauthenticated visitor cannot create a review", async () => {
		const target = await createUser();
		const response = await postReview(undefined, {
			type: "USER",
			rating: 5,
			content: "Great person",
			userId: target.id,
		});
		expect(response.status).toBe(401);
	});

	test("creating a user review requires userId and rejects self-reviews", async () => {
		const author = await createUser();

		const missingUserId = await postReview(author.cookie, {
			type: "USER",
			rating: 4,
			content: "Missing target",
		});
		expect(missingUserId.status).toBe(400);

		const selfReview = await postReview(author.cookie, {
			type: "USER",
			rating: 4,
			content: "Reviewing myself",
			userId: author.id,
		});
		expect(selfReview.status).toBe(400);
	});

	test("creating a review for a nonexistent user returns 404", async () => {
		const author = await createUser();
		const response = await postReview(author.cookie, {
			type: "USER",
			rating: 3,
			content: "Ghost review",
			userId: crypto.randomUUID(),
		});
		expect(response.status).toBe(404);
	});

	test("creating a user review returns 201, and reviewing the same user again updates it (200)", async () => {
		const author = await createUser();
		const target = await createUser();

		const created = await postReview(author.cookie, {
			type: "USER",
			rating: 5,
			content: "Excellent teammate",
			userId: target.id,
		});
		expect(created.status).toBe(201);
		expect(created.body.review.authorId).toBe(author.id);
		expect(created.body.review.userId).toBe(target.id);
		expect(created.body.review.rating).toBe(5);

		const updated = await postReview(author.cookie, {
			type: "USER",
			rating: 2,
			content: "Changed my mind",
			userId: target.id,
		});
		expect(updated.status).toBe(200);
		expect(updated.body.review.id).toBe(created.body.review.id);
		expect(updated.body.review.rating).toBe(2);
	});

	test("creating a club review requires an existing club and succeeds for a real one", async () => {
		const author = await createUser();
		const club = await createClub(author);

		const missingClubId = await postReview(author.cookie, {
			type: "CLUB",
			rating: 4,
			content: "Missing target",
		});
		expect(missingClubId.status).toBe(400);

		const notFound = await postReview(author.cookie, {
			type: "CLUB",
			rating: 4,
			content: "Ghost club",
			clubId: crypto.randomUUID(),
		});
		expect(notFound.status).toBe(404);

		const created = await postReview(author.cookie, {
			type: "CLUB",
			rating: 4,
			content: "Nice club",
			clubId: club.id,
		});
		expect(created.status).toBe(201);
		expect(created.body.review.clubId).toBe(club.id);
	});

	test("an event review requires a finished event, checked before attendance", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		// The event hasn't finished yet, so the "finished" check rejects this before attendance
		// is even considered — even for a user who never registered.
		const notFinished = await postReview(outsider.cookie, {
			type: "EVENT",
			rating: 5,
			content: "Too early",
			eventId: event.id,
		});
		expect(notFinished.status).toBe(400);
	});

	test("an event review is forbidden for a finished event the user did not attend", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await testDb`UPDATE "Event" SET "dateStart" = NOW() - INTERVAL '2 days', "dateEnd" = NOW() - INTERVAL '1 day' WHERE id = ${event.id}`;

		const notAttended = await postReview(outsider.cookie, {
			type: "EVENT",
			rating: 5,
			content: "Never went",
			eventId: event.id,
		});
		expect(notAttended.status).toBe(403);
	});

	test("creating an event review for a nonexistent event returns 404", async () => {
		const author = await createUser();
		const response = await postReview(author.cookie, {
			type: "EVENT",
			rating: 5,
			content: "Ghost event",
			eventId: crypto.randomUUID(),
		});
		expect(response.status).toBe(404);
	});

	test("an attendee can review a finished event", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);
		await makeEventReviewable(attendee, event.id);

		const created = await postReview(attendee.cookie, {
			type: "EVENT",
			rating: 5,
			content: "Great weekend of airsoft",
			eventId: event.id,
		});
		expect(created.status).toBe(201);
		expect(created.body.review.eventId).toBe(event.id);
		expect(created.body.review.authorId).toBe(attendee.id);
	});

	test("someone who declined a team invite cannot review the event", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const invitee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await api(captain.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "team",
			paymentMethod: "cash",
			invitedUserIds: [invitee.id],
		});
		expect(registration.status).toBe(200);

		const declined = await api(invitee.cookie).put(
			`/api/events/${event.id}/registrations/${registration.body.registration.id}/invite`,
			{ status: "DECLINED" },
		);
		expect(declined.status).toBe(200);

		await testDb`UPDATE "Event" SET "dateStart" = NOW() - INTERVAL '2 days', "dateEnd" = NOW() - INTERVAL '1 day' WHERE id = ${event.id}`;

		const response = await postReview(invitee.cookie, {
			type: "EVENT",
			rating: 1,
			content: "I never actually went to this one",
			eventId: event.id,
		});
		expect(response.status).toBe(403);
	});

	test("PATCH /reviews/:id lets the author edit their review and records edit history", async () => {
		const author = await createUser();
		const target = await createUser();

		const created = await postReview(author.cookie, {
			type: "USER",
			rating: 3,
			content: "Original content",
			userId: target.id,
		});
		expect(created.status).toBe(201);
		const reviewId = created.body.review.id as string;

		const patched = await api(author.cookie).patch(`/api/reviews/${reviewId}`, {
			rating: 5,
			content: "Updated content",
		});
		expect(patched.status).toBe(200);
		expect(patched.body.review.rating).toBe(5);
		expect(patched.body.review.content).toBe("Updated content");

		const history = await api().get(`/api/reviews/${reviewId}/history`);
		expect(history.status).toBe(200);
		expect(history.body.history.length).toBeGreaterThanOrEqual(1);
		expect(history.body.history[0].previousContent).toBe("Original content");
		expect(history.body.history[0].previousRating).toBe(3);
	});

	test("PATCH /reviews/:id rejects unauthenticated requests, unknown reviews, invalid bodies, and other authors", async () => {
		const author = await createUser();
		const outsider = await createUser();
		const target = await createUser();

		const created = await postReview(author.cookie, {
			type: "USER",
			rating: 3,
			content: "Original content",
			userId: target.id,
		});
		expect(created.status).toBe(201);
		const reviewId = created.body.review.id as string;

		const unauthenticated = await api().patch(`/api/reviews/${reviewId}`, { rating: 4, content: "x" });
		expect(unauthenticated.status).toBe(401);

		const notFound = await api(author.cookie).patch(`/api/reviews/${crypto.randomUUID()}`, {
			rating: 4,
			content: "x",
		});
		expect(notFound.status).toBe(404);

		const invalidBody = await api(author.cookie).patch(`/api/reviews/${reviewId}`, { rating: 9, content: "x" });
		expect(invalidBody.status).toBe(400);

		const forbidden = await api(outsider.cookie).patch(`/api/reviews/${reviewId}`, {
			rating: 4,
			content: "Hijacked",
		});
		expect(forbidden.status).toBe(403);
	});

	test("DELETE /reviews/:id lets the author delete their review, but not other users", async () => {
		const author = await createUser();
		const outsider = await createUser();
		const target = await createUser();

		const created = await postReview(author.cookie, {
			type: "USER",
			rating: 3,
			content: "To be deleted",
			userId: target.id,
		});
		expect(created.status).toBe(201);
		const reviewId = created.body.review.id as string;

		const unauthenticated = await api().delete(`/api/reviews/${reviewId}`);
		expect(unauthenticated.status).toBe(401);

		const forbidden = await api(outsider.cookie).delete(`/api/reviews/${reviewId}`);
		expect(forbidden.status).toBe(403);

		const notFound = await api(author.cookie).delete(`/api/reviews/${crypto.randomUUID()}`);
		expect(notFound.status).toBe(404);

		const deleted = await api(author.cookie).delete(`/api/reviews/${reviewId}`);
		expect(deleted.status).toBe(200);
		expect(deleted.body.success).toBeTrue();

		const deleteAgain = await api(author.cookie).delete(`/api/reviews/${reviewId}`);
		expect(deleteAgain.status).toBe(404);
	});

	test("an admin can delete someone else's review", async () => {
		const author = await createUser();
		const target = await createUser();
		const adminUser = await createUser();
		const admin = await makeAdmin(adminUser);

		const created = await postReview(author.cookie, {
			type: "USER",
			rating: 3,
			content: "Admin will remove this",
			userId: target.id,
		});
		expect(created.status).toBe(201);
		const reviewId = created.body.review.id as string;

		const deleted = await api(admin.cookie).delete(`/api/reviews/${reviewId}`);
		expect(deleted.status).toBe(200);
		expect(deleted.body.success).toBeTrue();
	});

	test("GET /reviews/:type/:id lists reviews with pagination and rating filters, and rejects invalid types", async () => {
		const author = await createUser();
		const target = await createUser();

		const created = await postReview(author.cookie, {
			type: "USER",
			rating: 5,
			content: "Listed review",
			userId: target.id,
		});
		expect(created.status).toBe(201);

		const list = await api().get(`/api/reviews/user/${target.id}`);
		expect(list.status).toBe(200);
		expect(list.body.reviews.map((r: { id: string }) => r.id)).toContain(created.body.review.id);
		expect(list.body.pagination).toMatchObject({ page: 1 });

		const filtered = await api().get(`/api/reviews/user/${target.id}?minRating=5&maxRating=5`);
		expect(filtered.status).toBe(200);
		expect(filtered.body.reviews.map((r: { id: string }) => r.id)).toContain(created.body.review.id);

		const filteredOut = await api().get(`/api/reviews/user/${target.id}?rating=1`);
		expect(filteredOut.status).toBe(200);
		expect(filteredOut.body.reviews.map((r: { id: string }) => r.id)).not.toContain(created.body.review.id);

		const invalidType = await api().get(`/api/reviews/team/${target.id}`);
		expect(invalidType.status).toBe(400);
	});

	test("GET /reviews/:id/history returns 404 for an unknown review", async () => {
		const response = await api().get(`/api/reviews/${crypto.randomUUID()}/history`);
		expect(response.status).toBe(404);
	});
});
