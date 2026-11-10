import { expect, test } from "bun:test";
import { resolveMarkdownSource } from "@/lib/server/markdown-source";

const base = "http://localhost:3460";

test("resolveMarkdownSource accepts local pages", () => {
	expect(resolveMarkdownSource("/en/clubs?page=2", base)?.href).toBe("http://localhost:3460/en/clubs?page=2");
});

test("resolveMarkdownSource rejects other origins and excluded prefixes", () => {
	for (const source of [
		"//localhost:3481/",
		"/\\localhost:3481/",
		"//localhost:3462/api/health",
		"/api/health",
		"/en/../api/x",
		"/_next/x",
		"/\t/evil.host",
		"evil",
		"",
	]) {
		expect(resolveMarkdownSource(source, base)).toBeNull();
	}
	expect(resolveMarkdownSource(null, base)).toBeNull();
});

test("resolveMarkdownSource rejects .md sources, which would self-fetch again", () => {
	expect(resolveMarkdownSource("/x.md", base)).toBeNull();
	expect(resolveMarkdownSource("/clubs/veis.md?x=1", base)).toBeNull();
});
