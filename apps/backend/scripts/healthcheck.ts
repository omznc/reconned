// Docker HEALTHCHECK. Only the database decides health: the app runs without Redis.
// Docker does not restart an unhealthy container, so after MAX_TIMEOUTS hung checks in a row
// this sends SIGTERM to the app, and the unless-stopped restart policy starts it again.
import { existsSync, rmSync } from "node:fs";

const COUNTER = "/tmp/healthcheck-timeouts";
const MAX_TIMEOUTS = 3;

async function readTimeouts(): Promise<number> {
	if (!existsSync(COUNTER)) return 0;
	return Number(await Bun.file(COUNTER).text()) || 0;
}

try {
	const response = await fetch("http://localhost:3002/api/health", { signal: AbortSignal.timeout(8000) });
	const body = (await response.json()) as { database?: string };
	rmSync(COUNTER, { force: true });
	process.exit(body.database === "connected" ? 0 : 1);
} catch (error) {
	if (error instanceof Error && error.name === "TimeoutError") {
		const timeouts = (await readTimeouts()) + 1;
		if (timeouts >= MAX_TIMEOUTS) {
			// The container keeps /tmp over a restart, so reset the counter.
			rmSync(COUNTER, { force: true });
			process.kill(1, "SIGTERM");
		} else {
			await Bun.write(COUNTER, String(timeouts));
		}
	}
	process.exit(1);
}
