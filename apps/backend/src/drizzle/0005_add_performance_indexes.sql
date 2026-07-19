-- Performance audit: add missing indexes, drop redundant/dead ones, and remove
-- duplicated FK constraints on ReviewEditHistory.
--
-- NOTE ON LOCKING: the statements below use plain CREATE INDEX (not CONCURRENTLY)
-- because drizzle wraps migrations in a single transaction, and CREATE INDEX
-- CONCURRENTLY cannot run inside a transaction. Each CREATE INDEX here takes a
-- SHARE lock on its table, blocking writes (but not reads) for the duration of
-- the build. On large production tables (Review, ClubAuditLog, Event, User,
-- Club, ClubMembership, Post, ClubInvite, ClubPurchase, EventInvite,
-- ClubAlliance, Alliance) apply these by hand with CREATE INDEX CONCURRENTLY
-- (each as its own statement, outside a transaction) instead of running this
-- migration file directly against production.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
-- Drop redundant indexes: these duplicate an existing unique constraint, or
-- lead with the primary key column (making them useless for lookups on the
-- non-leading column), so the planner never chooses them over the PK/unique index.
DROP INDEX "Club_id_slug_idx";--> statement-breakpoint
DROP INDEX "ClubInvite_inviteCode_idx";--> statement-breakpoint
DROP INDEX "Event_id_slug_idx";--> statement-breakpoint
DROP INDEX "TwoFactor_secret_idx";--> statement-breakpoint
DROP INDEX "TwoFactor_userId_idx";--> statement-breakpoint
DROP INDEX "User_email_idx";--> statement-breakpoint
DROP INDEX "User_id_slug_idx";--> statement-breakpoint
-- Drop duplicated FK constraints on ReviewEditHistory: 0003_bizarre_rocket_raccoon.sql
-- created both a "_fk" (onUpdate: no action) and a "_fkey" (onUpdate: cascade)
-- constraint for the same (reviewId -> Review.id) and (editedBy -> User.id)
-- columns, so every insert/update validated each FK twice. Only the "_fkey"
-- variants are declared in schema.ts, so the "_fk" duplicates are dropped here.
ALTER TABLE "ReviewEditHistory" DROP CONSTRAINT "ReviewEditHistory_reviewId_Review_id_fk";--> statement-breakpoint
ALTER TABLE "ReviewEditHistory" DROP CONSTRAINT "ReviewEditHistory_editedBy_User_id_fk";--> statement-breakpoint
-- Missing FK indexes (Postgres does not auto-index foreign keys).
CREATE INDEX "Alliance_countryId_idx" ON "Alliance" USING btree ("countryId" int4_ops);--> statement-breakpoint
CREATE INDEX "Club_countryId_idx" ON "Club" USING btree ("countryId" int4_ops);--> statement-breakpoint
CREATE INDEX "ClubAlliance_allianceId_idx" ON "ClubAlliance" USING btree ("allianceId" int4_ops);--> statement-breakpoint
CREATE INDEX "EventInvite_eventId_idx" ON "EventInvite" USING btree ("eventId" text_ops);--> statement-breakpoint
CREATE INDEX "EventInvite_eventRegistrationId_idx" ON "EventInvite" USING btree ("eventRegistrationId" text_ops);--> statement-breakpoint
CREATE INDEX "Review_eventId_idx" ON "Review" USING btree ("eventId" text_ops);--> statement-breakpoint
CREATE INDEX "ReviewEditHistory_editedBy_idx" ON "ReviewEditHistory" USING btree ("editedBy" text_ops);--> statement-breakpoint
-- Composite (parentId, createdAt) / (parentId, status) indexes for listings that
-- filter by FK and ORDER BY createdAt DESC (an ascending composite index is
-- scanned backward for DESC order, so a plain ASC index serves both directions).
CREATE INDEX "ClubAuditLog_clubId_createdAt_idx" ON "ClubAuditLog" USING btree ("clubId" text_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ClubInvite_clubId_createdAt_idx" ON "ClubInvite" USING btree ("clubId" text_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ClubInvite_clubId_status_idx" ON "ClubInvite" USING btree ("clubId" text_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "ClubMembership_clubId_createdAt_idx" ON "ClubMembership" USING btree ("clubId" text_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ClubPurchase_clubId_createdAt_idx" ON "ClubPurchase" USING btree ("clubId" text_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Post_clubId_createdAt_idx" ON "Post" USING btree ("clubId" text_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Review_clubId_createdAt_idx" ON "Review" USING btree ("clubId" text_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Review_userId_createdAt_idx" ON "Review" USING btree ("userId" text_ops,"createdAt" timestamp_ops);--> statement-breakpoint
-- GIN trigram indexes for leading-wildcard ILIKE searches (requires pg_trgm, created above).
CREATE INDEX "Club_name_trgm_idx" ON "Club" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "Club_location_trgm_idx" ON "Club" USING gin ("location" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "Event_name_trgm_idx" ON "Event" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "Event_location_trgm_idx" ON "Event" USING gin ("location" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "User_name_trgm_idx" ON "User" USING gin ("name" gin_trgm_ops);
