import { getLocale, getTranslations } from "next-intl/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiGithub } from "@icons-pack/react-simple-icons";
import { remark } from "remark";
import remarkHtml from "remark-html";
import remarkGfm from "remark-gfm";
import Peeking from "@public/peeking.webp";
import Image from "next/image";

import "./markdown.css";

// Helper function to format GitHub release body markdown
async function formatReleaseBody(body: string): Promise<string> {
	if (!body) {
		return "";
	}

	// Use remark to parse markdown with GFM support (tables, images, etc)
	const processedContent = await remark()
		.use(remarkGfm) // Support GitHub Flavored Markdown
		.use(remarkHtml, { sanitize: false }) // Convert to HTML
		.process(body);

	return String(processedContent.value);
}

export const revalidate = 3600; // 1 hour

// Main changelog page
export default async function ChangelogPage() {
	const t = await getTranslations("public.changelog");
	const locale = await getLocale();

	// Get the latest releases from GitHub
	const response = await fetch("https://api.github.com/repos/omznc/reconned/releases", {
		method: "GET",
		headers: {
			Accept: "application/vnd.github.v3+json",
		},
	});

	const releases: {
		id: number;
		name: string;
		tag_name: string;
		published_at: string;
		body: string;
		html_url: string;
	}[] = await response.json();

	if (!releases || releases.length === 0) {
		return (
			<div className="container mx-auto py-12 px-4 md:px-6">
				<div className="text-center mb-12">
					<h1 className="text-4xl font-bold mb-4">{t("title")}</h1>
					<p className="text-lg text-muted-foreground">{t("description")}</p>
				</div>

				<Alert variant="destructive" className="mb-6">
					<AlertTriangle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{t("errorLoading")}</AlertDescription>
				</Alert>
			</div>
		);
	}

	if (releases.length === 0) {
		return notFound();
	}

	// Get the latest release and previous releases
	const latestRelease = releases[0];
	const previousReleases = releases.slice(1);

	if (!latestRelease) {
		return notFound();
	}

	const content = await formatReleaseBody(latestRelease.body);

	// Pre-process all release bodies to avoid awaiting inside the render function
	const previousReleasesContent = await Promise.all(
		previousReleases.map(async (release) => ({
			...release,
			formattedBody: await formatReleaseBody(release.body),
		})),
	);

	return (
		<div className="container mx-auto py-12 px-4 md:px-6">
			<div className="text-center mb-12">
				<h1 className="text-4xl font-bold mb-4">{t("title")}</h1>
				<p className="text-lg text-muted-foreground">{t("description")}</p>
			</div>

			{/* Latest Release */}
			<div className="relative mb-16">
				<Image
					priority={true}
					loading="eager"
					src={Peeking}
					alt="An airsoft player peeking from behind a wall"
					draggable={false}
					className="z-10 absolute -right-5 md:-right-0 -top-11 lg:-top-27 transition-all w-full max-w-[180px] lg:max-w-[300px] dark:invert"
				/>
				<h2 className="text-2xl font-bold mb-6">{t("latestRelease")}</h2>
				<Card className="relative overflow-hidden border-2 border-primary/20 shadow-lg">
					<CardHeader className="bg-primary/5">
						<CardTitle className="text-2xl flex items-center gap-2">
							{latestRelease.name ||
								t("version", {
									version: latestRelease.tag_name,
								})}
						</CardTitle>
						<div className="text-sm text-muted-foreground">
							{t("published", {
								date: new Date(latestRelease.published_at).toLocaleDateString(locale, {
									year: "numeric",
									month: "long",
									day: "numeric",
								}),
							})}
						</div>
					</CardHeader>
					<CardContent className="pt-6">
						<div className="markdown-content">
							{/* biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation> */}
							<div
								dangerouslySetInnerHTML={{
									__html: content,
								}}
							/>
						</div>
					</CardContent>
					<CardFooter className="bg-primary/5 border-t border-border flex justify-end py-4">
						<Button variant="outline" size="sm" asChild>
							<a
								href={latestRelease.html_url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2"
							>
								<SiGithub className="h-4 w-4" />
								{t("viewOnGithub")}
								<ExternalLink className="h-3 w-3" />
							</a>
						</Button>
					</CardFooter>
				</Card>
			</div>

			{/* Previous Releases */}
			{previousReleasesContent.length > 0 && (
				<div>
					<h2 className="text-2xl font-bold mb-6">{t("previousReleases")}</h2>
					<div className="space-y-6">
						{previousReleasesContent.map((release) => (
							<Card key={release.id} className="overflow-hidden">
								<CardHeader>
									<CardTitle className="text-xl">
										{release.name ||
											t("version", {
												version: release.tag_name,
											})}
									</CardTitle>
									<div className="text-sm text-muted-foreground">
										{t("published", {
											date: new Date(release.published_at).toLocaleDateString(locale, {
												year: "numeric",
												month: "long",
												day: "numeric",
											}),
										})}
									</div>
								</CardHeader>
								<CardContent>
									<div className="markdown-content">
										{/* biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation> */}
										<div
											dangerouslySetInnerHTML={{
												__html: release.formattedBody,
											}}
										/>
									</div>
								</CardContent>
								<CardFooter className="border-t border-border flex justify-end py-4">
									<Button variant="ghost" size="sm" asChild>
										<a
											href={release.html_url}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-2"
										>
											<SiGithub className="h-4 w-4" />
											{t("viewOnGithub")}
											<ExternalLink className="h-3 w-3" />
										</a>
									</Button>
								</CardFooter>
							</Card>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("public");

	return {
		title: t("changelog.metadata.title"),
		description: t("changelog.metadata.description"),
		keywords: t("layout.metadata.keywords")
			.split(",")
			.map((keyword) => keyword.trim()),
	};
}
