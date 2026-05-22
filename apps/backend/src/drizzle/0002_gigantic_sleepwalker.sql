CREATE INDEX "Club_isPrivate_idx" ON "Club" USING btree ("isPrivate");--> statement-breakpoint
CREATE INDEX "Club_verified_idx" ON "Club" USING btree ("verified");--> statement-breakpoint
CREATE INDEX "Event_isPrivate_idx" ON "Event" USING btree ("isPrivate");--> statement-breakpoint
CREATE INDEX "Event_clubId_isPrivate_idx" ON "Event" USING btree ("clubId" text_ops,"isPrivate");--> statement-breakpoint
CREATE INDEX "EventRegistrationToUser_a_idx" ON "_EventRegistrationToUser" USING btree ("A" text_ops);