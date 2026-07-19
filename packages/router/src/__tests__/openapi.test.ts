import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createOpenAPIHandler, generateOpenAPISpec } from "../openapi";
import { Router } from "../router";

describe("generateOpenAPISpec", () => {
	test("should generate basic OpenAPI spec", async () => {
		const router = new Router();

		router.get("/users", async ({ response }) => {
			return response.json({ users: [] });
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);

		expect(spec.openapi).toBe("3.1.0");
		expect(spec.info.title).toBe("API");
		expect(spec.info.version).toBe("1.0.0");
		expect(spec.servers).toHaveLength(1);
		expect(spec.servers?.[0]?.url).toBe("http://localhost:3000");
	});

	test("should include routes with schemas in spec", async () => {
		const router = new Router();

		router.get(
			"/users/:id",
			async ({ params, response }) => {
				return response.json({ id: params.id, name: "Test" });
			},
			{
				schema: {
					params: z.object({ id: z.string().uuid() }),
					response: {
						200: z.object({
							id: z.string(),
							name: z.string(),
						}),
					},
					summary: "Get user by ID",
					description: "Returns a single user",
					tags: ["users"],
				},
			},
		);

		const spec = await generateOpenAPISpec("http://localhost:3000/api", [router]);

		expect(spec.paths["/users/{id}"]).toBeDefined();
		expect(spec.paths["/users/{id}"].get).toBeDefined();
		expect((spec.paths["/users/{id}"].get as Record<string, unknown>).summary).toBe("Get user by ID");
		expect((spec.paths["/users/{id}"].get as Record<string, unknown>).description).toBe("Returns a single user");
		expect((spec.paths["/users/{id}"].get as Record<string, unknown>).tags).toEqual(["users"]);
	});

	test("should generate path parameters from schema", async () => {
		const router = new Router();

		router.get("/users/:userId/posts/:postId", async ({ response }) => response.json({}), {
			schema: {
				params: z.object({
					userId: z.string(),
					postId: z.string(),
				}),
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);
		const operation = spec.paths["/users/{userId}/posts/{postId}"].get as Record<string, unknown>;
		const parameters = operation.parameters as Array<Record<string, unknown>>;

		expect(parameters).toHaveLength(2);
		expect(parameters.map((p) => p.name)).toContain("userId");
		expect(parameters.map((p) => p.name)).toContain("postId");
		expect(parameters.every((p) => p.in === "path")).toBe(true);
		expect(parameters.every((p) => p.required === true)).toBe(true);
	});

	test("should generate query parameters from schema", async () => {
		const router = new Router();

		router.get("/search", async ({ response }) => response.json({}), {
			schema: {
				query: z.object({
					q: z.string(),
					limit: z.coerce.number().optional(),
				}),
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);
		const operation = spec.paths["/search"].get as Record<string, unknown>;
		const parameters = operation.parameters as Array<Record<string, unknown>>;

		expect(parameters).toHaveLength(2);
		const qParam = parameters.find((p) => p.name === "q");
		const limitParam = parameters.find((p) => p.name === "limit");

		expect(qParam?.in).toBe("query");
		expect(qParam?.required).toBe(true);
		expect(limitParam?.required).toBe(false);
	});

	test("should generate request body for POST routes", async () => {
		const router = new Router();

		router.post("/users", async ({ body, response }) => response.json(body), {
			schema: {
				body: z.object({
					name: z.string(),
					email: z.string().email(),
				}),
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);
		const operation = spec.paths["/users"].post as Record<string, unknown>;

		expect(operation.requestBody).toBeDefined();
		expect((operation.requestBody as Record<string, unknown>).required).toBe(true);

		const content = (operation.requestBody as Record<string, unknown>).content as Record<string, unknown>;
		expect(content["application/json"]).toBeDefined();

		const schema = (content["application/json"] as Record<string, unknown>).schema as Record<string, unknown>;
		expect(schema.type).toBe("object");
		expect(schema.properties).toHaveProperty("name");
		expect(schema.properties).toHaveProperty("email");
		expect(schema.required).toContain("name");
		expect(schema.required).toContain("email");
	});

	test("should generate responses from schema", async () => {
		const router = new Router();

		router.get("/users", async ({ response }) => response.json({ users: [] }), {
			schema: {
				response: {
					200: z.object({
						users: z.array(z.object({ id: z.string(), name: z.string() })),
					}),
					404: z.object({
						error: z.string(),
					}),
				},
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);
		const operation = spec.paths["/users"].get as Record<string, unknown>;

		expect(operation.responses).toBeDefined();
		expect((operation.responses as Record<string, unknown>)["200"]).toBeDefined();
		expect((operation.responses as Record<string, unknown>)["404"]).toBeDefined();
	});

	test("should add security for authenticated routes", async () => {
		const router = new Router();

		router.get("/profile", async ({ response }) => response.json({}), {
			auth: true,
			schema: {
				response: { 200: z.object({}) },
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);
		const operation = spec.paths["/profile"].get as Record<string, unknown>;

		expect(operation.security).toEqual([{ bearerAuth: [] }]);
	});

	test("should skip routes without schema", async () => {
		const router = new Router();

		router.get("/no-schema", async ({ response }) => response.json({}));
		router.get("/with-schema", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);

		expect(spec.paths["/no-schema"]).toBeUndefined();
		expect(spec.paths["/with-schema"]).toBeDefined();
	});

	test("should handle custom options", async () => {
		const router = new Router();

		router.get("/test", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router], {
			title: "My API",
			version: "2.0.0",
			description: "A test API",
		});

		expect(spec.info.title).toBe("My API");
		expect(spec.info.version).toBe("2.0.0");
		expect(spec.info.description).toBe("A test API");
	});

	test("should handle schema contributors", async () => {
		const router = new Router();

		router.get("/test", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router], {
			schemaContributors: [
				{
					paths: {
						"/external": {
							get: {
								operationId: "externalEndpoint",
								summary: "External endpoint",
							},
						},
					},
				},
			],
		});

		expect(spec.paths["/external"]).toBeDefined();
		expect(spec.paths["/test"]).toBeDefined();
	});

	test("should handle async schema contributors", async () => {
		const router = new Router();

		const spec = await generateOpenAPISpec("http://localhost:3000", [router], {
			schemaContributors: [
				async () => ({
					paths: {
						"/async": {
							get: {
								operationId: "asyncEndpoint",
							},
						},
					},
				}),
			],
		});

		expect(spec.paths["/async"]).toBeDefined();
	});

	test("should handle failed schema contributors gracefully", async () => {
		const router = new Router();

		router.get("/test", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		// Should not throw
		const spec = await generateOpenAPISpec("http://localhost:3000", [router], {
			schemaContributors: [
				() => {
					throw new Error("Contributor failed");
				},
			],
		});

		expect(spec.paths["/test"]).toBeDefined();
	});

	test("should generate unique operation IDs", async () => {
		const router1 = new Router();
		const router2 = new Router();

		router1.get("/users", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		router2.get("/users", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router1, router2]);

		// Second router overwrites first, but gets unique operation ID with suffix
		const operation = spec.paths["/users"].get as Record<string, unknown>;
		expect(operation.operationId).toMatch(/^usersGet\d*$/);
	});

	test("should handle multiple routers", async () => {
		const apiRouter = new Router();
		const adminRouter = new Router();

		apiRouter.get("/users", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		adminRouter.get("/admin/stats", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [apiRouter, adminRouter]);

		expect(spec.paths["/users"]).toBeDefined();
		expect(spec.paths["/admin/stats"]).toBeDefined();
	});

	test("should handle custom security schemes", async () => {
		const router = new Router();

		router.get("/test", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router], {
			securitySchemes: {
				apiKey: {
					type: "apiKey",
					in: "header",
					name: "X-API-Key",
				},
			},
		});

		expect(spec.components?.securitySchemes).toEqual({
			apiKey: {
				type: "apiKey",
				in: "header",
				name: "X-API-Key",
			},
		});
	});

	test("should handle component schemas from contributors", async () => {
		const router = new Router();

		const spec = await generateOpenAPISpec("http://localhost:3000", [router], {
			schemaContributors: [
				{
					components: {
						schemas: {
							User: {
								type: "object",
								properties: {
									id: { type: "string" },
								},
							},
						},
					},
				},
			],
		});

		expect(spec.components?.schemas).toHaveProperty("User");
	});
});

describe("createOpenAPIHandler", () => {
	test("should create handler with getSpec method", async () => {
		const router = new Router();

		router.get("/test", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		const handler = createOpenAPIHandler([router]);
		const spec = await handler.getSpec("http://localhost:3000");

		expect(spec.openapi).toBe("3.1.0");
		expect(spec.paths["/test"]).toBeDefined();
	});

	test("should create handler with handleSpec method", async () => {
		const router = new Router();

		router.get("/test", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		const handler = createOpenAPIHandler([router]);

		const request = new Request("http://localhost:3000/api/openapi.json");
		const response = await handler.handleSpec(request);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/json");

		const spec = await response.json();
		expect(spec.openapi).toBe("3.1.0");
	});

	test("should create handler with handleDocs method", () => {
		const router = new Router();
		const handler = createOpenAPIHandler([router]);

		const response = handler.handleDocs();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/html");

		// Check that it returns a promise, so just verify the response exists
		expect(response).toBeInstanceOf(Response);
	});

	test("should allow custom scalar.js URL", () => {
		const router = new Router();
		const handler = createOpenAPIHandler([router]);

		const response = handler.handleDocs("https://custom.url/scalar.js");

		expect(response.status).toBe(200);
	});

	test("should pass options to generated spec", async () => {
		const router = new Router();

		router.get("/test", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		const handler = createOpenAPIHandler([router], {
			title: "Custom Title",
			version: "3.0.0",
		});

		const spec = await handler.getSpec("http://localhost:3000");

		expect(spec.info.title).toBe("Custom Title");
		expect(spec.info.version).toBe("3.0.0");
	});
});

describe("OpenAPI edge cases", () => {
	test("should handle root path", async () => {
		const router = new Router();

		router.get("/", async ({ response }) => response.json({}), {
			schema: { response: { 200: z.object({}) } },
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);

		expect(spec.paths["/"]).toBeDefined();
		const operation = spec.paths["/"].get as Record<string, unknown>;
		expect(operation.operationId).toBe("getRoot");
	});

	test("should handle paths with hyphens and underscores", async () => {
		const router = new Router();

		router.get("/user-profiles/:user_id", async ({ response }) => response.json({}), {
			schema: {
				params: z.object({ user_id: z.string() }),
				response: { 200: z.object({}) },
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);

		expect(spec.paths["/user-profiles/{user_id}"]).toBeDefined();
		const operation = spec.paths["/user-profiles/{user_id}"].get as Record<string, unknown>;
		expect(typeof operation.operationId).toBe("string");
	});

	test("should handle ZodEffects schema", async () => {
		const router = new Router();

		router.post("/users", async ({ response }) => response.json({}), {
			schema: {
				body: z.object({ email: z.string() }).refine((data) => data.email.includes("@")),
				response: { 201: z.object({}) },
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);

		expect(spec.paths["/users"].post).toBeDefined();
	});

	test("should handle nullable fields", async () => {
		const router = new Router();

		router.get("/users", async ({ response }) => response.json({ name: null }), {
			schema: {
				response: {
					200: z.object({
						name: z.string().nullable(),
					}),
				},
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);

		expect(spec.paths["/users"].get).toBeDefined();
	});

	test("should handle default values", async () => {
		const router = new Router();

		router.get("/search", async ({ response }) => response.json({}), {
			schema: {
				query: z.object({
					limit: z.coerce.number().default(10),
				}),
				response: { 200: z.object({}) },
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);

		expect(spec.paths["/search"].get).toBeDefined();
	});

	test("should handle PUT and PATCH methods", async () => {
		const router = new Router();

		router.put("/users/:id", async ({ response }) => response.json({}), {
			schema: {
				body: z.object({ name: z.string() }),
				response: { 200: z.object({}) },
			},
		});

		router.patch("/users/:id", async ({ response }) => response.json({}), {
			schema: {
				body: z.object({ name: z.string() }),
				response: { 200: z.object({}) },
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);

		expect(spec.paths["/users/{id}"].put).toBeDefined();
		expect(spec.paths["/users/{id}"].patch).toBeDefined();

		const putOp = spec.paths["/users/{id}"].put as Record<string, unknown>;
		const patchOp = spec.paths["/users/{id}"].patch as Record<string, unknown>;

		expect(putOp.requestBody).toBeDefined();
		expect(patchOp.requestBody).toBeDefined();
	});

	test("should handle DELETE method", async () => {
		const router = new Router();

		router.delete("/users/:id", async ({ response }) => response.json({}), {
			schema: {
				params: z.object({ id: z.string() }),
				response: { 204: z.object({}) },
			},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);

		expect(spec.paths["/users/{id}"].delete).toBeDefined();
	});

	test("should default response to 200 if no response schema", async () => {
		const router = new Router();

		router.get("/test", async ({ response }) => response.json({}), {
			schema: {},
		});

		const spec = await generateOpenAPISpec("http://localhost:3000", [router]);

		expect(spec.paths["/test"].get).toBeDefined();
		const operation = spec.paths["/test"].get as Record<string, unknown>;
		expect((operation.responses as Record<string, unknown>)["200"]).toBeDefined();
	});
});
