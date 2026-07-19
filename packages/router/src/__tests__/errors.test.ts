import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { AppError, apiError, assert, ErrorCodes, formatErrorResponse, formatZodError } from "../errors";

describe("ErrorCodes", () => {
	test("should have all expected error codes", () => {
		expect(ErrorCodes.UNAUTHORIZED).toBe("UNAUTHORIZED");
		expect(ErrorCodes.FORBIDDEN).toBe("FORBIDDEN");
		expect(ErrorCodes.TOKEN_EXPIRED).toBe("TOKEN_EXPIRED");
		expect(ErrorCodes.INVALID_CREDENTIALS).toBe("INVALID_CREDENTIALS");
		expect(ErrorCodes.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
		expect(ErrorCodes.INVALID_INPUT).toBe("INVALID_INPUT");
		expect(ErrorCodes.MISSING_REQUIRED_FIELD).toBe("MISSING_REQUIRED_FIELD");
		expect(ErrorCodes.NOT_FOUND).toBe("NOT_FOUND");
		expect(ErrorCodes.CONFLICT).toBe("CONFLICT");
		expect(ErrorCodes.ALREADY_EXISTS).toBe("ALREADY_EXISTS");
		expect(ErrorCodes.RATE_LIMITED).toBe("RATE_LIMITED");
		expect(ErrorCodes.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
		expect(ErrorCodes.DATABASE_ERROR).toBe("DATABASE_ERROR");
		expect(ErrorCodes.EXTERNAL_SERVICE_ERROR).toBe("EXTERNAL_SERVICE_ERROR");
		expect(ErrorCodes.BUSINESS_RULE_VIOLATION).toBe("BUSINESS_RULE_VIOLATION");
		expect(ErrorCodes.INSUFFICIENT_PERMISSIONS).toBe("INSUFFICIENT_PERMISSIONS");
		expect(ErrorCodes.OPERATION_NOT_ALLOWED).toBe("OPERATION_NOT_ALLOWED");
	});
});

describe("AppError", () => {
	test("should create error with all properties", () => {
		const error = new AppError("TEST_ERROR", "Test message", 400, { field: "email" });

		expect(error.name).toBe("AppError");
		expect(error.code).toBe("TEST_ERROR");
		expect(error.message).toBe("Test message");
		expect(error.statusCode).toBe(400);
		expect(error.details).toEqual({ field: "email" });
	});

	test("should create error with cause", () => {
		const cause = new Error("Original error");
		const error = new AppError("TEST_ERROR", "Test message", 500, undefined, cause);

		expect(error.cause).toBe(cause);
	});

	test("should be instance of Error", () => {
		const error = new AppError("TEST_ERROR", "Test message", 400);

		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(AppError);
	});
});

describe("apiError factory", () => {
	test("should create unauthorized error", () => {
		const error = apiError.unauthorized();

		expect(error.code).toBe("UNAUTHORIZED");
		expect(error.statusCode).toBe(401);
		expect(error.message).toBe("Authentication required");
	});

	test("should create unauthorized error with custom message", () => {
		const error = apiError.unauthorized("Token expired");

		expect(error.message).toBe("Token expired");
	});

	test("should create unauthorized error with details", () => {
		const error = apiError.unauthorized("Token expired", { reason: "expired" });

		expect(error.details).toEqual({ reason: "expired" });
	});

	test("should create forbidden error", () => {
		const error = apiError.forbidden("Admin access required");

		expect(error.code).toBe("FORBIDDEN");
		expect(error.statusCode).toBe(403);
		expect(error.message).toBe("Admin access required");
	});

	test("should create not found error", () => {
		const error = apiError.notFound("User");

		expect(error.code).toBe("NOT_FOUND");
		expect(error.statusCode).toBe(404);
		expect(error.message).toBe("User not found");
	});

	test("should create validation error", () => {
		const error = apiError.validation("Invalid email format");

		expect(error.code).toBe("VALIDATION_ERROR");
		expect(error.statusCode).toBe(400);
		expect(error.message).toBe("Invalid email format");
	});

	test("should create conflict error", () => {
		const error = apiError.conflict("Email already registered");

		expect(error.code).toBe("CONFLICT");
		expect(error.statusCode).toBe(409);
		expect(error.message).toBe("Email already registered");
	});

	test("should create rate limited error", () => {
		const error = apiError.rateLimited("Too many login attempts");

		expect(error.code).toBe("RATE_LIMITED");
		expect(error.statusCode).toBe(429);
		expect(error.message).toBe("Too many login attempts");
	});

	test("should create internal error", () => {
		const cause = new Error("Database connection failed");
		const error = apiError.internal("Something went wrong", { operation: "save" }, cause);

		expect(error.code).toBe("INTERNAL_ERROR");
		expect(error.statusCode).toBe(500);
		expect(error.message).toBe("Something went wrong");
		expect(error.details).toEqual({ operation: "save" });
		expect(error.cause).toBe(cause);
	});

	test("should create database error", () => {
		const cause = new Error("Connection timeout");
		const error = apiError.database("Query failed", { query: "SELECT *" }, cause);

		expect(error.code).toBe("DATABASE_ERROR");
		expect(error.statusCode).toBe(500);
		expect(error.cause).toBe(cause);
	});
});

describe("formatErrorResponse", () => {
	test("should format AppError", () => {
		const error = new AppError("TEST_ERROR", "Test message", 400, { field: "email" });
		const response = formatErrorResponse(error);

		expect(response).toEqual({
			error: {
				code: "TEST_ERROR",
				message: "Test message",
				details: { field: "email" },
			},
		});
	});

	test("should format AppError without details", () => {
		const error = new AppError("TEST_ERROR", "Test message", 400);
		const response = formatErrorResponse(error);

		expect(response).toEqual({
			error: {
				code: "TEST_ERROR",
				message: "Test message",
			},
		});
	});

	test("should format generic Error", () => {
		const error = new Error("Something went wrong");
		const response = formatErrorResponse(error);

		expect(response.error.code).toBe("INTERNAL_ERROR");
		expect(response.error.message).toBe("Something went wrong");
	});

	test("should format non-Error objects", () => {
		const response = formatErrorResponse("String error");

		expect(response.error.code).toBe("INTERNAL_ERROR");
		expect(response.error.message).toBe("An unexpected error occurred");
	});

	test("should format null/undefined", () => {
		const response = formatErrorResponse(null);

		expect(response.error.code).toBe("INTERNAL_ERROR");
		expect(response.error.message).toBe("An unexpected error occurred");
	});
});

describe("formatZodError", () => {
	test("should format Zod validation error", () => {
		const schema = z.object({
			email: z.string().email(),
			age: z.number().min(18),
		});

		const result = schema.safeParse({ email: "invalid", age: 10 });
		if (!result.success) {
			const formatted = formatZodError(result.error);

			expect(formatted.code).toBe("VALIDATION_ERROR");
			expect(formatted.message).toBe("Validation failed");
			expect(formatted.details).toBeInstanceOf(Array);
			expect(formatted.details.length).toBeGreaterThan(0);
		}
	});

	test("should handle nested path in error", () => {
		const schema = z.object({
			user: z.object({
				email: z.string().email(),
			}),
		});

		const result = schema.safeParse({ user: { email: "invalid" } });
		if (!result.success) {
			const formatted = formatZodError(result.error);

			const emailError = formatted.details.find((d) => d.path.includes("email"));
			expect(emailError).toBeDefined();
		}
	});

	test("should use 'root' for empty path", () => {
		const schema = z.string().email();
		const result = schema.safeParse("invalid");

		if (!result.success) {
			const formatted = formatZodError(result.error);
			expect(formatted.details[0].path).toBe("root");
		}
	});
});

describe("assert", () => {
	test("should not throw when condition is true", () => {
		expect(() => {
			assert(true, apiError.notFound("Resource"));
		}).not.toThrow();
	});

	test("should throw when condition is false", () => {
		expect(() => {
			assert(false, apiError.notFound("Resource"));
		}).toThrow(AppError);
	});

	test("should throw the provided error", () => {
		const error = apiError.forbidden("Access denied");

		try {
			assert(false, error);
			expect(true).toBe(false); // Should not reach here
		} catch (e) {
			expect((e as AppError).code).toBe("FORBIDDEN");
			expect((e as AppError).message).toBe("Access denied");
		}
	});

	test("should work as type guard", () => {
		function process(value: string | undefined): string {
			assert(value !== undefined, apiError.validation("Value is required"));
			return value.toUpperCase(); // TypeScript knows value is string here
		}

		expect(process("hello")).toBe("HELLO");
		expect(() => process(undefined)).toThrow("Value is required");
	});
});
