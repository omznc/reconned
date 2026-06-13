CREATE TABLE "ReviewEditHistory" (
	"id" text PRIMARY KEY NOT NULL,
	"reviewId" text NOT NULL,
	"previousRating" smallint NOT NULL,
	"previousContent" text NOT NULL,
	"editedBy" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ReviewEditHistory" ADD CONSTRAINT "ReviewEditHistory_reviewId_Review_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReviewEditHistory" ADD CONSTRAINT "ReviewEditHistory_editedBy_User_id_fk" FOREIGN KEY ("editedBy") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReviewEditHistory" ADD CONSTRAINT "ReviewEditHistory_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ReviewEditHistory" ADD CONSTRAINT "ReviewEditHistory_editedBy_fkey" FOREIGN KEY ("editedBy") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "ReviewEditHistory_reviewId_idx" ON "ReviewEditHistory" USING btree ("reviewId" text_ops);--> statement-breakpoint
CREATE INDEX "ClubPurchase_clubId_idx" ON "ClubPurchase" USING btree ("clubId");--> statement-breakpoint
CREATE INDEX "ClubRule_clubId_idx" ON "ClubRule" USING btree ("clubId");--> statement-breakpoint
CREATE INDEX "ClubRule_eventId_idx" ON "ClubRule" USING btree ("eventId");