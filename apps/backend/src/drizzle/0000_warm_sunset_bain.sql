-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."InviteStatus" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED', 'REQUESTED');--> statement-breakpoint
CREATE TYPE "public"."ReviewType" AS ENUM('USER', 'CLUB', 'EVENT');--> statement-breakpoint
CREATE TYPE "public"."Role" AS ENUM('USER', 'MANAGER', 'CLUB_OWNER');--> statement-breakpoint
CREATE TABLE "Achievement" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Club" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"latitude" double precision,
	"longitude" double precision,
	"description" text,
	"dateFounded" timestamp(3),
	"slug" text,
	"isAllied" boolean DEFAULT false NOT NULL,
	"isPrivate" boolean DEFAULT false NOT NULL,
	"isPrivateStats" boolean DEFAULT false NOT NULL,
	"logo" text,
	"contactPhone" text,
	"contactEmail" text,
	"verified" boolean DEFAULT false NOT NULL,
	"website" text,
	"instagramUsername" text,
	"instagramProfilePictureUrl" text,
	"instagramAccessToken" text,
	"instagramTokenExpiry" timestamp(3),
	"instagramRefreshToken" text,
	"instagramConnected" boolean DEFAULT false NOT NULL,
	"instagramBusinessId" text,
	"facebookPageId" text,
	"instagramTokenType" text,
	"countryId" integer,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"headerImage" text
);
--> statement-breakpoint
CREATE TABLE "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"expiresAt" timestamp(3),
	"password" text,
	"accessTokenExpiresAt" timestamp(3),
	"refreshTokenExpiresAt" timestamp(3),
	"scope" text,
	"createdAt" timestamp(3) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"publicKey" text NOT NULL,
	"userId" text NOT NULL,
	"webauthnUserID" text NOT NULL,
	"counter" integer NOT NULL,
	"deviceType" text NOT NULL,
	"backedUp" boolean NOT NULL,
	"transports" text,
	"createdAt" timestamp(3),
	"credentialID" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3),
	"updatedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "TwoFactor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backupCodes" text NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ClubPurchase" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"clubId" text NOT NULL,
	"receiptUrls" text[],
	"amount" double precision NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp(3) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"impersonatedBy" text
);
--> statement-breakpoint
CREATE TABLE "ClubRule" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"clubId" text NOT NULL,
	"eventId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ClubMembership" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"clubId" text NOT NULL,
	"role" "Role" DEFAULT 'USER' NOT NULL,
	"startDate" timestamp(3),
	"endDate" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ClubInvite" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"clubId" text NOT NULL,
	"userId" text,
	"status" "InviteStatus" DEFAULT 'PENDING' NOT NULL,
	"inviteCode" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ClubAuditLog" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"userId" text,
	"clubId" text NOT NULL,
	"actionType" text NOT NULL,
	"actionData" jsonb NOT NULL,
	"ipAddress" text,
	"userAgent" text
);
--> statement-breakpoint
CREATE TABLE "InstagramPageSelection" (
	"id" text PRIMARY KEY NOT NULL,
	"clubId" text NOT NULL,
	"accessToken" text NOT NULL,
	"pages" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Event" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"clubId" text NOT NULL,
	"image" text,
	"slug" text,
	"dateStart" timestamp(3) NOT NULL,
	"dateEnd" timestamp(3) NOT NULL,
	"dateRegistrationsClose" timestamp(3) NOT NULL,
	"dateRegistrationsOpen" timestamp(3) NOT NULL,
	"isPrivate" boolean DEFAULT false NOT NULL,
	"allowFreelancers" boolean DEFAULT false NOT NULL,
	"location" text NOT NULL,
	"googleMapsLink" text,
	"costPerPerson" double precision DEFAULT 0 NOT NULL,
	"hasBreakfast" boolean DEFAULT false NOT NULL,
	"hasLunch" boolean DEFAULT false NOT NULL,
	"hasDinner" boolean DEFAULT false NOT NULL,
	"hasSnacks" boolean DEFAULT false NOT NULL,
	"hasDrinks" boolean DEFAULT false NOT NULL,
	"hasPrizes" boolean DEFAULT false NOT NULL,
	"gearRequirements" jsonb[],
	"mapData" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EventRegistration" (
	"id" text PRIMARY KEY NOT NULL,
	"eventId" text NOT NULL,
	"createdById" text NOT NULL,
	"type" text DEFAULT 'solo' NOT NULL,
	"paymentMethod" text DEFAULT 'cash' NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EventInvite" (
	"id" text PRIMARY KEY NOT NULL,
	"eventId" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"eventRegistrationId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Review" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "ReviewType" NOT NULL,
	"rating" smallint NOT NULL,
	"content" text NOT NULL,
	"authorId" text NOT NULL,
	"userId" text,
	"clubId" text,
	"eventId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Post" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"images" text[],
	"isPublic" boolean DEFAULT false NOT NULL,
	"clubId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Country" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"iso3" char(3) NOT NULL,
	"iso2" char(2) NOT NULL,
	"numericCode" char(3),
	"phoneCode" text,
	"capital" text,
	"currency" text,
	"currencyName" text,
	"currencySymbol" text,
	"tld" text,
	"native" text,
	"region" text,
	"subregion" text,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"emoji" text,
	"emojiU" text,
	"timezones" jsonb,
	"translations" jsonb,
	"wikiDataId" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"emailVerified" boolean NOT NULL,
	"normalizedEmail" text,
	"image" text,
	"slug" text,
	"bio" text,
	"location" text,
	"website" text,
	"phone" text,
	"callsign" text,
	"gear" jsonb[],
	"font" text DEFAULT 'mono' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"isPrivate" boolean DEFAULT false NOT NULL,
	"isPrivateEmail" boolean DEFAULT true NOT NULL,
	"isPrivatePhone" boolean DEFAULT true NOT NULL,
	"isPrivateStats" boolean DEFAULT false NOT NULL,
	"role" text,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp(3),
	"twoFactorEnabled" boolean,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"headerImage" text,
	"style" text DEFAULT 'relaxed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_AchievementToUser" (
	"A" text NOT NULL,
	"B" text NOT NULL,
	CONSTRAINT "_AchievementToUser_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
CREATE TABLE "_EventRegistrationToUser" (
	"A" text NOT NULL,
	"B" text NOT NULL,
	CONSTRAINT "_EventRegistrationToUser_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
ALTER TABLE "Club" ADD CONSTRAINT "Club_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."Country"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClubPurchase" ADD CONSTRAINT "ClubPurchase_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClubRule" ADD CONSTRAINT "ClubRule_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClubRule" ADD CONSTRAINT "ClubRule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClubInvite" ADD CONSTRAINT "ClubInvite_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClubInvite" ADD CONSTRAINT "ClubInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClubAuditLog" ADD CONSTRAINT "ClubAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClubAuditLog" ADD CONSTRAINT "ClubAuditLog_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Event" ADD CONSTRAINT "Event_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_eventRegistrationId_fkey" FOREIGN KEY ("eventRegistrationId") REFERENCES "public"."EventRegistration"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Review" ADD CONSTRAINT "Review_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Post" ADD CONSTRAINT "Post_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_AchievementToUser" ADD CONSTRAINT "_AchievementToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Achievement"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_AchievementToUser" ADD CONSTRAINT "_AchievementToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_EventRegistrationToUser" ADD CONSTRAINT "_EventRegistrationToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."EventRegistration"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_EventRegistrationToUser" ADD CONSTRAINT "_EventRegistrationToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "Club_id_slug_idx" ON "Club" USING btree ("id" text_ops,"slug" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Club_slug_key" ON "Club" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "Account_userId_idx" ON "Account" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "Passkey_userId_idx" ON "Passkey" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "Verification_identifier_idx" ON "Verification" USING btree ("identifier" text_ops);--> statement-breakpoint
CREATE INDEX "TwoFactor_secret_idx" ON "TwoFactor" USING btree ("secret" text_ops);--> statement-breakpoint
CREATE INDEX "TwoFactor_userId_idx" ON "TwoFactor" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "TwoFactor_userId_key" ON "TwoFactor" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Session_token_key" ON "Session" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ClubMembership_userId_clubId_key" ON "ClubMembership" USING btree ("userId" text_ops,"clubId" text_ops);--> statement-breakpoint
CREATE INDEX "ClubInvite_clubId_idx" ON "ClubInvite" USING btree ("clubId" text_ops);--> statement-breakpoint
CREATE INDEX "ClubInvite_email_idx" ON "ClubInvite" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "ClubInvite_inviteCode_idx" ON "ClubInvite" USING btree ("inviteCode" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ClubInvite_inviteCode_key" ON "ClubInvite" USING btree ("inviteCode" text_ops);--> statement-breakpoint
CREATE INDEX "ClubInvite_status_idx" ON "ClubInvite" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "ClubInvite_userId_idx" ON "ClubInvite" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "ClubAuditLog_actionType_idx" ON "ClubAuditLog" USING btree ("actionType" text_ops);--> statement-breakpoint
CREATE INDEX "ClubAuditLog_clubId_idx" ON "ClubAuditLog" USING btree ("clubId" text_ops);--> statement-breakpoint
CREATE INDEX "ClubAuditLog_createdAt_idx" ON "ClubAuditLog" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ClubAuditLog_userId_idx" ON "ClubAuditLog" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "InstagramPageSelection_clubId_idx" ON "InstagramPageSelection" USING btree ("clubId" text_ops);--> statement-breakpoint
CREATE INDEX "Event_id_slug_idx" ON "Event" USING btree ("id" text_ops,"slug" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Event_slug_key" ON "Event" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "EventInvite_token_key" ON "EventInvite" USING btree ("token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Review_authorId_clubId_key" ON "Review" USING btree ("authorId" text_ops,"clubId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Review_authorId_eventId_key" ON "Review" USING btree ("authorId" text_ops,"eventId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Review_authorId_userId_key" ON "Review" USING btree ("authorId" text_ops,"userId" text_ops);--> statement-breakpoint
CREATE INDEX "Post_clubId_idx" ON "Post" USING btree ("clubId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Country_iso2_key" ON "Country" USING btree ("iso2" bpchar_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Country_iso3_key" ON "Country" USING btree ("iso3" bpchar_ops);--> statement-breakpoint
CREATE INDEX "User_email_idx" ON "User" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "User_id_slug_idx" ON "User" USING btree ("id" text_ops,"slug" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "User_normalizedEmail_key" ON "User" USING btree ("normalizedEmail" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "User_slug_key" ON "User" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "_AchievementToUser_B_index" ON "_AchievementToUser" USING btree ("B" text_ops);--> statement-breakpoint
CREATE INDEX "_EventRegistrationToUser_B_index" ON "_EventRegistrationToUser" USING btree ("B" text_ops);
*/