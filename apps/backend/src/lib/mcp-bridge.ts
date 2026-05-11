import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Route, Router, RouteSchema } from "@reconned/router";
import { jsonResponse } from "@reconned/router";
import { z } from "zod";

type McpRouteMap = Map<string, { route: Route; method: string }>;

function singularize(word: string): string {
	if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
	if (word.endsWith("s") && !word.endsWith("ss") && word.length > 2) return word.slice(0, -1);
	return word;
}

function generateToolName(method: string, path: string): string {
	const prefixMap: Record<string, string> = {
		GET: "get",
		POST: "create",
		PUT: "update",
		DELETE: "delete",
		PATCH: "update",
	};
	const prefix = prefixMap[method] || "get";

	const parts = path
		.replace(/^\/api\//, "")
		.split("/")
		.filter(Boolean);
	const hasParams = parts.some((p) => p.startsWith(":"));

	const actualPrefix = method === "GET" && !hasParams ? "list" : prefix;

	const staticParts = parts.filter((p) => !p.startsWith(":"));
	const shouldSingularize = !(method === "GET" && !hasParams);
	const name = shouldSingularize ? staticParts.map(singularize).join("_") : staticParts.join("_");

	return `${actualPrefix}_${name}`;
}

function zodToJsonSchemaValue(schema: z.ZodTypeAny): Record<string, unknown> {
	const unwrapped =
		schema instanceof z.ZodOptional || schema instanceof z.ZodDefault || schema instanceof z.ZodNullable
			? ((schema._def as unknown as { innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny }).innerType ?? schema)
			: schema;
	const result: Record<string, unknown> = {};
	if (unwrapped instanceof z.ZodString) result.type = "string";
	else if (unwrapped instanceof z.ZodNumber) result.type = "number";
	else if (unwrapped instanceof z.ZodBoolean) result.type = "boolean";
	else if (unwrapped instanceof z.ZodArray) {
		result.type = "array";
		result.items = zodToJsonSchemaValue(unwrapped.element as unknown as z.ZodTypeAny);
	} else if (unwrapped instanceof z.ZodEnum) {
		result.type = "string";
		result.enum = unwrapped.options as string[];
	} else if (unwrapped instanceof z.ZodObject) {
		result.type = "object";
		const shape = unwrapped.shape as Record<string, z.ZodTypeAny>;
		const properties: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(shape)) {
			properties[key] = zodToJsonSchemaValue(value);
		}
		result.properties = properties;
	} else if (unwrapped instanceof z.ZodRecord) {
		result.type = "object";
		const def = unwrapped.def as unknown as { valueType?: z.ZodTypeAny };
		if (def.valueType) {
			result.additionalProperties = zodToJsonSchemaValue(def.valueType as unknown as z.ZodTypeAny);
		}
	} else if (unwrapped instanceof z.ZodDate) {
		result.type = "string";
		result.format = "date-time";
	} else if (unwrapped instanceof z.ZodLiteral) {
		result.type =
			typeof unwrapped.value === "string" ? "string" : typeof unwrapped.value === "number" ? "number" : "boolean";
	} else {
		result.type = "string";
	}

	const description = (schema._def as { description?: string }).description;
	if (description) result.description = description;
	return result;
}

function buildMcpInputSchema(schema?: RouteSchema): Tool["inputSchema"] {
	const properties: Record<string, object> = {};
	const required: string[] = [];

	const zodSchemas = [schema?.params, schema?.query, schema?.body].filter(Boolean) as z.ZodTypeAny[];

	for (const s of zodSchemas) {
		if (s instanceof z.ZodObject) {
			const shape = s.shape as Record<string, z.ZodTypeAny>;
			for (const [key, value] of Object.entries(shape)) {
				properties[key] = zodToJsonSchemaValue(value) as unknown as object;
				if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
					if (!required.includes(key)) required.push(key);
				}
			}
		}
	}

	return {
		type: "object",
		properties,
		...(required.length > 0 && { required }),
	} as Tool["inputSchema"];
}

function separateArgs(
	args: Record<string, unknown>,
	schema?: RouteSchema,
): { params: Record<string, unknown>; query: Record<string, unknown>; body: Record<string, unknown> } {
	const params: Record<string, unknown> = {};
	const query: Record<string, unknown> = {};
	const body: Record<string, unknown> = {};

	const paramKeys =
		schema?.params instanceof z.ZodObject
			? Object.keys((schema.params as z.ZodObject<Record<string, z.ZodTypeAny>>).shape)
			: [];
	const queryKeys =
		schema?.query instanceof z.ZodObject
			? Object.keys((schema.query as z.ZodObject<Record<string, z.ZodTypeAny>>).shape)
			: [];

	for (const [key, value] of Object.entries(args)) {
		if (paramKeys.includes(key)) params[key] = value;
		else if (queryKeys.includes(key)) query[key] = value;
		else body[key] = value;
	}

	return { params, query, body };
}

let cachedTools: Tool[] | null = null;
let cachedRouteMap: McpRouteMap | null = null;

function buildMcpToolCache(router: Router): { tools: Tool[]; routeMap: McpRouteMap } {
	const tools: Tool[] = [];
	const routeMap: McpRouteMap = new Map();

	for (const route of router.routes) {
		const config = route.schema?.mcpTool;
		if (!config) continue;

		const name =
			typeof config === "object" && config.name ? config.name : generateToolName(route.method, route.path);
		const description =
			typeof config === "object" && config.description
				? config.description
				: route.schema?.summary || route.schema?.description || "";

		const inputSchema = buildMcpInputSchema(route.schema);

		tools.push({ name, description, inputSchema });
		routeMap.set(name, { route, method: route.method });
	}

	return { tools, routeMap };
}

export function extractMcpTools(router: Router): Tool[] {
	if (cachedTools) return cachedTools;
	const result = buildMcpToolCache(router);
	cachedTools = result.tools;
	cachedRouteMap = result.routeMap;
	return result.tools;
}

export function invalidateMcpToolCache(): void {
	cachedTools = null;
	cachedRouteMap = null;
}

export async function executeMcpTool(
	toolName: string,
	args: Record<string, unknown>,
	user: { id: string; email: string; name: string; role?: string },
	router: Router,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
	if (!cachedRouteMap) {
		buildMcpToolCache(router);
	}

	const entry = cachedRouteMap?.get(toolName);
	if (!entry) {
		return {
			content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }],
			isError: true,
		};
	}

	const { route } = entry;

	const { params, query, body } = separateArgs(args, route.schema);

	let urlPath = route.path;
	for (const [key, value] of Object.entries(params)) {
		urlPath = urlPath.replace(`:${key}`, encodeURIComponent(String(value)));
	}

	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined) searchParams.set(key, String(value));
	}
	const queryString = searchParams.toString();
	const url = `http://localhost${urlPath}${queryString ? `?${queryString}` : ""}`;

	const headers = new Headers({ "Content-Type": "application/json" });
	const requestInit: RequestInit = { method: route.method, headers };
	if (Object.keys(body).length > 0 && ["POST", "PUT", "PATCH"].includes(route.method)) {
		requestInit.body = JSON.stringify(body);
	}
	const request = new Request(url, requestInit);

	const context = {
		user,
		session: { id: "mcp-session" },
		isAdmin: user.role === "admin",
		requestId: crypto.randomUUID(),
		requestStartTime: Date.now(),
	};

	try {
		const response = await router.handle(
			request,
			context,
			jsonResponse as (data: unknown, status?: number) => Response,
		);
		const data = await response.json();
		return {
			content: [{ type: "text", text: JSON.stringify(data) }],
			isError: response.status >= 400,
		};
	} catch (error) {
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({
						error: error instanceof Error ? error.message : "Internal error",
					}),
				},
			],
			isError: true,
		};
	}
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isWriteTool(toolName: string, _router: Router): boolean {
	if (!cachedRouteMap) return false;
	const entry = cachedRouteMap.get(toolName);
	if (!entry) return false;
	return WRITE_METHODS.has(entry.method);
}
