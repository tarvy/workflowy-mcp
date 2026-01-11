/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 *
 * GET /.well-known/oauth-authorization-server
 */

import { NextResponse } from "next/server";
import type { OAuthMetadata } from "@/lib/types";

export async function GET(): Promise<NextResponse<OAuthMetadata>> {
  const issuer = process.env.OAUTH_ISSUER || "https://workflowy-mcp-mauve.vercel.app";

  // Use MCP-relative paths for consistency with MCP client discovery
  const metadata: OAuthMetadata = {
    issuer,
    authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    scopes_supported: ["workflowy"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
