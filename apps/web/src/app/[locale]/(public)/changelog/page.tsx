import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import sanitizeHtml from "sanitize-html";
import { parse } from "yaml";
import JsonLdScript from "@/components/json-ld-script";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

import "./markdown.css";
import sanitize from "sanitize-html";
import type { CollectionPage, WithContext } from "schema-dts";
import { ErrorPage } from "@/components/error-page";
import { PeekingDrawing } from "@/components/logos/drawings/peeking-drawing";

interface ChangelogEntry {
	tag_name: string;
	name: string;
	published_at: string;
	body: string;
	html_url?: string;
}

// Helper function to format markdown content
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

// Helper function to parse changelog markdown file
async function parseChangelogFile(filename: string): Promise<ChangelogEntry> {
	const filePath = join(process.cwd(), "src/content/changelogs", filename);
	const content = await readFile(filePath, "utf-8");

	// Extract version from filename (remove .md extension)
	const tag_name = filename.replace(".md", "");

	// Parse YAML front matter
	const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	let frontMatter: { title?: string; date?: string } | null = null;
	let body = content;

	if (frontMatterMatch?.[1] && frontMatterMatch[2]) {
		try {
			const parsed = parse(frontMatterMatch[1]);
			if (parsed && typeof parsed === "object") {
				frontMatter = parsed as { title?: string; date?: string };
			}
			body = frontMatterMatch[2].trim();
		} catch (error) {
			console.warn(`Failed to parse front matter in ${filename}:`, error);
		}
	}

	const title = frontMatter?.title ?? `Version ${tag_name}`;
	const published_at = frontMatter?.date ? new Date(frontMatter.date).toISOString() : new Date().toISOString();

	return {
		tag_name,
		name: title,
		published_at,
		body,
	};
}

// Load all changelog entries from markdown files
async function loadChangelogs(): Promise<ChangelogEntry[]> {
	try {
		const changelogsDir = join(process.cwd(), "src/content/changelogs");
		const files = await readdir(changelogsDir);

		// Filter for .md files and sort by version (newest first)
		const mdFiles = files
			.filter((file) => file.endsWith(".md"))
			.sort((a, b) => {
				const aVersion = a.replace(".md", "").split(".").map(Number);
				const bVersion = b.replace(".md", "").split(".").map(Number);

				// Compare version numbers
				for (let i = 0; i < Math.max(aVersion.length, bVersion.length); i++) {
					const aPart = aVersion[i] || 0;
					const bPart = bVersion[i] || 0;
					if (aPart !== bPart) {
						return bPart - aPart; // Descending order
					}
				}
				return 0;
			});

		const changelogs = await Promise.all(mdFiles.map(parseChangelogFile));
		return changelogs;
	} catch (error) {
		console.error("Error loading changelogs:", error);
		return [];
	}
}

export const revalidate = 3600; // 1 hour

// Main changelog page
export default async function ChangelogPage() {
	const t = await getExtracted();
	const locale = await getLocale();

	// Load changelogs from markdown files
	const releases = await loadChangelogs();

	if (releases.length === 0) {
		return (
			<div className="container mx-auto py-12 px-4 md:px-6">
				<div className="text-center mb-12">
					<h1 className="text-4xl font-bold mb-4">{t("Changes")}</h1>
					<p className="text-lg text-muted-foreground">{t("The RECONNED changelog")}</p>
				</div>

				<Alert variant="destructive" className="mb-6">
					<AlertTriangle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{t("There's been a problem while trying to get the changelog")}</AlertDescription>
				</Alert>
			</div>
		);
	}

	// Get the latest release and previous releases
	const latestRelease = releases[0];
	const previousReleases = releases.slice(1);

	if (!latestRelease) {
		return <ErrorPage title={t("No releases found")} />;
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
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/changelog`,
		name: t("Changelog - RECONNED"),
		description: t(
			"The changelog for the RECONNED platform. The first universal platform for airsoft clubs, events, and players.",
		),
		url: `${env.NEXT_PUBLIC_WEB_URL}/changelog`,
		mainEntity: {
			"@type": "ItemList",
			name: "Reconned Releases",
			description: "Software releases and updates for the Reconned platform",
			itemListElement: releases.map((release, index) => ({
				"@type": "ListItem",
				position: index + 1,
				item: {
					"@type": "Article",
					"@id": `${env.NEXT_PUBLIC_WEB_URL}/changelog#${release.tag_name}`,
					headline: release.name || `Version ${release.tag_name}`,
					datePublished: release.published_at,
					dateModified: release.published_at,
					author: {
						"@type": "Organization",
						name: "Reconned Team",
						url: env.NEXT_PUBLIC_WEB_URL,
					},
					publisher: {
						"@type": "Organization",
						name: "Reconned",
						url: env.NEXT_PUBLIC_WEB_URL,
						logo: `${env.NEXT_PUBLIC_WEB_URL}/reconned-logo-light.svg`,
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
				<h1 className="text-4xl font-bold mb-4">{t("Changes")}</h1>
				<p className="text-lg text-muted-foreground">{t("The RECONNED changelog")}</p>
			</div>

			{/* Latest Release */}
			<div className="relative mb-16">
				<PeekingDrawing className="z-10 absolute -right-5 md:-right-0 -top-11 lg:-top-27 transition-all w-full max-w-[180px] lg:max-w-[300px] dark:invert" />
				<h2 className="text-2xl font-bold mb-6">{t("Latest version")}</h2>
				<Card className="relative overflow-hidden border-2 border-primary/20 shadow-lg">
					<CardHeader className="bg-primary/5">
						<CardTitle className="text-2xl flex items-center gap-2">
							{latestRelease.name ||
								t("Version {version}", {
									version: latestRelease.tag_name,
								})}
						</CardTitle>
						<div className="text-sm text-muted-foreground">
							{t("Posted {date}", {
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
									__html: sanitizeHtml(content),
								}}
							/>
						</div>
					</CardContent>
					<CardFooter className="bg-primary/5 border-t border-border flex justify-end py-4">
						<div className="text-sm text-muted-foreground">Version {latestRelease.tag_name}</div>
					</CardFooter>
				</Card>
			</div>

			{/* Previous Releases */}
			{previousReleasesContent.length > 0 && (
				<div>
					<h2 className="text-2xl font-bold mb-6">{t("Previous versions")}</h2>
					<div className="space-y-6">
						{previousReleasesContent.map((release) => (
							<Card key={release.tag_name} className="overflow-hidden">
								<CardHeader>
									<CardTitle className="text-xl">
										{release.name ||
											t.rich("Version {version}", {
												version: release.tag_name,
											})}
									</CardTitle>
									<div className="text-sm text-muted-foreground">
										{t("Posted {date}", {
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
												__html: sanitizeHtml(release.formattedBody),
											}}
										/>
									</div>
								</CardContent>
								<CardFooter className="border-t border-border flex justify-end py-4">
									<div className="text-sm text-muted-foreground">Version {release.tag_name}</div>
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
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("RECONNED Changelog - Latest Updates & Features"),
		description: t(
			"Stay updated with the latest changes, new features, and improvements to the RECONNED airsoft platform. See what's new and what's coming next.",
		),
		keywords: t(
			"airsoft Bosnia, airsoft BiH, airsoft weapons, airsoft replicas, airsoft equipment, airsoft clubs BiH, airsoft shop BiH, airsoft store, airsoft rifles, airsoft pistols, airsoft bullets, airsoft BBs, airsoft mask, airsoft clothing, airsoft uniforms, airsoft BiH forum, airsoft events BiH, airsoft rules, airsoft tactics, airsoft players BiH, best airsoft BiH, buying airsoft BiH, selling airsoft BiH, airsoft teams BiH, airsoft locations BiH, airsoft field BiH",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("RECONNED Changelog - Latest Updates & Features"),
			description: t(
				"Stay updated with the latest changes, new features, and improvements to the RECONNED airsoft platform. See what's new and what's coming next.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/changelog", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("RECONNED Changelog - Latest Updates & Features"),
			description: t(
				"Stay updated with the latest changes, new features, and improvements to the RECONNED airsoft platform. See what's new and what's coming next.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/changelog", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/changelog", locale),
		},
	};
}
