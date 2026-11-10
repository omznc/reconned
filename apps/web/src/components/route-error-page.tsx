import Error500 from "@public/errors/500.webp";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useExtracted } from "next-intl";
import posthog from "posthog-js";
import { useEffect } from "react";
import { Image } from "@/components/image";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Use as the `errorComponent` of a route. Reports the error to PostHog, like the old `error.tsx`. */
export function RouteErrorPage({ error }: ErrorComponentProps) {
	const t = useExtracted();

	useEffect(() => {
		posthog.captureException(error);
	}, [error]);

	return (
		<div className="flex h-dvh w-full fade-in-up flex-col items-center justify-center p-8">
			<Image src={Error500} alt="500" sizes="100vw" className="w-full max-w-[400px] dark:invert" />
			<h1 className="text-4xl font-bold mb-4 text-center">{t("Something went wrong")}</h1>
			<p className="text-lg mb-8 text-center">{t("An unexpected error occurred. Please try again.")}</p>
			<Button asChild={true}>
				<Link
					href="/"
					className="text-lg text-center hover:bg-accent transition-all bg-background px-4 py-2 rounded-md border"
				>
					{t("Return to homepage")}
				</Link>
			</Button>
		</div>
	);
}
