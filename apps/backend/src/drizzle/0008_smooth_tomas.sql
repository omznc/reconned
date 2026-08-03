ALTER TABLE "Event" ADD COLUMN "maxAttendees" integer;--> statement-breakpoint
ALTER TABLE "_EventRegistrationToUser" ADD COLUMN "status" "InviteStatus" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "_EventRegistrationToUser" ADD COLUMN "invitedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "_EventRegistrationToUser" ADD COLUMN "respondedAt" timestamp(3);--> statement-breakpoint
--> Team members added before invites needed accepting were already on the roster.
--> Leaving them PENDING would silently drop them from headcounts and attendance.
UPDATE "_EventRegistrationToUser" SET "status" = 'ACCEPTED', "respondedAt" = CURRENT_TIMESTAMP;--> statement-breakpoint
CREATE INDEX "EventRegistrationToUser_b_status_idx" ON "_EventRegistrationToUser" USING btree ("B" text_ops,"status");