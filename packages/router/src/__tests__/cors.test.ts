import { describe, expect, test } from "bun:test";
import { addCORSHeaders, handleCORS } from "../cors";

describe("handleCORS", () => {
	test("should return null for non-OPTIONS requests", () => {
		const request = new Request("http://localhost/test", {
			method: "GET",
			headers: { origin: "http://localhost:3000" },
		});

		const result = handleCORS(request, ["http://localhost:3000"]);

		expect(result).toBeNull();
	});

	test("should return preflight response for OPTIONS requests", () => {
		const request = new Request("http://localhost/test", {
			method: "OPTIONS",
			headers: { origin: "http://localhost:3000" },
		});

		const result = handleCORS(request, ["http://localhost:3000"]);

		expect(result).not.toBeNull();
		expect(result?.status).toBe(204);
		expect(result?.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
		expect(result?.headers.get("Access-Control-Allow-Methods")).toContain("GET");
		expect(result?.headers.get("Access-Control-Allow-Methods")).toContain("POST");
		expect(result?.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	test("should not include origin header for disallowed origins", () => {
		const request = new Request("http://localhost/test", {
			method: "OPTIONS",
			headers: { origin: "http://evil.com" },
		});

		const result = handleCORS(request, ["http://localhost:3000"]);

		expect(result).not.toBeNull();
		expect(result?.status).toBe(204);
		expect(result?.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	test("should handle request without origin header", () => {
		const request = new Request("http://localhost/test", {
			method: "OPTIONS",
		});

		const result = handleCORS(request, ["http://localhost:3000"]);

		expect(result).not.toBeNull();
		expect(result?.status).toBe(204);
		expect(result?.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	test("should include allowed headers", () => {
		const request = new Request("http://localhost/test", {
			method: "OPTIONS",
			headers: { origin: "http://localhost:3000" },
		});

		const result = handleCORS(request, ["http://localhost:3000"]);

		const allowedHeaders = result?.headers.get("Access-Control-Allow-Headers");
		expect(allowedHeaders).toContain("Content-Type");
		expect(allowedHeaders).toContain("Authorization");
	});
});

describe("addCORSHeaders", () => {
	test("should add CORS headers for allowed origin", () => {
		const response = new Response("ok");
		const request = new Request("http://localhost/test", {
			headers: { origin: "http://localhost:3000" },
		});

		const result = addCORSHeaders(response, request, ["http://localhost:3000"]);

		expect(result.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
		expect(result.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	test("should not add CORS headers for disallowed origin", () => {
		const response = new Response("ok");
		const request = new Request("http://localhost/test", {
			headers: { origin: "http://evil.com" },
		});

		const result = addCORSHeaders(response, request, ["http://localhost:3000"]);

		expect(result.headers.get("Access-Control-Allow-Origin")).toBeNull();
		expect(result.headers.get("Access-Control-Allow-Credentials")).toBeNull();
	});

	test("should handle request without origin", () => {
		const response = new Response("ok");
		const request = new Request("http://localhost/test");

		const result = addCORSHeaders(response, request, ["http://localhost:3000"]);

		expect(result.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	test("should return same response object (mutated)", () => {
		const response = new Response("ok");
		const request = new Request("http://localhost/test", {
			headers: { origin: "http://localhost:3000" },
		});

		const result = addCORSHeaders(response, request, ["http://localhost:3000"]);

		expect(result).toBe(response);
	});

	test("should support multiple allowed origins", () => {
		const response = new Response("ok");
		const request = new Request("http://localhost/test", {
			headers: { origin: "http://example.com" },
		});

		const result = addCORSHeaders(response, request, [
			"http://localhost:3000",
			"http://example.com",
			"https://app.example.com",
		]);

		expect(result.headers.get("Access-Control-Allow-Origin")).toBe("http://example.com");
	});
});

describe("CORS integration", () => {
	test("should handle full CORS flow", () => {
		const allowedOrigins = ["http://localhost:3000"];

		// Preflight request
		const preflightRequest = new Request("http://localhost/api/users", {
			method: "OPTIONS",
			headers: { origin: "http://localhost:3000" },
		});

		const preflightResponse = handleCORS(preflightRequest, allowedOrigins);
		expect(preflightResponse).not.toBeNull();
		expect(preflightResponse?.status).toBe(204);

		// Actual request
		const actualResponse = new Response(JSON.stringify({ users: [] }), {
			headers: { "Content-Type": "application/json" },
		});
		const actualRequest = new Request("http://localhost/api/users", {
			headers: { origin: "http://localhost:3000" },
		});

		const finalResponse = addCORSHeaders(actualResponse, actualRequest, allowedOrigins);
		expect(finalResponse.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
	});
});
