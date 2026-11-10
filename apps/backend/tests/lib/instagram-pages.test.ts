import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { getUserPages } from "../../src/lib/instagram";

const realFetch = globalThis.fetch;

function mockGraph(routes: Record<string, () => Response>) {
	return spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		for (const [path, respond] of Object.entries(routes)) {
			if (url.includes(path)) {
				return respond();
			}
		}
		return realFetch(input, init);
	}) as typeof fetch);
}

const page = (id: string, accessToken = `token-${id}`) => ({ id, name: `Page ${id}`, access_token: accessToken });

describe("getUserPages", () => {
	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	test("merges personal pages with business pages, personal first, without duplicates", async () => {
		mockGraph({
			"/me/accounts": () => Response.json({ data: [page("1")] }),
			"/me/businesses": () =>
				Response.json({ data: [{ owned_pages: { data: [page("2"), page("1", "other")] } }] }),
		});

		const result = await getUserPages("user-token");

		expect(result.data).toEqual([page("1"), page("2")]);
	});

	test("returns business-owned and client pages, deduplicated, skipping pages without a token", async () => {
		mockGraph({
			"/me/accounts": () => Response.json({ data: [] }),
			"/me/businesses": () =>
				Response.json({
					data: [
						{ owned_pages: { data: [page("2"), page("3", "")] }, client_pages: { data: [page("4")] } },
						{ owned_pages: { data: [page("2")] } },
					],
				}),
		});

		const result = await getUserPages("user-token");

		expect(result.data.map((p) => p.id).sort()).toEqual(["2", "4"]);
	});

	test("returns an empty list when the business call is refused", async () => {
		mockGraph({
			"/me/accounts": () => Response.json({ data: [] }),
			"/me/businesses": () => Response.json({ error: { message: "missing permission" } }, { status: 403 }),
		});

		const result = await getUserPages("user-token");

		expect(result.data).toEqual([]);
	});
});
