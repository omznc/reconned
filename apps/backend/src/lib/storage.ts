import { S3Client } from "bun";
import { env } from "./env";

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
	const extension = baseKey.split(".").pop() || "";
	const nameWithoutExt = baseKey.replace(`.${extension}`, "");
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

export async function getS3UploadUrl(key: string, type: string, size: number): Promise<UploadUrlResponse> {
	// Basic validation
	if (!type || !size || !key) {
		throw new Error("File type, size, and key are required");
	}

	if (!allowedFileTypes.includes(type)) {
		throw new Error(`Unsupported file type: ${type}. Allowed: ${allowedFileTypes.join(", ")}`);
	}

	if (size > maxFileSize) {
		throw new Error(`File size exceeds the maximum allowed size of ${Math.round(maxFileSize / 1024 / 1024)}MB`);
	}

	// Generate key with size information for accurate quota tracking
	const keyWithSize = generateKeyWithSize(key, size);

	const url = s3.presign(keyWithSize, {
		method: "PUT",
		type: type,
		expiresIn: 60 * 5, // 5 minutes
	});

	return {
		url,
		cdnUrl: `${env.CDN_URL}/${keyWithSize}`,
		key: keyWithSize,
	};
}

export async function deleteS3Files(keys: string[]): Promise<void> {
	if (keys.length === 0) {
		return;
	}

	try {
		await Promise.all(keys.map((key) => s3.delete(key)));
	} catch (error) {
		throw new Error(`Failed to delete S3 files: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}
