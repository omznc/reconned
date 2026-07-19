import { describe, expect, test } from "bun:test";
import {
	authMiddleware,
	composeMiddleware,
	conditionalMiddleware,
	correlationMiddleware,
	corsMiddleware,
	errorHandlingMiddleware,
	methodMiddleware,
	pathMiddleware,
	requestLoggingMiddleware,
	responseTransformMiddleware,
} from "../middlewares";
import type { MiddlewareContext, MiddlewareHandler } from "../types";

function createMockContext(overrides: Partial<MiddlewareContext> = {}): MiddlewareContext {
	return {
		user: undefined,
		isAdmin: false,
		requestId: "test-id",
		requestStartTime: Date.now(),
		request: new Request("http://localhost/test"),
		params: {},
		response: {
			json: <T>(data: T, status = 200) => new Response(JSON.stringify(data), { status }),
			error: <T>(data: T, status = 400) => new Response(JSON.stringify(data), { status }),
			redirect: (url: string, status = 302) => new Response(null, { status, headers: { Location: url } }),
		},
		...overrides,
	};
}

describe("conditionalMiddleware", () => {
	test("should execute middleware when condition is true", async () => {
		const innerMiddleware: MiddlewareHandler = async ({ context }) => {
			return context.response.json({ executed: true });
		};

		const middleware = conditionalMiddleware(() => true, innerMiddleware);

		const result = await middleware({
			context: createMockContext(),
			next: () => Promise.resolve(new Response("fallback")),
		});

		const body = (await result.json()) as { executed: boolean };
		expect(body.executed).toBe(true);
	});

	test("should skip middleware when condition is false", async () => {
		const innerMiddleware: MiddlewareHandler = async ({ context }) => {
			return context.response.json({ executed: true });
		};

		const middleware = conditionalMiddleware(() => false, innerMiddleware);

		const result = await middleware({
			context: createMockContext(),
			next: () => Promise.resolve(new Response(JSON.stringify({ skipped: true }))),
		});

		const body = (await result.json()) as { skipped: boolean };
		expect(body.skipped).toBe(true);
	});
});

describe("pathMiddleware", () => {
	test("should match string prefix", async () => {
		const middleware = pathMiddleware("/api", async ({ context }) => {
			return context.response.json({ matched: true });
		});

		const result = await middleware({
			context: createMockContext({
				request: new Request("http://localhost/api/users"),
			}),
			next: () => Promise.resolve(new Response("fallback")),
		});

		const body = (await result.json()) as { matched: boolean };
		expect(body.matched).toBe(true);
	});

	test("should match regex pattern", async () => {
		const middleware = pathMiddleware(/^\/api\/v\d+/, async ({ context }) => {
			return context.response.json({ matched: true });
		});

		const result = await middleware({
			context: createMockContext({
				request: new Request("http://localhost/api/v1/users"),
			}),
			next: () => Promise.resolve(new Response("fallback")),
		});

		const body = (await result.json()) as { matched: boolean };
		expect(body.matched).toBe(true);
	});

	test("should use custom matcher function", async () => {
		const middleware = pathMiddleware(
			(path) => path.startsWith("/admin"),
			async ({ context }) => context.response.json({ matched: true }),
		);

		const result = await middleware({
			context: createMockContext({
				request: new Request("http://localhost/admin/dashboard"),
			}),
			next: () => Promise.resolve(new Response("fallback")),
		});

		const body = (await result.json()) as { matched: boolean };
		expect(body.matched).toBe(true);
	});
});

describe("methodMiddleware", () => {
	test("should match single method", async () => {
		const middleware = methodMiddleware("POST", async ({ context }) => {
			return context.response.json({ matched: true });
		});

		const result = await middleware({
			context: createMockContext({
				request: new Request("http://localhost/test", { method: "POST" }),
			}),
			next: () => Promise.resolve(new Response("fallback")),
		});

		const body = (await result.json()) as { matched: boolean };
		expect(body.matched).toBe(true);
	});

	test("should match multiple methods", async () => {
		const middleware = methodMiddleware(["GET", "POST"], async ({ context }) => {
			return context.response.json({ matched: true });
		});

		for (const method of ["GET", "POST"]) {
			const result = await middleware({
				context: createMockContext({
					request: new Request("http://localhost/test", { method }),
				}),
				next: () => Promise.resolve(new Response("fallback")),
			});

			const body = (await result.json()) as { matched: boolean };
			expect(body.matched).toBe(true);
		}
	});
});

describe("errorHandlingMiddleware", () => {
	test("should catch errors and return custom response", async () => {
		const middleware = errorHandlingMiddleware((error, context) => {
			return context.response.error({ caught: true, message: String(error) }, 500);
		});

		const result = await middleware({
			context: createMockContext(),
			next: () => Promise.reject(new Error("Test error")),
		});

		expect(result.status).toBe(500);
		const body = (await result.json()) as { caught: boolean };
		expect(body.caught).toBe(true);
	});

	test("should pass through successful responses", async () => {
		const middleware = errorHandlingMiddleware(() => new Response("should not be used"));

		const result = await middleware({
			context: createMockContext(),
			next: () => Promise.resolve(new Response(JSON.stringify({ success: true }))),
		});

		const body = (await result.json()) as { success: boolean };
		expect(body.success).toBe(true);
	});
});

describe("composeMiddleware", () => {
	test("should compose multiple middleware in order", async () => {
		const order: string[] = [];

		const middleware1: MiddlewareHandler = async ({ next }) => {
			order.push("m1-before");
			const response = await next();
			order.push("m1-after");
			return response;
		};

		const middleware2: MiddlewareHandler = async ({ next }) => {
			order.push("m2-before");
			const response = await next();
			order.push("m2-after");
			return response;
		};

		const composed = composeMiddleware(middleware1, middleware2);

		await composed({
			context: createMockContext(),
			next: () => {
				order.push("handler");
				return Promise.resolve(new Response("ok"));
			},
		});

		expect(order).toEqual(["m1-before", "m2-before", "handler", "m2-after", "m1-after"]);
	});

	test("should throw error for undefined middleware", async () => {
		const composed = composeMiddleware(undefined as unknown as MiddlewareHandler);

		await expect(
			composed({
				context: createMockContext(),
				next: () => Promise.resolve(new Response("ok")),
			}),
		).rejects.toThrow("Middleware is undefined");
	});
});

describe("corsMiddleware", () => {
	test("should handle OPTIONS preflight request", async () => {
		const middleware = corsMiddleware(["http://localhost:3000"]);

		const result = await middleware({
			context: createMockContext({
				request: new Request("http://localhost/test", {
					method: "OPTIONS",
					headers: { origin: "http://localhost:3000" },
				}),
			}),
			next: () => Promise.resolve(new Response("should not be called")),
		});

		expect(result.status).toBe(200);
		expect(result.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
		expect(result.headers.get("Access-Control-Allow-Methods")).toContain("GET");
		expect(result.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	test("should reject preflight from disallowed origin", async () => {
		const middleware = corsMiddleware(["http://localhost:3000"]);

		const result = await middleware({
			context: createMockContext({
				request: new Request("http://localhost/test", {
					method: "OPTIONS",
					headers: { origin: "http://evil.com" },
				}),
			}),
			next: () => Promise.resolve(new Response("should not be called")),
		});

		expect(result.status).toBe(403);
	});

	test("should add CORS headers to actual response", async () => {
		const middleware = corsMiddleware(["http://localhost:3000"]);

		const result = await middleware({
			context: createMockContext({
				request: new Request("http://localhost/test", {
					headers: { origin: "http://localhost:3000" },
				}),
			}),
			next: () => Promise.resolve(new Response(JSON.stringify({ data: "ok" }))),
		});

		expect(result.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
	});

	test("should allow wildcard origin", async () => {
		const middleware = corsMiddleware(["*"]);

		const result = await middleware({
			context: createMockContext({
				request: new Request("http://localhost/test", {
					method: "OPTIONS",
					headers: { origin: "http://any-origin.com" },
				}),
			}),
			next: () => Promise.resolve(new Response("ok")),
		});

		expect(result.status).toBe(200);
	});

	test("should respect custom options", async () => {
		const middleware = corsMiddleware(["http://localhost:3000"], {
			allowMethods: ["GET", "POST"],
			allowHeaders: ["Content-Type", "X-Custom"],
			allowCredentials: false,
			maxAge: 3600,
		});

		const result = await middleware({
			context: createMockContext({
				request: new Request("http://localhost/test", {
					method: "OPTIONS",
					headers: { origin: "http://localhost:3000" },
				}),
			}),
			next: () => Promise.resolve(new Response("ok")),
		});

		expect(result.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
		expect(result.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Custom");
		expect(result.headers.get("Access-Control-Max-Age")).toBe("3600");
		expect(result.headers.get("Access-Control-Allow-Credentials")).toBeNull();
	});
});

describe("authMiddleware", () => {
	test("should allow authenticated users", async () => {
		const middleware = authMiddleware({ requireAuth: true });

		const result = await middleware({
			context: createMockContext({
				user: { id: "1", email: "test@example.com", name: "Test" },
			}),
			next: () => Promise.resolve(new Response(JSON.stringify({ success: true }))),
		});

		const body = (await result.json()) as { success: boolean };
		expect(body.success).toBe(true);
	});

	test("should reject unauthenticated users", async () => {
		const middleware = authMiddleware({ requireAuth: true });

		const result = await middleware({
			context: createMockContext({ user: undefined }),
			next: () => Promise.resolve(new Response("should not be called")),
		});

		expect(result.status).toBe(401);
	});

	test("should redirect when redirectTo is set", async () => {
		const middleware = authMiddleware({ requireAuth: true, redirectTo: "/login" });

		const result = await middleware({
			context: createMockContext({ user: undefined }),
			next: () => Promise.resolve(new Response("should not be called")),
		});

		expect(result.status).toBe(302);
		expect(result.headers.get("Location")).toBe("/login");
	});

	test("should check user roles", async () => {
		const middleware = authMiddleware({ requireAuth: true, roles: ["admin"] });

		const result = await middleware({
			context: createMockContext({
				user: { id: "1", email: "test@example.com", name: "Test", role: "user" },
			}),
			next: () => Promise.resolve(new Response("should not be called")),
		});

		expect(result.status).toBe(403);
	});

	test("should allow users with required role", async () => {
		const middleware = authMiddleware({ requireAuth: true, roles: ["admin"] });

		const result = await middleware({
			context: createMockContext({
				user: { id: "1", email: "test@example.com", name: "Test", role: "admin" },
			}),
			next: () => Promise.resolve(new Response(JSON.stringify({ success: true }))),
		});

		const body = (await result.json()) as { success: boolean };
		expect(body.success).toBe(true);
	});
});

describe("correlationMiddleware", () => {
	test("should add request ID and response time headers", async () => {
		const middleware = correlationMiddleware();

		const result = await middleware({
			context: createMockContext(),
			next: () => Promise.resolve(new Response("ok")),
		});

		expect(result.headers.has("X-Request-ID")).toBe(true);
		expect(result.headers.has("X-Response-Time")).toBe(true);
	});
});

describe("requestLoggingMiddleware", () => {
	test("should log requests and responses", async () => {
		const logs: Array<{ level: string; message: string }> = [];

		const middleware = requestLoggingMiddleware({
			log: (level, message) => {
				logs.push({ level, message });
			},
		});

		await middleware({
			context: createMockContext({
				request: new Request("http://localhost/test"),
			}),
			next: () => Promise.resolve(new Response("ok", { status: 200 })),
		});

		expect(logs.length).toBe(2);
		expect(logs[0].message).toContain("HTTP request");
		expect(logs[1].message).toContain("HTTP response");
	});

	test("should exclude specified paths", async () => {
		const logs: Array<{ level: string; message: string }> = [];

		const middleware = requestLoggingMiddleware({
			log: (level, message) => {
				logs.push({ level, message });
			},
			excludePaths: ["/health"],
		});

		await middleware({
			context: createMockContext({
				request: new Request("http://localhost/health"),
			}),
			next: () => Promise.resolve(new Response("ok")),
		});

		expect(logs.length).toBe(0);
	});

	test("should log errors and re-throw", async () => {
		const logs: Array<{ level: string; message: string }> = [];

		const middleware = requestLoggingMiddleware({
			log: (level, message) => {
				logs.push({ level, message });
			},
		});

		await expect(
			middleware({
				context: createMockContext({
					request: new Request("http://localhost/test"),
				}),
				next: () => Promise.reject(new Error("Test error")),
			}),
		).rejects.toThrow("Test error");

		expect(logs.some((l) => l.level === "error")).toBe(true);
	});

	test("should include headers when configured", async () => {
		const loggedData: Array<Record<string, unknown>> = [];

		const middleware = requestLoggingMiddleware({
			log: (_level, _message, data) => {
				loggedData.push(data);
			},
			includeHeaders: true,
		});

		await middleware({
			context: createMockContext({
				request: new Request("http://localhost/test", {
					headers: { "X-Custom": "value" },
				}),
			}),
			next: () => Promise.resolve(new Response("ok")),
		});

		expect(loggedData[0].headers).toBeDefined();
	});
});

describe("responseTransformMiddleware", () => {
	test("should transform response", async () => {
		const middleware = responseTransformMiddleware((response) => {
			const newResponse = new Response(response.body, {
				status: response.status,
				headers: { ...Object.fromEntries(response.headers), "X-Transformed": "true" },
			});
			return newResponse;
		});

		const result = await middleware({
			context: createMockContext(),
			next: () => Promise.resolve(new Response(JSON.stringify({ data: "ok" }))),
		});

		expect(result.headers.get("X-Transformed")).toBe("true");
	});

	test("should support async transform", async () => {
		const middleware = responseTransformMiddleware(async (response) => {
			const body = await response.text();
			return new Response(body.toUpperCase(), { headers: { "Content-Type": "text/plain" } });
		});

		const result = await middleware({
			context: createMockContext(),
			next: () => Promise.resolve(new Response("hello")),
		});

		expect(await result.text()).toBe("HELLO");
	});

	test("should pass context to transform function", async () => {
		let receivedContext: MiddlewareContext | undefined;

		const middleware = responseTransformMiddleware((response, context) => {
			receivedContext = context;
			return response;
		});

		const ctx = createMockContext();
		await middleware({
			context: ctx,
			next: () => Promise.resolve(new Response("ok")),
		});

		expect(receivedContext).toBe(ctx);
	});
});
