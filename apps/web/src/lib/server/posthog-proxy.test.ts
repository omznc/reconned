import { expect, test } from "bun:test";
import { buildPosthogTarget, posthogRequestHeaders } from "@/lib/server/posthog-proxy";

test("buildPosthogTarget builds api and asset urls", () => {
	expect(buildPosthogTarget("e/", "?v=1")?.href).toBe("https://eu.i.posthog.com/e/?v=1");
	expect(buildPosthogTarget("static/array.js", "")?.host).toBe("eu-assets.i.posthog.com");
});

test("buildPosthogTarget rejects host-changing splats", () => {
	for (const splat of ["/evil.host/x", "\\evil.host/x", "a\\b"]) {
		expect(buildPosthogTarget(splat, "")).toBeNull();
	}
	expect(buildPosthogTarget("evil.host/x", "")?.origin).toBe("https://eu.i.posthog.com");
});

test("posthogRequestHeaders drops authorization and cookies", () => {
	const source = new Headers({
		authorization: "Bearer x",
		cookie: "a=b",
		"user-agent": "ua",
		"x-forwarded-for": "1.2.3.4",
	});
	const headers = posthogRequestHeaders(source, new URL("https://eu.i.posthog.com/"));
	expect(headers.get("authorization")).toBeNull();
	expect(headers.get("cookie")).toBeNull();
	expect(headers.get("user-agent")).toBe("ua");
	expect(headers.get("x-forwarded-for")).toBe("1.2.3.4");
});
