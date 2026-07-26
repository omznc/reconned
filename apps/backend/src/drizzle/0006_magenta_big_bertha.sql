ALTER TABLE "Club" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "Club" ADD COLUMN "citySlug" text;--> statement-breakpoint
CREATE INDEX "Club_citySlug_idx" ON "Club" USING btree ("citySlug" text_ops);