# OAuth 2.0 Implementation Plan for Workflowy MCP Server

## Executive Summary

This plan outlines the implementation of OAuth 2.0 Authorization Code Flow with PKCE support to enable Claude Desktop and Mobile connector UI integration. The implementation will maintain backward compatibility with the existing Bearer token authentication method while adding full OAuth 2.0 support.

### Key Design Decision: JWT-Based Token Storage

**Workflowy API keys are NOT stored in the database long-term.** Instead:
- ✅ **Custom OAuth consent form** prompts user for Workflowy API key (like Postman connector)
- ✅ **JWT access tokens** contain the encrypted Workflowy API key in the payload
- ✅ **No database lookup** needed for access tokens - JWT is self-contained
- ✅ **Only temporary storage** in authorization codes (10 min) and refresh tokens (for rotation)
- ✅ **Better security** - credentials travel with the token, not stored in DB
- ✅ **Stateless** - no DB query needed for each MCP request

This approach matches how Postman's MCP connector worked - asking users for credentials during the OAuth flow and embedding them securely in the token.

## Current State Analysis

### Existing Architecture
- **Authentication**: Bearer token with format `ACCESS_SECRET:WORKFLOWY_API_KEY`
- **Database**: Neon PostgreSQL with single `bookmarks` table
- **Framework**: Next.js 14 on Vercel
- **MCP Handler**: `mcp-handler` library with `withMcpAuth` wrapper
- **Workflowy API**: Uses API keys (no native OAuth support)

### Constraints & Requirements

1. **Claude Connector UI Requirements**:
   - Must support OAuth 2.0 Authorization Code Flow (not client credentials)
   - Must support PKCE (Proof Key for Code Exchange)
   - Must support Dynamic Client Registration (DCR)
   - Must accept redirect URIs:
     - `http://localhost:6274/oauth/callback` (local clients)
     - `http://localhost:6274/oauth/callback/debug` (local debug)
     - `https://claude.ai/api/mcp/auth_callback` (Claude web)
     - `https://claude.com/api/mcp/auth_callback` (Claude web)

2. **Workflowy API Constraints**:
   - Workflowy has no OAuth - only API keys
   - Users must provide their Workflowy API key during OAuth consent
   - We need to securely store the mapping: OAuth token → Workflowy API key

3. **Backward Compatibility**:
   - Existing Bearer token auth must continue working
   - No breaking changes for current users

## Architecture Design

### OAuth Flow Overview

```
1. Client Registration (DCR)
   Client → POST /register → { client_id, client_secret }

2. Authorization Request
   User → GET /oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...
   → Custom consent form asks user to enter Workflowy API key
   → User enters Workflowy API key → Server validates it
   → Redirect with authorization code (code contains encrypted Workflowy API key)

3. Token Exchange
   Client → POST /oauth/token (with code, code_verifier)
   → Server validates → Returns JWT access_token (with encrypted Workflowy API key) + refresh_token

4. MCP Requests
   Client → MCP endpoint with Authorization: Bearer <jwt_access_token>
   → Server decrypts JWT → Extracts Workflowy API key → Makes Workflowy API call
```

**Key Design Decision**: Workflowy API keys are **NOT stored in the database**. Instead:
- They are collected during OAuth consent (custom form, like Postman connector)
- Encrypted and embedded in the JWT access token itself
- Decrypted on-the-fly when the token is used
- This eliminates database storage of sensitive credentials

### Database Schema Changes

**New Tables Required:**

```sql
-- OAuth clients (from Dynamic Client Registration)
CREATE TABLE oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT NOT NULL,  -- bcrypt hash
  client_name TEXT,
  redirect_uris TEXT[],  -- Array of allowed redirect URIs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Authorization codes (temporary, short-lived)
-- NOTE: Workflowy API key is encrypted and stored here temporarily
-- until it's exchanged for a JWT token
CREATE TABLE oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  code_challenge TEXT NOT NULL,  -- PKCE code challenge
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  redirect_uri TEXT NOT NULL,
  workflowy_api_key_encrypted TEXT NOT NULL,  -- Encrypted Workflowy API key (temporary)
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens (for token rotation)
-- NOTE: We only store refresh tokens, NOT access tokens
-- Access tokens are JWTs with encrypted Workflowy API key embedded
CREATE TABLE oauth_refresh_tokens (
  refresh_token TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id),
  workflowy_api_key_encrypted TEXT NOT NULL,  -- Encrypted Workflowy API key (for refresh)
  scope TEXT DEFAULT 'workflowy',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_oauth_refresh_tokens_client_id ON oauth_refresh_tokens(client_id);
CREATE INDEX idx_oauth_codes_expires ON oauth_authorization_codes(expires_at);
```

**Security Considerations:**
- **Workflowy API keys are NOT stored long-term in the database**
- They are encrypted and embedded in JWT access tokens
- Only temporarily stored in authorization codes (10 min expiry)
- Stored in refresh tokens (encrypted) for token rotation
- Use environment variable for encryption key: `ENCRYPTION_KEY` (32 bytes)
- Use environment variable for JWT signing: `JWT_SECRET` (32 bytes)
- Client secrets must be hashed (bcrypt with cost 12)
- Authorization codes expire in 10 minutes
- Access tokens (JWT) expire in 1 hour
- Refresh tokens expire in 30 days

## Implementation Plan

### Phase 1: Infrastructure & Database Setup

#### 1.1 Add Dependencies
```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5"
  }
}
```

**Note**: `crypto` is Node.js built-in, no need to install

#### 1.2 Database Migration Script
- Create migration to add new OAuth tables
- Add encryption utilities for Workflowy API keys
- Add helper functions for token generation

#### 1.3 Environment Variables
Add to Vercel:
- `ENCRYPTION_KEY`: 32-byte hex string for AES encryption (generate with `openssl rand -hex 32`)
- `JWT_SECRET`: 32-byte hex string for JWT signing (generate with `openssl rand -hex 32`)
- `OAUTH_ISSUER`: Your Vercel URL (e.g., `https://workflowy-mcp-mauve.vercel.app`)
- `ACCESS_SECRET`: Keep existing (for backward compatibility)

### Phase 2: OAuth Core Endpoints

#### 2.1 OAuth Metadata Endpoint
**Route**: `GET /.well-known/oauth-authorization-server`

Returns RFC 8414 compliant metadata:
```json
{
  "issuer": "https://workflowy-mcp-mauve.vercel.app",
  "authorization_endpoint": "https://workflowy-mcp-mauve.vercel.app/oauth/authorize",
  "token_endpoint": "https://workflowy-mcp-mauve.vercel.app/oauth/token",
  "registration_endpoint": "https://workflowy-mcp-mauve.vercel.app/oauth/register",
  "scopes_supported": ["workflowy"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"]
}
```

#### 2.2 Dynamic Client Registration (DCR)
**Route**: `POST /oauth/register`

**Request**:
```json
{
  "client_name": "Claude Desktop",
  "redirect_uris": [
    "http://localhost:6274/oauth/callback",
    "https://claude.ai/api/mcp/auth_callback"
  ],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "scope": "workflowy"
}
```

**Response**:
```json
{
  "client_id": "generated-uuid",
  "client_secret": "generated-secret",
  "client_id_issued_at": 1234567890,
  "client_secret_expires_at": 0
}
```

**Implementation Notes**:
- Generate UUID v4 for client_id
- Generate 32-byte random secret for client_secret
- Hash client_secret with bcrypt before storing
- Store redirect_uris array in database

#### 2.3 Authorization Endpoint
**Route**: `GET /oauth/authorize` (initial) and `POST /oauth/authorize` (form submission)

**Query Parameters** (GET):
- `client_id`: OAuth client ID
- `redirect_uri`: Must match registered redirect URI
- `response_type`: Must be "code"
- `scope`: Requested scopes (default: "workflowy")
- `code_challenge`: PKCE code challenge (base64url encoded SHA256)
- `code_challenge_method`: Must be "S256"
- `state`: Optional CSRF protection token

**Flow**:
1. Validate client_id exists
2. Validate redirect_uri is registered for client
3. Validate PKCE parameters
4. **Show custom consent form asking user to enter Workflowy API key** (like Postman connector)
5. User submits form with Workflowy API key
6. **Validate Workflowy API key by making test API call** to Workflowy
7. If valid, encrypt the Workflowy API key
8. Generate authorization code (32-byte random)
9. Store code with encrypted Workflowy API key (temporary, 10 min expiry)
10. Redirect to redirect_uri with code and state

**Consent Form** (HTML page - like Postman's approach):
```html
<form method="POST" action="/oauth/authorize">
  <h2>Connect to Workflowy</h2>
  <p>Enter your Workflowy API key to connect:</p>
  <input type="text" name="workflowy_api_key" placeholder="wf_xxxxxxxxxxxxx" required>
  <p><small>Get your API key from <a href="https://beta.workflowy.com/api-reference/" target="_blank">Workflowy API Reference</a></small></p>
  <input type="hidden" name="client_id" value="...">
  <input type="hidden" name="redirect_uri" value="...">
  <input type="hidden" name="code_challenge" value="...">
  <input type="hidden" name="state" value="...">
  <button type="submit">Authorize</button>
</form>
```

**Key Features**:
- **User-friendly form** that prompts for Workflowy API key (like Postman connector)
- **Real-time validation** - test the API key before proceeding
- **Clear instructions** with link to get API key
- **No database storage** - API key is only temporarily stored in authorization code

#### 2.4 Token Endpoint
**Route**: `POST /oauth/token`

**Request** (application/x-www-form-urlencoded):
```
grant_type=authorization_code
&code=<authorization_code>
&redirect_uri=<original_redirect_uri>
&client_id=<client_id>
&client_secret=<client_secret>
&code_verifier=<pkce_code_verifier>
```

**Validation**:
1. Verify client_id and client_secret
2. Verify authorization code exists and hasn't expired
3. Verify redirect_uri matches
4. Verify PKCE: SHA256(code_verifier) == code_challenge
5. Delete authorization code (one-time use)

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "generated-refresh-token",
  "scope": "workflowy"
}
```

**Token Generation**:
- **Access token**: JWT with encrypted Workflowy API key in payload
  - Header: `{"alg": "HS256", "typ": "JWT"}`
  - Payload: `{"sub": "workflowy-user", "exp": <expiry>, "iat": <issued>, "scope": "workflowy", "wf_key": "<encrypted_workflowy_api_key>"}`
  - Signature: HMAC-SHA256 with JWT_SECRET
- **Refresh token**: 32-byte random, base64url encoded
  - Store in database with encrypted Workflowy API key (for token rotation)
- **No long-term storage** of Workflowy API keys - they're in the JWT or refresh token only

#### 2.5 Token Refresh Endpoint
**Route**: `POST /oauth/token` (with refresh_token grant)

**Request**:
```
grant_type=refresh_token
&refresh_token=<refresh_token>
&client_id=<client_id>
&client_secret=<client_secret>
```

**Flow**:
1. Verify client_id and client_secret
2. Look up refresh_token in `oauth_refresh_tokens` table
3. Verify refresh_token hasn't expired
4. Decrypt Workflowy API key from refresh token record
5. Generate new JWT access token (with encrypted Workflowy API key)
6. Generate new refresh token
7. Update refresh token record (rotate token)
8. Return new tokens

**Response**: New JWT access_token and refresh_token (refresh token is rotated)

### Phase 3: MCP Handler Integration

#### 3.1 Update verifyToken Function

Modify `verifyToken` to support both:
1. **Legacy Bearer Token**: `ACCESS_SECRET:WORKFLOWY_API_KEY` (backward compatibility)
2. **OAuth JWT Access Token**: Decode JWT, extract encrypted Workflowy API key, decrypt it

```typescript
import jwt from "jsonwebtoken";

const verifyToken = async (
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  // Method 1: Legacy Bearer token (backward compatibility)
  const separator = ":";
  const separatorIndex = bearerToken.indexOf(separator);
  
  if (separatorIndex > 0) {
    // Legacy format: ACCESS_SECRET:WORKFLOWY_API_KEY
    const accessSecret = process.env.ACCESS_SECRET;
    if (accessSecret) {
      const providedSecret = bearerToken.slice(0, separatorIndex);
      if (providedSecret === accessSecret) {
        const workflowyApiKey = bearerToken.slice(separatorIndex + 1);
        if (workflowyApiKey) {
          return {
            token: workflowyApiKey,
            scopes: ["workflowy"],
            clientId: "legacy-bearer",
          };
        }
      }
    }
  }

  // Method 2: OAuth JWT access token
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return undefined;
    }

    // Verify and decode JWT
    const decoded = jwt.verify(bearerToken, jwtSecret) as {
      sub: string;
      exp: number;
      iat: number;
      scope: string;
      wf_key: string; // Encrypted Workflowy API key
    };

    // Decrypt Workflowy API key from JWT payload
    const workflowyApiKey = decrypt(decoded.wf_key);

    return {
      token: workflowyApiKey,
      scopes: decoded.scope.split(" "),
      clientId: "oauth-client",
    };
  } catch (error) {
    // JWT invalid, expired, or malformed
    return undefined;
  }
};
```

**Key Benefits**:
- **No database lookup** for access tokens - JWT is self-contained
- **Faster** - no DB query needed
- **Stateless** - token contains everything needed
- **Secure** - Workflowy API key is encrypted within JWT payload

#### 3.2 Encryption Utilities

```typescript
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY must be set");
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Return: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}
```

### Phase 4: UI Components

#### 4.1 Authorization Consent Page
**Route**: `GET /oauth/authorize` (renders HTML form)

Simple HTML page with:
- Form to enter Workflowy API key
- Instructions and link to get API key
- "Authorize" button
- CSRF protection (state parameter)
- Client validation display

#### 4.2 Error Pages
- Invalid client
- Invalid redirect URI
- Expired authorization code
- Invalid PKCE verification

### Phase 5: Security Hardening

#### 5.1 Rate Limiting
- Authorization endpoint: 10 requests per minute per IP
- Token endpoint: 20 requests per minute per client
- Registration endpoint: 5 registrations per hour per IP

#### 5.2 Input Validation
- Validate all redirect URIs against registered list
- Validate PKCE code_challenge format
- Validate authorization code format
- Sanitize all user inputs

#### 5.3 Token Security
- Use cryptographically secure random token generation
- Implement token rotation on refresh
- Add token revocation endpoint
- Log all token usage for audit

#### 5.4 HTTPS Enforcement
- Ensure all OAuth endpoints require HTTPS in production
- Validate redirect URIs use HTTPS (except localhost)

## File Structure

```
app/
├── api/
│   ├── [transport]/
│   │   └── route.ts              # Existing MCP handler (updated)
│   ├── oauth/
│   │   ├── authorize/
│   │   │   └── route.ts          # Authorization endpoint
│   │   ├── token/
│   │   │   └── route.ts           # Token exchange & refresh
│   │   └── register/
│   │       └── route.ts           # DCR endpoint
│   └── .well-known/
│       └── oauth-authorization-server/
│           └── route.ts          # OAuth metadata
├── oauth/
│   └── consent/
│       └── page.tsx               # Consent form UI
└── lib/
    ├── db.ts                      # Database utilities (updated)
    ├── encryption.ts              # Encryption utilities (new)
    ├── oauth.ts                   # OAuth utilities (new)
    └── validation.ts              # Input validation (new)
```

## Testing Strategy

### Unit Tests
- Encryption/decryption functions
- PKCE code challenge verification
- Token generation and validation
- Database operations

### Integration Tests
1. **Full OAuth Flow**:
   - Register client
   - Request authorization
   - Exchange code for token
   - Use token in MCP request
   - Refresh token

2. **Error Cases**:
   - Invalid client_id
   - Invalid redirect_uri
   - Expired authorization code
   - Invalid PKCE verification
   - Invalid refresh token

3. **Backward Compatibility**:
   - Legacy Bearer token still works
   - OAuth tokens work independently

### Manual Testing Checklist
- [ ] Register client via DCR
- [ ] Complete OAuth flow in Claude Desktop
- [ ] Complete OAuth flow in Claude Web
- [ ] Use connector in Claude Mobile
- [ ] Token refresh works
- [ ] Legacy Bearer token still works
- [ ] Invalid tokens return 401
- [ ] Expired tokens return 401

## Deployment Plan

### Pre-Deployment
1. Generate `ENCRYPTION_KEY`: `openssl rand -hex 32`
2. Add to Vercel environment variables
3. Set `OAUTH_ISSUER` to production URL
4. Run database migrations
5. Test in preview deployment

### Deployment Steps
1. Deploy code to Vercel
2. Verify database migrations ran successfully
3. Test OAuth metadata endpoint
4. Test full OAuth flow
5. Verify backward compatibility
6. Update documentation

### Rollback Plan
- Keep legacy Bearer token auth working
- OAuth is additive, not replacing
- Can disable OAuth endpoints if needed
- Database changes are additive (no data loss)

## Documentation Updates

### User-Facing
1. Update `MCP_CLIENT_SETUP.md` with OAuth instructions
2. Add OAuth setup guide for Claude connectors
3. Update README with OAuth support announcement

### Developer-Facing
1. Document OAuth endpoints
2. Document database schema
3. Document encryption key management
4. Add troubleshooting guide

## Timeline Estimate

- **Phase 1** (Infrastructure): 2-3 hours
- **Phase 2** (OAuth Endpoints): 6-8 hours
- **Phase 3** (MCP Integration): 2-3 hours
- **Phase 4** (UI Components): 2-3 hours
- **Phase 5** (Security): 2-3 hours
- **Testing**: 3-4 hours
- **Documentation**: 2 hours

**Total**: ~20-26 hours of development time

## Success Criteria

1. ✅ Users can register OAuth clients via DCR
2. ✅ Users can complete OAuth flow in Claude Desktop/Web
3. ✅ OAuth tokens work for MCP requests
4. ✅ Token refresh works correctly
5. ✅ Legacy Bearer token auth still works
6. ✅ Workflowy API keys are encrypted at rest
7. ✅ PKCE is properly enforced
8. ✅ All security requirements met
9. ✅ Mobile app can use connectors configured via Desktop/Web

## Risk Mitigation

### Risk: Encryption Key Loss
**Mitigation**: Document key generation and storage. Consider key rotation strategy.

### Risk: Token Leakage
**Mitigation**: Use HTTPS only, implement token rotation, add audit logging.

### Risk: Database Performance
**Mitigation**: Add proper indexes, monitor query performance, consider connection pooling.

### Risk: Breaking Changes
**Mitigation**: Maintain backward compatibility, thorough testing, gradual rollout.

## Future Enhancements

1. **Token Revocation Endpoint**: Allow users to revoke tokens
2. **Token Introspection Endpoint**: RFC 7662 compliance
3. **Admin Dashboard**: View and manage OAuth clients
4. **Analytics**: Track OAuth usage and token usage
5. **Multi-User Support**: Support multiple Workflowy accounts per OAuth client
