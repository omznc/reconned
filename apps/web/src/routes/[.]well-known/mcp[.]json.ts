import { createFileRoute } from "@tanstack/react-router";
import { GET } from "./mcp/server-card[.]json";

// Some agent scanners look for the MCP server card at `/.well-known/mcp.json`
// instead of the SEP-1649 path — serve the same card at both.
export const Route = createFileRoute("/.well-known/mcp.json")({
	server: { handlers: { GET } },
});
