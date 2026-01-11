/**
 * OAuth 2.0 Token Endpoint
 *
 * POST /api/oauth/token
 * - grant_type=authorization_code: Exchange code for tokens
 * - grant_type=refresh_token: Refresh access token
 */

import { NextRequest, NextResponse } from "next/server";
import {
  consumeAuthorizationCode,
  verifyClientCredentials,
  storeRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
} from "@/lib/db";
import { decrypt, generateRefreshToken as generateRefreshTokenValue } from "@/lib/crypto";
import {
  verifyCodeChallenge,
  generateAccessToken,
  hashRefreshToken,
} from "@/lib/oauth";
import type { TokenResponse, OAuthError } from "@/lib/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function errorResponse(error: string, description: string, status: number = 400): NextResponse<OAuthError> {
  return NextResponse.json(
    { error, error_description: description } as OAuthError,
    { status, headers: corsHeaders }
  );
}

/**
 * Extract client credentials from request
 * Supports both Basic auth header and POST body
 */
function extractClientCredentials(
  req: NextRequest,
  body: URLSearchParams
): { clientId: string; clientSecret: string } | null {
  // Check Authorization header (Basic auth)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const base64 = authHeader.slice(6);
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const [clientId, clientSecret] = decoded.split(":");
    if (clientId && clientSecret) {
      return { clientId, clientSecret };
    }
  }

  // Fall back to POST body
  const clientId = body.get("client_id");
  const clientSecret = body.get("client_secret");
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }

  return null;
}

/**
 * OPTIONS /api/oauth/token - CORS preflight
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * POST /api/oauth/token
 */
export async function POST(req: NextRequest): Promise<NextResponse<TokenResponse | OAuthError>> {
  console.log("[TOKEN] Request received:", req.method, req.url);
  console.log("[TOKEN] Headers:", Object.fromEntries(req.headers.entries()));

  // Parse form data
  const contentType = req.headers.get("content-type") || "";
  let body: URLSearchParams;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    body = new URLSearchParams(text);
  } else if (contentType.includes("application/json")) {
    const json = await req.json();
    body = new URLSearchParams(json);
  } else {
    return errorResponse("invalid_request", "Content-Type must be application/x-www-form-urlencoded or application/json");
  }

  const grantType = body.get("grant_type");
  console.log("[TOKEN] Grant type:", grantType);
  console.log("[TOKEN] Body params:", Object.fromEntries(body.entries()));

  if (grantType === "authorization_code") {
    console.log("[TOKEN] Handling authorization_code grant");
    return handleAuthorizationCode(req, body);
  } else if (grantType === "refresh_token") {
    console.log("[TOKEN] Handling refresh_token grant");
    return handleRefreshToken(req, body);
  } else {
    console.log("[TOKEN] Unsupported grant type:", grantType);
    return errorResponse("unsupported_grant_type", "Supported grant types: authorization_code, refresh_token");
  }
}

/**
 * Handle authorization_code grant type
 */
async function handleAuthorizationCode(
  req: NextRequest,
  body: URLSearchParams
): Promise<NextResponse<TokenResponse | OAuthError>> {
  // Extract client credentials
  const credentials = extractClientCredentials(req, body);
  console.log("[TOKEN] Client credentials extracted:", credentials ? `clientId=${credentials.clientId}` : "none");
  if (!credentials) {
    console.log("[TOKEN] ERROR: No client credentials");
    return errorResponse("invalid_client", "Client authentication required");
  }

  // Verify client credentials
  console.log("[TOKEN] Verifying client credentials...");
  const isValidClient = await verifyClientCredentials(credentials.clientId, credentials.clientSecret);
  console.log("[TOKEN] Client valid:", isValidClient);
  if (!isValidClient) {
    console.log("[TOKEN] ERROR: Invalid client credentials");
    return errorResponse("invalid_client", "Invalid client credentials", 401);
  }

  // Get required parameters
  const code = body.get("code");
  const redirectUri = body.get("redirect_uri");
  const codeVerifier = body.get("code_verifier");

  if (!code) {
    return errorResponse("invalid_request", "code is required");
  }
  if (!redirectUri) {
    return errorResponse("invalid_request", "redirect_uri is required");
  }
  if (!codeVerifier) {
    return errorResponse("invalid_request", "code_verifier is required (PKCE)");
  }

  // Get and consume authorization code (one-time use)
  const authCode = await consumeAuthorizationCode(code);
  if (!authCode) {
    return errorResponse("invalid_grant", "Authorization code not found or already used");
  }

  // Check expiration
  if (new Date() > authCode.expires_at) {
    return errorResponse("invalid_grant", "Authorization code expired");
  }

  // Verify client_id matches
  if (authCode.client_id !== credentials.clientId) {
    return errorResponse("invalid_grant", "Authorization code was not issued to this client");
  }

  // Verify redirect_uri matches
  if (authCode.redirect_uri !== redirectUri) {
    return errorResponse("invalid_grant", "redirect_uri does not match");
  }

  // Verify PKCE
  if (!verifyCodeChallenge(codeVerifier, authCode.code_challenge)) {
    return errorResponse("invalid_grant", "PKCE verification failed");
  }

  // Decrypt Workflowy API key
  const workflowyApiKey = decrypt(authCode.workflowy_api_key_encrypted);

  // Generate access token (JWT with encrypted API key)
  const accessToken = generateAccessToken(credentials.clientId, workflowyApiKey, 3600);

  // Generate refresh token
  const refreshTokenValue = generateRefreshTokenValue();
  const refreshTokenHash = hashRefreshToken(refreshTokenValue);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Store refresh token (re-encrypt API key for storage)
  await storeRefreshToken(
    refreshTokenHash,
    credentials.clientId,
    authCode.workflowy_api_key_encrypted, // Already encrypted
    "workflowy",
    refreshExpiresAt
  );

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: refreshTokenValue,
    scope: "workflowy",
  };

  return NextResponse.json(response, { headers: corsHeaders });
}

/**
 * Handle refresh_token grant type
 */
async function handleRefreshToken(
  req: NextRequest,
  body: URLSearchParams
): Promise<NextResponse<TokenResponse | OAuthError>> {
  // Extract client credentials
  const credentials = extractClientCredentials(req, body);
  if (!credentials) {
    return errorResponse("invalid_client", "Client authentication required");
  }

  // Verify client credentials
  const isValidClient = await verifyClientCredentials(credentials.clientId, credentials.clientSecret);
  if (!isValidClient) {
    return errorResponse("invalid_client", "Invalid client credentials", 401);
  }

  // Get refresh token
  const refreshTokenValue = body.get("refresh_token");
  if (!refreshTokenValue) {
    return errorResponse("invalid_request", "refresh_token is required");
  }

  // Look up refresh token by hash
  const refreshTokenHash = hashRefreshToken(refreshTokenValue);
  const storedToken = await getRefreshToken(refreshTokenHash);

  if (!storedToken) {
    return errorResponse("invalid_grant", "Refresh token not found or already used");
  }

  // Check expiration
  if (new Date() > storedToken.expires_at) {
    await deleteRefreshToken(refreshTokenHash);
    return errorResponse("invalid_grant", "Refresh token expired");
  }

  // Verify client_id matches
  if (storedToken.client_id !== credentials.clientId) {
    return errorResponse("invalid_grant", "Refresh token was not issued to this client");
  }

  // Delete old refresh token (rotation)
  await deleteRefreshToken(refreshTokenHash);

  // Decrypt Workflowy API key
  const workflowyApiKey = decrypt(storedToken.workflowy_api_key_encrypted);

  // Generate new access token
  const accessToken = generateAccessToken(credentials.clientId, workflowyApiKey, 3600);

  // Generate new refresh token (rotation)
  const newRefreshTokenValue = generateRefreshTokenValue();
  const newRefreshTokenHash = hashRefreshToken(newRefreshTokenValue);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Store new refresh token
  await storeRefreshToken(
    newRefreshTokenHash,
    credentials.clientId,
    storedToken.workflowy_api_key_encrypted, // Keep same encrypted key
    storedToken.scope,
    refreshExpiresAt
  );

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: newRefreshTokenValue,
    scope: storedToken.scope,
  };

  return NextResponse.json(response, { headers: corsHeaders });
}
