import { routing } from "@/i18n/routing";
import { createNavigation } from "next-intl/navigation";
import { revalidatePath } from "next/cache";

// Lightweight wrappers around Next.js' navigation
// APIs that consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
	createNavigation(routing);

export function revalidateLocalizedPaths(
	path: string,
	type?: "page" | "layout",
) {
	for (const locale of routing.locales) {
		revalidatePath(`/${locale}${path}`, type ?? "page");
	}
}
