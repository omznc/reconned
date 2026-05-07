CREATE TABLE "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"configId" text NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"referenceId" text NOT NULL,
	"refillInterval" integer,
	"refillAmount" integer,
	"lastRefillAt" timestamp(3),
	"enabled" boolean DEFAULT true NOT NULL,
	"rateLimitEnabled" boolean DEFAULT true NOT NULL,
	"rateLimitTimeWindow" integer,
	"rateLimitMax" integer,
	"requestCount" integer DEFAULT 0 NOT NULL,
	"remaining" integer,
	"lastRequest" timestamp(3),
	"expiresAt" timestamp(3),
	"createdAt" timestamp(3) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
ALTER TABLE "Country" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "Country" ADD COLUMN "currencyCode" text;--> statement-breakpoint
CREATE INDEX "apikey_configId_idx" ON "apikey" USING btree ("configId" text_ops);--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikey" USING btree ("key" text_ops);--> statement-breakpoint
CREATE INDEX "apikey_referenceId_idx" ON "apikey" USING btree ("referenceId" text_ops);