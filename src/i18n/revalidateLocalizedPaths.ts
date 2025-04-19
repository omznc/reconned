import { routing } from "@/i18n/routing";
import { revalidatePath } from "next/cache";

export function revalidateLocalizedPaths(path: string, type?: "page" | "layout") {
	for (const locale of routing.locales) {
		revalidatePath(`/${locale}${path}`, type ?? "page");
	}
}
