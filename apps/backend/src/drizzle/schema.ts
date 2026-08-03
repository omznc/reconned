import { sql } from "drizzle-orm";
import {
	boolean,
	char,
	doublePrecision,
	foreignKey,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	smallint,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const inviteStatus = pgEnum("InviteStatus", [
	"PENDING",
	"ACCEPTED",
	"REJECTED",
	"EXPIRED",
	"REVOKED",
	"REQUESTED",
]);
export const reviewType = pgEnum("ReviewType", ["USER", "CLUB", "EVENT"]);
export const role = pgEnum("Role", ["USER", "MANAGER", "CLUB_OWNER"]);

/** Where a single person stands with a single event. See `eventAttendee`. */
export const attendeeStatus = pgEnum("AttendeeStatus", [
	// Invited onto someone's team, has not answered yet. Holds no place.
	"PENDING",
	// Coming. The only status that occupies a place and counts towards the headcount.
	"CONFIRMED",
	// Was invited onto a team and said no.
	"DECLINED",
	// Was confirmed and pulled out, or their booking was cancelled.
	"CANCELLED",
	// Wanted a place at a full event. Promoted to CONFIRMED when one frees up.
	"WAITLISTED",
]);

/** Whether this person made the booking or was brought along on it. */
export const attendeeRole = pgEnum("AttendeeRole", ["LEADER", "MEMBER"]);

export const achievement = pgTable(
	"Achievement",
	{
		id: text().primaryKey().notNull(),
		slug: text().notNull(),
		description: text(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	},
	(table) => [uniqueIndex("Achievement_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops"))],
);

export const club = pgTable(
	"Club",
	{
		id: text().primaryKey().notNull(),
		name: text().notNull(),
		location: text(),
		// `location` is free-form ("Matuzići Doboj Jug", "Sarajevo, BiH") and cannot be
		// grouped on, so the per-city landing pages key off a real city instead.
		//
		// `cityId` is the source of truth — a row in the seeded `City` table, chosen in
		// the club settings form. `city` and `citySlug` are denormalised copies of that
		// row's name and slug, written server-side whenever `cityId` changes. They exist
		// so the landing-page queries stay single-table, and because they are copies of
		// one row rather than user text, two clubs in the same city can no longer
		// disagree about how it is spelled.
		cityId: integer(),
		city: text(),
		citySlug: text(),
		latitude: doublePrecision(),
		longitude: doublePrecision(),
		description: text(),
		dateFounded: timestamp({ precision: 3, mode: "string" }),
		slug: text(),
		isAllied: boolean().default(false).notNull(),
		isPrivate: boolean().default(false).notNull(),
		isPrivateStats: boolean().default(false).notNull(),
		logo: text(),
		contactPhone: text(),
		contactEmail: text(),
		verified: boolean().default(false).notNull(),
		website: text(),
		instagramUsername: text(),
		instagramProfilePictureUrl: text(),
		instagramAccessToken: text(),
		instagramTokenExpiry: timestamp({ precision: 3, mode: "string" }),
		instagramRefreshToken: text(),
		instagramConnected: boolean().default(false).notNull(),
		instagramBusinessId: text(),
		facebookPageId: text(),
		instagramTokenType: text(),
		countryId: integer(),
		banned: boolean(),
		banReason: text(),
		banExpires: timestamp({ precision: 3, mode: "string" }),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		headerImage: text(),
	},
	(table) => [
		uniqueIndex("Club_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
		index("Club_isPrivate_idx").using("btree", table.isPrivate.asc().nullsLast()),
		index("Club_verified_idx").using("btree", table.verified.asc().nullsLast()),
		index("Club_countryId_idx").using("btree", table.countryId.asc().nullsLast().op("int4_ops")),
		index("Club_citySlug_idx").using("btree", table.citySlug.asc().nullsLast().op("text_ops")),
		index("Club_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
		index("Club_location_trgm_idx").using("gin", table.location.op("gin_trgm_ops")),
		foreignKey({
			columns: [table.countryId],
			foreignColumns: [country.id],
			name: "Club_countryId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		// `set null` rather than `cascade`: a city disappearing from the reference data
		// must never delete somebody's club. The denormalised copies are cleared
		// alongside it by the same code that writes them.
		foreignKey({
			columns: [table.cityId],
			foreignColumns: [city.id],
			name: "Club_cityId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
	],
);

export const account = pgTable(
	"Account",
	{
		id: text().primaryKey().notNull(),
		accountId: text().notNull(),
		providerId: text().notNull(),
		userId: text().notNull(),
		accessToken: text(),
		refreshToken: text(),
		idToken: text(),
		expiresAt: timestamp({ precision: 3, mode: "string" }),
		password: text(),
		accessTokenExpiresAt: timestamp({ precision: 3, mode: "string" }),
		refreshTokenExpiresAt: timestamp({ precision: 3, mode: "string" }),
		scope: text(),
		createdAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	},
	(table) => [
		index("Account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Account_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const passkey = pgTable(
	"Passkey",
	{
		id: text().primaryKey().notNull(),
		name: text(),
		publicKey: text().notNull(),
		userId: text().notNull(),
		credentialID: text().notNull(),
		counter: integer().notNull(),
		deviceType: text().notNull(),
		backedUp: boolean().notNull(),
		transports: text(),
		createdAt: timestamp({ precision: 3, mode: "string" }),
		aaguid: text(),
	},
	(table) => [
		index("Passkey_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Passkey_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const verification = pgTable(
	"Verification",
	{
		id: text().primaryKey().notNull(),
		identifier: text().notNull(),
		value: text().notNull(),
		expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }),
		updatedAt: timestamp({ precision: 3, mode: "string" }),
	},
	(table) => [index("Verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops"))],
);

export const twoFactor = pgTable(
	"TwoFactor",
	{
		id: text().primaryKey().notNull(),
		secret: text().notNull(),
		backupCodes: text().notNull(),
		userId: text().notNull(),
	},
	(table) => [
		uniqueIndex("TwoFactor_userId_key").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "TwoFactor_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const clubPurchase = pgTable(
	"ClubPurchase",
	{
		id: text().primaryKey().notNull(),
		title: text().notNull(),
		description: text(),
		clubId: text().notNull(),
		receiptUrls: text().array(),
		amount: doublePrecision().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	},
	(table) => [
		index("ClubPurchase_clubId_idx").using("btree", table.clubId.asc().nullsLast()),
		index("ClubPurchase_clubId_createdAt_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.createdAt.asc().nullsLast().op("timestamp_ops"),
		),
		foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.id],
			name: "ClubPurchase_clubId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const session = pgTable(
	"Session",
	{
		id: text().primaryKey().notNull(),
		expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		ipAddress: text(),
		userAgent: text(),
		userId: text().notNull(),
		token: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		impersonatedBy: text(),
	},
	(table) => [
		uniqueIndex("Session_token_key").using("btree", table.token.asc().nullsLast().op("text_ops")),
		index("Session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Session_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const apikey = pgTable(
	"apikey",
	{
		id: text().primaryKey().notNull(),
		configId: text().notNull(),
		name: text(),
		start: text(),
		prefix: text(),
		key: text().notNull(),
		referenceId: text().notNull(),
		refillInterval: integer(),
		refillAmount: integer(),
		lastRefillAt: timestamp({ precision: 3, mode: "string" }),
		enabled: boolean().default(true).notNull(),
		rateLimitEnabled: boolean().default(true).notNull(),
		rateLimitTimeWindow: integer(),
		rateLimitMax: integer(),
		requestCount: integer().default(0).notNull(),
		remaining: integer(),
		lastRequest: timestamp({ precision: 3, mode: "string" }),
		expiresAt: timestamp({ precision: 3, mode: "string" }),
		createdAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		permissions: text(),
		metadata: text(),
	},
	(table) => [
		index("apikey_configId_idx").using("btree", table.configId.asc().nullsLast().op("text_ops")),
		index("apikey_key_idx").using("btree", table.key.asc().nullsLast().op("text_ops")),
		index("apikey_referenceId_idx").using("btree", table.referenceId.asc().nullsLast().op("text_ops")),
	],
);

// better-auth OIDC provider tables, used by the mcp() plugin for OAuth 2.0
// (dynamic client registration, authorize/token, consent) and by id_token signing.
export const oauthApplication = pgTable(
	"oauthApplication",
	{
		id: text().primaryKey().notNull(),
		name: text().notNull(),
		icon: text(),
		metadata: text(),
		clientId: text().notNull().unique(),
		clientSecret: text(),
		redirectUrls: text().notNull(),
		type: text().notNull(),
		disabled: boolean().default(false).notNull(),
		userId: text(),
		createdAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	},
	(table) => [
		index("oauthApplication_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "oauthApplication_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const oauthAccessToken = pgTable(
	"oauthAccessToken",
	{
		id: text().primaryKey().notNull(),
		accessToken: text().notNull().unique(),
		refreshToken: text().notNull().unique(),
		accessTokenExpiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		refreshTokenExpiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		clientId: text().notNull(),
		userId: text(),
		scopes: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	},
	(table) => [
		index("oauthAccessToken_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
		index("oauthAccessToken_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		foreignKey({
			columns: [table.clientId],
			foreignColumns: [oauthApplication.clientId],
			name: "oauthAccessToken_clientId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "oauthAccessToken_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const oauthConsent = pgTable(
	"oauthConsent",
	{
		id: text().primaryKey().notNull(),
		clientId: text().notNull(),
		userId: text().notNull(),
		scopes: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		consentGiven: boolean().notNull(),
	},
	(table) => [
		index("oauthConsent_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
		index("oauthConsent_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		foreignKey({
			columns: [table.clientId],
			foreignColumns: [oauthApplication.clientId],
			name: "oauthConsent_clientId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "oauthConsent_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const jwks = pgTable("jwks", {
	id: text().primaryKey().notNull(),
	publicKey: text().notNull(),
	privateKey: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	expiresAt: timestamp({ precision: 3, mode: "string" }),
});

export const clubRule = pgTable(
	"ClubRule",
	{
		id: text().primaryKey().notNull(),
		name: text().notNull(),
		description: text(),
		content: text().notNull(),
		clubId: text().notNull(),
		eventId: text(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	},
	(table) => [
		index("ClubRule_clubId_idx").using("btree", table.clubId.asc().nullsLast()),
		index("ClubRule_eventId_idx").using("btree", table.eventId.asc().nullsLast()),
		foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.id],
			name: "ClubRule_clubId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.eventId],
			foreignColumns: [event.id],
			name: "ClubRule_eventId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
	],
);

export const clubMembership = pgTable(
	"ClubMembership",
	{
		id: text().primaryKey().notNull(),
		userId: text().notNull(),
		clubId: text().notNull(),
		role: role().default("USER").notNull(),
		startDate: timestamp({ precision: 3, mode: "string" }),
		endDate: timestamp({ precision: 3, mode: "string" }),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	},
	(table) => [
		uniqueIndex("ClubMembership_userId_clubId_key").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
			table.clubId.asc().nullsLast().op("text_ops"),
		),
		index("ClubMembership_clubId_idx").using("btree", table.clubId.asc().nullsLast().op("text_ops")),
		index("ClubMembership_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		index("ClubMembership_clubId_role_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.role.asc().nullsLast(),
		),
		index("ClubMembership_clubId_createdAt_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.createdAt.asc().nullsLast().op("timestamp_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "ClubMembership_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.id],
			name: "ClubMembership_clubId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const clubInvite = pgTable(
	"ClubInvite",
	{
		id: text().primaryKey().notNull(),
		email: text().notNull(),
		clubId: text().notNull(),
		userId: text(),
		status: inviteStatus().default("PENDING").notNull(),
		inviteCode: text().notNull(),
		expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	},
	(table) => [
		index("ClubInvite_clubId_idx").using("btree", table.clubId.asc().nullsLast().op("text_ops")),
		index("ClubInvite_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
		uniqueIndex("ClubInvite_inviteCode_key").using("btree", table.inviteCode.asc().nullsLast().op("text_ops")),
		index("ClubInvite_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
		index("ClubInvite_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		index("ClubInvite_clubId_createdAt_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.createdAt.asc().nullsLast().op("timestamp_ops"),
		),
		index("ClubInvite_clubId_status_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.status.asc().nullsLast().op("enum_ops"),
		),
		foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.id],
			name: "ClubInvite_clubId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "ClubInvite_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
	],
);

export const clubAuditLog = pgTable(
	"ClubAuditLog",
	{
		id: text().primaryKey().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		userId: text(),
		clubId: text().notNull(),
		actionType: text().notNull(),
		actionData: jsonb().notNull(),
		ipAddress: text(),
		userAgent: text(),
	},
	(table) => [
		index("ClubAuditLog_actionType_idx").using("btree", table.actionType.asc().nullsLast().op("text_ops")),
		index("ClubAuditLog_clubId_idx").using("btree", table.clubId.asc().nullsLast().op("text_ops")),
		index("ClubAuditLog_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
		index("ClubAuditLog_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		index("ClubAuditLog_clubId_actionType_createdAt_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.actionType.asc().nullsLast().op("text_ops"),
			table.createdAt.asc().nullsLast().op("timestamp_ops"),
		),
		index("ClubAuditLog_clubId_createdAt_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.createdAt.asc().nullsLast().op("timestamp_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "ClubAuditLog_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.id],
			name: "ClubAuditLog_clubId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const instagramPageSelection = pgTable(
	"InstagramPageSelection",
	{
		id: text().primaryKey().notNull(),
		clubId: text().notNull(),
		accessToken: text().notNull(),
		pages: text().notNull(),
		expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	},
	(table) => [
		index("InstagramPageSelection_clubId_idx").using("btree", table.clubId.asc().nullsLast().op("text_ops")),
	],
);

export const event = pgTable(
	"Event",
	{
		id: text().primaryKey().notNull(),
		name: text().notNull(),
		description: text().notNull(),
		clubId: text().notNull(),
		image: text(),
		slug: text(),
		dateStart: timestamp({ precision: 3, mode: "string" }).notNull(),
		dateEnd: timestamp({ precision: 3, mode: "string" }).notNull(),
		dateRegistrationsClose: timestamp({ precision: 3, mode: "string" }).notNull(),
		dateRegistrationsOpen: timestamp({ precision: 3, mode: "string" }).notNull(),
		isPrivate: boolean().default(false).notNull(),
		allowFreelancers: boolean().default(false).notNull(),
		// null means unlimited. Counted against the full headcount of an event:
		// every registration plus its accepted team members plus its external invites.
		maxAttendees: integer(),
		location: text().notNull(),
		googleMapsLink: text(),
		costPerPerson: doublePrecision().default(0).notNull(),
		hasBreakfast: boolean().default(false).notNull(),
		hasLunch: boolean().default(false).notNull(),
		hasDinner: boolean().default(false).notNull(),
		hasSnacks: boolean().default(false).notNull(),
		hasDrinks: boolean().default(false).notNull(),
		hasPrizes: boolean().default(false).notNull(),
		gearRequirements: jsonb().array(),
		mapData: jsonb(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	},
	(table) => [
		uniqueIndex("Event_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
		index("Event_clubId_idx").using("btree", table.clubId.asc().nullsLast().op("text_ops")),
		index("Event_dateStart_idx").using("btree", table.dateStart.asc().nullsLast().op("timestamp_ops")),
		index("Event_clubId_dateStart_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.dateStart.asc().nullsLast().op("timestamp_ops"),
		),
		index("Event_isPrivate_idx").using("btree", table.isPrivate.asc().nullsLast()),
		index("Event_clubId_isPrivate_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.isPrivate.asc().nullsLast(),
		),
		index("Event_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
		index("Event_location_trgm_idx").using("gin", table.location.op("gin_trgm_ops")),
		foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.id],
			name: "Event_clubId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const eventRegistration = pgTable(
	"EventRegistration",
	{
		id: text().primaryKey().notNull(),
		eventId: text().notNull(),
		createdById: text().notNull(),
		type: text().default("solo").notNull(),
		paymentMethod: text().default("cash").notNull(),
		attended: boolean().default(false).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	},
	(table) => [
		index("EventRegistration_createdById_idx").using("btree", table.createdById.asc().nullsLast().op("text_ops")),
		index("EventRegistration_eventId_idx").using("btree", table.eventId.asc().nullsLast().op("text_ops")),
		index("EventRegistration_eventId_attended_idx").using(
			"btree",
			table.eventId.asc().nullsLast().op("text_ops"),
			table.attended.asc().nullsLast().op("bool_ops"),
		),
		foreignKey({
			columns: [table.eventId],
			foreignColumns: [event.id],
			name: "EventRegistration_eventId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "EventRegistration_createdById_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

/**
 * One row per person per event — the single answer to "who is coming".
 *
 * An attendee used to be three different things depending on how they joined: the booking's
 * `createdById`, a `_EventRegistrationToUser` row, or an `EventInvite` row. Every question worth
 * asking (headcount, capacity, attendance, who may review) had to union all three, which is how
 * a five-person team came to read as one registration and how attendance ended up being a single
 * boolean for a whole squad. This table replaces all three.
 *
 * `eventRegistration` survives as the *booking*: the group-level facts (who organised it, how they
 * intend to pay). Every attendee belongs to one, and a solo entry is simply a booking of one.
 */
export const eventAttendee = pgTable(
	"EventAttendee",
	{
		id: text().primaryKey().notNull(),
		eventId: text().notNull(),
		bookingId: text().notNull(),
		// Exactly one of userId / guestEmail is set: a member of the site, or somebody the leader
		// is vouching for who has no account yet.
		userId: text(),
		guestName: text(),
		guestEmail: text(),
		role: attendeeRole().default("MEMBER").notNull(),
		status: attendeeStatus().default("PENDING").notNull(),
		// Deliberately nullable. `false` means "marked, did not show up"; null means nobody has
		// marked the roster yet, which is a different fact and used to be indistinguishable.
		attended: boolean(),
		// Lets a guest claim their own place by signing up, turning guestEmail into a userId.
		inviteToken: text(),
		inviteExpiresAt: timestamp({ precision: 3, mode: "string" }),
		invitedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		respondedAt: timestamp({ precision: 3, mode: "string" }),
		paidAt: timestamp({ precision: 3, mode: "string" }),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	},
	(table) => [
		index("EventAttendee_eventId_status_idx").using(
			"btree",
			table.eventId.asc().nullsLast().op("text_ops"),
			table.status.asc().nullsLast().op("enum_ops"),
		),
		index("EventAttendee_bookingId_idx").using("btree", table.bookingId.asc().nullsLast().op("text_ops")),
		index("EventAttendee_userId_status_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
			table.status.asc().nullsLast().op("enum_ops"),
		),
		uniqueIndex("EventAttendee_inviteToken_key").using("btree", table.inviteToken.asc().nullsLast().op("text_ops")),
		// The database, not a check somewhere in a route, is what guarantees a person cannot hold
		// two places at the same event. Partial so that declining one team and joining another,
		// or being invited by two teams at once, stays legal.
		uniqueIndex("EventAttendee_event_user_confirmed_key")
			.using(
				"btree",
				table.eventId.asc().nullsLast().op("text_ops"),
				table.userId.asc().nullsLast().op("text_ops"),
			)
			.where(sql`"status" = 'CONFIRMED' AND "userId" IS NOT NULL`),
		uniqueIndex("EventAttendee_event_guest_confirmed_key")
			.using("btree", table.eventId.asc().nullsLast().op("text_ops"), sql`lower("guestEmail")`)
			.where(sql`"status" = 'CONFIRMED' AND "guestEmail" IS NOT NULL`),
		foreignKey({
			columns: [table.eventId],
			foreignColumns: [event.id],
			name: "EventAttendee_eventId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.bookingId],
			foreignColumns: [eventRegistration.id],
			name: "EventAttendee_bookingId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "EventAttendee_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const reviewEditHistory = pgTable(
	"ReviewEditHistory",
	{
		id: text().primaryKey().notNull(),
		reviewId: text()
			.notNull()
			.references(() => review.id, { onDelete: "cascade" }),
		previousRating: smallint().notNull(),
		previousContent: text().notNull(),
		editedBy: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	},
	(table) => [
		index("ReviewEditHistory_reviewId_idx").using("btree", table.reviewId.asc().nullsLast().op("text_ops")),
		index("ReviewEditHistory_editedBy_idx").using("btree", table.editedBy.asc().nullsLast().op("text_ops")),
		foreignKey({
			columns: [table.reviewId],
			foreignColumns: [review.id],
			name: "ReviewEditHistory_reviewId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.editedBy],
			foreignColumns: [user.id],
			name: "ReviewEditHistory_editedBy_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const review = pgTable(
	"Review",
	{
		id: text().primaryKey().notNull(),
		type: reviewType().notNull(),
		rating: smallint().notNull(),
		content: text().notNull(),
		authorId: text().notNull(),
		userId: text(),
		clubId: text(),
		eventId: text(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	},
	(table) => [
		uniqueIndex("Review_authorId_clubId_key").using(
			"btree",
			table.authorId.asc().nullsLast().op("text_ops"),
			table.clubId.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("Review_authorId_eventId_key").using(
			"btree",
			table.authorId.asc().nullsLast().op("text_ops"),
			table.eventId.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("Review_authorId_userId_key").using(
			"btree",
			table.authorId.asc().nullsLast().op("text_ops"),
			table.userId.asc().nullsLast().op("text_ops"),
		),
		index("Review_clubId_idx").using("btree", table.clubId.asc().nullsLast().op("text_ops")),
		index("Review_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
		index("Review_authorId_idx").using("btree", table.authorId.asc().nullsLast().op("text_ops")),
		index("Review_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
		index("Review_eventId_idx").using("btree", table.eventId.asc().nullsLast().op("text_ops")),
		index("Review_clubId_createdAt_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.createdAt.asc().nullsLast().op("timestamp_ops"),
		),
		index("Review_userId_createdAt_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
			table.createdAt.asc().nullsLast().op("timestamp_ops"),
		),
		foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "Review_authorId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Review_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.id],
			name: "Review_clubId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.eventId],
			foreignColumns: [event.id],
			name: "Review_eventId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const post = pgTable(
	"Post",
	{
		id: text().primaryKey().notNull(),
		title: text().notNull(),
		content: text().notNull(),
		images: text().array(),
		isPublic: boolean().default(false).notNull(),
		clubId: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	},
	(table) => [
		index("Post_clubId_idx").using("btree", table.clubId.asc().nullsLast().op("text_ops")),
		index("Post_clubId_isPublic_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.isPublic.asc().nullsLast().op("bool_ops"),
		),
		index("Post_clubId_createdAt_idx").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.createdAt.asc().nullsLast().op("timestamp_ops"),
		),
		foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.id],
			name: "Post_clubId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const country = pgTable(
	"Country",
	{
		id: serial().primaryKey().notNull(),
		name: text().notNull(),
		iso3: char({ length: 3 }).notNull(),
		iso2: char({ length: 2 }).notNull(),
		latitude: numeric({ precision: 10, scale: 8 }),
		longitude: numeric({ precision: 11, scale: 8 }),
		emoji: text(),
		translations: jsonb(),
		currency: text(),
		currencyCode: text(),
		enabled: boolean().default(true).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	},
	(table) => [
		uniqueIndex("Country_iso2_key").using("btree", table.iso2.asc().nullsLast().op("bpchar_ops")),
		uniqueIndex("Country_iso3_key").using("btree", table.iso3.asc().nullsLast().op("bpchar_ops")),
	],
);

/**
 * Reference data, seeded from `country-state-city` — never written to by the app.
 * Exists so a club's city is a foreign key rather than free text: typos, spelling
 * variants ("Banja Luka" vs "Banjaluka") and outright junk can no longer split or
 * invent a city landing page.
 *
 * `slug` is globally unique and is the routing key for `/clubs/city/[citySlug]`.
 * City names are not unique — not worldwide, and not even within one country
 * (BiH has a Živinice in both entities) — so the seed disambiguates collisions
 * deterministically. See `seed-cities.ts`.
 */
export const city = pgTable(
	"City",
	{
		id: serial().primaryKey().notNull(),
		countryId: integer().notNull(),
		name: text().notNull(),
		slug: text().notNull(),
		/** Subdivision code from the source dataset, kept to disambiguate same-named cities. */
		stateCode: text(),
		latitude: numeric({ precision: 10, scale: 8 }),
		longitude: numeric({ precision: 11, scale: 8 }),
		enabled: boolean().default(true).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	},
	(table) => [
		uniqueIndex("City_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
		index("City_countryId_idx").using("btree", table.countryId.asc().nullsLast().op("int4_ops")),
		// The picker searches by name within a country; trigram matching is what makes
		// "sarajev" find "Sarajevo" across 148k rows without a sequential scan.
		index("City_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
		foreignKey({
			columns: [table.countryId],
			foreignColumns: [country.id],
			name: "City_countryId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const alliance = pgTable(
	"Alliance",
	{
		id: serial().primaryKey().notNull(),
		name: text().notNull(),
		description: text(),
		link: text(),
		countryId: integer().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	},
	(table) => [
		index("Alliance_countryId_idx").using("btree", table.countryId.asc().nullsLast().op("int4_ops")),
		foreignKey({
			columns: [table.countryId],
			foreignColumns: [country.id],
			name: "Alliance_countryId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const clubAlliance = pgTable(
	"ClubAlliance",
	{
		id: serial().primaryKey().notNull(),
		clubId: text().notNull(),
		allianceId: integer().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	},
	(table) => [
		index("ClubAlliance_allianceId_idx").using("btree", table.allianceId.asc().nullsLast().op("int4_ops")),
		foreignKey({
			columns: [table.clubId],
			foreignColumns: [club.id],
			name: "ClubAlliance_clubId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.allianceId],
			foreignColumns: [alliance.id],
			name: "ClubAlliance_allianceId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		uniqueIndex("ClubAlliance_clubId_allianceId_key").using(
			"btree",
			table.clubId.asc().nullsLast().op("text_ops"),
			table.allianceId.asc().nullsLast().op("int4_ops"),
		),
	],
);

export const user = pgTable(
	"User",
	{
		id: text().primaryKey().notNull(),
		email: text().notNull(),
		name: text().notNull(),
		emailVerified: boolean().notNull(),
		normalizedEmail: text(),
		image: text(),
		slug: text(),
		bio: text(),
		location: text(),
		website: text(),
		phone: text(),
		callsign: text(),
		gear: jsonb().array(),
		font: text().default("mono").notNull(),
		theme: text().default("dark").notNull(),
		style: text().default("relaxed").notNull(),
		language: text().default("bs").notNull(),
		isPrivate: boolean().default(false).notNull(),
		isPrivateEmail: boolean().default(true).notNull(),
		isPrivatePhone: boolean().default(true).notNull(),
		isPrivateStats: boolean().default(false).notNull(),
		role: text(),
		banned: boolean(),
		banReason: text(),
		banExpires: timestamp({ precision: 3, mode: "string" }),
		twoFactorEnabled: boolean(),
		createdAt: timestamp({ precision: 3, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		headerImage: text(),
	},
	(table) => [
		uniqueIndex("User_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
		uniqueIndex("User_normalizedEmail_key").using("btree", table.normalizedEmail.asc().nullsLast().op("text_ops")),
		uniqueIndex("User_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
		index("User_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
	],
);

export const achievementToUser = pgTable(
	"_AchievementToUser",
	{
		a: text("A").notNull(),
		b: text("B").notNull(),
	},
	(table) => [
		index().using("btree", table.b.asc().nullsLast().op("text_ops")),
		foreignKey({
			columns: [table.a],
			foreignColumns: [achievement.id],
			name: "_AchievementToUser_A_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.b],
			foreignColumns: [user.id],
			name: "_AchievementToUser_B_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		primaryKey({ columns: [table.a, table.b], name: "_AchievementToUser_AB_pkey" }),
	],
);

export const featureFlag = pgTable("FeatureFlag", {
	id: text("id")
		.primaryKey()
		.notNull()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	description: text("description"),
	enabled: boolean("enabled").default(false).notNull(),
	createdAt: timestamp("createdAt", { precision: 3, mode: "string" }).defaultNow().notNull(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" }).defaultNow().notNull(),
});
