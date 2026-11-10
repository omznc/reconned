import { describe, expect, test } from "bun:test";
import { buildSeoHead, scriptSafeJson } from "@/lib/seo";

describe("scriptSafeJson", () => {
	test("user text cannot close the JSON-LD script element", () => {
		const query = "</script><img src=x onerror=alert(1)>";
		const head = buildSeoHead({ title: "t", schemas: [JSON.stringify({ name: query })] });
		const text = head.scripts[0]?.children ?? "";
		expect(text).not.toContain("<");
		expect(JSON.parse(text)).toEqual({ name: query });
	});

	test("JSON without < is unchanged", () => {
		expect(scriptSafeJson('{"a":"b > c"}')).toBe('{"a":"b > c"}');
	});
});
