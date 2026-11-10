-- Indexes for the retention purges in `src/tasks/retention.ts`, which scan Session and Verification
-- on expiry once a day. Without these both are sequential scans.
--
-- Plain CREATE INDEX, applied by the migration runner on boot like every other migration here. The
-- CONCURRENTLY caveat in 0005 does not apply: neither table is anywhere near the size where the
-- SHARE lock's build time is worth a hand-applied step.

CREATE INDEX "Session_expiresAt_idx" ON "Session" USING btree ("expiresAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "Verification_expiresAt_idx" ON "Verification" USING btree ("expiresAt" timestamp_ops);