import { fetchManagedClubs } from "@/app/api/club/managed/fetch-managed-clubs";
import { isAuthenticated } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
	const user = await isAuthenticated();

	if (!user) {
		return NextResponse.json([]);
	}

	const managedClubs = await fetchManagedClubs(user.id);
	return NextResponse.json(managedClubs);
}
