"use client";

import Link from "next/link";
import { useExtracted } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function PublicTopBanners({ isBeta }: { isBeta: boolean }) {
	const t = useExtracted();
	const pathname = usePathname();
	const normalized = pathname.replace(/\/$/, "") || "/";
	const onMap = normalized === "/map";

	if (onMap) {
		return null;
	}

	return (
		<>
			{isBeta && (
				<div className="top-0 left-0 z-50 w-full bg-background/40 text-center py-1.5">
					<p className="text-sm">{t("Beta version - Changes and errors are possible.")}</p>
				</div>
			)}
			<Link
				href="https://github.com/omznc/reconned?utm_source=reconned.com"
				className="top-0 left-0 z-50 w-full bg-background/20 backdrop-blur-xl text-center py-1.5"
			>
				<p className="text-sm">{t("We're open-source! Click here and help us become better.")}</p>
			</Link>
		</>
	);
}
