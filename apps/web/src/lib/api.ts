import createClient from "openapi-fetch";
import type { paths } from "./api-types";
import { env } from "./env";

/**
 * Typesafe API client for the backend.
 *
 * Usage example:
 * ```ts
 * import apiClient from "@/lib/api";
 *
 * // GET request
 * const { data, error } = await apiClient.GET("/api/countries");
 * if (error) {
 *   // Handle error
 * }
 *
 * // POST request with body
 * const { data, error } = await apiClient.POST("/api/users", {
 *   body: { name: "John", email: "john@example.com" }
 * });
 *
 * // GET request with params
 * const { data, error } = await apiClient.GET("/api/users/{id}", {
 *   params: { path: { id: "123" } }
 * });
 * ```
 *
 * To regenerate types after backend changes:
 * ```bash
 * bun run api:generate-types
 * ```
 *
 * Note: Some endpoints use `passthrough()` schemas which result in `{ [key: string]: unknown }` types.
 * These should be updated in the backend to use explicit Zod schemas for proper type inference.
 */
export const apiClient = createClient<paths>({
	baseUrl: env.NEXT_PUBLIC_BACKEND_URL,
	credentials: "include",
});

/**
 * Helper type to extract the response data type from an API endpoint.
 *
 * @example
 * ```ts
 * type UserResponse = ApiResponse<"/api/users/{id}", "get">;
 * ```
 */
type ExtractJsonResponse<T> = T extends { responses: { 200: { content: { "application/json": infer U } } } }
	? U
	: never;

export type ApiResponse<Path extends keyof paths, Method extends keyof paths[Path]> = ExtractJsonResponse<
	paths[Path][Method]
>;

export default apiClient;
