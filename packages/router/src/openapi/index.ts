import * as z from "zod";
import type { Router } from "../router";
import type { OpenAPIOptions, OpenAPISpec } from "../types";

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
				const cleanPart = part.replace(/^[:{]|}$/g, "");
				return cleanPart
					.split(/[-_]/)
					.map((word, idx) => (idx === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
					.join("");
			})
			.join("") + methodCapitalized;

	return operationId.charAt(0).toLowerCase() + operationId.slice(1);
}

function getStatusDescription(status: number): string {
	const descriptions: Record<number, string> = {
		200: "Success",
		201: "Created",
		204: "No Content",
		400: "Bad Request",
		401: "Unauthorized",
		403: "Forbidden",
		404: "Not Found",
		409: "Conflict",
		429: "Too Many Requests",
		500: "Internal Server Error",
	};
	return descriptions[status] || "Response";
}

export async function generateOpenAPISpec(
	baseUrl: string,
	routers: Router[],
	options: OpenAPIOptions = {},
): Promise<OpenAPISpec> {
	const usedOperationIds = new Set<string>();
	const paths: Record<string, Record<string, unknown>> = {};
	const components: Record<string, unknown> = {};

	if (options.schemaContributors) {
		for (const contributor of options.schemaContributors) {
			try {
				const result = typeof contributor === "function" ? await contributor() : contributor;

				if (result.paths) {
					for (const [path, methods] of Object.entries(result.paths)) {
						const normalizedPath = path.startsWith("/") ? path : `/${path}`;

						if (!paths[normalizedPath]) {
							paths[normalizedPath] = {};
						}

						for (const [method, operation] of Object.entries(methods as Record<string, unknown>)) {
							const op = operation as Record<string, unknown>;

							let operationId = (op.operationId as string) || generateOperationId(normalizedPath, method);
							let suffix = 1;
							const originalOperationId = operationId;
							while (usedOperationIds.has(operationId)) {
								operationId = `${originalOperationId}${suffix}`;
								suffix++;
							}
							op.operationId = operationId;
							usedOperationIds.add(operationId);

							paths[normalizedPath][method] = op;
						}
					}
				}

				if (result.components) {
					for (const [key, value] of Object.entries(result.components)) {
						if (!components[key]) {
							components[key] = {};
						}
						Object.assign(components[key] as Record<string, unknown>, value);
					}
				}
			} catch {
				// Skip failed contributors
			}
		}
	}

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

			if (route.schema.body && (method === "post" || method === "put" || method === "patch")) {
				const bodySchema = route.schema.body;
				let unwrappedSchema = bodySchema;
				let isOptional = false;

				if (bodySchema instanceof z.ZodOptional) {
					unwrappedSchema = bodySchema._def.innerType as z.ZodTypeAny;
					isOptional = true;
				} else if (bodySchema instanceof z.ZodDefault) {
					unwrappedSchema = bodySchema._def.innerType as z.ZodTypeAny;
					isOptional = true;
				}

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

			if (route.auth) {
				operation.security = [{ bearerAuth: [] }];
			}

			paths[openapiPath][method] = operation;
		}
	}

	const spec: OpenAPISpec = {
		openapi: "3.1.0",
		info: {
			title: options.title || "API",
			version: options.version || "1.0.0",
			description: options.description,
		},
		servers: [
			{
				url: baseUrl,
				description: "API Server",
			},
		],
		paths,
		components: {
			securitySchemes: options.securitySchemes || {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
				},
			},
			...(components.schemas ? { schemas: components.schemas as Record<string, unknown> } : {}),
		},
	};

	return spec;
}

export function createOpenAPIHandler(routers: Router[], options: OpenAPIOptions = {}) {
	return {
		async getSpec(baseUrl: string): Promise<OpenAPISpec> {
			return generateOpenAPISpec(baseUrl, routers, options);
		},

		async handleSpec(request: Request): Promise<Response> {
			const url = new URL(request.url);
			const protocol = process.env.NODE_ENV === "production" ? "https:" : url.protocol;
			const baseUrl = `${protocol}//${url.host}/api`;
			const spec = await this.getSpec(baseUrl);
			return new Response(JSON.stringify(spec), {
				headers: { "Content-Type": "application/json" },
			});
		},

		handleDocs(scalarJsUrl = "https://cdn.jsdelivr.net/npm/@scalar/api-reference"): Response {
			const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>API Documentation</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
	<script id="api-reference" data-url="/api/openapi.json"></script>
	<script src="${scalarJsUrl}"></script>
</body>
</html>`;
			return new Response(html, {
				headers: { "Content-Type": "text/html" },
			});
		},
	};
}
