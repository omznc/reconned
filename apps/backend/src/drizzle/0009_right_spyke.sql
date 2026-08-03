CREATE TYPE "public"."AttendeeRole" AS ENUM('LEADER', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."AttendeeStatus" AS ENUM('PENDING', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'WAITLISTED');--> statement-breakpoint
CREATE TABLE "EventAttendee" (
	"id" text PRIMARY KEY NOT NULL,
	"eventId" text NOT NULL,
	"bookingId" text NOT NULL,
	"userId" text,
	"guestName" text,
	"guestEmail" text,
	"role" "AttendeeRole" DEFAULT 'MEMBER' NOT NULL,
	"status" "AttendeeStatus" DEFAULT 'PENDING' NOT NULL,
	"attended" boolean,
	"inviteToken" text,
	"inviteExpiresAt" timestamp(3),
	"invitedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"respondedAt" timestamp(3),
	"paidAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."EventRegistration"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "EventAttendee_eventId_status_idx" ON "EventAttendee" USING btree ("eventId" text_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "EventAttendee_bookingId_idx" ON "EventAttendee" USING btree ("bookingId" text_ops);--> statement-breakpoint
CREATE INDEX "EventAttendee_userId_status_idx" ON "EventAttendee" USING btree ("userId" text_ops,"status" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "EventAttendee_inviteToken_key" ON "EventAttendee" USING btree ("inviteToken" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "EventAttendee_event_user_confirmed_key" ON "EventAttendee" USING btree ("eventId" text_ops,"userId" text_ops) WHERE "status" = 'CONFIRMED' AND "userId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "EventAttendee_event_guest_confirmed_key" ON "EventAttendee" USING btree ("eventId" text_ops,lower("guestEmail")) WHERE "status" = 'CONFIRMED' AND "guestEmail" IS NOT NULL;--> statement-breakpoint
--> Backfill: every existing attendee, whichever of the three old shapes they were stored in.
--> Leaders come from the booking's createdById, members from the team join table, and guests
--> from EventInvite. Ordering by `pri` makes a leader outrank a team invite for the same person.
--> Anyone the old model let hold two places at one event keeps the earliest and has the rest
--> recorded as CANCELLED, since the partial unique indexes above now forbid the overlap.
--> `attended` was a non-null boolean defaulting to false, so only an explicit true is real;
--> false is restored to null, meaning "nobody has marked the roster yet".
WITH src AS (
	SELECT r."eventId", r.id AS booking, r."createdById" AS uid,
		NULL::text AS gname, NULL::text AS gmail, NULL::text AS token, NULL::timestamp(3) AS token_exp,
		'LEADER'::"AttendeeRole" AS arole, 'CONFIRMED'::"AttendeeStatus" AS st,
		r.attended, r."createdAt" AS ts, r."createdAt" AS responded, 0 AS pri
	FROM "EventRegistration" r
	UNION ALL
	SELECT r."eventId", r.id, l."B",
		NULL, NULL, NULL, NULL,
		'MEMBER'::"AttendeeRole",
		(CASE l."status"
			WHEN 'ACCEPTED' THEN 'CONFIRMED'
			WHEN 'REJECTED' THEN 'DECLINED'
			ELSE 'PENDING'
		END)::"AttendeeStatus",
		r.attended, l."invitedAt", l."respondedAt", 1
	FROM "_EventRegistrationToUser" l
	JOIN "EventRegistration" r ON r.id = l."A"
	WHERE l."B" <> r."createdById"
	UNION ALL
	SELECT r."eventId", r.id, NULL,
		i.name, i.email, i.token, i."expiresAt",
		'MEMBER'::"AttendeeRole", 'CONFIRMED'::"AttendeeStatus",
		r.attended, i."createdAt", i."createdAt", 2
	FROM "EventInvite" i
	JOIN "EventRegistration" r ON r.id = i."eventRegistrationId"
), ranked AS (
	SELECT src.*,
		row_number() OVER (PARTITION BY "eventId", uid ORDER BY pri, ts) AS urn,
		row_number() OVER (PARTITION BY "eventId", lower(gmail) ORDER BY pri, ts) AS grn
	FROM src
), resolved AS (
	SELECT ranked.*,
		CASE
			WHEN st <> 'CONFIRMED' THEN st
			WHEN uid IS NOT NULL AND urn > 1 THEN 'CANCELLED'::"AttendeeStatus"
			WHEN gmail IS NOT NULL AND grn > 1 THEN 'CANCELLED'::"AttendeeStatus"
			ELSE st
		END AS final_st
	FROM ranked
)
INSERT INTO "EventAttendee" (
	"id", "eventId", "bookingId", "userId", "guestName", "guestEmail",
	"role", "status", "attended", "inviteToken", "inviteExpiresAt",
	"invitedAt", "respondedAt", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, "eventId", booking, uid, gname, gmail,
	arole, final_st,
	--> The booking's old attended flag described the whole group, so it only carries over to
	--> people who were actually on the roster. Somebody who declined cannot have attended.
	CASE WHEN attended AND final_st = 'CONFIRMED' THEN true ELSE NULL END,
	token, token_exp, ts, responded, ts, ts
FROM resolved;
