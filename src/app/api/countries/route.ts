import { NextResponse } from "next/server";
import { withAxiom } from "next-axiom";
import { getCountries } from "@/lib/cached-countries";

export const runtime = "edge";
export const revalidate = 86400; // 24 hours
export const fetchCache = "force-cache";

export const GET = withAxiom(async () => {
	const countries = await getCountries();

	return NextResponse.json(countries, {
		headers: {
			"Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
		},
	});
	// biome-ignore lint/suspicious/noExplicitAny: TODO: Fix once next-axiom sorts their stuff out
}) as any;
