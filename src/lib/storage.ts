import { DeleteObjectCommand, DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import {
	type FileValidationResult,
	generateFileHash,
	generateSecureFilename,
	isImageMimeType,
	optimizeImage,
	validateFileBuffer,
} from "@/lib/file-security";
import { checkClubStorageQuota, checkUserDailyQuota, STORAGE_LIMITS } from "@/lib/storage-quota";

const s3 = new S3Client({
	endpoint: env.S3_ENDPOINT as string,
	region: env.S3_REGION as string,
	credentials: {
		accessKeyId: env.S3_ACCESS_KEY_ID as string,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
	},
});

const allowedFileTypes: string[] = env.NEXT_PUBLIC_ALLOWED_FILE_TYPES
	? env.NEXT_PUBLIC_ALLOWED_FILE_TYPES.split(",")
	: ["image/jpeg", "image/png", "application/pdf", "image/webp"];

const maxFileSize: number = env.NEXT_PUBLIC_MAX_FILE_SIZE
	? Number.parseInt(env.NEXT_PUBLIC_MAX_FILE_SIZE, 10)
	: STORAGE_LIMITS.SINGLE_FILE;

export interface SecureUploadOptions {
	type: string;
	size: number;
	key: string;
	clubId?: string;
	userId?: string;
}

export const generateKeyWithSize = (baseKey: string, size: number): string => {
	const extension = baseKey.split(".").pop() || "";
	const nameWithoutExt = baseKey.replace(`.${extension}`, "");
	return `${nameWithoutExt}_${size}b.${extension}`;
};

export const extractSizeFromKey = (key: string): number => {
	const match = key.match(/_(\d+)b\./);
	return match?.[1] ? Number.parseInt(match[1], 10) : 0;
};

export interface SecureUploadResult {
	url: string;
	cdnUrl: string;
	optimizedKey?: string;
	fileHash?: string;
}

/**
 * Enhanced file upload with security validations
 * Checks: file type, size, quotas, rate limits
 */
export const getS3FileUploadUrl = async (props: SecureUploadOptions): Promise<SecureUploadResult> => {
	const { type, size, key, clubId, userId } = props;

	// Basic validation
	if (!(type && size && key)) {
		throw new Error("File type, size, and key are required");
	}

	if (!allowedFileTypes.includes(type)) {
		throw new Error(`Unsupported file type: ${type}. Allowed: ${allowedFileTypes.join(", ")}`);
	}

	if (size > maxFileSize) {
		throw new Error(`File size exceeds the maximum allowed size of ${Math.round(maxFileSize / 1024 / 1024)}MB`);
	}

	// Check storage quotas if clubId provided
	if (clubId) {
		const clubQuota = await checkClubStorageQuota(clubId, size);
		if (!clubQuota.allowed) {
			throw new Error(clubQuota.error || "Club storage quota exceeded");
		}
	}

	// Check user daily quota if userId provided
	if (userId) {
		const userQuota = await checkUserDailyQuota(userId, size);
		if (!userQuota.allowed) {
			throw new Error(userQuota.error || "Daily upload quota exceeded");
		}
	}

	// Generate key with size information for accurate quota tracking
	const keyWithSize = generateKeyWithSize(key, size);

	const command = new PutObjectCommand({
		Bucket: env.S3_BUCKET_NAME as string,
		Key: keyWithSize,
		ContentType: type,
		ContentLength: size,
		CacheControl: "public, max-age=31536000", // 1 year cache
	});

	const url = await getSignedUrl(s3, command, {
		expiresIn: 60 * 5, // 5 minutes
	});

	return {
		url,
		cdnUrl: `${env.NEXT_PUBLIC_CDN_URL}/${keyWithSize}`,
	};
};

export const deleteS3File = async (key: string) => {
	const command = new DeleteObjectCommand({
		Bucket: env.S3_BUCKET_NAME as string,
		Key: key,
	});

	await s3.send(command);
};

export const deleteS3Files = async (keys: string[]) => {
	if (keys.length === 0) return;

	const command = new DeleteObjectsCommand({
		Bucket: env.S3_BUCKET_NAME as string,
		Delete: {
			Objects: keys.map((key) => ({ Key: key })),
		},
	});

	await s3.send(command);
};

/**
 * Process and validate file buffer before upload
 * Includes magic number validation and image optimization
 */
export const processFileForUpload = async (
	buffer: Buffer,
	originalFilename: string,
	expectedMimeType: string,
): Promise<{
	processedBuffer: Buffer;
	secureFilename: string;
	fileHash: string;
	validation: FileValidationResult;
}> => {
	// Validate file
	const validation = await validateFileBuffer(buffer, expectedMimeType, maxFileSize);
	if (!validation.isValid) {
		throw new Error(validation.error || "File validation failed");
	}

	let processedBuffer = buffer;

	// Optimize images
	if (isImageMimeType(expectedMimeType)) {
		try {
			processedBuffer = await optimizeImage(buffer);
		} catch (error) {
			// If optimization fails, use original buffer
			console.warn("Image optimization failed:", error);
		}
	}

	// Generate secure filename and hash
	const secureFilename = generateSecureFilename(originalFilename);
	const fileHash = generateFileHash(processedBuffer);

	return {
		processedBuffer,
		secureFilename,
		fileHash,
		validation,
	};
};
