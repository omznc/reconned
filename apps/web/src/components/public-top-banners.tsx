"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useExtracted } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function PublicTopBanners() {
	const t = useExtracted();
	const pathname = usePathname();
	const normalized = pathname.replace(/\/$/, "") || "/";
	const onMap = normalized === "/map";

	return (
		<AnimatePresence initial={false}>
			{!onMap && (
				<motion.div
					initial={{ height: 0 }}
					animate={{ height: "auto" }}
					exit={{ height: 0 }}
					transition={{ duration: 0.25, ease: "easeInOut" }}
					className="top-0 left-0 z-50 w-full overflow-hidden bg-background/20 text-center"
				>
					<motion.div
						initial={{ opacity: 0, filter: "blur(4px)" }}
						animate={{ opacity: 1, filter: "blur(0px)" }}
						exit={{ opacity: 0, filter: "blur(4px)" }}
						transition={{ duration: 0.25, ease: "easeInOut" }}
						className="py-1.5"
					>
						<Link
							href="https://github.com/omznc/reconned?utm_source=reconned.com"
							className="!bg-transparent"
						>
							<p className="text-sm">{t("We're open-source! Click here and help us become better.")}</p>
						</Link>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
