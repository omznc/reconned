--> statement-breakpoint
ALTER TABLE "Post" ADD COLUMN "authorId" text;
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" 
  FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Post" ALTER COLUMN "clubId" drop not null;--> statement-breakpoint
ALTER TABLE "Post" ALTER COLUMN "title" drop not null;--> statement-breakpoint
ALTER TABLE "Post" ALTER COLUMN "isPublic" set default true;--> statement-breakpoint
CREATE TABLE "PostLike" (
  "postId" text NOT NULL,
  "userId" text NOT NULL,
  "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" 
  FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_pkey" PRIMARY KEY ("postId", "userId");--> statement-breakpoint
CREATE INDEX "PostLike_postId_idx" ON "PostLike" USING btree ("postId" text_ops);--> statement-breakpoint
CREATE INDEX "PostLike_userId_idx" ON "PostLike" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE TABLE "Comment" (
  "id" text PRIMARY KEY NOT NULL,
  "postId" text NOT NULL,
  "authorId" text NOT NULL,
  "content" text NOT NULL,
  "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) NOT NULL
);--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" 
  FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" 
  FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "Comment_postId_idx" ON "Comment" USING btree ("postId" text_ops);--> statement-breakpoint
CREATE INDEX "Comment_authorId_idx" ON "Comment" USING btree ("authorId" text_ops);--> statement-breakpoint
CREATE INDEX "Comment_createdAt_idx" ON "Comment" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
DROP INDEX "Post_clubId_idx";--> statement-breakpoint
DROP INDEX "Post_clubId_isPublic_idx";--> statement-breakpoint
CREATE INDEX "Post_clubId_idx" ON "Post" USING btree ("clubId" text_ops) WHERE "clubId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "Post_authorId_idx" ON "Post" USING btree ("authorId" text_ops);--> statement-breakpoint
CREATE INDEX "Post_createdAt_idx" ON "Post" USING btree ("createdAt" timestamp_ops);