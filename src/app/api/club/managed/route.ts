import { type NextRequest, NextResponse } from "next/server";
import { fetchManagedClubs } from "@/app/api/club/managed/fetch-managed-clubs";
import { isAuthenticated } from "@/lib/auth";

export async function GET(_req: NextRequest) {
	const user = await isAuthenticated();

	if (!user) {
		return NextResponse.json([]);
	}

	const managedClubs = await fetchManagedClubs(user.id);
	return NextResponse.json(managedClubs);
}
