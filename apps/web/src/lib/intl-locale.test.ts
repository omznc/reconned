import { expect, test } from "bun:test";
import { toIntlLocale } from "@/lib/intl-locale";

test("maps bs tags to sr-Latn-BA", () => {
	expect(toIntlLocale("bs")).toBe("sr-Latn-BA");
	expect(toIntlLocale("bs-BA")).toBe("sr-Latn-BA");
});

test("keeps other locales", () => {
	expect(toIntlLocale("en")).toBe("en");
	expect(toIntlLocale("bsx")).toBe("bsx");
});
