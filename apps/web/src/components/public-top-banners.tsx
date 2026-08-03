"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useExtracted } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function PublicTopBanners() {
	const t = useExtracted();
	const pathname = usePathname();
	const normalized = pathname.replace(/\/$/, "") || "/";
	const onMap = normalized === "/map";
	// Under reduced motion the banner keeps its opacity crossfade but stops animating
	// its height and blur, which is what makes the page below it shift on every route change.
	const reduceMotion = useReducedMotion();

	return (
		<AnimatePresence initial={false}>
			{!onMap && (
				<motion.div
					initial={reduceMotion ? false : { height: 0 }}
					animate={reduceMotion ? {} : { height: "auto" }}
					exit={reduceMotion ? {} : { height: 0 }}
					transition={{ duration: 0.25, ease: "easeInOut" }}
					className="top-0 left-0 z-50 w-full overflow-hidden bg-background/20 text-center"
				>
					<motion.div
						initial={{ opacity: 0, filter: reduceMotion ? "none" : "blur(4px)" }}
						animate={{ opacity: 1, filter: reduceMotion ? "none" : "blur(0px)" }}
						exit={{ opacity: 0, filter: reduceMotion ? "none" : "blur(4px)" }}
						transition={{ duration: 0.25, ease: "easeInOut" }}
						className="py-1.5"
					>
						<Link
							href="https://github.com/omznc/reconned?utm_source=reconned.com"
							target="_blank"
							rel="noopener noreferrer"
							className="!bg-transparent"
						>
							<p className="text-sm">{t("RECONNED is open source — read the code on GitHub.")}</p>
						</Link>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
