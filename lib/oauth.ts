/**
 * OAuth 2.0 utilities for Workflowy MCP Server
 *
 * - PKCE S256 verification
 * - JWT access token generation and verification
 * - Workflowy API key validation
 * - Redirect URI validation
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { encrypt, decrypt } from "./crypto";
import type { JWTPayload } from "./types";

// ==================== PKCE ====================

/**
 * Verify PKCE code challenge (S256 only)
 *
 * code_challenge = BASE64URL(SHA256(code_verifier))
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string
): boolean {
  // SHA256 hash the verifier
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();

  // Base64url encode (RFC 4648 - no padding)
  const computed = hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // Constant-time comparison
  if (computed.length !== codeChallenge.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(codeChallenge)
  );
}

// ==================== JWT Access Tokens ====================

/**
 * Generate a JWT access token with encrypted Workflowy API key
 */
export function generateAccessToken(
  clientId: string,
  workflowyApiKey: string,
  expiresInSeconds: number = 3600 // 1 hour default
): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  const issuer = process.env.OAUTH_ISSUER || "https://workflowy-mcp-mauve.vercel.app";

  // Encrypt the Workflowy API key before embedding in JWT
  const encryptedKey = encrypt(workflowyApiKey);

  const payload: Omit<JWTPayload, "exp" | "iat"> = {
    sub: clientId,
    iss: issuer,
    aud: issuer,
    scope: "workflowy",
    wf_key: encryptedKey,
  };

  return jwt.sign(payload, jwtSecret, {
    expiresIn: expiresInSeconds,
    algorithm: "HS256",
  });
}

/**
 * Verify a JWT access token and extract the Workflowy API key
 *
 * Returns the decrypted Workflowy API key if valid, null otherwise
 */
export function verifyAccessToken(token: string): {
  workflowyApiKey: string;
  clientId: string;
  scope: string;
} | null {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
    }) as JWTPayload;

    // Decrypt the Workflowy API key
    const workflowyApiKey = decrypt(decoded.wf_key);

    return {
      workflowyApiKey,
      clientId: decoded.sub,
      scope: decoded.scope,
    };
  } catch {
    // Token invalid, expired, or malformed
    return null;
  }
}

// ==================== Workflowy API Validation ====================

/**
 * Validate a Workflowy API key by making a test API call
 *
 * Returns true if the key is valid, false otherwise
 */
export async function validateWorkflowyApiKey(apiKey: string): Promise<boolean> {
  try {
    // Use the targets endpoint as a lightweight validation call
    const response = await fetch("https://workflowy.com/api/v1/targets", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // 200 OK means the key is valid
    return response.ok;
  } catch {
    // Network error or other issue
    return false;
  }
}

// ==================== Redirect URI Validation ====================

/**
 * Check if a redirect URI is valid for a client
 *
 * - Must exactly match one of the registered URIs
 * - localhost URIs are allowed for development
 * - HTTPS required for non-localhost URIs
 */
export function isValidRedirectUri(
  uri: string,
  registeredUris: string[]
): boolean {
  // Exact match required
  if (!registeredUris.includes(uri)) {
    return false;
  }

  try {
    const parsed = new URL(uri);

    // localhost is allowed with http
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    }

    // All other URIs must use HTTPS
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ==================== Token Hashing ====================

/**
 * Hash a refresh token for storage
 * Uses SHA-256 (deterministic, so we can look it up)
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
