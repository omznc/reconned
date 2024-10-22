import { auth } from "@auth/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function GET() {
	auth.api.signOut({
		headers: await headers(),
	});

	redirect("/login");
}
