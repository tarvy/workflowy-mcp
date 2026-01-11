/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 *
 * This endpoint tells MCP clients where to find the authorization server.
 * Required for MCP OAuth flow discovery.
 */

import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const baseUrl = process.env.OAUTH_ISSUER || "https://workflowy-mcp-mauve.vercel.app";
  const mcpBase = `${baseUrl}/api/mcp`;

  const metadata = {
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [baseUrl],
    scopes_supported: ["workflowy"],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}
