# Workflowy MCP Server

An MCP (Model Context Protocol) server that connects AI assistants to your Workflowy account, allowing them to read, create, update, and manage your Workflowy notes.

## Features

- **OAuth 2.0 Authentication** - Secure OAuth flow with PKCE for Claude Desktop, Claude Web, and other MCP clients
- **Legacy Token Support** - Bearer token authentication for programmatic access
- **Full Workflowy API** - Read, create, update, delete, and organize notes

## Quick Start

### For Claude Desktop / Claude Web (OAuth - Recommended)

1. **Deploy to Vercel** (see [Deployment](#deployment) below)
2. **Add MCP Server in Claude:**
   - Open Claude Desktop → Settings → Connectors
   - Click "Add Connector"
   - Enter URL: `https://your-vercel-url.vercel.app/api/mcp`
   - Click "Connect" and follow the OAuth flow
   - Enter your Workflowy API key when prompted
3. **Done!** Start using Workflowy with Claude

### For Claude Code / Cursor / Other Clients (Legacy Token)

See [MCP_CLIENT_SETUP.md](./MCP_CLIENT_SETUP.md) for detailed configuration.

---

## Deployment

### 1. Deploy to [Vercel](https://vercel.com/new)

1. Fork or clone this repository
2. Import the project in Vercel
3. Add environment variables in your Vercel project settings:

   **Required for OAuth:**
   - `DATABASE_URL` - Your Neon database connection string
   - `ENCRYPTION_KEY` - 64-character hex string: `openssl rand -hex 32`
   - `JWT_SECRET` - 64-character hex string: `openssl rand -hex 32`
   - `OAUTH_ISSUER` - Your Vercel URL (e.g., `https://workflowy-mcp.vercel.app`)
   - `OAUTH_REGISTRATION_SECRET` - 64-character hex string: `openssl rand -hex 32` (protects client registration)

   **Required for Legacy Token Auth:**
   - `ACCESS_SECRET` - A strong random secret: `openssl rand -hex 32`

4. Deploy the project

### 2. Get Your Workflowy API Key

1. Go to https://beta.workflowy.com/api-reference/
2. Generate or copy your API key
3. Keep this key secure—you'll use it to authenticate with the MCP server

### 3. Connect to Your MCP Client

Configure the MCP server in your AI assistant client. The authorization header format is:

```
Authorization: Bearer ACCESS_SECRET:WORKFLOWY_API_KEY
```

**📋 For detailed setup instructions with copy-paste code snippets, see [MCP_CLIENT_SETUP.md](./MCP_CLIENT_SETUP.md)**

Quick links:
- **Claude Code**: Configure in `~/.claude.json` (see [MCP_CLIENT_SETUP.md](./MCP_CLIENT_SETUP.md#claude-code))
- **Claude Desktop**: Configure in `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) (see [MCP_CLIENT_SETUP.md](./MCP_CLIENT_SETUP.md#claude-desktop))
- **Claude Mobile App**: Configure in app settings (see [MCP_CLIENT_SETUP.md](./MCP_CLIENT_SETUP.md#claude-mobile-app))
- **Cursor**: Configure in `~/.cursor/mcp.json` (see [MCP_CLIENT_SETUP.md](./MCP_CLIENT_SETUP.md#cursor))
- **GPT Codex**: Configure in `~/.codex/config.toml` (see [MCP_CLIENT_SETUP.md](./MCP_CLIENT_SETUP.md#gpt-codex))

After configuring, restart your client for changes to take effect.

## Authentication

This server supports two authentication methods:

### Method 1: OAuth 2.0 (Recommended)

For **Claude Desktop**, **Claude Web**, and **Claude Mobile**:

1. Add the MCP server URL in Claude's Connectors settings
2. Click "Connect" - you'll be redirected to an authorization page
3. Enter your Workflowy API key (get it from https://workflowy.com/api/)
4. Click "Authorize" - you're connected!

**How it works:**
- Uses OAuth 2.0 with PKCE (RFC 7636) for secure authentication
- Your Workflowy API key is encrypted and embedded in JWT tokens
- Tokens auto-refresh, so you stay connected
- No manual token configuration needed

### Method 2: Legacy Bearer Token

For **Claude Code**, **Cursor**, **GPT Codex**, and programmatic access:

**In Vercel** (set the access secret):
```
ACCESS_SECRET = abc123mysecret
```

**In your client** (combine access secret and Workflowy API key):
```
Authorization: Bearer ACCESS_SECRET:WORKFLOWY_API_KEY
```

Example: `Bearer abc123mysecret:wf_xyz789`

**Security notes:**
- The server does NOT store your Workflowy API key long-term
- For OAuth: API key is encrypted in JWT tokens (not stored in database)
- For Legacy: API key is validated per-request (never stored)
- Each user can use their own Workflowy API key

## Available [Workflowy API](https://beta.workflowy.com/api-reference/) Endpoints

The `workflowy_api` tool supports these endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nodes?parent_id=None` | List top-level nodes |
| GET | `/api/v1/nodes?parent_id=:id` | List children of a node |
| GET | `/api/v1/nodes/:id` | Get a single node |
| POST | `/api/v1/nodes` | Create a node (body: `name`, `parent_id`) |
| POST | `/api/v1/nodes/:id` | Update a node |
| DELETE | `/api/v1/nodes/:id` | Delete a node |
| POST | `/api/v1/nodes/:id/move` | Move a node (body: `parent_id`) |
| POST | `/api/v1/nodes/:id/complete` | Mark node as complete |
| POST | `/api/v1/nodes/:id/uncomplete` | Mark node as incomplete |
| GET | `/api/v1/nodes-export` | Export all nodes (rate limit: 1 req/min) |
| GET | `/api/v1/targets` | Get targets (inbox, home) |

The `parent_id` parameter accepts:
- A node UUID
- `"inbox"` - your Workflowy inbox
- `"home"` - your Workflowy home
- `"None"` - top-level nodes

## Example Usage

Once connected, you can ask your AI assistant things like:
- "Show me my top Workflowy notes"
- "Create a new note called 'Meeting Notes' in my inbox"
- "Mark the task 'Buy groceries' as complete"

## Local Development

```sh
npm install
npm run dev
```

## Notes

- Make sure you have [Fluid compute](https://vercel.com/docs/functions/fluid-compute) enabled in Vercel for efficient execution
- The Workflowy API has rate limits, especially for the export endpoint (1 request per minute)
