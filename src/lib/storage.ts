import {
	DeleteObjectCommand,
	DeleteObjectsCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
	endpoint: process.env.S3_ENDPOINT as string,
	region: process.env.S3_REGION as string,
	credentials: {
		accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
	},
});

const allowedFileTypes = ["image/jpeg", "image/png", "application/pdf"];

const maxFileSize = 5 * 1024 * 1024; // 5 MB

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
		throw new Error("Missing file information");
	}
	if (!allowedFileTypes.includes(type)) {
		throw new Error("Invalid file type");
	}

	if (size > maxFileSize) {
		throw new Error("File size exceeds the maximum allowed size");
	}

	const command = new PutObjectCommand({
		Bucket: process.env.S3_BUCKET_NAME as string,
		Key: key,
		ContentType: type,
		ContentLength: size,
	});

	const url = await getSignedUrl(s3, command, {
		expiresIn: 60 * 5, // 5 minutes
	});

	return url;
};

export const deleteS3File = async (key: string) => {
	const command = new DeleteObjectCommand({
		Bucket: process.env.S3_BUCKET_NAME as string,
		Key: key,
	});

	await s3.send(command);
};

export const deleteS3Files = async (keys: string[]) => {
	const command = new DeleteObjectsCommand({
		Bucket: process.env.S3_BUCKET_NAME as string,
		Delete: {
			Objects: keys.map((key) => ({ Key: key })),
		},
	});

	await s3.send(command);
};
