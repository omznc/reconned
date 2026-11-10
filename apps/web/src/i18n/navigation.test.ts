import { expect, test } from "bun:test";
import { resolveRelative } from "@/i18n/navigation";

const location = { pathname: "/en/dashboard/admin/feature-flags", searchStr: "?page=2" };

test("resolveRelative keeps the current path for query-only hrefs", () => {
	expect(resolveRelative("?flagId=new", location)).toBe("/en/dashboard/admin/feature-flags?flagId=new");
});

test("resolveRelative keeps the path and query for hash-only hrefs", () => {
	expect(resolveRelative("#about", location)).toBe("/en/dashboard/admin/feature-flags?page=2#about");
});

test("resolveRelative leaves absolute paths alone", () => {
	expect(resolveRelative("/en/clubs", location)).toBe("/en/clubs");
});
