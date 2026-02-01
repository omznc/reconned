import packageJson from "../../package.json";
import { env } from "./env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggingConfig {
	enabled: boolean;
	level: LogLevel;
	samplingRate: number;
	serviceVersion: string;
	commitHash: string;
	environment: string;
}

export const loggingConfig: LoggingConfig = {
	enabled: env.POSTHOG_LOGS_ENABLED,
	level: env.LOG_LEVEL,
	samplingRate: env.LOG_SAMPLING_RATE,
	serviceVersion: packageJson.version,
	commitHash: process.env.GIT_COMMIT || "unknown",
	environment: process.env.NODE_ENV || "development",
};

export function shouldLog(level: LogLevel): boolean {
	const levels: LogLevel[] = ["debug", "info", "warn", "error"];
	const configuredLevelIndex = levels.indexOf(loggingConfig.level);
	const messageLevelIndex = levels.indexOf(level);

	return messageLevelIndex >= configuredLevelIndex;
}

export function shouldSampleLog(): boolean {
	if (loggingConfig.samplingRate >= 1) return true;
	if (loggingConfig.samplingRate <= 0) return false;
	return Math.random() < loggingConfig.samplingRate;
}
