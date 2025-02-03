import { auth } from "@auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function GET() {
	const resp = await auth.api.signOut({
		headers: await headers(),
	});

	console.log(resp);

	redirect("/login");
}
