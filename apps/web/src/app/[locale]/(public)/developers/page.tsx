import { ArrowUpRightIcon, BookOpen, Code2, Key, Server, Terminal } from "lucide-react";
import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { WebPage, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export const revalidate = 86_400;

function normalizeApiBase(url: string): string {
	const trimmed = url.replace(/\/+$/, "");
	if (trimmed.endsWith("/api")) {
		return trimmed;
	}
	return `${trimmed}/api`;
}

export default async function DevelopersPage() {
	const t = await getExtracted();
	const locale = await getLocale();
	const apiBase = normalizeApiBase(env.NEXT_PUBLIC_BACKEND_URL);

	const schema: WithContext<WebPage> = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/developers`,
		name: t("RECONNED API — Developer Documentation"),
		description: t(
			"Build on RECONNED with our REST API and MCP server. Create API keys, integrate with your tools, and automate your airsoft community workflows.",
		),
		url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/developers`,
		publisher: {
			"@type": "Organization",
			name: "Reconned",
			url: env.NEXT_PUBLIC_WEB_URL,
		},
	};

	return (
		<div className="container mx-auto py-12 px-4 max-w-4xl">
			<JsonLdScript data={schema} />

			<div className="mb-12">
				<h1 className="text-4xl font-bold tracking-tight mb-4">{t("RECONNED API")}</h1>
				<p className="text-lg text-muted-foreground">
					{t(
						"Build on RECONNED with our REST API and MCP server. Create API keys, integrate with your tools, and automate your airsoft community workflows.",
					)}
				</p>
			</div>

			<section className="mb-12">
				<div className="flex items-center gap-3 mb-4">
					<Key className="h-6 w-6 text-primary" />
					<h2 className="text-2xl font-semibold">{t("API Keys")}</h2>
				</div>
				<p className="mb-4">
					{t(
						"API keys allow you to authenticate with the RECONNED API and MCP server. You can create and manage your keys from your account settings.",
					)}
				</p>
				<Link
					href="/dashboard/user/settings"
					className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
				>
					{t("Create an API key in your settings")}
					<ArrowUpRightIcon className="h-4 w-4" />
				</Link>
				<div className="mt-4 rounded-lg border bg-card p-4">
					<p className="text-sm font-medium mb-2">{t("Usage")}:</p>
					<code className="block bg-muted rounded-md px-3 py-2 text-sm font-mono">
						curl -H &quot;X-API-Key: your-api-key&quot; {env.NEXT_PUBLIC_WEB_URL}/api/mcp
					</code>
				</div>
			</section>

			<section className="mb-12">
				<div className="flex items-center gap-3 mb-4">
					<BookOpen className="h-6 w-6 text-primary" />
					<h2 className="text-2xl font-semibold">{t("API Documentation")}</h2>
				</div>
				<p className="mb-4">
					{t(
						"Our REST API is fully documented using the OpenAPI 3.1 specification. Browse the interactive API reference to explore all available endpoints, request schemas, and response types.",
					)}
				</p>
				<a
					href={`${env.NEXT_PUBLIC_BACKEND_URL}/api/docs`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
				>
					{t("Browse the API reference")}
					<ArrowUpRightIcon className="h-4 w-4" />
				</a>
			</section>

			<section className="mb-12">
				<div className="flex items-center gap-3 mb-4">
					<Server className="h-6 w-6 text-primary" />
					<h2 className="text-2xl font-semibold">{t("MCP Server")}</h2>
				</div>
				<p className="mb-4">
					{t(
						"RECONNED provides a Model Context Protocol (MCP) server that lets AI assistants and tools interact with the platform. The MCP server exposes tools for searching clubs, events, and players, as well as managing your RECONNED data.",
					)}
				</p>
				<p className="font-medium mb-2">{t("Endpoint")}:</p>
				<code className="block bg-muted rounded-md px-3 py-2 text-sm font-mono mb-4">POST /api/mcp</code>
				<p className="font-medium mb-2">{t("Authentication")}:</p>
				<p className="mb-4">
					{t("Pass your API key via the X-API-Key header or the Authorization: Bearer header.")}
				</p>
				<p className="font-medium mb-2">{t("Client configuration")}:</p>
				<pre className="bg-muted rounded-md px-3 py-2 text-sm font-mono overflow-x-auto">
					{`{
  "mcpServers": {
    "reconned": {
      "url": "${env.NEXT_PUBLIC_WEB_URL}/api/mcp",
      "headers": {
        "X-API-Key": "your-api-key"
      }
    }
  }
}`}
				</pre>
			</section>

			<section className="mb-12">
				<div className="flex items-center gap-3 mb-4">
					<Code2 className="h-6 w-6 text-primary" />
					<h2 className="text-2xl font-semibold">{t("Code Examples")}</h2>
				</div>
				<p className="mb-4">{t("Here are some example requests to get you started with the RECONNED API.")}</p>
				<div className="space-y-4">
					<div className="rounded-lg border bg-card p-4">
						<div className="flex items-center gap-2 mb-2">
							<Terminal className="h-4 w-4 text-muted-foreground" />
							<p className="text-sm font-medium">{t("List upcoming events")}</p>
						</div>
						<code className="block bg-muted rounded-md px-3 py-2 text-sm font-mono">
							curl {apiBase}/events/upcoming?limit=5
						</code>
					</div>
					<div className="rounded-lg border bg-card p-4">
						<div className="flex items-center gap-2 mb-2">
							<Terminal className="h-4 w-4 text-muted-foreground" />
							<p className="text-sm font-medium">{t("Search clubs")}</p>
						</div>
						<code className="block bg-muted rounded-md px-3 py-2 text-sm font-mono">
							curl {apiBase}/clubs?search=airsoft&limit=10
						</code>
					</div>
				</div>
			</section>
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("RECONNED API — Developer Documentation"),
		description: t(
			"Build on RECONNED with our REST API and MCP server. Create API keys, integrate with your tools, and automate your airsoft community workflows.",
		),
		keywords: t(
			"RECONNED API, developer documentation, REST API, MCP server, API keys, integration, automation, airsoft API, Model Context Protocol",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("RECONNED API — Developer Documentation"),
			description: t(
				"Build on RECONNED with our REST API and MCP server. Create API keys, integrate with your tools, and automate your airsoft community workflows.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/developers", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("RECONNED API — Developer Documentation"),
			description: t(
				"Build on RECONNED with our REST API and MCP server. Create API keys, integrate with your tools, and automate your airsoft community workflows.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/developers", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/developers", locale),
		},
	};
}
