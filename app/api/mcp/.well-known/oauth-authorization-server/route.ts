/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * Served at MCP-relative path for MCP client discovery
 */

import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const baseUrl = process.env.OAUTH_ISSUER || "https://workflowy-mcp-mauve.vercel.app";
  const mcpBase = `${baseUrl}/api/mcp`;

  const metadata = {
    issuer: baseUrl,
    authorization_endpoint: `${mcpBase}/oauth/authorize`,
    token_endpoint: `${mcpBase}/oauth/token`,
    registration_endpoint: `${mcpBase}/oauth/register`,
    scopes_supported: ["workflowy"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
  };

  return NextResponse.json(metadata);
}
