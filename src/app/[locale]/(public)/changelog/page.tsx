import { SiGithub } from "@icons-pack/react-simple-icons";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import JsonLdScript from "@/components/json-ld-script";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";

import "./markdown.css";
import DOMPurify from "isomorphic-dompurify";
import type { CollectionPage, WithContext } from "schema-dts";
import { PeekingDrawing } from "@/components/logos/drawings/peeking-drawing";

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
export default async function ChangelogPage(props: { params: Promise<{ locale: string }> }) {
	const [params] = await Promise.all([props.params]);
	const t = await getTranslations();
	const locale = params.locale;

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
					<h1 className="text-4xl font-bold mb-4">{t("public.changelog.title")}</h1>
					<p className="text-lg text-muted-foreground">{t("public.changelog.description")}</p>
				</div>

				<Alert variant="destructive" className="mb-6">
					<AlertTriangle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{t("public.changelog.errorLoading")}</AlertDescription>
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

	const changelogSchema: WithContext<CollectionPage> = {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/changelog`,
		name: t("public.changelog.metadata.title"),
		description: t("public.changelog.metadata.description"),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/changelog`,
		mainEntity: {
			"@type": "ItemList",
			name: "Reconned Releases",
			description: "Software releases and updates for the Reconned platform",
			itemListElement: releases.map((release, index) => ({
				"@type": "ListItem",
				position: index + 1,
				item: {
					"@type": "Article",
					"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/changelog#${release.tag_name}`,
					headline: release.name || `Version ${release.tag_name}`,
					datePublished: release.published_at,
					dateModified: release.published_at,
					author: {
						"@type": "Organization",
						name: "Reconned Team",
						url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
					},
					publisher: {
						"@type": "Organization",
						name: "Reconned",
						url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
						logo: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/reconned-logo-light.svg`,
					},
					articleBody: release.body,
					url: release.html_url,
				},
			})),
		},
	};

	return (
		<div className="container mx-auto py-12 px-4 md:px-6">
			<JsonLdScript data={changelogSchema} />
			<div className="text-center mb-12">
				<h1 className="text-4xl font-bold mb-4">{t("public.changelog.title")}</h1>
				<p className="text-lg text-muted-foreground">{t("public.changelog.description")}</p>
			</div>

			{/* Latest Release */}
			<div className="relative mb-16">
				<PeekingDrawing className="z-10 absolute -right-5 md:-right-0 -top-11 lg:-top-27 transition-all w-full max-w-[180px] lg:max-w-[300px] dark:invert" />
				<h2 className="text-2xl font-bold mb-6">{t("public.changelog.latestRelease")}</h2>
				<Card className="relative overflow-hidden border-2 border-primary/20 shadow-lg">
					<CardHeader className="bg-primary/5">
						<CardTitle className="text-2xl flex items-center gap-2">
							{latestRelease.name ||
								t.rich("public.changelog.version", {
									version: latestRelease.tag_name,
								})}
						</CardTitle>
						<div className="text-sm text-muted-foreground">
							{t("public.changelog.published", {
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
							<div
								// biome-ignore lint/security/noDangerouslySetInnerHtml: It's md content
								dangerouslySetInnerHTML={{
									__html: DOMPurify.sanitize(content),
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
								{t("public.changelog.viewOnGithub")}
								<ExternalLink className="h-3 w-3" />
							</a>
						</Button>
					</CardFooter>
				</Card>
			</div>

			{/* Previous Releases */}
			{previousReleasesContent.length > 0 && (
				<div>
					<h2 className="text-2xl font-bold mb-6">{t("public.changelog.previousReleases")}</h2>
					<div className="space-y-6">
						{previousReleasesContent.map((release) => (
							<Card key={release.id} className="overflow-hidden">
								<CardHeader>
									<CardTitle className="text-xl">
										{release.name ||
											t.rich("public.changelog.version", {
												version: release.tag_name,
											})}
									</CardTitle>
									<div className="text-sm text-muted-foreground">
										{t("public.changelog.published", {
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
										<div
											// biome-ignore lint/security/noDangerouslySetInnerHtml: It's md content
											dangerouslySetInnerHTML={{
												__html: DOMPurify.sanitize(release.formattedBody),
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
											{t("public.changelog.viewOnGithub")}
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

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
	const params = await props.params;
	const t = await getTranslations();

	return {
		title: t("public.changelog.metadata.title"),
		description: t("public.changelog.metadata.description"),
		keywords: t("public.layout.metadata.keywords")
			.split(",")
			.map((keyword) => keyword.trim()),
		alternates: {
			canonical: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${params.locale}/changelog`,
			languages: {
				bs: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/bs/changelog`,
				en: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/en/changelog`,
				"x-default": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/bs/changelog`,
			},
		},
	};
}
