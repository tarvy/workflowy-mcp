/**
 * OAuth 2.0 Authorization Endpoint
 *
 * GET /api/oauth/authorize - Render consent form
 * POST /api/oauth/authorize - Process form submission
 */

import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, storeAuthorizationCode } from "@/lib/db";
import { encrypt, generateAuthorizationCode } from "@/lib/crypto";
import { validateWorkflowyApiKey, isValidRedirectUri } from "@/lib/oauth";
import type { OAuthError } from "@/lib/types";

// HTML template for the consent form
function renderConsentForm(params: {
  clientId: string;
  clientName: string | null;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string | null;
  scope: string;
  error?: string;
}): string {
  const errorHtml = params.error
    ? `<div class="error">${params.error}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect to Workflowy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: #16213e;
      border-radius: 12px;
      padding: 40px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      color: #fff;
    }
    .subtitle {
      color: #888;
      margin-bottom: 24px;
      font-size: 14px;
    }
    .client-name {
      color: #6c9fff;
      font-weight: 500;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      color: #aaa;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      font-size: 16px;
      border: 1px solid #333;
      border-radius: 8px;
      background: #0f0f23;
      color: #fff;
      margin-bottom: 16px;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #6c9fff;
    }
    .help-text {
      font-size: 13px;
      color: #666;
      margin-bottom: 24px;
    }
    .help-text a {
      color: #6c9fff;
      text-decoration: none;
    }
    .help-text a:hover {
      text-decoration: underline;
    }
    button {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      font-weight: 500;
      border: none;
      border-radius: 8px;
      background: #6c9fff;
      color: #000;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #5a8ae6;
    }
    button:disabled {
      background: #444;
      cursor: not-allowed;
    }
    .error {
      background: #3d1f1f;
      border: 1px solid #ff6b6b;
      color: #ff6b6b;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .scope-badge {
      display: inline-block;
      background: #2a3f5f;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      color: #6c9fff;
      margin-bottom: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Connect to Workflowy</h1>
    <p class="subtitle">
      ${params.clientName ? `<span class="client-name">${escapeHtml(params.clientName)}</span> wants to` : "An application wants to"}
      access your Workflowy account
    </p>
    <div class="scope-badge">Scope: ${escapeHtml(params.scope)}</div>
    ${errorHtml}
    <form method="POST" action="/api/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}">
      ${params.state ? `<input type="hidden" name="state" value="${escapeHtml(params.state)}">` : ""}
      <input type="hidden" name="scope" value="${escapeHtml(params.scope)}">

      <label for="workflowy_api_key">Workflowy API Key</label>
      <input
        type="password"
        id="workflowy_api_key"
        name="workflowy_api_key"
        placeholder="wf_xxxxxxxxxxxxx"
        required
        autocomplete="off"
      >
      <p class="help-text">
        Get your API key from
        <a href="https://beta.workflowy.com/api-reference/" target="_blank" rel="noopener">
          Workflowy API Reference
        </a>
      </p>
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function errorResponse(error: string, description: string, status: number = 400): NextResponse {
  return NextResponse.json(
    { error, error_description: description } as OAuthError,
    { status }
  );
}

function errorRedirect(redirectUri: string, error: string, description: string, state?: string): NextResponse {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString());
}

/**
 * GET /api/oauth/authorize - Render consent form
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  console.log("[AUTHORIZE GET] Full URL:", req.url);
  console.log("[AUTHORIZE GET] All params:", Object.fromEntries(new URL(req.url).searchParams.entries()));

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  console.log("[AUTHORIZE GET] client_id:", clientId);
  console.log("[AUTHORIZE GET] redirect_uri:", redirectUri);
  const responseType = url.searchParams.get("response_type");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state");
  const scope = url.searchParams.get("scope") || "workflowy";

  // Validate required parameters
  if (!clientId) {
    return errorResponse("invalid_request", "client_id is required");
  }
  if (!redirectUri) {
    return errorResponse("invalid_request", "redirect_uri is required");
  }
  if (responseType !== "code") {
    return errorResponse("unsupported_response_type", "Only response_type=code is supported");
  }
  if (!codeChallenge) {
    return errorResponse("invalid_request", "code_challenge is required (PKCE)");
  }
  if (codeChallengeMethod !== "S256") {
    return errorResponse("invalid_request", "code_challenge_method must be S256");
  }

  // Validate client
  const client = await getOAuthClient(clientId);
  if (!client) {
    return errorResponse("invalid_client", "Unknown client_id");
  }

  // Validate redirect URI
  if (!isValidRedirectUri(redirectUri, client.redirect_uris)) {
    return errorResponse("invalid_request", "redirect_uri not registered for this client");
  }

  // Render consent form
  const html = renderConsentForm({
    clientId,
    clientName: client.client_name,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    state,
    scope,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}

/**
 * POST /api/oauth/authorize - Process form submission
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const clientId = formData.get("client_id") as string;
  const redirectUri = formData.get("redirect_uri") as string;
  const codeChallenge = formData.get("code_challenge") as string;
  const codeChallengeMethod = formData.get("code_challenge_method") as string;
  const state = formData.get("state") as string | null;
  const scope = formData.get("scope") as string || "workflowy";
  const workflowyApiKey = formData.get("workflowy_api_key") as string;

  // Validate required parameters
  if (!clientId || !redirectUri || !codeChallenge || !codeChallengeMethod) {
    return errorResponse("invalid_request", "Missing required parameters");
  }

  // Validate client
  const client = await getOAuthClient(clientId);
  if (!client) {
    return errorResponse("invalid_client", "Unknown client_id");
  }

  // Validate redirect URI
  if (!isValidRedirectUri(redirectUri, client.redirect_uris)) {
    return errorResponse("invalid_request", "redirect_uri not registered for this client");
  }

  // Validate Workflowy API key
  if (!workflowyApiKey) {
    const html = renderConsentForm({
      clientId,
      clientName: client.client_name,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      state,
      scope,
      error: "Please enter your Workflowy API key",
    });
    return new NextResponse(html, {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Validate API key with Workflowy
  const isValid = await validateWorkflowyApiKey(workflowyApiKey);
  if (!isValid) {
    const html = renderConsentForm({
      clientId,
      clientName: client.client_name,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      state,
      scope,
      error: "Invalid Workflowy API key. Please check and try again.",
    });
    return new NextResponse(html, {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Generate authorization code
  const code = generateAuthorizationCode();
  const encryptedApiKey = encrypt(workflowyApiKey);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store authorization code
  await storeAuthorizationCode(
    code,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    encryptedApiKey,
    state,
    expiresAt
  );

  // Redirect with code
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);

  console.log("[AUTHORIZE POST] Redirecting to:", url.toString());
  console.log("[AUTHORIZE POST] Code generated:", code.substring(0, 10) + "...");
  console.log("[AUTHORIZE POST] State:", state);

  // Use 302 redirect to convert POST to GET (307 would preserve POST method)
  return NextResponse.redirect(url.toString(), 302);
}
