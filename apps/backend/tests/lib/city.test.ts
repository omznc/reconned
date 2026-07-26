import { describe, expect, test } from "bun:test";
// `city.ts` imports nothing at all, so it is safe to import statically.
import { normalizeCityName, slugifyCity } from "../../src/lib/city";

describe("normalizeCityName", () => {
	test("strips the administrative prefixes geocoders return", () => {
		expect(normalizeCityName("Grad Sarajevo")).toBe("Sarajevo");
		expect(normalizeCityName("Općina Doboj Jug")).toBe("Doboj Jug");
		expect(normalizeCityName("Општина Пале")).toBe("Пале");
		expect(normalizeCityName("City of London")).toBe("London");
	});

	test("leaves names that merely start with those letters alone", () => {
		expect(normalizeCityName("Gradiška")).toBe("Gradiška");
		expect(normalizeCityName("Gradačac")).toBe("Gradačac");
	});

	test("trims surrounding whitespace", () => {
		expect(normalizeCityName("  Livno  ")).toBe("Livno");
	});
});

describe("slugifyCity", () => {
	test("folds the Bosnian/Croatian/Serbian diacritics", () => {
		expect(slugifyCity("Široki Brijeg")).toBe("siroki-brijeg");
		expect(slugifyCity("Đurđevik")).toBe("durdevik");
		expect(slugifyCity("Čapljina")).toBe("capljina");
	});

	test("transliterates Cyrillic instead of dropping it", () => {
		expect(slugifyCity("Бања Лука")).toBe("banja-luka");
		expect(slugifyCity("Љубиње")).toBe("ljubinje");
		expect(slugifyCity("Ћуприја")).toBe("cuprija");
	});

	// Both scripts must land on one page, or a club would be invisible to half the
	// site depending on which one its owner happened to type.
	test("agrees between the two scripts", () => {
		expect(slugifyCity("Пале")).toBe(slugifyCity("Pale"));
		expect(slugifyCity("Бања Лука")).toBe(slugifyCity("Banja Luka"));
	});

	test("returns an empty slug for a name with nothing routable in it", () => {
		expect(slugifyCity("!!!")).toBe("");
	});
});
