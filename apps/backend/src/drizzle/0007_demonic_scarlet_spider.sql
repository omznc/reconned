CREATE TABLE "City" (
	"id" serial PRIMARY KEY NOT NULL,
	"countryId" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"stateCode" text,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Club" ADD COLUMN "cityId" integer;--> statement-breakpoint
ALTER TABLE "City" ADD CONSTRAINT "City_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."Country"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "City_slug_key" ON "City" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "City_countryId_idx" ON "City" USING btree ("countryId" int4_ops);--> statement-breakpoint
CREATE INDEX "City_name_trgm_idx" ON "City" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "Club" ADD CONSTRAINT "Club_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "public"."City"("id") ON DELETE set null ON UPDATE cascade;