"use client";

import Error500 from "@public/errors/500.webp";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useLogger } from "next-axiom";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
	const logger = useLogger({ source: "global-error" });
	const t = useExtracted();

	useEffect(() => {
		if (!logger) return;

		logger.error("Global error", {
			error,
		});
	}, [error, logger]);

	return (
		<div className="flex h-dvh w-full fade-in-up flex-col items-center justify-center p-8">
			<Image src={Error500} alt="500" className="w-full max-w-[400px] dark:invert" />
			<h1 className="text-4xl font-bold mb-4 text-center">{t("Something went wrong")}</h1>
			<p className="text-lg mb-8 text-center">{t("An unexpected error occurred. Please try again.")}</p>
			<Button asChild={true}>
				<Link
					href={"/" as Route}
					className="text-lg text-center hover:bg-accent transition-all bg-background px-4 py-2 rounded-md border"
				>
					{t("Return to homepage")}
				</Link>
			</Button>
		</div>
	);
}
