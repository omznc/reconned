import { env } from "@/lib/env";
import {
	DeleteObjectCommand,
	DeleteObjectsCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
	endpoint: env.S3_ENDPOINT as string,
	region: env.S3_REGION as string,
	credentials: {
		accessKeyId: env.S3_ACCESS_KEY_ID as string,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
	},
});

const allowedFileTypes: string[] = env.ALLOWED_FILE_TYPES
	? env.ALLOWED_FILE_TYPES.split(",")
	: ["image/jpeg", "image/png", "application/pdf", "image/webp"];

const maxFileSize: number = env.MAX_FILE_SIZE
	? Number.parseInt(env.MAX_FILE_SIZE, 10)
	: 5 * 1024 * 1024; // Default to 5 MB

/**
 * DOES NOT CHECK FOR AUTHENTICATION
 */
export const getS3FileUploadUrl = async (props: {
	type: string;
	size: number;
	key: string;
}) => {
	const { type, size, key } = props;
	if (!(type && size)) {
		throw new Error("File type and size are required");
	}
	if (!allowedFileTypes.includes(type)) {
		throw new Error(`Unsupported file type: ${type}`);
	}

	if (size > maxFileSize) {
		throw new Error(
			`File size exceeds the maximum allowed size of ${maxFileSize} bytes`,
		);
	}

	const command = new PutObjectCommand({
		Bucket: env.S3_BUCKET_NAME as string,
		Key: key,
		ContentType: type,
		ContentLength: size,
	});

	const url = await getSignedUrl(s3, command, {
		expiresIn: 60 * 5, // 5 minutes
	});

	return {
		url,
		cdnUrl: `${env.NEXT_PUBLIC_CDN_URL}/${key}`,
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
	const command = new DeleteObjectsCommand({
		Bucket: env.S3_BUCKET_NAME as string,
		Delete: {
			Objects: keys.map((key) => ({ Key: key })),
		},
	});

	await s3.send(command);
};
