import { Logger } from "next-axiom";
import { prisma } from "@/lib/prisma";
import { extractSizeFromKey } from "@/lib/storage";

export interface StorageQuotaResult {
	allowed: boolean;
	currentUsage: number;
	limit: number;
	remaining: number;
	error?: string;
}

export interface FileRecord {
	key: string;
	size: number;
	hash: string;
	mimeType: string;
	clubId: string;
	createdAt: Date;
}

// Storage limits in bytes
export const STORAGE_LIMITS = {
	CLUB_TOTAL: 1024 * 1024 * 1024, // 1GB per club
	USER_DAILY: 50 * 1024 * 1024, // 50MB per user per day
	SINGLE_FILE: 5 * 1024 * 1024, // 5MB per file
} as const;

const logger = new Logger({ source: "storage-quota" });

export const checkClubStorageQuota = async (clubId: string, additionalSize: number): Promise<StorageQuotaResult> => {
	try {
		// Calculate current usage from posts and spending receipts
		const [postsUsage, receiptsUsage] = await Promise.all([
			// Get all image keys from posts
			prisma.post.findMany({
				where: { clubId },
				select: { images: true },
			}),
			// Get all receipt URL keys from purchases
			prisma.clubPurchase.findMany({
				where: { clubId },
				select: { receiptUrls: true },
			}),
		]);

		// Calculate actual storage usage from file keys
		const postImageSizes = postsUsage.flatMap((post) =>
			post.images.map((imageKey) => extractSizeFromKey(imageKey)),
		);

		const receiptSizes = receiptsUsage.flatMap((purchase) =>
			purchase.receiptUrls.map((receiptKey) => extractSizeFromKey(receiptKey)),
		);

		const currentUsage = [...postImageSizes, ...receiptSizes].reduce((total, size) => total + size, 0);
		const limit = STORAGE_LIMITS.CLUB_TOTAL;
		const remaining = Math.max(0, limit - currentUsage);

		if (currentUsage + additionalSize > limit) {
			logger.info("Club storage quota exceeded", {
				clubId,
				currentUsage,
				limit,
				remaining,
			});
			return {
				allowed: false,
				currentUsage,
				limit,
				remaining,
				error: `Storage quota exceeded. Current: ${Math.round(currentUsage / 1024 / 1024)}MB, Limit: ${Math.round(limit / 1024 / 1024)}MB`,
			};
		}

		return {
			allowed: true,
			currentUsage,
			limit,
			remaining,
		};
	} catch (error) {
		logger.info("Failed to check club storage quota", {
			clubId,
			error,
		});
		return {
			allowed: false,
			currentUsage: 0,
			limit: STORAGE_LIMITS.CLUB_TOTAL,
			remaining: 0,
			error: "Failed to check storage quota",
		};
	}
};

export const checkUserDailyQuota = async (userId: string, additionalSize: number): Promise<StorageQuotaResult> => {
	// Since Post and ClubPurchase models don't track individual users,
	// we'll use a simplified approach based on audit logs for now
	try {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		// Count uploads from today based on audit logs as fallback
		const todayUploads = await prisma.clubAuditLog.count({
			where: {
				userId,
				actionType: {
					in: ["POST_CREATE", "SPENDING_CREATE"],
				},
				createdAt: {
					gte: today,
					lt: tomorrow,
				},
			},
		});

		// Use a conservative estimate for user daily quota
		const estimatedDailyUsage = todayUploads * 2 * 1024 * 1024; // 2MB avg per upload
		const limit = STORAGE_LIMITS.USER_DAILY;
		const remaining = Math.max(0, limit - estimatedDailyUsage);

		if (estimatedDailyUsage + additionalSize > limit) {
			logger.info("User daily upload quota exceeded", {
				userId,
				estimatedDailyUsage,
				limit,
				remaining,
			});
			return {
				allowed: false,
				currentUsage: estimatedDailyUsage,
				limit,
				remaining,
				error: "Daily upload quota exceeded. Try again tomorrow.",
			};
		}

		return {
			allowed: true,
			currentUsage: estimatedDailyUsage,
			limit,
			remaining,
		};
	} catch (error) {
		logger.info("Failed to check user daily upload quota", {
			userId,
			error,
		});
		return {
			allowed: true, // Allow on error
			currentUsage: 0,
			limit: STORAGE_LIMITS.USER_DAILY,
			remaining: STORAGE_LIMITS.USER_DAILY,
		};
	}
};
