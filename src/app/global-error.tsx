"use client";

import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import Image from "next/image";
import { useLocale, useMessages } from "next-intl";
import Error500 from "@public/errors/500.webp";
import { useTheme } from "next-themes";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);
	const locale = useLocale();
	const theme = useTheme();
	const messages = useMessages();
	const t = messages["public.notFound"];

	return (
		<html lang={locale} className={theme.theme === "dark" ? "dark" : ""}>
			<body>
				<main className="flex h-dvh w-full fade-in-up flex-col items-center justify-center p-8">
					<Image src={Error500} alt="404" className="w-full max-w-[400px] dark:invert" />
					<h1 className="text-4xl font-bold mb-4 text-center">{t.title}</h1>
					<p className="text-lg mb-8 text-center">{t.message}</p>
					<Button asChild={true}>
						<Link
							href="/"
							className="text-lg text-center hover:bg-accent transition-all bg-background px-4 py-2 rounded-md border"
						>
							{t.backHome}
						</Link>
					</Button>
				</main>
			</body>
		</html>
	);
}
