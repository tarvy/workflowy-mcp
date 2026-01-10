/**
 * OAuth 2.0 TypeScript interfaces for Workflowy MCP Server
 */

// OAuth client from Dynamic Client Registration
export interface OAuthClient {
  client_id: string;
  client_secret_hash: string;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  created_at: Date;
}

// Authorization code (temporary, 10 min TTL)
export interface AuthorizationCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  workflowy_api_key_encrypted: string;
  state: string | null;
  expires_at: Date;
  created_at: Date;
}

// Refresh token (30 day TTL, rotated on use)
export interface RefreshToken {
  token_hash: string;
  client_id: string;
  workflowy_api_key_encrypted: string;
  scope: string;
  expires_at: Date;
  created_at: Date;
}

// JWT payload structure for access tokens
export interface JWTPayload {
  sub: string; // Subject (client identifier)
  iss: string; // Issuer (OAuth server URL)
  aud: string; // Audience
  exp: number; // Expiration time (Unix timestamp)
  iat: number; // Issued at (Unix timestamp)
  scope: string; // OAuth scopes
  wf_key: string; // Encrypted Workflowy API key
}

// OAuth error response
export interface OAuthError {
  error: OAuthErrorCode;
  error_description?: string;
  error_uri?: string;
}

// Standard OAuth 2.0 error codes
export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "access_denied"
  | "server_error"
  | "temporarily_unavailable";

// Dynamic Client Registration request
export interface DCRRequest {
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
}

// Dynamic Client Registration response
export interface DCRResponse {
  client_id: string;
  client_secret: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
  client_name?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
}

// Token endpoint response
export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// OAuth metadata (RFC 8414)
export interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
}
