import { getCountries } from "@/lib/cached-countries";
import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 86400; // 24 hours
export const fetchCache = "force-cache";

export async function GET() {
	const countries = await getCountries();

	return NextResponse.json(countries, {
		headers: {
			"Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
		},
	});
}
