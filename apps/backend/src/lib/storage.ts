import { apiError } from "@reconned/router";
import { S3Client } from "bun";
import { env } from "./env";
import { posthog } from "./posthog";

const s3 = new S3Client({
	endpoint: env.S3_ENDPOINT,
	region: env.S3_REGION,
	accessKeyId: env.S3_ACCESS_KEY_ID,
	secretAccessKey: env.S3_SECRET_ACCESS_KEY,
	bucket: env.S3_BUCKET_NAME,
});

const allowedFileTypes: string[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const maxFileSize = 5 * 1024 * 1024; // 5 MB

export interface UploadUrlRequest {
	type: string;
	size: number;
}

export interface UploadUrlResponse {
	url: string;
	cdnUrl: string;
	key: string;
}

export function generateKeyWithSize(baseKey: string, size: number): string {
	const lastDotIndex = baseKey.lastIndexOf(".");
	if (lastDotIndex === -1) {
		// No extension, just append size
		return `${baseKey}_${size}b`;
	}

	const nameWithoutExt = baseKey.slice(0, lastDotIndex);
	const extension = baseKey.slice(lastDotIndex + 1);
	return `${nameWithoutExt}_${size}b.${extension}`;
}

export function extractSizeFromKey(key: string): number {
	const match = key.match(/_(\d+)b\./);
	// biome-ignore lint/complexity/useOptionalChain: Otherwise it breaks.
	if (match && match[1]) {
		return Number.parseInt(match[1], 10);
	}
	return 0;
}

export async function getS3UploadUrl(
	key: string,
	type: string,
	size: number,
	userId?: string,
): Promise<UploadUrlResponse> {
	// Basic validation — thrown as AppError(400) so every presign route returns a 400, not a 500
	if (!type || !size || !key) {
		throw apiError.validation("File type, size, and key are required");
	}

	if (!allowedFileTypes.includes(type)) {
		throw apiError.validation(`Unsupported file type: ${type}. Allowed: ${allowedFileTypes.join(", ")}`);
	}

	if (size > maxFileSize) {
		throw apiError.validation(
			`File size exceeds the maximum allowed size of ${Math.round(maxFileSize / 1024 / 1024)}MB`,
		);
	}

	// Generate key with size information for accurate quota tracking
	const keyWithSize = generateKeyWithSize(key, size);

	const url = s3.presign(keyWithSize, {
		method: "PUT",
		type: type,
		expiresIn: 60 * 5, // 5 minutes
	});

	// Track file upload URL generation
	if (userId) {
		posthog.capture({
			distinctId: userId,
			event: "file_upload_url_generated",
			properties: {
				file_type: type,
				file_size: size,
				file_size_mb: Math.round((size / 1024 / 1024) * 100) / 100,
				key: key,
			},
		});
	}

	return {
		url,
		cdnUrl: `${env.CDN_URL}/${keyWithSize}`,
		key: keyWithSize,
	};
}

export async function deleteS3Files(keys: string[], userId?: string): Promise<void> {
	if (keys.length === 0) {
		return;
	}

	try {
		await Promise.all(keys.map((key) => s3.delete(key)));

		// Track file deletions
		if (userId) {
			posthog.capture({
				distinctId: userId,
				event: "files_deleted",
				properties: {
					files_count: keys.length,
					file_keys: keys,
				},
			});
		}
	} catch (error) {
		throw new Error(`Failed to delete S3 files: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}
