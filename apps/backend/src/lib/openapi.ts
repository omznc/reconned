import { join } from "node:path";
import type { Router } from "@reconned/router";
import { addCORSHeaders, jsonResponse } from "@reconned/router";
import * as z from "zod";
import { auth } from "./auth";
import { logger } from "./posthog";
export interface OpenAPISpec {
	openapi: string;
	info: {
		title: string;
		version: string;
		description?: string;
	};
	servers: Array<{ url: string; description?: string }>;
	paths: Record<string, Record<string, unknown>>;
	components?: {
		schemas?: Record<string, unknown>;
		securitySchemes?: Record<string, unknown>;
	};
}

function unwrapForJSONSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
	let current = schema;
	while (true) {
		const def = (
			current as {
				_def?: {
					typeName?: string;
					effect?: { type?: string };
					innerType?: z.ZodTypeAny;
					schema?: z.ZodTypeAny;
				};
			}
		)._def;

		if (!def) {
			break;
		}

		const typeName = def.typeName;

		if (typeName === "ZodOptional" && def.innerType) {
			current = def.innerType;
		} else if (typeName === "ZodDefault" && def.innerType) {
			current = def.innerType;
		} else if (typeName === "ZodNullable" && def.innerType) {
			current = def.innerType;
		} else if (typeName === "ZodEffects" && def.schema) {
			current = def.schema;
		} else {
			break;
		}
	}
	return current;
}

function generateOperationId(path: string, method: string): string {
	// Convert path like /api/users/:id to usersGetById
	const pathParts = path
		.replace(/^\/api\//, "")
		.replace(/\/$/, "")
		.split("/")
		.filter(Boolean);

	const methodCapitalized = method.charAt(0).toUpperCase() + method.slice(1);

	if (pathParts.length === 0) {
		return `${method}Root`;
	}

	const operationId =
		pathParts
			.map((part) => {
				// Remove path parameters like {id} or :id
				const cleanPart = part.replace(/^[:{]|}$/g, "");
				// Convert kebab-case or snake_case to camelCase
				return cleanPart
					.split(/[-_]/)
					.map((word, idx) => (idx === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
					.join("");
			})
			.join("") + methodCapitalized;

	return operationId.charAt(0).toLowerCase() + operationId.slice(1);
}

export async function generateOpenAPISpec(baseUrl: string, routers: Router[]): Promise<OpenAPISpec> {
	// Get Better Auth OpenAPI schema if available
	let authPaths: Record<string, Record<string, unknown>> = {};
	let authComponents: Record<string, unknown> = {};
	const usedOperationIds = new Set<string>();

	try {
		const authSchema = await auth.api.generateOpenAPISchema();
		if (authSchema) {
			const schema = authSchema as unknown as {
				paths?: Record<string, Record<string, unknown>>;
				components?: Record<string, unknown>;
			};

			const originalPaths = (schema.paths || {}) as Record<string, Record<string, unknown>>;
			const prefixedAuthPaths: Record<string, Record<string, unknown>> = {};

			for (const [path, methods] of Object.entries(originalPaths)) {
				const normalizedPath = path.startsWith("/") ? path : `/${path}`;
				const prefixedPath =
					normalizedPath === "/auth" || normalizedPath.startsWith("/auth/")
						? normalizedPath
						: `/auth${normalizedPath}`;
				prefixedAuthPaths[prefixedPath] = methods;
			}

			authPaths = prefixedAuthPaths;
			authComponents = schema.components || {};

			for (const path in authPaths) {
				for (const method in authPaths[path]) {
					const operation = authPaths[path][method] as Record<string, unknown>;
					operation.tags = ["Auth"];

					// Ensure unique operationId
					let operationId = (operation.operationId as string) || generateOperationId(path, method);
					let suffix = 1;
					const originalOperationId = operationId;
					while (usedOperationIds.has(operationId)) {
						operationId = `${originalOperationId}${suffix}`;
						suffix++;
					}
					operation.operationId = operationId;
					usedOperationIds.add(operationId);
				}
			}
		}
	} catch (error) {
		logger.emit({
			severityText: "warn",
			body: "Could not generate Better Auth OpenAPI schema",
			attributes: {
				error: error instanceof Error ? error.message : String(error),
			},
		});
	}

	const paths: Record<string, Record<string, unknown>> = { ...authPaths };

	for (const router of routers) {
		for (const route of router.routes) {
			if (!route.schema) {
				continue;
			}

			const openapiPath = route.path.replace(/:([^/]+)/g, "{$1}");
			const method = route.method.toLowerCase();

			if (!paths[openapiPath]) {
				paths[openapiPath] = {};
			}

			// Generate unique operationId
			let operationId = generateOperationId(openapiPath, method);
			let suffix = 1;
			const originalOperationId = operationId;
			while (usedOperationIds.has(operationId)) {
				operationId = `${originalOperationId}${suffix}`;
				suffix++;
			}
			usedOperationIds.add(operationId);

			const operation: Record<string, unknown> = {
				operationId,
				tags: route.schema.tags || [],
				summary: route.schema.summary,
				description: route.schema.description,
			};

			// Add parameters
			const parameters: Array<Record<string, unknown>> = [];

			if (route.schema.params) {
				const paramSchema = route.schema.params as z.ZodObject<z.ZodRawShape>;
				for (const [key, value] of Object.entries(paramSchema.shape)) {
					const zodValue = value as unknown as z.ZodTypeAny;
					const unwrapped = unwrapForJSONSchema(zodValue);
					parameters.push({
						name: key,
						in: "path",
						required: true,
						schema: z.toJSONSchema(unwrapped, { target: "openapi-3.0", unrepresentable: "any" }),
					});
				}
			}

			if (route.schema.query) {
				const unwrappedQuery = unwrapForJSONSchema(route.schema.query);
				const querySchema = unwrappedQuery as z.ZodObject<z.ZodRawShape>;
				if (querySchema.shape) {
					for (const [key, value] of Object.entries(querySchema.shape)) {
						const zodValue = value as unknown as z.ZodTypeAny;
						const unwrapped = unwrapForJSONSchema(zodValue);
						parameters.push({
							name: key,
							in: "query",
							required: !zodValue.isOptional(),
							schema: z.toJSONSchema(unwrapped, { target: "openapi-3.0", unrepresentable: "any" }),
						});
					}
				}
			}

			if (parameters.length > 0) {
				operation.parameters = parameters;
			}

			// Add request body
			if (route.schema.body && (method === "post" || method === "put" || method === "patch")) {
				const bodySchema = route.schema.body;
				// Check if schema is optional or has default (not required)
				let unwrappedSchema = bodySchema;
				let isOptional = false;

				// Unwrap optional or default wrappers
				if (bodySchema instanceof z.ZodOptional) {
					unwrappedSchema = bodySchema._def.innerType as z.ZodTypeAny;
					isOptional = true;
				} else if (bodySchema instanceof z.ZodDefault) {
					unwrappedSchema = bodySchema._def.innerType as z.ZodTypeAny;
					isOptional = true;
				}

				// Generate JSON schema - manually build for ZodObject
				let jsonSchema: unknown;
				const fullyUnwrapped = unwrapForJSONSchema(unwrappedSchema);
				if (fullyUnwrapped instanceof z.ZodObject) {
					const properties: Record<string, unknown> = {};
					const required: string[] = [];

					for (const [key, value] of Object.entries(fullyUnwrapped.shape)) {
						const zodValue = value as unknown as z.ZodTypeAny;
						const fieldUnwrapped = unwrapForJSONSchema(zodValue);
						const fieldSchema = z.toJSONSchema(fieldUnwrapped, {
							target: "openapi-3.0",
							unrepresentable: "any",
						}) as Record<string, unknown>;

						properties[key] = fieldSchema;
						if (!(value instanceof z.ZodOptional || value instanceof z.ZodDefault)) {
							required.push(key);
						}
					}

					jsonSchema = {
						type: "object",
						properties,
						...(required.length > 0 && { required }),
					};
				} else {
					jsonSchema = z.toJSONSchema(fullyUnwrapped, {
						target: "openapi-3.0",
						unrepresentable: "any",
					});
				}

				operation.requestBody = {
					required: !isOptional,
					content: {
						"application/json": {
							schema: jsonSchema,
						},
					},
				};
			}

			// Add responses
			const responses: Record<string, unknown> = {};
			if (route.schema.response) {
				for (const [status, schema] of Object.entries(route.schema.response)) {
					const zodSchema = schema as unknown as z.ZodTypeAny;
					const unwrapped = unwrapForJSONSchema(zodSchema);
					const statusCode = Number.parseInt(status, 10);
					if (!Number.isNaN(statusCode)) {
						responses[status] = {
							description: getStatusDescription(statusCode),
							content: {
								"application/json": {
									schema: z.toJSONSchema(unwrapped, {
										target: "openapi-3.0",
										unrepresentable: "any",
									}),
								},
							},
						};
					}
				}
			} else {
				// Default 200 response
				responses["200"] = {
					description: "Success",
					content: {
						"application/json": {
							schema: { type: "object" },
						},
					},
				};
			}

			operation.responses = responses;

			// Add security if auth required
			if (route.auth) {
				operation.security = [{ bearerAuth: [] }];
			}

			paths[openapiPath][method] = operation;
		}
	}

	// Merge with Better Auth components
	const components = {
		schemas: {
			...((authComponents.schemas as Record<string, unknown>) || {}),
		},
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
			},
			...((authComponents.securitySchemes as Record<string, unknown>) || {}),
		},
	};

	return {
		openapi: "3.1.0",
		info: {
			title: "Reconned API",
			version: "1.0.0",
			description: "API documentation for Reconned backend",
		},
		servers: [
			{
				url: baseUrl,
				description: "API Server",
			},
		],
		paths,
		components,
	};
}

function getStatusDescription(status: number): string {
	const descriptions: Record<number, string> = {
		200: "Success",
		201: "Created",
		400: "Bad Request",
		401: "Unauthorized",
		403: "Forbidden",
		404: "Not Found",
		500: "Internal Server Error",
	};
	return descriptions[status] || "Response";
}

async function handleScalarUIAsset(pathname: string): Promise<Response | null> {
	if (pathname !== "/api/docs/scalar.js") {
		return null;
	}

	try {
		const scalarPath = join(
			process.cwd(),
			"node_modules",
			"@scalar/api-reference",
			"dist",
			"browser",
			"standalone.js",
		);
		const file = Bun.file(scalarPath);
		if (await file.exists()) {
			return new Response(file, {
				headers: {
					"Content-Type": "application/javascript",
					"Cache-Control": "public, max-age=31536000",
				},
			});
		}
	} catch {
		// Fall through to null
	}
	return null;
}

function getScalarHtml(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Reconned API Documentation</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
	<script
		id="api-reference"
		data-url="/api/openapi.json"
	></script>
	<script src="/api/docs/scalar.js"></script>
</body>
</html>`;
}

/**
 * The spec is static after boot — routes and their Zod schemas never change at runtime — but
 * generating it means walking ~200 routes through Zod→JSON-Schema plus a better-auth schema
 * build. The endpoint is unauthenticated, so regenerating per request is a free CPU-DoS.
 *
 * Memoized per base URL (the URL is derived from the request host, so it is part of the output).
 * We cache the in-flight promise rather than the result so a burst of concurrent first requests
 * triggers exactly one generation. The cached object is serialized fresh each time, so the JSON
 * emitted is byte-identical to before — the build/predev type generation is unaffected.
 */
const specCache = new Map<string, Promise<unknown>>();

async function handleOpenAPISpec(request: Request, routers: Router[], corsOrigins: string[]): Promise<Response> {
	const url = new URL(request.url);
	const protocol = process.env.NODE_ENV === "production" ? "https:" : url.protocol;
	const baseUrl = `${protocol}//${url.host}/api`;

	let pending = specCache.get(baseUrl);
	if (!pending) {
		pending = generateOpenAPISpec(baseUrl, routers).catch((error) => {
			// Never cache a failure — the next request should retry.
			specCache.delete(baseUrl);
			throw error;
		});
		specCache.set(baseUrl, pending);
	}

	const spec = await pending;
	return addCORSHeaders(jsonResponse(spec), request, corsOrigins);
}

export async function handleOpenAPIRoutes(
	request: Request,
	routers: Router[],
	corsOrigins: string[],
): Promise<Response | null> {
	const url = new URL(request.url);
	const pathname = url.pathname;

	// Handle Scalar API Reference HTML page
	if (pathname === "/api/docs" || pathname === "/api/docs/") {
		return new Response(getScalarHtml(), {
			headers: {
				"Content-Type": "text/html",
			},
		});
	}

	// Handle Scalar UI static assets
	const assetResponse = await handleScalarUIAsset(pathname);
	if (assetResponse) {
		return assetResponse;
	}

	// Handle OpenAPI spec endpoint
	if (pathname === "/api/openapi.json") {
		return handleOpenAPISpec(request, routers, corsOrigins);
	}

	return null;
}
