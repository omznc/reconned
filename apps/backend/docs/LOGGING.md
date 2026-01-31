# Logging Guidelines

This document provides comprehensive guidelines for implementing effective logging in the reconned backend using the wide events pattern.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Logging Principles](#logging-principles)
- [Wide Events Pattern](#wide-events-pattern)
- [Business Context](#business-context)
- [Route Handler Examples](#route-handler-examples)
- [Common Patterns](#common-patterns)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting](#troubleshooting)

---

## Overview

The reconned backend uses structured logging with OpenTelemetry and PostHog. Every HTTP request generates a single, context-rich "wide event" that includes:

- **Service Context**: Version, commit hash, environment
- **Request Context**: Method, path, user ID, IP, user agent
- **User Context**: User ID, email, role (when authenticated)
- **Business Context**: Domain-specific information (operation type, resources, outcomes)
- **Performance**: Duration in milliseconds
- **Outcome**: Success or error with details

### Benefits

- **Debugging**: Trace any request by ID through all service calls
- **Analytics**: Query by user, subscription tier, feature flags
- **Performance**: Identify slow requests by operation or user tier
- **Deployment Correlation**: Match errors with specific commits

---

## Architecture

### Logger Setup

**Location**: `src/lib/posthog.ts`

The logger is configured at startup with automatic environment context:

```typescript
export const logger = logs.getLogger("reconned-backend");

// Environment context auto-included in all logs:
// - service.name: "reconned-backend"
// - service.version: from package.json
// - service.commit_hash: from GIT_COMMIT env var
// - deployment.environment: NODE_ENV
```

### Middleware Chain

Requests flow through middleware in this order:

1. **Correlation Middleware** (`src/lib/middlewares/correlation.ts`)
   - Generates unique request ID (UUID v7)
   - Adds `X-Request-ID` and `X-Response-Time` headers to responses

2. **Wide Events Middleware** (`src/lib/middlewares/wide-events.ts`)
   - Emits single structured event at request completion
   - Captures timing, outcome, and business context
   - Handles both success and error paths

3. **Logging Middleware** (`src/lib/middlewares/index.ts`)
   - Legacy request/response logging (being phased out)

---

## Logging Principles

### 1. Wide Events (Critical)

**Emit ONE context-rich event per request per service.**

Instead of multiple `console.log()` calls, consolidate all information into a single structured event emitted at request completion.

```typescript
// ❌ BAD: Scattered logs
console.log("User requested club", clubId);
console.log("User is premium", user.subscription);
const data = await fetchClub(clubId);
console.log("Club fetched", data.name);

// ✅ GOOD: Single wide event
try {
  const club = await fetchClub(clubId);
  context.businessContext = {
    operation: "get_club",
    domain: "club_management",
    club_id: clubId,
    club_name: club.name,
    user_subscription_tier: user.subscription,
  };
  return response.json(club);
} catch (error) {
  context.businessContext = {
    operation: "get_club",
    domain: "club_management",
    club_id: clubId,
    error_type: "database_error",
  };
  throw error;
}
```

### 2. High Cardinality & Dimensionality

**Include fields with many unique values (user IDs, request IDs) and many fields per event.**

This enables queries like "Show me all requests from user X in the last hour" or "Which premium users had errors yesterday?"

```typescript
logger.emit({
  severityText: "info",
  body: "Purchase completed",
  attributes: {
    // High cardinality (millions of unique values)
    user_id: "usr_123abc",
    request_id: "req_456def",
    club_id: 789,

    // High dimensionality (many fields)
    amount_cents: 2500,
    currency: "USD",
    payment_method: "stripe",
    user_subscription_tier: "premium",
    account_age_days: 365,
    // ... more context
  },
});
```

### 3. Business Context (Critical)

**Always include business domain information, not just technical details.**

The goal is to know "a premium user couldn't complete a $2,499 purchase" not just "POST /purchases returned 500".

```typescript
// ❌ BAD: Technical only
logger.emit({
  severityText: "error",
  body: "Request failed",
  attributes: {
    status: 500,
    error: "Connection timeout",
  },
});

// ✅ GOOD: Business context
logger.emit({
  severityText: "error",
  body: "Purchase failed",
  attributes: {
    status: 500,
    error: "Connection timeout",
    business: {
      operation: "process_payment",
      domain: "payments",
      amount_cents: 249900,
      user_subscription_tier: "premium",
      payment_provider: "stripe",
      business_impact: "high",
    },
  },
});
```

### 4. Consistent Schema

**Use consistent field names across all services.**

- Use snake_case for all field names
- Use specific suffixes: `_id`, `_count`, `_ms`, `_cents`
- Group business context under `business` object
- Use consistent operation names: `get_`, `create_`, `update_`, `delete_`

---

## Wide Events Pattern

### Automatic Logging

The wide events middleware automatically logs:

- Request details (method, path, headers)
- User context (if authenticated)
- Timing information
- Success/error outcome

You only need to add **business context** specific to your route.

### Adding Business Context

Use the `addBusinessContext()` helper or set `context.businessContext` directly:

```typescript
import { addBusinessContext } from "../lib/middlewares/wide-events";

clubsRouter.post(
  "/clubs",
  async ({ context, body, response }) => {
    // Add business context
    addBusinessContext(context, {
      operation: "create_club",
      domain: "club_management",
      club_name: body.name,
      club_location: body.location,
    });

    const club = await createClub(body);

    // Update business context with result
    addBusinessContext(context, {
      club_id: club.id,
      club_created: true,
    });

    return response.json(club);
  },
  {
    schema: {
      body: createClubSchema,
      // ...
    },
  },
);
```

### Error Handling with Context

Add error-specific business context in catch blocks:

```typescript
clubsRouter.post(
  "/clubs/:id/purchase",
  async ({ params, body, context, response }) => {
    context.businessContext = {
      operation: "create_purchase",
      domain: "payments",
      club_id: params.id,
      amount_cents: body.amount,
    };

    try {
      const purchase = await processPayment(body);
      context.businessContext.purchase_id = purchase.id;
      context.businessContext.payment_method = purchase.method;
      return response.json(purchase);
    } catch (error) {
      context.businessContext.error_type = error.name;
      context.businessContext.payment_provider = "stripe";
      context.businessContext.business_impact = "revenue_loss";
      throw error;
    }
  },
);
```

---

## Business Context

### Domain Examples

Different domains have different context requirements:

#### Club Management

```typescript
business: {
  operation: "update_club_logo",
  domain: "club_management",
  club_id: 123,
  club_name: "Airsoft Club",
  previous_logo: "old.jpg",
  new_logo: "new.jpg",
  file_size_bytes: 1024000,
}
```

#### Events

```typescript
business: {
  operation: "register_for_event",
  domain: "events",
  event_id: 456,
  event_name: "Monthly Match",
  club_id: 123,
  registration_count: 25,
  max_participants: 50,
}
```

#### Payments

```typescript
business: {
  operation: "process_payment",
  domain: "payments",
  amount_cents: 2500,
  currency: "USD",
  payment_method: "stripe",
  payment_intent_id: "pi_123abc",
  user_subscription_tier: "premium",
}
```

#### Instagram Integration

```typescript
business: {
  operation: "fetch_instagram_media",
  domain: "instagram_integration",
  club_id: 123,
  media_count: 20,
  instagram_business_id: "123456789",
  provider: "facebook_graph_api",
}
```

### Common Business Fields

| Field | Type | Description |
|-------|------|-------------|
| `operation` | string | What action: `get_`, `create_`, `update_`, `delete_` |
| `domain` | string | Business area: `club_management`, `payments`, `events` |
| `error_type` | string | Error category: `validation`, `database`, `api` |
| `business_impact` | string | `high`, `medium`, `low` |
| `user_subscription_tier` | string | `free`, `premium`, `enterprise` |

---

## Route Handler Examples

### Example 1: Simple GET Request

```typescript
clubsRouter.get(
  "/clubs/:id",
  async ({ params, context, response }) => {
    const club = await db
      .select()
      .from(club)
      .where(eq(club.id, params.id))
      .limit(1);

    if (!club[0]) {
      context.businessContext = {
        operation: "get_club",
        domain: "club_management",
        club_id: params.id,
        outcome: "not_found",
      };
      throw apiError.notFound("Club");
    }

    context.businessContext = {
      operation: "get_club",
      domain: "club_management",
      club_id: club[0].id,
      club_name: club[0].name,
      member_count: club[0].memberCount,
    };

    return response.json(club[0]);
  },
);
```

### Example 2: POST with Error Handling

```typescript
clubsRouter.post(
  "/clubs/:id/events",
  async ({ params, body, context, response }) => {
    context.businessContext = {
      operation: "create_event",
      domain: "events",
      club_id: params.id,
      event_name: body.name,
    };

    try {
      const event = await createEvent(params.id, body);

      context.businessContext = {
        ...context.businessContext,
        event_id: event.id,
        event_date: event.date,
        max_participants: body.maxParticipants,
      };

      return response.json(event);
    } catch (error) {
      context.businessContext.error_type = error.name;
      context.businessContext.error_category = "database";
      throw error;
    }
  },
);
```

### Example 3: External API Call

```typescript
clubsRouter.get(
  "/clubs/:id/instagram/media",
  async ({ params, context, response }) => {
    const club = await getClub(params.id);

    if (!club.instagramAccessToken) {
      context.businessContext = {
        operation: "fetch_instagram_media",
        domain: "instagram_integration",
        club_id: params.id,
        error_type: "missing_credentials",
      };
      return response.json({ media: [] });
    }

    try {
      const media = await fetchInstagramMedia(club);

      context.businessContext = {
        operation: "fetch_instagram_media",
        domain: "instagram_integration",
        club_id: params.id,
        media_count: media.length,
        provider: "facebook_graph_api",
      };

      return response.json({ media });
    } catch (error) {
      context.businessContext = {
        operation: "fetch_instagram_media",
        domain: "instagram_integration",
        club_id: params.id,
        error_type: "api_error",
        provider: "facebook_graph_api",
      };
      throw error;
    }
  },
);
```

---

## Common Patterns

### Validation Errors

```typescript
try {
  const validated = schema.parse(rawInput);
} catch (error) {
  context.businessContext = {
    operation: "validate_input",
    domain: "validation",
    validation_target: "request_body",
    error_category: "validation_error",
  };
  throw apiError.validation("Invalid input");
}
```

### Database Operations

```typescript
try {
  const result = await db.insert(club).values(data).returning();
  context.businessContext = {
    operation: "create_club",
    domain: "club_management",
    club_id: result[0].id,
    database_table: "clubs",
    outcome: "success",
  };
} catch (error) {
  context.businessContext = {
    operation: "create_club",
    domain: "club_management",
    error_type: "database_error",
    database_table: "clubs",
  };
  throw error;
}
```

### External API Calls

```typescript
try {
  const response = await fetch(apiUrl, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const data = await response.json();

  context.businessContext = {
    operation: "call_external_api",
    domain: "integrations",
    provider: "stripe",
    api_endpoint: "/v1/charges",
    status_code: response.status,
  };

  return data;
} catch (error) {
  context.businessContext = {
    operation: "call_external_api",
    domain: "integrations",
    provider: "stripe",
    error_type: "api_error",
  };
  throw error;
}
```

---

## Environment Configuration

### Environment Variables

Located in `.env`:

```bash
# Logging level: debug, info, warn, error
LOG_LEVEL=info

# Log sampling rate: 0.0 (none) to 1.0 (all)
LOG_SAMPLING_RATE=1

# Enable PostHog logging
POSTHOG_LOGS_ENABLED=true

# Git commit hash (auto-set in production)
GIT_COMMIT=abc123def
```

### Log Levels

- **debug**: Detailed diagnostics (development only)
- **info**: Normal business operations (default)
- **warn**: Warning conditions that don't stop execution
- **error**: Error conditions that affect functionality

### Sampling

Use sampling for high-volume endpoints:

```typescript
import { shouldSampleLog } from "../lib/logging-config";

if (shouldSampleLog()) {
  logger.emit({
    severityText: "info",
    body: "High-volume event",
    attributes: { /* ... */ },
  });
}
```

---

## Troubleshooting

### Finding Logs by Request ID

Every response includes an `X-Request-ID` header. Use this to trace the entire request:

```bash
curl -i http://localhost:3002/api/clubs/123
# Look for: X-Request-ID: 01234567-89ab-cdef-0123-456789abcdef

# Search PostHog for this request ID
# Filter: request_id = "01234567-89ab-cdef-0123-456789abcdef"
```

### Finding Logs by User

```javascript
// PostHog query
request.user.id = "usr_123abc"
// Add filters: timestamp > 7 days ago
```

### Debugging Validation Errors

Validation errors include detailed context:

```typescript
logger.emit({
  severityText: "error",
  body: "Request validation error",
  attributes: {
    validation_target: "request_body",
    validation_issues: 3,
    business: {
      operation: "validate_input",
      domain: "validation",
    },
  },
});
```

### Common Issues

**Issue**: Logs not appearing in PostHog

**Solutions**:
1. Check `POSTHOG_LOGS_ENABLED` is `true`
2. Verify PostHog API key is set
3. Check network connectivity to PostHog
4. Review PostHog dashboard for ingestion errors

**Issue**: Missing request ID

**Solutions**:
1. Ensure correlation middleware is registered
2. Check middleware order (correlation before wide events)
3. Verify RouteContext includes requestId field

**Issue**: Business context not appearing

**Solutions**:
1. Ensure `context.businessContext` is set before response
2. Check that wide events middleware is registered
3. Verify context is passed through middleware chain

---

## Migration Checklist

For existing routes, add business context:

- [ ] Add `operation` field (get/create/update/delete + resource)
- [ ] Add `domain` field (business area)
- [ ] Add resource identifiers (user_id, club_id, etc.)
- [ ] Add error details in catch blocks
- [ ] Add outcome information for success paths
- [ ] Test in PostHog dashboard

---

## Additional Resources

- [Stripe - Canonical Log Lines](https://stripe.com/blog/canonical-log-lines)
- [Observability Wide Events 101](https://boristane.com/blog/observability-wide-events-101/)
- [Logging Best Practices](https://loggingsucks.com)
