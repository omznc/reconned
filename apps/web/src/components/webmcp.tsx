"use client";

import { useEffect } from "react";
import { env } from "@/lib/env";

type WebMCPToolResult = { content: Array<{ type: "text"; text: string }> };

type WebMCPTool = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute: (args: Record<string, unknown>) => Promise<WebMCPToolResult>;
};

type ModelContext = {
	provideContext: (context: { tools: WebMCPTool[] }) => void;
};

async function fetchAsToolResult(url: URL): Promise<WebMCPToolResult> {
	const response = await fetch(url);
	if (!response.ok) {
		return { content: [{ type: "text", text: `Request failed with status ${response.status}` }] };
	}
	return { content: [{ type: "text", text: await response.text() }] };
}

/**
 * Exposes site tools to in-browser AI agents via WebMCP
 * (https://webmachinelearning.github.io/webmcp/). No-op in browsers
 * without `document.modelContext` (or the older `navigator.modelContext`).
 */
export function WebMCP() {
	useEffect(() => {
		// Chrome moved the API from navigator.modelContext to document.modelContext;
		// the navigator entry lingers as a deprecated stub without provideContext.
		const modelContext =
			(document as Document & { modelContext?: ModelContext }).modelContext ??
			(navigator as Navigator & { modelContext?: ModelContext }).modelContext;
		if (typeof modelContext?.provideContext !== "function") {
			return;
		}

		const backendUrl = env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "");

		try {
			modelContext.provideContext({
				tools: [
					{
						name: "search_clubs",
						description:
							"Search public airsoft clubs on RECONNED by name or location. Returns a JSON list of clubs with pagination.",
						inputSchema: {
							type: "object",
							properties: {
								search: { type: "string", description: "Name or location to search for" },
								page: { type: "number", description: "Page number, starting at 1" },
							},
						},
						execute: async (args) => {
							const url = new URL(`${backendUrl}/api/clubs`);
							if (typeof args.search === "string") url.searchParams.set("search", args.search);
							url.searchParams.set("page", String(typeof args.page === "number" ? args.page : 1));
							url.searchParams.set("perPage", "10");
							return fetchAsToolResult(url);
						},
					},
					{
						name: "search_events",
						description:
							"Search public airsoft events on RECONNED by name or location. Returns a JSON list of events with pagination.",
						inputSchema: {
							type: "object",
							properties: {
								search: { type: "string", description: "Name or location to search for" },
								page: { type: "number", description: "Page number, starting at 1" },
							},
						},
						execute: async (args) => {
							const url = new URL(`${backendUrl}/api/events`);
							if (typeof args.search === "string") url.searchParams.set("search", args.search);
							url.searchParams.set("page", String(typeof args.page === "number" ? args.page : 1));
							url.searchParams.set("perPage", "10");
							return fetchAsToolResult(url);
						},
					},
				],
			});
		} catch {
			// WebMCP is best-effort; an API shape change must never break the page.
		}
	}, []);

	return null;
}
