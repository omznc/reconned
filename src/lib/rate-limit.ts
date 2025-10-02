import Redis from "ioredis";
import { Logger } from "next-axiom";
import { env } from "@/lib/env";

const redis = new Redis(env.REDIS_URL);

const logger = new Logger({ source: "rate-limit" });

interface RateLimitResult {
	success: boolean;
	remaining?: number;
	reset?: number;
}

export class RateLimit {
	private key: string;
	private maxRequests: number;
	private window: number;

	constructor(key: string, limit: number, window: number) {
		this.key = key;
		this.maxRequests = limit;
		this.window = window;
	}

	async limit(identifier: string): Promise<RateLimitResult> {
		const key = `ratelimit:${this.key}:${identifier}`;

		try {
			const current = await redis.get(key);
			const count = current ? Number.parseInt(current, 10) || 0 : 0;

			if (count >= this.maxRequests) {
				const ttl = await redis.ttl(key);
				logger.info("Rate limit exceeded", {
					key,
					count,
					ttl,
				});
				return {
					success: false,
					remaining: 0,
					reset: Date.now() + ttl * 1000,
				};
			}

			const pipeline = redis.pipeline();
			pipeline.incr(key);
			if (count === 0) {
				pipeline.expire(key, this.window);
			}
			await pipeline.exec();

			const remaining = Math.max(0, this.maxRequests - count - 1);
			return {
				success: true,
				remaining,
			};
		} catch (error) {
			logger.info("Rate limit error", {
				error,
			});
			return { success: true };
		}
	}
}

export const fileUploadRateLimit = new RateLimit("file-upload", 10, 60);
export const imageUploadRateLimit = new RateLimit("image-upload", 5, 60);
