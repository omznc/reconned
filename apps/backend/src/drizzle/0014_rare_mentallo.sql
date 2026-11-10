CREATE TYPE "public"."MembershipArchiveReason" AS ENUM('DECEASED', 'INACTIVE', 'MOVED_AWAY', 'RETIRED', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."MembershipStatus" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
ALTER TABLE "ClubMembership" ADD COLUMN "status" "MembershipStatus" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "ClubMembership" ADD COLUMN "archivedAt" timestamp(3);--> statement-breakpoint
ALTER TABLE "ClubMembership" ADD COLUMN "archivedById" text;--> statement-breakpoint
ALTER TABLE "ClubMembership" ADD COLUMN "archiveReason" "MembershipArchiveReason";--> statement-breakpoint
ALTER TABLE "ClubMembership" ADD COLUMN "archiveNote" text;--> statement-breakpoint
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "ClubMembership_clubId_status_idx" ON "ClubMembership" USING btree ("clubId" text_ops,"status");