import { expect, test } from "bun:test";
import { getPathname } from "@/i18n/navigation";
import { loginHrefFor, sanitizeRedirectTo } from "@/lib/safe-redirect";
import { generatePageLanguages } from "@/lib/utils";

test("sanitizeRedirectTo keeps same-site paths", () => {
	expect(sanitizeRedirectTo("/en/dashboard?a=1")).toBe("/en/dashboard?a=1");
	expect(sanitizeRedirectTo("/")).toBe("/");
});

test("sanitizeRedirectTo rejects off-site values", () => {
	for (const value of [
		"//evil.host/x",
		"/\\evil.host",
		"https://evil.host",
		"javascript:alert(1)",
		"/\t/evil.host",
		"evil",
		"",
	]) {
		expect(sanitizeRedirectTo(value)).toBeUndefined();
	}
	expect(sanitizeRedirectTo(null)).toBeUndefined();
});

test("loginHrefFor keeps path and search", () => {
	expect(loginHrefFor({ pathname: "/en/dashboard/x", searchStr: "?a=1" })).toBe(
		"/login?redirectTo=%2Fen%2Fdashboard%2Fx%3Fa%3D1",
	);
});

test("getPathname does not prefix a path that already has a locale", () => {
	expect(getPathname({ href: "/en/dashboard", locale: "en" })).toBe("/en/dashboard");
	expect(getPathname({ href: "/sr", locale: "en" })).toBe("/sr");
	expect(getPathname({ href: "/dashboard?x=/en", locale: "en" })).toBe("/en/dashboard?x=/en");
	expect(getPathname({ href: "/", locale: "en" })).toBe("/en");
});

test("home hreflang matches the canonical form", () => {
	const languages = generatePageLanguages("https://x.test", "/", "en");
	expect(languages).toEqual({
		bs: "https://x.test",
		en: "https://x.test/en",
		sr: "https://x.test/sr",
		"x-default": "https://x.test",
	});
});
