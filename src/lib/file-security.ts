import { createHash, randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

export interface FileValidationResult {
	isValid: boolean;
	error?: string;
	mimeType?: string;
}

export const sanitizeFilename = (filename: string): string => {
	return (
		filename
			.replace(/[^a-zA-Z0-9.-]/g, "_") // Remove special chars
			.replace(/\.+/g, ".") // Remove multiple dots
			.replace(/^\.+|\.+$/g, "") // Remove leading/trailing dots
			.substring(0, 100) || // Limit length
		"unnamed"
	); // Fallback if empty
};

export const generateSecureFilename = (originalName: string): string => {
	const sanitized = sanitizeFilename(originalName);
	const uuid = randomUUID();
	const extension = sanitized.split(".").pop() || "";
	const nameWithoutExt = sanitized.replace(/\.[^/.]+$/, "");

	return `${uuid}-${nameWithoutExt}.${extension}`;
};

export const validateFileBuffer = async (
	buffer: Buffer,
	expectedMimeType: string,
	maxSize: number,
): Promise<FileValidationResult> => {
	// Check file size
	if (buffer.length === 0) {
		return { isValid: false, error: "Empty file" };
	}

	if (buffer.length > maxSize) {
		return { isValid: false, error: `File too large. Max size: ${maxSize} bytes` };
	}

	// Magic number validation
	try {
		const fileType = await fileTypeFromBuffer(buffer);

		if (!fileType) {
			return { isValid: false, error: "Unknown file type" };
		}

		if (fileType.mime !== expectedMimeType) {
			return {
				isValid: false,
				error: `Invalid file type. Expected: ${expectedMimeType}, Got: ${fileType.mime}`,
			};
		}

		return { isValid: true, mimeType: fileType.mime };
	} catch {
		return { isValid: false, error: "File validation failed" };
	}
};

export const generateFileHash = (buffer: Buffer): string => {
	return createHash("sha256").update(buffer).digest("hex");
};

export const optimizeImage = async (
	buffer: Buffer,
	maxWidth = 1920,
	maxHeight = 1080,
	quality = 85,
): Promise<Buffer> => {
	try {
		return await sharp(buffer)
			.resize(maxWidth, maxHeight, {
				fit: "inside",
				withoutEnlargement: true,
			})
			.jpeg({ quality })
			.toBuffer();
	} catch {
		// If optimization fails, return original buffer
		return buffer;
	}
};

export const isImageMimeType = (mimeType: string): boolean => {
	return mimeType.startsWith("image/");
};
