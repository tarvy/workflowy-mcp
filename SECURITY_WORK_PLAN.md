# Security Work Plan (Workflowy MCP)

Purpose: Keep a single, living document that tracks security work, its current state, and the concrete steps needed to complete it. This is meant to be updated at the start/end of each working session so we always know "where we are" and "what's next."

Last updated: 2026-01-11
Owner: Travis
Status key: Not started | In progress | Blocked | Done

## Current snapshot
- Overall status: Done (all PRs complete)
- Scope: OAuth-only MCP, Vercel deployment, Neon DB
- Goals: Reduce credential leakage risk, lock down client registration, simplify to a single auth flow

## Known risks (agreed)
- ~~OAuth logs currently include headers, request params, and tokens (risk of credential leakage in logs).~~ RESOLVED (PR 1)
- ~~OAuth authorization logs include redirect URLs, state, and code fragments (sensitive when combined).~~ RESOLVED (PR 1)
- ~~Legacy bearer auth is static and never expires (risk of long-lived credential exposure).~~ RESOLVED (PR 3)
- ~~Dynamic client registration is open to any caller (risk of unwanted clients / DB growth).~~ RESOLVED (PR 2)
- ~~JWT verification does not validate issuer/audience (risk if secrets reused across MCPs).~~ RESOLVED (PR 4)
- Data isolation is not yet designed for multi-MCP or multi-tenant use (future risk).

## PR plan (units of work)
Each PR below is a standalone, reviewable unit. Keep PRs small and focused.

### PR 1: Redact OAuth logging
Status: Done
Owner: Travis
Scope:
- Remove or sanitize logging in `app/api/oauth/authorize/route.ts`.
- Remove or sanitize logging in `app/api/oauth/token/route.ts`.
Acceptance criteria:
- No headers, tokens, auth codes, state, or full URLs appear in logs.
- Logs (if any) only show safe summaries (endpoint, outcome).
Notes:
- Prefer removing logs entirely unless they provide essential debugging value.

### PR 2: Gate dynamic client registration
Status: Done
Owner: Travis
Scope:
- Require an admin registration secret for `POST /api/oauth/register`.
- Document the secret in setup docs and README.
Acceptance criteria:
- Requests without a valid secret return 401/403.
- Requests with the secret succeed and return client credentials.
Notes:
- Uses env var `OAUTH_REGISTRATION_SECRET` and request header `x-oauth-registration-secret`.
- If `OAUTH_REGISTRATION_SECRET` is not set, registration remains open (backward compatible).

### PR 3: Disable legacy bearer auth
Status: Done
Owner: Travis
Scope:
- Remove legacy token parsing in `app/api/[transport]/route.ts`.
- Update docs to reflect OAuth-only support.
Acceptance criteria:
- Legacy `ACCESS_SECRET:WORKFLOWY_API_KEY` is rejected.
- OAuth JWT tokens continue to work.
- README and setup guides no longer mention the legacy flow.
Notes:
- Simplified verifyToken to OAuth JWT only.
- Rewrote QUICK_SETUP.md, MCP_CLIENT_SETUP.md, SETUP.md, and README.md.

### PR 4: Harden JWT validation
Status: Done
Owner: Travis
Scope:
- Validate `iss` and `aud` in `lib/oauth.ts` during token verification.
- Document expectation for unique `JWT_SECRET` and `ENCRYPTION_KEY` per deployment.
Acceptance criteria:
- Tokens with mismatched issuer/audience are rejected.
- Happy path remains unchanged for valid tokens.
Notes:
- Added issuer and audience validation to verifyAccessToken using jsonwebtoken options.
- OAUTH_ISSUER is now required for token verification.
- Added Security section to README documenting unique secrets requirement.

## Work mechanics
Update this document after each session:
- Update "Last updated" and overall status.
- Update each PR's status.
- Add a brief note in the progress log.

Definition of done per PR:
- Code merged + docs updated (if applicable).
- Acceptance criteria verified.

## Progress log
- 2026-01-11: PR 4 complete - added iss/aud validation to JWT verification, documented unique secrets.
- 2026-01-11: PR 3 complete - removed legacy bearer auth, rewrote docs for OAuth-only.
- 2026-01-11: PR 2 complete - added OAUTH_REGISTRATION_SECRET check, removed console.error, updated docs.
- 2026-01-11: PR 1 complete - removed all console.log statements from authorize and token routes.
- YYYY-MM-DD: Initialized plan.

## Documentation considerations (compile after PRs)
- Multi-MCP guidance: per-MCP secrets, per-MCP issuer URLs, data isolation (tenant_id/client_id).
- Operational hygiene: rotating `JWT_SECRET`/`ENCRYPTION_KEY`, revoking refresh tokens, and auditing logs.
- Security posture summary: OAuth-only, gated DCR, logging hygiene.

## Open questions
- Do we want to disable DCR entirely after registering the intended client?
- Do we want an explicit token revocation endpoint now or later?
