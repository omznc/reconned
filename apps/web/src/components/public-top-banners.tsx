"use client";

import Link from "next/link";
import { useExtracted } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function PublicTopBanners() {
	const t = useExtracted();
	const pathname = usePathname();
	const normalized = pathname.replace(/\/$/, "") || "/";
	const onMap = normalized === "/map";

	if (onMap) {
		return null;
	}

	return (
		<div className="top-0 left-0 z-50 w-full bg-background/20 text-center py-1.5">
			<Link href="https://github.com/omznc/reconned?utm_source=reconned.com" className="!bg-transparent">
				<p className="text-sm">{t("We're open-source! Click here and help us become better.")}</p>
			</Link>
		</div>
	);
}
