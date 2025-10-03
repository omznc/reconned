import { type NextRequest, NextResponse } from "next/server";
import { withAxiom } from "next-axiom";
import { fetchManagedClubs } from "@/app/api/club/managed/fetch-managed-clubs";
import { isAuthenticated } from "@/lib/auth";

export const GET = withAxiom(async (_req: NextRequest) => {
	const user = await isAuthenticated();

	if (!user) {
		return NextResponse.json([]);
	}

	const managedClubs = await fetchManagedClubs(user.id);
	return NextResponse.json(managedClubs);
	// biome-ignore lint/suspicious/noExplicitAny: TODO: Fix once next-axiom sorts their stuff out
}) as any;
