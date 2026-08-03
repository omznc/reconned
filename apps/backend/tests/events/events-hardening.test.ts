import { describe, expect, test } from "bun:test";
import { createUser, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Hardening Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

function eventBody(clubId: string, overrides: Record<string, unknown> = {}) {
	const now = Date.now();
	return {
		clubId,
		name: `Hardening Event ${crypto.randomUUID().slice(0, 8)}`,
		description: "An event created by the integration test suite",
		costPerPerson: 10,
		location: "Sarajevo",
		dateStart: new Date(now + 7 * DAY_MS).toISOString(),
		dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
		dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
		dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
		allowFreelancers: true,
		...overrides,
	};
}

async function createEvent(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const response = await api(owner.cookie).post("/api/events", eventBody(clubId, overrides));
	expect(response.status).toBe(200);
	return response.body.event as { id: string; slug: string | null; maxAttendees: number | null };
}

/**
 * Attendance only opens once registrations have closed, so a test that wants to mark the roster
 * has to move the event into that window first — same edit an organiser makes on the day.
 */
async function closeRegistrations(
	owner: TestUser,
	clubId: string,
	eventId: string,
	overrides: Record<string, unknown> = {},
) {
	const response = await api(owner.cookie).put(
		`/api/events/${eventId}`,
		eventBody(clubId, { dateRegistrationsClose: new Date(Date.now() - 1000).toISOString(), ...overrides }),
	);
	expect(response.status).toBe(200);
}

function register(attendee: TestUser, eventId: string, body: Record<string, unknown> = {}) {
	return api(attendee.cookie).post(`/api/events/${eventId}/registrations`, {
		type: "solo",
		paymentMethod: "cash",
		...body,
	});
}

describe("deleting an event with dependent rows", () => {
	test("an event that has registrations can be deleted", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		expect((await register(attendee, event.id)).status).toBe(200);

		const deleted = await api(owner.cookie).delete(`/api/events/${event.id}`);
		expect(deleted.status).toBe(200);
		expect((await api(owner.cookie).get(`/api/events/${event.id}`)).status).toBe(404);
	});

	test("an event that has team members and external invites can be deleted", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await register(captain, event.id, {
			type: "team",
			invitedUserIds: [teammate.id],
			invitedUsersNotOnApp: [{ name: "Offline Player", email: `offline-${crypto.randomUUID()}@example.com` }],
		});
		expect(registration.status).toBe(200);

		const deleted = await api(owner.cookie).delete(`/api/events/${event.id}`);
		expect(deleted.status).toBe(200);
		expect((await api(owner.cookie).get(`/api/events/${event.id}`)).status).toBe(404);
	});

	test("a deleted event's registrations no longer count towards its club", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);
		await register(attendee, event.id);

		expect((await api(owner.cookie).delete(`/api/events/${event.id}`)).status).toBe(200);

		const count = await api().get(`/api/events/${event.id}/registrations/count`);
		expect(count.body.count).toBe(0);
	});
});

describe("event date validation", () => {
	test("an event cannot end before it starts", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const now = Date.now();

		const response = await api(owner.cookie).post(
			"/api/events",
			eventBody(club.id, {
				dateStart: new Date(now + 8 * DAY_MS).toISOString(),
				dateEnd: new Date(now + 7 * DAY_MS).toISOString(),
			}),
		);
		expect(response.status).toBe(400);
	});

	test("registrations cannot close after the event ends", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const now = Date.now();

		const response = await api(owner.cookie).post(
			"/api/events",
			eventBody(club.id, {
				dateRegistrationsClose: new Date(now + 30 * DAY_MS).toISOString(),
			}),
		);
		expect(response.status).toBe(400);
	});

	test("registrations cannot close before they open", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const now = Date.now();

		const response = await api(owner.cookie).post(
			"/api/events",
			eventBody(club.id, {
				dateRegistrationsOpen: new Date(now + 5 * DAY_MS).toISOString(),
				dateRegistrationsClose: new Date(now + DAY_MS).toISOString(),
			}),
		);
		expect(response.status).toBe(400);
	});

	test("unparseable dates are rejected", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(owner.cookie).post("/api/events", eventBody(club.id, { dateEnd: "not-a-date" }));
		expect(response.status).toBe(400);
	});

	test("updating an event cannot break the date ordering either", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);
		const now = Date.now();

		const response = await api(owner.cookie).put(
			`/api/events/${event.id}`,
			eventBody(club.id, {
				dateRegistrationsClose: new Date(now + 30 * DAY_MS).toISOString(),
			}),
		);
		expect(response.status).toBe(400);
	});
});

describe("allowFreelancers is enforced by the API", () => {
	test("a user with no club cannot register when freelancers are not allowed", async () => {
		const owner = await createUser();
		const freelancer = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { allowFreelancers: false });

		const response = await register(freelancer, event.id);
		expect(response.status).toBe(403);
	});

	test("a user who belongs to a club can register when freelancers are not allowed", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		await createClub(attendee);
		const event = await createEvent(owner, club.id, { allowFreelancers: false });

		const response = await register(attendee, event.id);
		expect(response.status).toBe(200);
	});

	test("a user with no club can register when freelancers are allowed", async () => {
		const owner = await createUser();
		const freelancer = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { allowFreelancers: true });

		expect((await register(freelancer, event.id)).status).toBe(200);
	});
});

describe("private events reject registrations from outsiders", () => {
	test("an outsider cannot register for a private event", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { isPrivate: true });

		const response = await register(outsider, event.id);
		expect(response.status).toBe(404);
	});

	test("an outsider cannot register for an event belonging to a private club", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner, { isPrivate: true });
		const event = await createEvent(owner, club.id);

		const response = await register(outsider, event.id);
		expect(response.status).toBe(404);
	});

	test("a club member can still register for their club's private event", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { isPrivate: true });

		expect((await register(owner, event.id)).status).toBe(200);
	});
});

describe("team invite validation", () => {
	test("inviting a user that does not exist is a validation error, not a crash", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await register(captain, event.id, {
			type: "team",
			invitedUserIds: [crypto.randomUUID()],
		});
		expect(response.status).toBe(400);
	});

	test("you cannot invite yourself to your own team", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await register(captain, event.id, {
			type: "team",
			invitedUserIds: [captain.id],
		});
		expect(response.status).toBe(400);
	});

	test("you cannot invite someone who already registered themselves", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const other = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		expect((await register(other, event.id)).status).toBe(200);

		const response = await register(captain, event.id, {
			type: "team",
			invitedUserIds: [other.id],
		});
		expect(response.status).toBe(400);
	});
});

describe("team invites require the invitee to opt in", () => {
	test("an invited user starts as PENDING and is not on the roster yet", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		expect((await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id] })).status).toBe(200);

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		expect(list.status).toBe(200);
		expect(list.body.registrations[0].invitedUsers[0].status).toBe("PENDING");

		const invites = await api(teammate.cookie).get("/api/events/team-invites");
		expect(invites.status).toBe(200);
		expect(invites.body.invites).toHaveLength(1);
		expect(invites.body.invites[0].eventId).toBe(event.id);
		expect(invites.body.invites[0].invitedByName).toBe(captain.name);
	});

	test("an invitee can accept and then appears as CONFIRMED", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id] });
		const registrationId = registration.body.registration.id as string;

		const accepted = await api(teammate.cookie).put(
			`/api/events/${event.id}/registrations/${registrationId}/invite`,
			{ status: "CONFIRMED" },
		);
		expect(accepted.status).toBe(200);
		expect(accepted.body.status).toBe("CONFIRMED");

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		expect(list.body.registrations[0].invitedUsers[0].status).toBe("CONFIRMED");
	});

	test("an invitee can reject, and the invite leaves their pending list", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id] });
		const registrationId = registration.body.registration.id as string;

		const rejected = await api(teammate.cookie).put(
			`/api/events/${event.id}/registrations/${registrationId}/invite`,
			{ status: "DECLINED" },
		);
		expect(rejected.status).toBe(200);

		const invites = await api(teammate.cookie).get("/api/events/team-invites");
		expect(invites.body.invites).toHaveLength(0);
	});

	test("a stranger cannot respond to an invite that is not theirs", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const stranger = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id] });
		const registrationId = registration.body.registration.id as string;

		const response = await api(stranger.cookie).put(
			`/api/events/${event.id}/registrations/${registrationId}/invite`,
			{ status: "CONFIRMED" },
		);
		expect(response.status).toBe(404);
	});

	test("editing a team registration does not reset an already accepted invite", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const newcomer = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id] });
		const registrationId = registration.body.registration.id as string;

		await api(teammate.cookie).put(`/api/events/${event.id}/registrations/${registrationId}/invite`, {
			status: "CONFIRMED",
		});

		expect(
			(await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id, newcomer.id] })).status,
		).toBe(200);

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const byId = new Map<string, string>(
			list.body.registrations[0].invitedUsers.map((u: { id: string; status: string }) => [u.id, u.status]),
		);
		expect(byId.get(teammate.id)).toBe("CONFIRMED");
		expect(byId.get(newcomer.id)).toBe("PENDING");
	});
});

describe("a user cannot be booked into the same event twice", () => {
	test("an accepted team member cannot also register solo", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id] });
		const registrationId = registration.body.registration.id as string;
		await api(teammate.cookie).put(`/api/events/${event.id}/registrations/${registrationId}/invite`, {
			status: "CONFIRMED",
		});

		const solo = await register(teammate, event.id);
		expect(solo.status).toBe(400);
	});

	test("a user who already registered cannot accept a team invite", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id] });
		const registrationId = registration.body.registration.id as string;

		// Registering after the invite went out is fine; accepting on top of it is not.
		expect((await register(teammate, event.id)).status).toBe(200);

		const accepted = await api(teammate.cookie).put(
			`/api/events/${event.id}/registrations/${registrationId}/invite`,
			{ status: "CONFIRMED" },
		);
		expect(accepted.status).toBe(400);
	});

	test("a pending invite does not block registering solo", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id] });

		expect((await register(teammate, event.id)).status).toBe(200);
	});
});

describe("event capacity", () => {
	test("registrations are refused once the event is full", async () => {
		const owner = await createUser();
		const first = await createUser();
		const second = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 1 });

		expect((await register(first, event.id)).status).toBe(200);

		const response = await register(second, event.id);
		expect(response.status).toBe(400);
	});

	test("external invites take up places too", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const latecomer = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 2 });

		expect(
			(
				await register(captain, event.id, {
					type: "team",
					invitedUsersNotOnApp: [
						{ name: "Offline Player", email: `offline-${crypto.randomUUID()}@example.com` },
					],
				})
			).status,
		).toBe(200);

		expect((await register(latecomer, event.id)).status).toBe(400);
	});

	test("accepting a team invite at a full event puts you on the waitlist, not through the door", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 1 });

		const registration = await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id] });
		const registrationId = registration.body.registration.id as string;

		const accepted = await api(teammate.cookie).put(
			`/api/events/${event.id}/registrations/${registrationId}/invite`,
			{ status: "CONFIRMED" },
		);
		expect(accepted.status).toBe(200);
		expect(accepted.body.status).toBe("WAITLISTED");

		// A waitlisted person is not attending, so they must not consume the cap.
		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(1);
		expect(details.body.placesLeft).toBe(0);
	});

	test("a place given back by someone dropping out goes to whoever has waited longest", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const first = await createUser();
		const second = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 2 });

		const registration = await register(captain, event.id, {
			type: "team",
			invitedUserIds: [first.id, second.id],
		});
		const registrationId = registration.body.registration.id as string;
		const invite = `/api/events/${event.id}/registrations/${registrationId}/invite`;

		// The captain holds one of the two places, so the first acceptance takes the last one.
		const firstAccept = await api(first.cookie).put(invite, { status: "CONFIRMED" });
		expect(firstAccept.body.status).toBe("CONFIRMED");

		const secondAccept = await api(second.cookie).put(invite, { status: "CONFIRMED" });
		expect(secondAccept.body.status).toBe("WAITLISTED");

		// The moment the first one drops out, the waiting one is in — without asking again.
		const declined = await api(first.cookie).put(invite, { status: "DECLINED" });
		expect(declined.status).toBe(200);

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const byId = new Map(
			list.body.registrations[0].invitedUsers.map((u: { id: string; status: string }) => [u.id, u.status]),
		);
		expect(byId.get(first.id)).toBe("DECLINED");
		expect(byId.get(second.id)).toBe("CONFIRMED");

		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(2);
	});

	test("the cap cannot be lowered below the people already signed up", async () => {
		const owner = await createUser();
		const first = await createUser();
		const second = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(first, event.id);
		await register(second, event.id);

		const response = await api(owner.cookie).put(
			`/api/events/${event.id}`,
			eventBody(club.id, { maxAttendees: 1 }),
		);
		expect(response.status).toBe(400);
	});

	test("an event with no cap accepts registrations freely", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);
		expect(event.maxAttendees).toBeNull();

		for (let i = 0; i < 3; i++) {
			const attendee = await createUser();
			expect((await register(attendee, event.id)).status).toBe(200);
		}
	});
});

describe("event routes accept a slug wherever they accept an id", () => {
	test("registering, listing, attendance and cancelling all work by slug", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const slug = `hardening-${crypto.randomUUID().slice(0, 8)}`;
		await createEvent(owner, club.id, { slug });

		const registration = await register(attendee, slug);
		expect(registration.status).toBe(200);
		const registrationId = registration.body.registration.id as string;

		const list = await api(owner.cookie).get(`/api/events/${slug}/registrations`);
		expect(list.status).toBe(200);
		expect(list.body.registrations).toHaveLength(1);

		await closeRegistrations(owner, club.id, slug, { slug });

		const attendance = await api(owner.cookie).put(
			`/api/events/${slug}/registrations/${registrationId}/attendance`,
			{ attended: true },
		);
		expect(attendance.status).toBe(200);
		expect(attendance.body.registration.attended).toBe(true);

		const cancelled = await api(attendee.cookie).delete(`/api/events/${slug}/registrations`);
		expect(cancelled.status).toBe(200);
	});

	test("an event can be updated and deleted by slug", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const slug = `hardening-${crypto.randomUUID().slice(0, 8)}`;
		const event = await createEvent(owner, club.id, { slug });

		const updated = await api(owner.cookie).put(
			`/api/events/${slug}`,
			eventBody(club.id, { slug, name: "Renamed By Slug" }),
		);
		expect(updated.status).toBe(200);
		expect(updated.body.event.name).toBe("Renamed By Slug");
		expect(updated.body.event.id).toBe(event.id);

		expect((await api(owner.cookie).delete(`/api/events/${slug}`)).status).toBe(200);
	});
});

describe("capacity is reported to the clients that gate on it", () => {
	test("an event with no limit reports no places left and a real headcount", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		expect(
			(
				await register(captain, event.id, {
					type: "team",
					invitedUserIds: [teammate.id],
				})
			).status,
		).toBe(200);

		const fetched = await api(owner.cookie).get(`/api/events/${event.id}`);
		expect(fetched.status).toBe(200);
		expect(fetched.body.placesLeft).toBe(null);
		// One registration, and the teammate has not accepted yet.
		expect(fetched.body.registrationCount).toBe(1);
		expect(fetched.body.attendeeCount).toBe(1);
	});

	test("an accepted team member is counted towards the headcount", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 5 });

		const registration = await register(captain, event.id, {
			type: "team",
			invitedUserIds: [teammate.id],
		});
		expect(registration.status).toBe(200);

		const accepted = await api(teammate.cookie).put(
			`/api/events/${event.id}/registrations/${registration.body.registration.id}/invite`,
			{ status: "CONFIRMED" },
		);
		expect(accepted.status).toBe(200);

		const fetched = await api(owner.cookie).get(`/api/events/${event.id}`);
		expect(fetched.status).toBe(200);
		expect(fetched.body.registrationCount).toBe(1);
		expect(fetched.body.attendeeCount).toBe(2);
		expect(fetched.body.placesLeft).toBe(3);
	});

	test("apply-data reports the places a newcomer can still take", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const newcomer = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 2 });

		expect((await register(attendee, event.id)).status).toBe(200);

		const forNewcomer = await api(newcomer.cookie).get(`/api/events/${event.id}/apply-data`);
		expect(forNewcomer.status).toBe(200);
		expect(forNewcomer.body.capacity.maxAttendees).toBe(2);
		expect(forNewcomer.body.capacity.takenByOthers).toBe(1);
		expect(forNewcomer.body.capacity.placesLeft).toBe(1);
	});

	test("apply-data does not count the caller's own registration against them", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 1 });

		expect((await register(attendee, event.id)).status).toBe(200);

		// The event is full, but the person already in it must still be able to edit.
		const forAttendee = await api(attendee.cookie).get(`/api/events/${event.id}/apply-data`);
		expect(forAttendee.status).toBe(200);
		expect(forAttendee.body.capacity.takenByOthers).toBe(0);
		expect(forAttendee.body.capacity.placesLeft).toBe(1);
		expect(forAttendee.body.existingRegistration).not.toBe(null);
	});
});

describe("attendance is recorded per person, not per squad", () => {
	test("a team can turn up without one of its members", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const noShow = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await register(captain, event.id, { type: "team", invitedUserIds: [noShow.id] });
		const registrationId = registration.body.registration.id as string;

		await api(noShow.cookie).put(`/api/events/${event.id}/registrations/${registrationId}/invite`, {
			status: "CONFIRMED",
		});

		await closeRegistrations(owner, club.id, event.id);

		// The manager marks the booking present, then corrects the one person who never showed.
		const booking = await api(owner.cookie).put(
			`/api/events/${event.id}/registrations/${registrationId}/attendance`,
			{ attended: true },
		);
		expect(booking.status).toBe(200);

		const before = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const absentee = before.body.registrations[0].invitedUsers.find((u: { id: string }) => u.id === noShow.id) as {
			attendeeId: string;
			attended: boolean;
		};
		expect(absentee.attended).toBe(true);

		const corrected = await api(owner.cookie).put(
			`/api/events/${event.id}/attendees/${absentee.attendeeId}/attendance`,
			{ attended: false },
		);
		expect(corrected.status).toBe(200);

		const after = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const roster = after.body.registrations[0];
		expect(roster.createdBy.attended).toBe(true);
		expect(roster.invitedUsers.find((u: { id: string }) => u.id === noShow.id).attended).toBe(false);
	});

	test("nobody is marked absent until somebody says so", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(attendee, event.id);

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		expect(list.body.registrations[0].createdBy.attended).toBe(null);
	});

	test("only a manager of the hosting club can mark someone present", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(attendee, event.id);

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const attendeeId = list.body.registrations[0].createdBy.attendeeId as string;

		const response = await api(outsider.cookie).put(`/api/events/${event.id}/attendees/${attendeeId}/attendance`, {
			attended: true,
		});
		expect(response.status).toBe(403);
	});
});

describe("guests brought along by a team", () => {
	test("a guest takes a place immediately, since nobody is going to ask them to confirm", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 3 });

		await register(captain, event.id, {
			type: "team",
			invitedUsersNotOnApp: [{ name: "Guest One", email: "guest.one@example.com" }],
		});

		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(2);
		expect(details.body.placesLeft).toBe(1);
	});

	test("a booking cannot claim more places than the event has left", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 2 });

		const response = await register(captain, event.id, {
			type: "team",
			invitedUsersNotOnApp: [
				{ name: "Guest One", email: "guest.one@example.com" },
				{ name: "Guest Two", email: "guest.two@example.com" },
			],
		});
		expect(response.status).toBe(400);

		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(0);
	});

	test("the same guest cannot be brought by two different teams", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const rival = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);
		const guest = [{ name: "Guest One", email: "shared.guest@example.com" }];

		expect((await register(captain, event.id, { type: "team", invitedUsersNotOnApp: guest })).status).toBe(200);

		// Same person, spelled differently. The address is what identifies them.
		const second = await register(rival, event.id, {
			type: "team",
			invitedUsersNotOnApp: [{ name: "guest one", email: "Shared.Guest@example.com" }],
		});
		expect(second.status).toBe(400);
	});

	test("editing a booking's guest list replaces it rather than piling up duplicates", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(captain, event.id, {
			type: "team",
			invitedUsersNotOnApp: [{ name: "Guest One", email: "guest.one@example.com" }],
		});
		await register(captain, event.id, {
			type: "team",
			invitedUsersNotOnApp: [{ name: "Guest Two", email: "guest.two@example.com" }],
		});

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const guests = list.body.registrations[0].invitedUsersNotOnApp as { email: string }[];
		expect(guests).toHaveLength(1);
		expect(guests[0]?.email).toBe("guest.two@example.com");
	});
});

/** Reads the one-time token that goes out in a guest's invitation email. */
async function guestToken(eventId: string, email: string) {
	const rows = await testDb.unsafe(
		`SELECT "inviteToken" FROM "EventAttendee" WHERE "eventId" = $1 AND lower("guestEmail") = $2`,
		[eventId, email.toLowerCase()],
	);
	return rows[0]?.inviteToken as string | null;
}

describe("a guest claiming the place that was booked for them", () => {
	test("the token binds the place to the account that redeems it", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const guest = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(captain, event.id, {
			type: "team",
			invitedUsersNotOnApp: [{ name: "Guest One", email: "claimable@example.com" }],
		});

		const token = await guestToken(event.id, "claimable@example.com");
		expect(token).toBeTruthy();

		const claim = await api(guest.cookie).post("/api/events/attendees/claim", { token });
		expect(claim.status).toBe(200);
		expect(claim.body.eventId).toBe(event.id);

		// The place did not move, it only changed hands: still one booking, still two people.
		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(2);

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const roster = list.body.registrations[0];
		expect(roster.invitedUsersNotOnApp).toHaveLength(0);
		expect(roster.invitedUsers.map((u: { id: string }) => u.id)).toContain(guest.id);
		expect(roster.invitedUsers.find((u: { id: string }) => u.id === guest.id).status).toBe("CONFIRMED");
	});

	test("a token cannot be redeemed twice", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const first = await createUser();
		const second = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(captain, event.id, {
			type: "team",
			invitedUsersNotOnApp: [{ name: "Guest One", email: "single.use@example.com" }],
		});

		const token = await guestToken(event.id, "single.use@example.com");
		expect((await api(first.cookie).post("/api/events/attendees/claim", { token })).status).toBe(200);

		const replay = await api(second.cookie).post("/api/events/attendees/claim", { token });
		expect(replay.status).toBe(404);
	});

	test("somebody already attending cannot take a second place", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(captain, event.id, {
			type: "team",
			invitedUsersNotOnApp: [{ name: "Guest One", email: "double.dip@example.com" }],
		});
		await register(attendee, event.id);

		const token = await guestToken(event.id, "double.dip@example.com");
		const claim = await api(attendee.cookie).post("/api/events/attendees/claim", { token });
		expect(claim.status).toBe(400);
	});

	test("a claimed place survives the captain editing the booking", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const guest = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(captain, event.id, {
			type: "team",
			invitedUsersNotOnApp: [{ name: "Guest One", email: "sticky@example.com" }],
		});

		const token = await guestToken(event.id, "sticky@example.com");
		expect((await api(guest.cookie).post("/api/events/attendees/claim", { token })).status).toBe(200);

		// The apply form no longer lists them as a guest, so the edit arrives without them. Their
		// place is theirs now, and reconciling the guest list must leave it alone.
		await register(captain, event.id, {
			type: "team",
			invitedUserIds: [guest.id],
			invitedUsersNotOnApp: [],
		});

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const member = list.body.registrations[0].invitedUsers.find((u: { id: string }) => u.id === guest.id);
		expect(member.status).toBe("CONFIRMED");
	});

	test("editing a booking leaves an untouched guest's invitation link working", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);
		const guests = [{ name: "Guest One", email: "kept@example.com" }];

		await register(captain, event.id, { type: "team", invitedUsersNotOnApp: guests });
		const before = await guestToken(event.id, "kept@example.com");

		await register(captain, event.id, {
			type: "team",
			paymentMethod: "bank",
			invitedUsersNotOnApp: guests,
		});

		expect(await guestToken(event.id, "kept@example.com")).toBe(before);
	});
});

describe("a place that frees up finds its way to the next person", () => {
	test("a full event offers the waiting list instead of a closed door", async () => {
		const owner = await createUser();
		const first = await createUser();
		const second = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 1 });

		expect((await register(first, event.id)).status).toBe(200);

		// Without opting in the answer is still no, because a queued place is not a place.
		const turnedAway = await register(second, event.id);
		expect(turnedAway.status).toBe(400);

		const queued = await register(second, event.id, { joinWaitlist: true });
		expect(queued.status).toBe(200);
		expect(queued.body.waitlisted).toBe(true);

		// Queueing must not consume the cap, or the first person's place would be double-sold.
		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(1);
		expect(details.body.placesLeft).toBe(0);
	});

	test("cancelling hands the place to whoever registered themselves onto the list", async () => {
		const owner = await createUser();
		const first = await createUser();
		const second = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 1 });

		await register(first, event.id);
		await register(second, event.id, { joinWaitlist: true });

		const cancelled = await api(first.cookie).delete(`/api/events/${event.id}/registrations`);
		expect(cancelled.status).toBe(200);
		expect(cancelled.body.promoted).toBe(1);

		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(1);
	});

	test("dropping a teammate hands their place to the waiting list", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const teammate = await createUser();
		const waiting = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 2 });

		const registration = await register(captain, event.id, { type: "team", invitedUserIds: [teammate.id] });
		const registrationId = registration.body.registration.id as string;

		const accepted = await api(teammate.cookie).put(
			`/api/events/${event.id}/registrations/${registrationId}/invite`,
			{ status: "CONFIRMED" },
		);
		expect(accepted.body.status).toBe("CONFIRMED");

		await register(waiting, event.id, { joinWaitlist: true });

		// The captain drops the teammate. The place they were holding has to go somewhere.
		const edited = await register(captain, event.id, { type: "team", invitedUserIds: [] });
		expect(edited.status).toBe(200);

		const invites = await api(waiting.cookie).get("/api/events/team-invites");
		expect(invites.body.invites).toHaveLength(0);

		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(2);
	});

	test("dropping a guest hands their place to the waiting list", async () => {
		const owner = await createUser();
		const captain = await createUser();
		const waiting = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 2 });
		const guestEmail = `dropped-${crypto.randomUUID()}@example.com`;

		await register(captain, event.id, {
			type: "team",
			invitedUsersNotOnApp: [{ name: "Dropped Guest", email: guestEmail }],
		});

		await register(waiting, event.id, { joinWaitlist: true });

		await register(captain, event.id, { type: "team", invitedUsersNotOnApp: [] });

		const rows = await testDb.unsafe(`SELECT "status" FROM "EventAttendee" WHERE "eventId" = $1`, [event.id]);
		const confirmed = rows.filter((r: { status: string }) => r.status === "CONFIRMED");
		expect(confirmed).toHaveLength(2);
		expect(rows.some((r: { status: string }) => r.status === "WAITLISTED")).toBe(false);
	});

	test("raising the cap drains the waiting list", async () => {
		const owner = await createUser();
		const first = await createUser();
		const second = await createUser();
		const third = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 1 });

		await register(first, event.id);
		await register(second, event.id, { joinWaitlist: true });
		await register(third, event.id, { joinWaitlist: true });

		const raised = await api(owner.cookie).put(`/api/events/${event.id}`, eventBody(club.id, { maxAttendees: 3 }));
		expect(raised.status).toBe(200);

		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(3);
		expect(details.body.placesLeft).toBe(0);
	});

	test("lifting the cap entirely lets everybody in", async () => {
		const owner = await createUser();
		const first = await createUser();
		const second = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 1 });

		await register(first, event.id);
		await register(second, event.id, { joinWaitlist: true });

		const lifted = await api(owner.cookie).put(
			`/api/events/${event.id}`,
			eventBody(club.id, { maxAttendees: null }),
		);
		expect(lifted.status).toBe(200);

		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(2);
	});

	test("the queue is served in the order people joined it", async () => {
		const owner = await createUser();
		const holder = await createUser();
		const early = await createUser();
		const late = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 1 });

		await register(holder, event.id);
		await register(early, event.id, { joinWaitlist: true });
		await register(late, event.id, { joinWaitlist: true });

		await api(holder.cookie).delete(`/api/events/${event.id}/registrations`);

		const rows = await testDb.unsafe(
			`SELECT "userId", "status" FROM "EventAttendee" WHERE "eventId" = $1 AND "userId" IS NOT NULL`,
			[event.id],
		);
		const byUser = new Map(rows.map((r: { userId: string; status: string }) => [r.userId, r.status]));
		expect(byUser.get(early.id)).toBe("CONFIRMED");
		expect(byUser.get(late.id)).toBe("WAITLISTED");
	});
});

describe("the capacity lock holds under a rush", () => {
	test("everybody racing for the last place, only one gets it", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 1 });

		const racers = await Promise.all(Array.from({ length: 8 }, () => createUser()));

		// The whole point of the row lock: these all read "one place left" at the same moment.
		const results = await Promise.all(racers.map((racer) => register(racer, event.id)));

		const accepted = results.filter((r) => r.status === 200);
		expect(accepted).toHaveLength(1);

		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(1);
	});

	test("a rush at a five-place event fills it exactly", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { maxAttendees: 5 });

		const racers = await Promise.all(Array.from({ length: 12 }, () => createUser()));
		const results = await Promise.all(racers.map((racer) => register(racer, event.id)));

		expect(results.filter((r) => r.status === 200)).toHaveLength(5);

		const details = await api().get(`/api/events/${event.id}`);
		expect(details.body.attendeeCount).toBe(5);
		expect(details.body.placesLeft).toBe(0);
	});
});

describe("recording who has settled up", () => {
	test("a manager can mark somebody paid and unpaid", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(attendee, event.id);

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const attendeeId = list.body.registrations[0].createdBy.attendeeId as string;
		expect(list.body.registrations[0].createdBy.paidAt).toBeNull();

		const paid = await api(owner.cookie).put(`/api/events/${event.id}/attendees/${attendeeId}/payment`, {
			paid: true,
		});
		expect(paid.status).toBe(200);
		expect(paid.body.attendee.paidAt).not.toBeNull();

		const unpaid = await api(owner.cookie).put(`/api/events/${event.id}/attendees/${attendeeId}/payment`, {
			paid: false,
		});
		expect(unpaid.status).toBe(200);
		// Cleared back to null, because money that has not arrived has not arrived.
		expect(unpaid.body.attendee.paidAt).toBeNull();
	});

	test("only a manager of the hosting club can mark somebody paid", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(attendee, event.id);

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const attendeeId = list.body.registrations[0].createdBy.attendeeId as string;

		const response = await api(outsider.cookie).put(`/api/events/${event.id}/attendees/${attendeeId}/payment`, {
			paid: true,
		});
		expect(response.status).toBe(403);
	});
});

describe("attendance can only be recorded around the event", () => {
	test("the door cannot be marked while registrations are still open", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(attendee, event.id);

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const attendeeId = list.body.registrations[0].createdBy.attendeeId as string;

		const early = await api(owner.cookie).put(`/api/events/${event.id}/attendees/${attendeeId}/attendance`, {
			attended: true,
		});
		expect(early.status).toBe(400);
	});

	test("marking the roster leaves an entry in the club's audit log", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await register(attendee, event.id);
		await closeRegistrations(owner, club.id, event.id);

		const list = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		const attendeeId = list.body.registrations[0].createdBy.attendeeId as string;

		expect(
			(
				await api(owner.cookie).put(`/api/events/${event.id}/attendees/${attendeeId}/attendance`, {
					attended: true,
				})
			).status,
		).toBe(200);

		const rows = await testDb.unsafe(
			`SELECT "actionType" FROM "ClubAuditLog" WHERE "clubId" = $1 AND "actionType" = 'EVENT_ATTENDANCE_UPDATE'`,
			[club.id],
		);
		expect(rows).toHaveLength(1);
	});
});
