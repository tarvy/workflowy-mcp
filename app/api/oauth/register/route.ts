/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591)
 *
 * POST /api/oauth/register
 */

import { NextRequest, NextResponse } from "next/server";
import { generateClientId, generateClientSecret } from "@/lib/crypto";
import { createOAuthClient } from "@/lib/db";
import type { DCRRequest, DCRResponse, OAuthError } from "@/lib/types";

export async function POST(req: NextRequest): Promise<NextResponse<DCRResponse | OAuthError>> {
  // Require admin secret for client registration
  const registrationSecret = process.env.OAUTH_REGISTRATION_SECRET;
  if (registrationSecret) {
    const providedSecret = req.headers.get("x-oauth-registration-secret");
    if (providedSecret !== registrationSecret) {
      return NextResponse.json(
        {
          error: "access_denied",
          error_description: "Invalid or missing registration secret",
        } as OAuthError,
        { status: 403 }
      );
    }
  }

  try {
    const body = await req.json() as DCRRequest;

    // Validate required fields
    if (!body.redirect_uris || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: "redirect_uris is required and must be a non-empty array",
        } as OAuthError,
        { status: 400 }
      );
    }

    // Validate redirect URIs
    for (const uri of body.redirect_uris) {
      try {
        const parsed = new URL(uri);
        // Allow localhost with http, require https for everything else
        const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
        if (!isLocalhost && parsed.protocol !== "https:") {
          return NextResponse.json(
            {
              error: "invalid_request",
              error_description: `Redirect URI must use HTTPS: ${uri}`,
            } as OAuthError,
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          {
            error: "invalid_request",
            error_description: `Invalid redirect URI: ${uri}`,
          } as OAuthError,
          { status: 400 }
        );
      }
    }

    // Generate client credentials
    const clientId = generateClientId();
    const clientSecret = generateClientSecret();

    // Default grant types
    const grantTypes = body.grant_types || ["authorization_code", "refresh_token"];

    // Validate grant types
    const allowedGrantTypes = ["authorization_code", "refresh_token"];
    for (const grantType of grantTypes) {
      if (!allowedGrantTypes.includes(grantType)) {
        return NextResponse.json(
          {
            error: "invalid_request",
            error_description: `Unsupported grant type: ${grantType}`,
          } as OAuthError,
          { status: 400 }
        );
      }
    }

    // Store client in database
    await createOAuthClient(
      clientId,
      clientSecret,
      body.client_name || null,
      body.redirect_uris,
      grantTypes
    );

    const response: DCRResponse = {
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0, // Never expires
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
      grant_types: grantTypes,
      response_types: ["code"],
    };

    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        error: "server_error",
        error_description: "Failed to register client",
      } as OAuthError,
      { status: 500 }
    );
  }
}
