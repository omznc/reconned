import type { ApiKey } from "@better-auth/api-key";
import { apiError, Router } from "@reconned/router";
import * as z from "zod";
import { auth } from "../lib/auth";

const MAX_API_KEYS_PER_USER = 10;

type ListApiKeysFn = (options: { headers: Headers }) => Promise<{
	apiKeys: Omit<ApiKey, "key">[];
	total: number;
	limit?: number;
	offset?: number;
}>;

type CreateApiKeyFn = (options: { body: { name?: string; userId?: string }; headers: Headers }) => Promise<{
	key: string;
	metadata: unknown;
	permissions: unknown;
	id: string;
	name: string | null;
	start: string | null;
	prefix: string | null;
	userId: string;
	refillInterval: number | null;
	refillAmount: number | null;
	lastRefillAt: Date | null;
	enabled: boolean;
	rateLimitEnabled: boolean;
	rateLimitTimeWindow: number | null;
	rateLimitMax: number | null;
	requestCount: number;
	remaining: number | null;
	lastRequest: Date | null;
	expiresAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}>;

type DeleteApiKeyFn = (options: { body: { keyId: string }; headers: Headers }) => Promise<{ success: boolean }>;

export const apiKeysRouter = new Router();

apiKeysRouter.get(
	"/api-keys",
	async ({ response, context, request }) => {
		if (!context.user) {
			throw apiError.unauthorized("Authentication required");
		}

		const result = await (auth.api.listApiKeys as unknown as ListApiKeysFn)({
			headers: request.headers,
		});

		return response.json(result);
	},
	{
		auth: true,
		schema: {
			tags: ["API Keys"],
			summary: "List API keys",
			description: "List all API keys for the current user",
			response: {
				200: z.object({
					apiKeys: z.array(z.record(z.string(), z.any())),
					total: z.number(),
					limit: z.number().optional(),
					offset: z.number().optional(),
				}),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

apiKeysRouter.post(
	"/api-keys",
	async ({ response, context, body, request }) => {
		if (!context.user) {
			throw apiError.unauthorized("Authentication required");
		}

		const existing = await (auth.api.listApiKeys as unknown as ListApiKeysFn)({
			headers: request.headers,
		});

		if (existing.apiKeys.length >= MAX_API_KEYS_PER_USER) {
			throw apiError.validation(`Maximum of ${MAX_API_KEYS_PER_USER} API keys allowed`);
		}

		const apiKey = await (auth.api.createApiKey as unknown as CreateApiKeyFn)({
			body: {
				name: body.name,
				userId: context.user.id,
			},
			headers: request.headers,
		});

		return response.json(apiKey);
	},
	{
		auth: true,
		schema: {
			tags: ["API Keys"],
			summary: "Create API key",
			description: "Create a new API key for the current user",
			body: z.object({
				name: z.string().min(1).max(50),
			}),
			response: {
				200: z.record(z.string(), z.any()),
				401: z.object({ error: z.string() }),
				400: z.object({ error: z.string() }),
			},
		},
	},
);

apiKeysRouter.post(
	"/api-keys/:id/revoke",
	async ({ params, response, context, request }) => {
		if (!context.user) {
			throw apiError.unauthorized("Authentication required");
		}

		const keyId = params.id;
		if (!keyId) {
			throw apiError.validation("API key ID is required");
		}

		await (auth.api.deleteApiKey as unknown as DeleteApiKeyFn)({
			body: {
				keyId,
			},
			headers: request.headers,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["API Keys"],
			summary: "Revoke API key",
			description: "Revoke an API key by ID",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);
