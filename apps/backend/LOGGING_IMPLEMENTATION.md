# Logging Improvements - Implementation Context

## Project Overview

**Goal:** Implement structured logging with wide events pattern, request correlation, and business context for the reconned backend.

**Date Started:** 2026-01-31
**Branch:** `feature/logging-improvements`
**Base Branch:** `dev`

---

## Current Architecture

### Backend Stack
- **Runtime:** Bun (JavaScript/TypeScript)
- **Language:** TypeScript
- **Framework:** Custom router (`src/lib/router.ts` - 810 lines)
- **Database:** PostgreSQL with Drizzle ORM
- **Cache:** Redis
- **Auth:** Better Auth with OAuth (Google, Facebook)
- **Analytics:** PostHog + OpenTelemetry logging

### Current Logging Setup

**Logger Location:** `apps/backend/src/lib/posthog.ts`
- Uses OpenTelemetry SDK (`@opentelemetry/sdk-logs`, `@opentelemetry/exporter-logs-otlp-http`)
- Exports logs to PostHog EU instance
- Logger interface:
  ```typescript
  logger.emit({
    severityText: "info" | "error" | "warn" | "debug",
    body: string,
    attributes: Record<string, unknown>
  })
  ```

**Current Usage:**
- 48 `logger.emit()` calls across 13 files
- 12 `console.log/error/warn` calls (needs migration)
- Request middleware uses `console.log` instead of OpenTelemetry

**Key Files with Logging:**
1. `src/tasks/scheduler.ts` (12 logs)
2. `src/lib/router.ts` (8 logs)
3. `src/routes/clubs.ts` (5 logs)
4. `src/index.ts` (4 logs)
5. `src/lib/middlewares/index.ts` (2 logs + console logging)
6. `src/lib/errors.ts` (1 log - global error handler)

---

## What's Missing

### Critical Gaps
1. **No request correlation IDs** - Can't track requests across service boundaries
2. **No environment context** - Missing commit hash, service version, deployment info
3. **No business context** - Logs lack user subscription tier, account age, feature flags
4. **Scattered logging** - Multiple log lines per request instead of single wide event
5. **Inconsistent patterns** - Mix of `logger.emit` and `console.log`
6. **No structured schema** - Different field names across services

### Impact
- **Debugging:** Difficult to trace specific user requests through logs
- **Analytics:** Can't answer "why did premium user X's purchase fail?"
- **Deployment:** Can't correlate errors with specific commits/versions
- **Performance:** No easy way to find slow requests by user tier

---

## Logging Best Practices (From Skill)

### Wide Events Pattern
**Core Principle:** Emit ONE context-rich event per request per service

```typescript
const wideEvent: Record<string, unknown> = {
  method: 'POST',
  path: '/checkout',
  requestId: c.get('requestId'),
  timestamp: new Date().toISOString(),
};

try {
  const user = await getUser(c.get('userId'));
  wideEvent.user = { id: user.id, subscription: user.subscription };

  const cart = await getCart(user.id);
  wideEvent.cart = { total_cents: cart.total, item_count: cart.items.length };

  wideEvent.status_code = 200;
  wideEvent.outcome = 'success';
  return c.json({ success: true });
} catch (error) {
  wideEvent.status_code = 500;
  wideEvent.outcome = 'error';
  wideEvent.error = { message: error.message, type: error.name };
  throw error;
} finally {
  wideEvent.duration_ms = Date.now() - startTime;
  logger.info(wideEvent);
}
```

### Key Requirements
1. **High Cardinality** - Include user IDs, request IDs (millions of unique values)
2. **High Dimensionality** - Many fields per event
3. **Business Context** - User tier, cart value, feature flags, account age
4. **Environment Characteristics** - Commit hash, version, region, instance ID
5. **Single Logger** - One instance configured at startup
6. **JSON Format** - Consistent structure
7. **Two Levels** - `info` and `error` only

### Anti-Patterns
- ❌ Multiple `console.log()` calls per request
- ❌ Different logger instances in different files
- ❌ Missing environment context
- ❌ Missing business context
- ❌ Unstructured strings: `console.log('something happened')`

---

## Implementation Plan

### Phase 1: Logger Infrastructure Enhancement (Foundation)
**File:** `apps/backend/src/lib/posthog.ts`

**Tasks:**
- [ ] Add git commit hash capture
- [ ] Add service version from package.json
- [ ] Add deployment environment (dev/staging/prod)
- [ ] Auto-include environment context in every log
- [ ] Add log level configuration via environment variable
- [ ] Create TypeScript interfaces for structured logs

**Code to Add:**
```typescript
// Environment context (auto-added to all logs)
const GIT_COMMIT = process.env.GIT_COMMIT || 'unknown';
const SERVICE_VERSION = require('../../package.json').version;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Enhanced logger with context
interface LogContext {
  service: {
    name: string;
    version: string;
    commit_hash: string;
    environment: string;
  };
  request?: {
    id: string;
    method: string;
    path: string;
  };
  user?: {
    id: string;
    subscription_tier?: string;
  };
  business?: Record<string, unknown>;
}
```

---

### Phase 2: Request Correlation Middleware
**New File:** `apps/backend/src/lib/middlewares/correlation.ts`

**Tasks:**
- [ ] Create correlation middleware
- [ ] Generate unique request ID using `randomUUIDv7()`
- [ ] Add request ID to context object
- [ ] Add request ID to response headers (`X-Request-ID`)
- [ ] Integrate with existing router context

**Code Structure:**
```typescript
import { randomUUIDv7 } from "bun";

export function correlationMiddleware(): MiddlewareHandler {
  return async ({ context, next }) => {
    const requestId = randomUUIDv7();
    const startTime = Date.now();

    // Add to context
    context.requestId = requestId;
    context.requestStartTime = startTime;

    const response = await next();

    // Add to response headers
    response.headers.set('X-Request-ID', requestId);

    return response;
  };
}
```

**Router Changes Needed:**
```typescript
// Update RouteContext type in src/lib/router.ts
export type RouteContext<TAuth extends boolean = false> = {
  user: TAuth extends true ? {...} : {...} | undefined;
  session?: { id: string };
  isAdmin: boolean;
  requestId: string;              // NEW
  requestStartTime: number;        // NEW
  businessContext?: Record<string, unknown>; // NEW
};
```

---

### Phase 3: Wide Events Middleware
**New File:** `apps/backend/src/lib/middlewares/wide-events.ts`

**Tasks:**
- [ ] Create wide event builder middleware
- [ ] Capture request start time
- [ ] Collect business context from route handlers
- [ ] Emit single structured event at request completion
- [ ] Handle both success and error cases
- [ ] Add business context helper function

**Code Structure:**
```typescript
export function wideEventsMiddleware(): MiddlewareHandler {
  return async ({ context, next }) => {
    const startTime = Date.now();
    const url = new URL(context.request.url);

    const wideEvent = {
      // Environment (auto-added)
      service: {
        name: "reconned-backend",
        version: SERVICE_VERSION,
        commit_hash: GIT_COMMIT,
        environment: ENVIRONMENT
      },

      // Request (high cardinality)
      request: {
        id: context.requestId,
        method: context.request.method,
        path: url.pathname,
      },

      // User (if authenticated)
      ...(context.user && {
        user: {
          id: context.user.id,
          email: context.user.email,
        }
      }),

      // Business context (added by handlers)
      business: context.businessContext || {},

      // Performance
      duration_ms: 0, // Set at end
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await next();

      wideEvent.status_code = response.status;
      wideEvent.outcome = 'success';
      wideEvent.duration_ms = Date.now() - startTime;

      logger.emit({
        severityText: 'info',
        body: `${context.request.method} ${url.pathname}`,
        attributes: wideEvent,
      });

      return response;
    } catch (error) {
      wideEvent.status_code = 500;
      wideEvent.outcome = 'error';
      wideEvent.error = {
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      };
      wideEvent.duration_ms = Date.now() - startTime;

      logger.emit({
        severityText: 'error',
        body: `Request failed: ${context.request.method} ${url.pathname}`,
        attributes: wideEvent,
      });

      throw error;
    }
  };
}
```

---

### Phase 4: Console Migration
**Files to Update:**
- `src/lib/middlewares/index.ts:296` - Request logging console.log
- `src/lib/middlewares/index.ts:302` - Response logging console.log
- `src/routes/dashboard.ts` - Debug console.logs (2 instances)
- `src/tasks/run-task.ts` - Task runner console output (9 instances)

**Migration Pattern:**
```typescript
// BEFORE
console[logLevel](`[${timestamp}] REQUEST:`, logData)

// AFTER
logger.emit({
  severityText: logLevel === 'error' ? 'error' : 'info',
  body: 'HTTP request received',
  attributes: {
    request_id: context.requestId,
    ...logData
  }
})
```

---

### Phase 5: Enhance Existing Logging
**Goal:** Add business context to existing logger.emit() calls

**Priority Files:**
1. `src/routes/clubs.ts` (5 logs)
   - Add subscription tier
   - Add club member count
   - Add operation type
2. `src/lib/router.ts` (8 logs)
   - Add validation error details
   - Include request context
3. `src/lib/errors.ts` (1 log)
   - Add error categorization
   - Include request ID
4. `src/tasks/scheduler.ts` (12 logs)
   - Add task execution context
   - Include duration metrics

---

### Phase 6: Configuration
**File:** `src/lib/env.ts`

**Tasks:**
- [ ] Add LOG_LEVEL environment variable
- [ ] Add LOG_SAMPLING_RATE variable
- [ ] Add POSTHOG_LOGS_ENABLED flag

**Code to Add:**
```typescript
LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
LOG_SAMPLING_RATE: z.string().transform(Number).default('1'),
POSTHOG_LOGS_ENABLED: z.enum(['true', 'false']).default('true')
```

**New File:** `src/lib/logging-config.ts`
- Centralized logging configuration
- Log level resolution
- Sampling logic

---

### Phase 7: Documentation
**New File:** `apps/backend/docs/LOGGING.md`

**Sections:**
1. Logging guidelines
2. Route handler examples
3. Migration checklist
4. Troubleshooting guide

---

## Execution Order

### Week 1: Foundation (Phase 1-2)
- [ ] Logger enhancement with environment context
- [ ] Correlation ID middleware
- [ ] Router context updates
- [ ] Test correlation ID propagation

### Week 2: Wide Events (Phase 3)
- [ ] Wide events middleware
- [ ] Business context helper
- [ ] Integration with existing middleware
- [ ] Test with sample route

### Week 3: Cleanup (Phase 4)
- [ ] Migrate request middleware console.log
- [ ] Migrate dashboard console.logs
- [ ] Update task runner logs

### Week 4: Enhancement (Phase 5)
- [ ] Add business context to clubs.ts
- [ ] Enhance router.ts logging
- [ ] Improve error handler logging

### Week 5: Polish (Phase 6-7)
- [ ] Add environment configuration
- [ ] Create logging documentation
- [ ] Final testing

---

## Testing Strategy

1. **Unit Tests**
   - Test correlation ID generation
   - Test environment context injection
   - Test wide event structure

2. **Integration Tests**
   - Make sample request
   - Verify correlation ID in response header
   - Check PostHog for log with correct structure
   - Verify business context is captured

3. **Manual Verification**
   ```bash
   # Make a test request
   curl -i http://localhost:3002/api/clubs

   # Check for X-Request-ID header
   # Verify in PostHog dashboard
   ```

---

## Rollback Plan

If issues arise:
1. Revert branch: `git checkout dev`
2. Delete feature branch: `git branch -D feature/logging-improvements`
3. No code changes to production until merged

---

## Dependencies

**Current Package Versions:**
```json
{
  "@opentelemetry/api-logs": "^0.210.0",
  "@opentelemetry/exporter-logs-otlp-http": "^0.210.0",
  "@opentelemetry/resources": "^2.4.0",
  "@opentelemetry/sdk-logs": "^0.210.0",
  "@opentelemetry/sdk-node": "^0.210.0",
  "posthog-node": "^5.21.0"
}
```

**No new dependencies required**

---

## PostHog Configuration

**Current Setup:**
- Service Name: `reconned-backend`
- Export URL: `https://us.i.posthog.com/i/v1/logs`
- PostHog Host: `https://eu.i.posthog.com`
- Batch processing: Enabled

**No changes needed to PostHog setup**

---

## Git Commit Strategy

Use conventional commits:
- `feat: add request correlation ID middleware`
- `refactor: migrate console.log to structured logging`
- `docs: add logging guidelines`
- `chore: update logger with environment context`

---

## Notes for Recovery

### How to Resume Work
1. Check out branch: `git checkout feature/logging-improvements`
2. Read `LOGGING_CHECKLIST.md` for current status
3. Read this file for full context
4. Continue with next pending item in checklist

### Key Files to Reference
- `apps/backend/src/lib/posthog.ts` - Logger setup
- `apps/backend/src/lib/router.ts` - Router & middleware system
- `apps/backend/src/lib/middlewares/index.ts` - Existing middleware
- `apps/backend/src/lib/errors.ts` - Error handling

### Testing Commands
```bash
# Start backend
cd apps/backend && bun run dev

# Make test request
curl -i http://localhost:3002/api/clubs

# Check logs in PostHog dashboard
```

---

## References

- [Logging Best Practices Skill](/home/omznc/.config/opencode/skills/logging-best-practices)
- [OpenTelemetry Logs](https://opentelemetry.io/docs/concepts/signals/logs/)
- [Stripe - Canonical Log Lines](https://stripe.com/blog/canonical-log-lines)
- [Observability Wide Events 101](https://boristane.com/blog/observability-wide-events-101/)
