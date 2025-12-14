import { join } from "node:path";
import { z } from "zod";
import { auth } from "./auth";
import { addCORSHeaders } from "./cors";
import type { Router } from "./router";
import { jsonResponse } from "./router";

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
			authPaths = schema.paths || {};
			authComponents = schema.components || {};

			// Tag all Better Auth routes with "Auth" tag and ensure unique operationIds
			// This includes all plugin endpoints (passkey, 2factor, onetap, etc.)
			for (const path in authPaths) {
				for (const method in authPaths[path]) {
					const operation = authPaths[path][method] as Record<string, unknown>;
					// Replace all tags with just "Auth" to group all auth-related endpoints together
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
		console.warn("Could not generate Better Auth OpenAPI schema:", error);
	}

	// Generate paths from routes
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
					parameters.push({
						name: key,
						in: "path",
						required: true,
						schema: z.toJSONSchema(zodValue, { target: "openapi-3.0" }),
					});
				}
			}

			if (route.schema.query) {
				const querySchema = route.schema.query as z.ZodObject<z.ZodRawShape>;
				for (const [key, value] of Object.entries(querySchema.shape)) {
					const zodValue = value as unknown as z.ZodTypeAny;
					parameters.push({
						name: key,
						in: "query",
						required: !zodValue.isOptional(),
						schema: z.toJSONSchema(zodValue, { target: "openapi-3.0" }),
					});
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
				if (unwrappedSchema instanceof z.ZodObject) {
					const properties: Record<string, unknown> = {};
					const required: string[] = [];

					for (const [key, value] of Object.entries(unwrappedSchema.shape)) {
						const zodValue = value as unknown as z.ZodTypeAny;
						const fieldSchema = z.toJSONSchema(zodValue, { target: "openapi-3.0" }) as Record<
							string,
							unknown
						>;

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
					jsonSchema = z.toJSONSchema(unwrappedSchema as unknown as z.ZodTypeAny, {
						target: "openapi-3.0",
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
					const statusCode = Number.parseInt(status, 10);
					if (!Number.isNaN(statusCode)) {
						responses[status] = {
							description: getStatusDescription(statusCode),
							content: {
								"application/json": {
									schema: z.toJSONSchema(zodSchema, { target: "openapi-3.0" }),
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

function getSwaggerUIHtml(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Reconned API Documentation</title>
	<link rel="stylesheet" type="text/css" href="/api/docs/swagger-ui.css" />
	<link rel="stylesheet" type="text/css" href="/api/docs/index.css" />
	<style>
		html {
			box-sizing: border-box;
			overflow: -moz-scrollbars-vertical;
			overflow-y: scroll;
		}
		*, *:before, *:after {
			box-sizing: inherit;
		}
		body {
			margin:0;
			background: #fafafa;
		}
	</style>
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="/api/docs/swagger-ui-bundle.js" charset="UTF-8"></script>
	<script src="/api/docs/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
	<script>
		window.onload = function() {
			window.ui = SwaggerUIBundle({
				url: "/api/openapi.json",
				dom_id: "#swagger-ui",
				presets: [
					SwaggerUIBundle.presets.apis,
					SwaggerUIStandalonePreset
				],
				layout: "StandaloneLayout",
				deepLinking: true,
				showExtensions: true,
				showCommonExtensions: true,
				tryItOutEnabled: true
			});
		};
	</script>
</body>
</html>`;
}

async function handleSwaggerUIAsset(pathname: string): Promise<Response | null> {
	if (!pathname.startsWith("/api/docs/") || pathname === "/api/docs" || pathname === "/api/docs/") {
		return null;
	}

	const assetPath = pathname.replace("/api/docs/", "");
	try {
		const swaggerUiPath = join(process.cwd(), "node_modules", "swagger-ui-dist", assetPath);
		const file = Bun.file(swaggerUiPath);
		if (await file.exists()) {
			return new Response(file, {
				headers: {
					"Cache-Control": "public, max-age=31536000",
				},
			});
		}
	} catch {
		// Fall through to null
	}
	return null;
}

async function handleOpenAPISpec(request: Request, routers: Router[], corsOrigins: string[]): Promise<Response> {
	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;
	const spec = await generateOpenAPISpec(baseUrl, routers);
	return addCORSHeaders(jsonResponse(spec), request, corsOrigins);
}

export async function handleOpenAPIRoutes(
	request: Request,
	routers: Router[],
	corsOrigins: string[],
): Promise<Response | null> {
	const url = new URL(request.url);
	const pathname = url.pathname;

	// Handle Swagger UI HTML page
	if (pathname === "/api/docs" || pathname === "/api/docs/") {
		return new Response(getSwaggerUIHtml(), {
			headers: {
				"Content-Type": "text/html",
			},
		});
	}

	// Handle Swagger UI static assets
	const assetResponse = await handleSwaggerUIAsset(pathname);
	if (assetResponse) {
		return assetResponse;
	}

	// Handle OpenAPI spec endpoint
	if (pathname === "/api/openapi.json") {
		return handleOpenAPISpec(request, routers, corsOrigins);
	}

	return null;
}
