import { auth } from "@auth/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function GET() {
	await auth.api.signOut({
		headers: await headers(),
	});

	revalidatePath("/login");
	redirect("/login");
}
