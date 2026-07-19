// Some agent scanners look for the MCP server card at `/.well-known/mcp.json`
// instead of the SEP-1649 path — serve the same card at both.
export { GET } from "@/app/.well-known/mcp/server-card.json/route";
