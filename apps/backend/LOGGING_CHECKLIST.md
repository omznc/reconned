# Logging Improvements - Implementation Checklist

**Branch:** `feature/logging-improvements`
**Started:** 2026-01-31
**Last Updated:** 2026-01-31

---

## Phase 1: Logger Infrastructure Enhancement ✅ COMPLETED

**File:** `apps/backend/src/lib/posthog.ts`

- [x] Add git commit hash capture (run command at startup)
- [x] Add service version from package.json
- [x] Add deployment environment (dev/staging/prod)
- [x] Create TypeScript interface for LogContext
- [x] Auto-include environment context in every log
- [x] Add log level configuration via environment variable
- [x] Test logger outputs correct environment context

**Status:** ✅ Completed

**Completed:** 2026-01-31

**Commit:** `feat(logging): enhance logger with environment context`

**Estimated Effort:** 2 hours | **Actual:** 1 hour

---

## Phase 2: Request Correlation Middleware ✅ COMPLETED

**New File:** `apps/backend/src/lib/middlewares/correlation.ts`

- [x] Create correlation middleware file
- [x] Generate unique request ID using `randomUUIDv7()`
- [x] Add request ID to response headers (`X-Request-ID`)
- [x] Add response time header (`X-Response-Time`)
- [x] Integrate with existing router context

**File:** `apps/backend/src/lib/router.ts`

- [x] Update RouteContext type to include requestId
- [x] Update RouteContext type to include requestStartTime
- [x] Update RouteContext type to include businessContext
- [x] Pass context through middleware chain
- [x] Test correlation ID appears in all requests

**File:** `apps/backend/src/index.ts`

- [x] Import correlationMiddleware
- [x] Add correlation middleware to middleware chain (before logging)
- [x] Initialize context with requestId and requestStartTime defaults

**Status:** ✅ Completed

**Completed:** 2026-01-31

**Commit:** (pending)

**Estimated Effort:** 3 hours | **Actual:** 1.5 hours

---

## Phase 3: Wide Events Middleware ✅ COMPLETED

**New File:** `apps/backend/src/lib/middlewares/wide-events.ts`

- [x] Create wide events middleware file
- [x] Implement request start time capture
- [x] Implement success path logging with business context
- [x] Implement error path logging with error details
- [x] Add duration calculation
- [x] Emit structured event at request completion
- [x] Add addBusinessContext helper function for route handlers

**File:** `apps/backend/src/index.ts`

- [x] Import wideEventsMiddleware
- [x] Add wide events middleware to middleware chain (after correlation, before logging)
- [x] Test wide events integration

**Status:** ✅ Completed

**Completed:** 2026-01-31

**Commit:** (pending)

**Estimated Effort:** 4 hours | **Actual:** 2 hours

---

## Phase 4: Console Migration ✅ COMPLETED

**File:** `apps/backend/src/lib/middlewares/index.ts`

- [x] Replace line 296 console.log with logger.emit
- [x] Replace line 302 console.log with logger.emit
- [x] Add request ID to request/response logs
- [x] Test request logging with correlation ID

**File:** `apps/backend/src/routes/dashboard.ts`

- [x] Import logger from posthog
- [x] Migrate debug console.log at line 22 (membership count)
- [x] Migrate debug console.log at line 25 (no memberships)
- [x] Migrate debug console.log at line 34 (club count)

**File:** `apps/backend/src/tasks/run-task.ts`

- [x] Review task runner console logs
- [x] Verify structured logging already in place
- [x] Keep user-facing CLI output as console (correct pattern)

**File:** `apps/backend/src/lib/posthog.ts`

- [x] Review console.error at SDK initialization
- [x] Keep console.error (logger not available yet, valid exception)

**Status:** ✅ Completed

**Completed:** 2026-01-31

**Commit:** (pending)

**Estimated Effort:** 2 hours | **Actual:** 1 hour

---

## Phase 5: Enhance Existing Logging

**File:** `apps/backend/src/routes/clubs.ts`

- [ ] Add subscription tier to email failure logs
- [ ] Add club member count to relevant logs
- [ ] Add operation type (create/update/delete)
- [ ] Add business outcome context

**File:** `apps/backend/src/lib/router.ts`

- [ ] Add validation error details to logs
- [ ] Include request ID in all logs
- [ ] Add business domain (clubs/events/users)

**File:** `apps/backend/src/lib/errors.ts`

- [ ] Add error categorization
- [ ] Include request ID in error logs
- [ ] Add business impact level

**File:** `apps/backend/src/tasks/scheduler.ts`

- [ ] Add task execution context
- [ ] Include job success/failure rates
- [ ] Add duration metrics

**File:** `apps/backend/src/index.ts`

- [ ] Add environment context to server lifecycle logs
- [ ] Add correlation ID to session error logs

**File:** `apps/backend/src/lib/middlewares/index.ts`

- [ ] Add request ID to rate limiting error logs

**File:** `apps/backend/src/lib/feature-flags.ts`

- [ ] Add feature flag access context
- [ ] Include user tier in flag evaluation logs

**File:** `apps/backend/src/lib/redis.ts`

- [ ] Add cache hit/miss logging
- [ ] Include request context

**Status:** Not started

**Estimated Effort:** 6 hours

---

## Phase 6: Configuration

**File:** `apps/backend/src/lib/env.ts`

- [ ] Add LOG_LEVEL environment variable
- [ ] Add LOG_SAMPLING_RATE environment variable
- [ ] Add POSTHOG_LOGS_ENABLED environment variable

**New File:** `apps/backend/src/lib/logging-config.ts`

- [ ] Create centralized logging configuration
- [ ] Implement log level resolution
- [ ] Implement sampling logic
- [ ] Add feature flags for logging components

**File:** `apps/backend/.env.example`

- [ ] Add LOG_LEVEL=info
- [ ] Add LOG_SAMPLING_RATE=1
- [ ] Add POSTHOG_LOGS_ENABLED=true

**Status:** Not started

**Estimated Effort:** 1 hour

---

## Phase 7: Documentation

**New File:** `apps/backend/docs/LOGGING.md`

- [ ] Document logging guidelines
- [ ] Add wide event pattern examples
- [ ] Add business context examples by domain
- [ ] Create route handler examples
- [ ] Document migration checklist for existing routes
- [ ] Add troubleshooting section

**File:** `apps/backend/README.md`

- [ ] Add link to LOGGING.md
- [ ] Document environment variables for logging

**Status:** Not started

**Estimated Effort:** 2 hours

---

## Testing

### Unit Tests

- [ ] Test correlation ID generation is unique
- [ ] Test environment context injection
- [ ] Test wide event structure matches schema
- [ ] Test business context collection

### Integration Tests

- [ ] Make sample request and verify correlation ID in response
- [ ] Check PostHog for log with correct structure
- [ ] Verify environment context in all logs
- [ ] Test business context is captured from handlers

### Manual Verification

- [ ] Start backend: `cd apps/backend && bun run dev`
- [ ] Make test request: `curl -i http://localhost:3002/api/clubs`
- [ ] Verify X-Request-ID header present
- [ ] Check PostHog dashboard for structured logs
- [ ] Verify business context appears in logs

**Status:** Not started

---

## Git Commits

Use these commit message patterns:

- `feat(logging): add request correlation ID middleware`
- `feat(logging): enhance logger with environment context`
- `refactor(logging): migrate console.log to structured logging`
- `feat(logging): add wide events middleware`
- `docs(logging): add comprehensive logging guidelines`
- `chore(logging): add environment configuration`

---

## Overall Progress

**Phases Completed:** 0 / 7
**Total Tasks:** 0 / ~65
**Estimated Time Remaining:** 20 hours

**Current Focus:** Phase 1 - Logger Infrastructure Enhancement

**Next Steps:**
1. Add environment context to logger
2. Test environment context appears in logs
3. Move to Phase 2 (Correlation IDs)

---

## Notes

- All changes in `apps/backend/` directory
- No new dependencies needed
- Backward compatible (no breaking changes)
- Can merge incrementally by phase

---

## Blockers

None currently

---

## Questions?

Refer to `LOGGING_IMPLEMENTATION.md` for full context and detailed instructions.
