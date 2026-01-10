/**
 * Database utilities for OAuth 2.0
 *
 * Uses Neon serverless PostgreSQL with inline schema creation
 */

import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import type {
  OAuthClient,
  AuthorizationCode,
  RefreshToken,
} from "./types";
import { hashSecret, verifySecret } from "./crypto";

let sql: NeonQueryFunction<false, false> | null = null;

/**
 * Get database connection and ensure OAuth tables exist
 */
export async function getDb(): Promise<NeonQueryFunction<false, false>> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!sql) {
    sql = neon(databaseUrl);
  }

  // Create OAuth tables if they don't exist
  await initOAuthTables(sql);

  return sql;
}

/**
 * Initialize OAuth database tables
 */
async function initOAuthTables(sql: NeonQueryFunction<false, false>): Promise<void> {
  // OAuth clients table
  await sql`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      client_id TEXT PRIMARY KEY,
      client_secret_hash TEXT NOT NULL,
      client_name TEXT,
      redirect_uris TEXT[] NOT NULL,
      grant_types TEXT[] DEFAULT ARRAY['authorization_code', 'refresh_token'],
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Authorization codes table (10 min TTL)
  await sql`
    CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT DEFAULT 'S256',
      workflowy_api_key_encrypted TEXT NOT NULL,
      state TEXT,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Refresh tokens table (30 day TTL, rotated on use)
  await sql`
    CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      workflowy_api_key_encrypted TEXT NOT NULL,
      scope TEXT DEFAULT 'workflowy',
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

// ==================== OAuth Clients ====================

/**
 * Create a new OAuth client
 */
export async function createOAuthClient(
  clientId: string,
  clientSecret: string,
  clientName: string | null,
  redirectUris: string[],
  grantTypes: string[] = ["authorization_code", "refresh_token"]
): Promise<void> {
  const db = await getDb();
  const secretHash = hashSecret(clientSecret);

  await db`
    INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, redirect_uris, grant_types)
    VALUES (${clientId}, ${secretHash}, ${clientName}, ${redirectUris}, ${grantTypes})
  `;
}

/**
 * Get an OAuth client by ID
 */
export async function getOAuthClient(clientId: string): Promise<OAuthClient | null> {
  const db = await getDb();
  const result = await db`
    SELECT client_id, client_secret_hash, client_name, redirect_uris, grant_types, created_at
    FROM oauth_clients
    WHERE client_id = ${clientId}
  `;

  if (result.length === 0) return null;

  const row = result[0];
  return {
    client_id: row.client_id as string,
    client_secret_hash: row.client_secret_hash as string,
    client_name: row.client_name as string | null,
    redirect_uris: row.redirect_uris as string[],
    grant_types: row.grant_types as string[],
    created_at: new Date(row.created_at as string),
  };
}

/**
 * Verify client credentials
 */
export async function verifyClientCredentials(
  clientId: string,
  clientSecret: string
): Promise<boolean> {
  const client = await getOAuthClient(clientId);
  if (!client) return false;

  return verifySecret(clientSecret, client.client_secret_hash);
}

// ==================== Authorization Codes ====================

/**
 * Store an authorization code
 */
export async function storeAuthorizationCode(
  code: string,
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  codeChallengeMethod: string,
  workflowyApiKeyEncrypted: string,
  state: string | null,
  expiresAt: Date
): Promise<void> {
  const db = await getDb();

  await db`
    INSERT INTO oauth_authorization_codes
    (code, client_id, redirect_uri, code_challenge, code_challenge_method, workflowy_api_key_encrypted, state, expires_at)
    VALUES (${code}, ${clientId}, ${redirectUri}, ${codeChallenge}, ${codeChallengeMethod}, ${workflowyApiKeyEncrypted}, ${state}, ${expiresAt})
  `;
}

/**
 * Get and delete an authorization code (one-time use)
 */
export async function consumeAuthorizationCode(code: string): Promise<AuthorizationCode | null> {
  const db = await getDb();

  // Get the code
  const result = await db`
    SELECT code, client_id, redirect_uri, code_challenge, code_challenge_method,
           workflowy_api_key_encrypted, state, expires_at, created_at
    FROM oauth_authorization_codes
    WHERE code = ${code}
  `;

  if (result.length === 0) return null;

  // Delete the code (one-time use)
  await db`DELETE FROM oauth_authorization_codes WHERE code = ${code}`;

  const row = result[0];
  return {
    code: row.code as string,
    client_id: row.client_id as string,
    redirect_uri: row.redirect_uri as string,
    code_challenge: row.code_challenge as string,
    code_challenge_method: row.code_challenge_method as string,
    workflowy_api_key_encrypted: row.workflowy_api_key_encrypted as string,
    state: row.state as string | null,
    expires_at: new Date(row.expires_at as string),
    created_at: new Date(row.created_at as string),
  };
}

/**
 * Clean up expired authorization codes
 */
export async function cleanupExpiredCodes(): Promise<number> {
  const db = await getDb();
  const result = await db`
    DELETE FROM oauth_authorization_codes
    WHERE expires_at < NOW()
    RETURNING code
  `;
  return result.length;
}

// ==================== Refresh Tokens ====================

/**
 * Store a refresh token (stored by hash, not plaintext)
 */
export async function storeRefreshToken(
  tokenHash: string,
  clientId: string,
  workflowyApiKeyEncrypted: string,
  scope: string,
  expiresAt: Date
): Promise<void> {
  const db = await getDb();

  await db`
    INSERT INTO oauth_refresh_tokens
    (token_hash, client_id, workflowy_api_key_encrypted, scope, expires_at)
    VALUES (${tokenHash}, ${clientId}, ${workflowyApiKeyEncrypted}, ${scope}, ${expiresAt})
  `;
}

/**
 * Get a refresh token by its hash
 */
export async function getRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
  const db = await getDb();

  const result = await db`
    SELECT token_hash, client_id, workflowy_api_key_encrypted, scope, expires_at, created_at
    FROM oauth_refresh_tokens
    WHERE token_hash = ${tokenHash}
  `;

  if (result.length === 0) return null;

  const row = result[0];
  return {
    token_hash: row.token_hash as string,
    client_id: row.client_id as string,
    workflowy_api_key_encrypted: row.workflowy_api_key_encrypted as string,
    scope: row.scope as string,
    expires_at: new Date(row.expires_at as string),
    created_at: new Date(row.created_at as string),
  };
}

/**
 * Delete a refresh token (for rotation)
 */
export async function deleteRefreshToken(tokenHash: string): Promise<boolean> {
  const db = await getDb();
  const result = await db`
    DELETE FROM oauth_refresh_tokens
    WHERE token_hash = ${tokenHash}
    RETURNING token_hash
  `;
  return result.length > 0;
}

/**
 * Clean up expired refresh tokens
 */
export async function cleanupExpiredRefreshTokens(): Promise<number> {
  const db = await getDb();
  const result = await db`
    DELETE FROM oauth_refresh_tokens
    WHERE expires_at < NOW()
    RETURNING token_hash
  `;
  return result.length;
}
