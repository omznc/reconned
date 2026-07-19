/**
 * Standardized error handling utilities for consistent error responses
 */

import type { ZodError } from "zod";

/**
 * Predefined error types for common scenarios
 */
export const ErrorCodes = {
	// Authentication & Authorization
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	TOKEN_EXPIRED: "TOKEN_EXPIRED",
	INVALID_CREDENTIALS: "INVALID_CREDENTIALS",

	// Validation
	VALIDATION_ERROR: "VALIDATION_ERROR",
	INVALID_INPUT: "INVALID_INPUT",
	MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

	// Resource errors
	NOT_FOUND: "NOT_FOUND",
	CONFLICT: "CONFLICT",
	ALREADY_EXISTS: "ALREADY_EXISTS",

	// Rate limiting
	RATE_LIMITED: "RATE_LIMITED",

	// Server errors
	INTERNAL_ERROR: "INTERNAL_ERROR",
	DATABASE_ERROR: "DATABASE_ERROR",
	EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

	// Business logic errors
	BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
	INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
	OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED",
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

/**
 * Create standardized error objects
 */
export class AppError extends Error {
	public readonly code: string;
	public readonly statusCode: number;
	public readonly details?: unknown;
	public override readonly cause?: unknown;

	constructor(code: string, message: string, statusCode: number, details?: unknown, cause?: unknown) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.statusCode = statusCode;
		this.details = details;
		this.cause = cause;
	}
}

/**
 * Factory functions for common errors
 */
export const apiError = {
	unauthorized: (message = "Authentication required", details?: unknown) =>
		new AppError(ErrorCodes.UNAUTHORIZED, message, 401, details),

	forbidden: (message = "Access denied", details?: unknown) =>
		new AppError(ErrorCodes.FORBIDDEN, message, 403, details),

	notFound: (resource = "Resource", details?: unknown) =>
		new AppError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404, details),

	validation: (message = "Validation failed", details?: unknown) =>
		new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details),

	conflict: (message = "Resource conflict", details?: unknown) =>
		new AppError(ErrorCodes.CONFLICT, message, 409, details),

	rateLimited: (message = "Too many requests", details?: unknown) =>
		new AppError(ErrorCodes.RATE_LIMITED, message, 429, details),

	internal: (message = "Internal server error", details?: unknown, cause?: unknown) =>
		new AppError(ErrorCodes.INTERNAL_ERROR, message, 500, details, cause),

	database: (message = "Database error", details?: unknown, cause?: unknown) =>
		new AppError(ErrorCodes.DATABASE_ERROR, message, 500, details, cause),
};

/**
 * Error response formatter
 */
export function formatErrorResponse(error: unknown): {
	error: {
		code: string;
		message: string;
		details?: unknown;
	};
} {
	if (error instanceof AppError) {
		return {
			error: {
				code: error.code,
				message: error.message,
				...(error.details ? { details: error.details } : {}),
			},
		};
	}

	if (error instanceof Error) {
		return {
			error: {
				code: ErrorCodes.INTERNAL_ERROR,
				message: error.message,
				details: process.env.NODE_ENV === "development" ? error.stack : undefined,
			},
		};
	}

	return {
		error: {
			code: ErrorCodes.INTERNAL_ERROR,
			message: "An unexpected error occurred",
			details: process.env.NODE_ENV === "development" ? String(error) : undefined,
		},
	};
}

/**
 * Validation error formatter for Zod errors
 */
export function formatZodError(error: ZodError): {
	code: string;
	message: string;
	details: Array<{
		path: string;
		message: string;
		code: string;
	}>;
} {
	return {
		code: ErrorCodes.VALIDATION_ERROR,
		message: "Validation failed",
		details: error.issues.map((issue) => ({
			path: issue.path.length > 0 ? issue.path.join(".") : "root",
			message: issue.message,
			code: issue.code,
		})),
	};
}

/**
 * Assert utility for preconditions
 */
export function assert(condition: boolean, error: AppError): asserts condition {
	if (!condition) {
		throw error;
	}
}
