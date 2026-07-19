# @reconned/router

A type-safe HTTP router for Bun with Zod validation, middleware composition, rate limiting, and OpenAPI generation.

## Features

- **Type-safe routing** - Full TypeScript inference for params, query, body, and responses
- **Zod validation** - Automatic request/response validation with detailed error messages
- **Middleware system** - Composable middleware with async/await support
- **Rate limiting** - In-memory and Redis-backed rate limiting
- **CORS support** - Configurable CORS handling
- **OpenAPI generation** - Automatic OpenAPI spec generation from route schemas
- **Error handling** - Standardized error responses with custom error classes

## Installation

```bash
bun add @reconned/router zod
```

## Quick Start

```typescript
import { Router, responseSchema } from "@reconned/router";
import { z } from "zod";

const router = new Router();

// Simple GET route
router.get("/health", () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" },
  });
});

// Route with path params
router.get("/users/:id", async ({ params, response }) => {
  return response.json({ id: params.id, name: "John Doe" });
});

// Route with body validation
const createUserSchema = {
  body: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  response: {
    201: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
};

router.post(
  "/users",
  async ({ body, response }) => {
    const user = { id: "123", ...body };
    return response.json(user, 201);
  },
  { schema: createUserSchema }
);

// Handle requests
const server = Bun.serve({
  port: 3000,
  async fetch(request) {
    const context = {
      user: undefined,
      isAdmin: false,
      requestId: crypto.randomUUID(),
      requestStartTime: Date.now(),
    };
    return router.handle(request, context, (data, status = 200) => 
      new Response(JSON.stringify(data), { 
        status, 
        headers: { "Content-Type": "application/json" } 
      })
    );
  },
});

console.log(`Server running on http://localhost:${server.port}`);
```

## API Reference

### Router

The main router class for defining and handling HTTP routes.

```typescript
import { Router } from "@reconned/router";

const router = new Router({
  defaultRateLimit: {
    windowMs: 60000,  // 1 minute
    maxRequests: 100,
  },
});
```

#### HTTP Methods

```typescript
router.get(path, handler, options?)
router.post(path, handler, options?)
router.put(path, handler, options?)
router.patch(path, handler, options?)
router.delete(path, handler, options?)
```

#### Route Options

```typescript
{
  auth?: boolean;           // Require authentication
  rateLimit?: RateLimitConfig | false;  // Override default rate limit
  schema?: RouteSchema;     // Zod schemas for validation
}
```

#### Route Handler

```typescript
type RouteHandler<TBody, TQuery, TSchema, TAuth> = (
  params: {
    request: Request;
    params: Record<string, string>;
    context: RouteContext<TAuth>;
    response: ResponseHelper<TSchema>;
    body?: TBody;      // Present if schema.body defined
    query?: TQuery;    // Present if schema.query defined
  }
) => Promise<Response> | Response;
```

#### Response Helper

```typescript
// JSON response (200 or 201)
response.json(data, status?)

// Error response (400, 401, 403, 404, 429, 500)
response.error(data, status?)

// Redirect response (301, 302)
response.redirect(url, status?)
```

### Schema Definition

Define validation schemas using Zod:

```typescript
import { z } from "zod";
import { responseSchema } from "@reconned/router";

const userSchema = {
  // Path parameters
  params: z.object({
    id: z.string().uuid(),
  }),
  
  // Query parameters
  query: z.object({
    include: z.enum(["posts", "comments"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
  
  // Request body (for POST/PUT/PATCH)
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  
  // Response schemas by status code
  response: {
    200: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
    404: z.object({
      error: z.object({
        code: z.string(),
        message: z.string(),
      }),
    }),
  },
  
  // OpenAPI metadata
  summary: "Update user",
  description: "Updates a user's profile information",
  tags: ["users"],
};

// Helper for multiple status codes with same schema
const listResponse = responseSchema([200], z.object({
  items: z.array(z.any()),
  total: z.number(),
}));
```

### Middleware

#### Built-in Middleware

```typescript
import {
  corsMiddleware,
  authMiddleware,
  correlationMiddleware,
  requestLoggingMiddleware,
  errorHandlingMiddleware,
  composeMiddleware,
  pathMiddleware,
  methodMiddleware,
} from "@reconned/router";

// CORS
router.middleware(corsMiddleware(["http://localhost:3000"], {
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
  allowCredentials: true,
  maxAge: 86400,
}));

// Authentication
router.middleware(authMiddleware({
  requireAuth: true,
  roles: ["admin"],
  redirectTo: "/login",
}));

// Request correlation (adds X-Request-ID and X-Response-Time headers)
router.middleware(correlationMiddleware());

// Request logging
router.middleware(requestLoggingMiddleware({
  log: (level, message, data) => console.log(`[${level}] ${message}`, data),
  includeHeaders: false,
  excludePaths: ["/health", "/metrics"],
}));

// Error handling
router.middleware(errorHandlingMiddleware((error, context) => {
  console.error("Unhandled error:", error);
  return context.response.error({ error: "Internal server error" }, 500);
}));

// Path-based middleware
router.middleware(
  pathMiddleware("/api/admin", authMiddleware({ requireAuth: true }))
);

// Compose multiple middleware
router.middleware(composeMiddleware(
  correlationMiddleware(),
  requestLoggingMiddleware({ log: console.log }),
));
```

#### Custom Middleware

```typescript
import type { MiddlewareHandler } from "@reconned/router";

const timingMiddleware: MiddlewareHandler = async ({ context, next }) => {
  const start = Date.now();
  const response = await next();
  const duration = Date.now() - start;
  
  response.headers.set("X-Response-Time", `${duration}ms`);
  return response;
};

router.middleware(timingMiddleware);
```

### Rate Limiting

#### In-Memory Store

```typescript
import { Router, InMemoryRateLimitStore } from "@reconned/router";

const router = new Router({
  defaultRateLimit: {
    windowMs: 60000,     // 1 minute window
    maxRequests: 100,    // Max 100 requests per window
    keyPrefix: "rl",
    skipPaths: ["/health"],
  },
});

// Per-route override
router.get("/api/data", handler, {
  rateLimit: {
    windowMs: 1000,
    maxRequests: 10,
  },
});

// Disable rate limiting for specific route
router.get("/api/public", handler, {
  rateLimit: false,
});
```

#### Redis Store

```typescript
import { createRedisStore, Router } from "@reconned/router";
import Redis from "ioredis";

const redis = new Redis("redis://localhost:6379");

const router = new Router({
  defaultRateLimit: {
    windowMs: 60000,
    maxRequests: 100,
    store: createRedisStore(redis),
  },
});
```

### Error Handling

```typescript
import { AppError, apiError, ErrorCodes, formatErrorResponse } from "@reconned/router";

// Throw structured errors
throw apiError.notFound("User", { userId: "123" });
throw apiError.unauthorized("Token expired");
throw apiError.forbidden("Admin access required");
throw apiError.validation("Invalid email", { field: "email" });

// Custom error
throw new AppError(
  "CUSTOM_ERROR",
  "Something went wrong",
  400,
  { additional: "info" }
);

// Format errors for responses
const errorResponse = formatErrorResponse(error);
// { error: { code: "NOT_FOUND", message: "User not found", details: { userId: "123" } } }
```

### OpenAPI Generation

```typescript
import { generateOpenAPISpec, createOpenAPIHandler } from "@reconned/router";

// Generate OpenAPI spec from router
const spec = generateOpenAPISpec(router, {
  title: "My API",
  version: "1.0.0",
  description: "API description",
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
    },
  },
});

// Create OpenAPI handler for serving docs
const openApiHandler = createOpenAPIHandler(router, {
  title: "My API",
  version: "1.0.0",
});

router.get("/openapi.json", openApiHandler.json);
router.get("/docs", openApiHandler.swaggerUI);
```

### CORS Utilities

```typescript
import { handleCORS, addCORSHeaders } from "@reconned/router";

const allowedOrigins = ["http://localhost:3000", "https://example.com"];

// Handle preflight requests
const preflightResponse = handleCORS(request, allowedOrigins);
if (preflightResponse) return preflightResponse;

// Add CORS headers to response
const response = await router.handle(request, context, jsonResponse);
return addCORSHeaders(response, request, allowedOrigins);
```

### Router Composition

Mount sub-routers with optional prefix:

```typescript
const apiRouter = new Router();
apiRouter.get("/users", listUsers);
apiRouter.post("/users", createUser);

const adminRouter = new Router();
adminRouter.get("/stats", getStats, { auth: true });

const router = new Router();
router.use(apiRouter, "/api");
router.use(adminRouter, "/api/admin");
```

## Type Inference

Full type inference from schemas:

```typescript
import { z } from "zod";
import type { InferBodyType, InferResponseType } from "@reconned/router";

const schema = {
  body: z.object({ name: z.string() }),
  response: {
    200: z.object({ id: z.string(), name: z.string() }),
  },
} as const;

type Body = InferBodyType<typeof schema>;     // { name: string }
type Response = InferResponseType<typeof schema>; // { id: string; name: string }
```

## License

MIT
