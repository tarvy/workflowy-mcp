# MCP Client Setup Guide

Quick copy-paste configuration snippets for adding the Workflowy MCP server to Claude Code, Cursor, and GPT Codex.

## Prerequisites

Before configuring any client, you'll need:

1. **Your Vercel deployment URL** - Something like `https://your-project.vercel.app`
2. **Your ACCESS_SECRET** - The secret you set in Vercel environment variables
3. **Your Workflowy API Key** - Get it from https://beta.workflowy.com/api-reference/

The authorization header format is: `Bearer ACCESS_SECRET:WORKFLOWY_API_KEY`

---

## Claude Code

**Config File:** `~/.claude.json`

### Full Configuration

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "workflowy": {
          "type": "streamable-http",
          "url": "https://YOUR-VERCEL-URL.vercel.app/api/mcp",
          "headers": {
            "Authorization": "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
          }
        }
      }
    }
  }
}
```

### For Global Access (All Projects)

Replace `/path/to/your/project` with your home directory:

```json
{
  "projects": {
    "/Users/YOUR_USERNAME": {
      "mcpServers": {
        "workflowy": {
          "type": "streamable-http",
          "url": "https://YOUR-VERCEL-URL.vercel.app/api/mcp",
          "headers": {
            "Authorization": "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
          }
        }
      }
    }
  }
}
```

### Adding to Existing Config

If you already have a `~/.claude.json` file, just add the `workflowy` server to your existing `mcpServers` object:

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "existing-server": { ... },
        "workflowy": {
          "type": "streamable-http",
          "url": "https://YOUR-VERCEL-URL.vercel.app/api/mcp",
          "headers": {
            "Authorization": "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
          }
        }
      }
    }
  }
}
```

**After saving:** Restart Claude Code for changes to take effect.

---

## Claude Desktop

You can configure Claude Desktop in two ways:

### Method 1: Direct Config File (Recommended - More Reliable)

**Config File Location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

#### Full Configuration

Create the config file if it doesn't exist, then add:

```json
{
  "mcpServers": {
    "workflowy": {
      "type": "streamable-http",
      "url": "https://YOUR-VERCEL-URL.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
      }
    }
  }
}
```

#### Adding to Existing Config

If you already have a `claude_desktop_config.json` file, just add the `workflowy` server to your existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": { ... },
    "workflowy": {
      "type": "streamable-http",
      "url": "https://YOUR-VERCEL-URL.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
      }
    }
  }
}
```

**After saving:** Restart Claude Desktop for changes to take effect.

### Method 2: Connectors UI (Alternative)

You can also configure via the Connectors UI in Settings, but the config file method is more reliable for custom Bearer token authentication. See the [Claude Mobile App](#claude-mobile-app) section for connector setup instructions.

---

## Claude Mobile App

**Important:** You cannot add new MCP connectors directly from the mobile app. You must configure them first via **Claude Desktop** or **Claude Web**, and then they will be available on mobile.

### Step 1: Configure via Claude Desktop or Claude Web

#### Option A: Claude Desktop (Recommended)

1. **Open Claude Desktop**
2. **Go to Settings**
   - Click on your profile icon (bottom left)
   - Select "Settings"
   - Click on the "Connectors" tab

3. **Add Custom Connector**
   - Click "Add custom connector"
   - **Name:** `workflowy` (or any name you prefer)
   - **Remote MCP server URL:** `https://YOUR-VERCEL-URL.vercel.app/api/mcp`
   - Click "Add"

4. **Connect and Authenticate**
   - After adding, click "Connect" next to the connector
   - When prompted for authentication, you'll need to provide a **Bearer Token**
   - **Important:** Enter the combined token in this format: `ACCESS_SECRET:WORKFLOWY_API_KEY`
     - Replace `ACCESS_SECRET` with your actual access secret (from Vercel environment variables)
     - Replace `WORKFLOWY_API_KEY` with your actual Workflowy API key
     - Example: If your access secret is `abc123` and your Workflowy API key is `wf_xyz789`, enter: `abc123:wf_xyz789`
   - The connector will send this as `Authorization: Bearer ACCESS_SECRET:WORKFLOWY_API_KEY`

**Note:** The server expects the token in the format `ACCESS_SECRET:WORKFLOWY_API_KEY` (with a colon separator). Make sure to include both parts when entering the Bearer token.

**Alternative:** If the connector interface doesn't support Bearer token authentication, you can use the direct configuration file method instead (see the [Claude Desktop](#claude-desktop) section above for config file setup).

#### Option B: Claude Web App

1. **Open Claude Web App** (https://claude.ai)
2. **Go to Settings**
   - Click on your profile icon (bottom left)
   - Select "Settings"
   - Click on the "Connectors" tab

3. **Add Custom Connector**
   - Click "Add custom connector"
   - **Name:** `workflowy`
   - **Remote MCP server URL:** `https://YOUR-VERCEL-URL.vercel.app/api/mcp`
   - Click "Add"

4. **Connect and Authenticate**
   - Click "Connect" next to the connector
   - Follow authentication prompts

### Step 2: Use on Mobile

Once configured via Desktop or Web:

1. **Open Claude Mobile App**
2. **Start a Conversation**
3. **Enable Connector**
   - Tap the "+" button (lower left of chat interface)
   - Select "Connectors"
   - Toggle on the `workflowy` connector for the conversation

### Important Notes

- **Plan Requirements:** Custom connectors using remote MCP are available on Pro, Max, Team, and Enterprise plans
- **Mobile Limitation:** You can only USE connectors on mobile that were configured via Desktop or Web
- **Authorization:** Your server uses `Bearer ACCESS_SECRET:WORKFLOWY_API_KEY` format. Ensure this is configured correctly in the connector settings
- **Security:** Only connect to trusted servers and review permissions carefully

**After configuring:** The connector will be available on all your devices (Desktop, Web, and Mobile).

---

## Cursor

**Config File:** `~/.cursor/mcp.json`

### Full Configuration

```json
{
  "mcpServers": {
    "workflowy": {
      "type": "streamable-http",
      "url": "https://YOUR-VERCEL-URL.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
      }
    }
  }
}
```

### Adding to Existing Config

If you already have a `~/.cursor/mcp.json` file, just add the `workflowy` server to your existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": { ... },
    "workflowy": {
      "type": "streamable-http",
      "url": "https://YOUR-VERCEL-URL.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
      }
    }
  }
}
```

**After saving:** Restart Cursor for changes to take effect.

### Alternative: Cursor Settings UI

1. Open Cursor Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "MCP" or navigate to Features → Model Context Protocol
3. Click "Add Server" or "Edit Servers"
4. Fill in:
   - **Name:** `workflowy`
   - **Type:** `streamable-http`
   - **URL:** `https://YOUR-VERCEL-URL.vercel.app/api/mcp`
   - **Headers:** 
     ```json
     {
       "Authorization": "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
     }
     ```
5. Save and restart Cursor

---

## GPT Codex

**Config File:** `~/.codex/config.toml`

### Step 1: Enable Experimental RMCP Client

Add this line to your `~/.codex/config.toml` file (create it if it doesn't exist):

```toml
experimental_use_rmcp_client = true
```

### Step 2: Add MCP Server Configuration

Add the server configuration to the same file:

```toml
[mcp_servers.workflowy]
url = "https://YOUR-VERCEL-URL.vercel.app/api/mcp"

[mcp_servers.workflowy.http_headers]
Authorization = "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
```

### Complete Example

If your `~/.codex/config.toml` file is new or empty, here's a complete example:

```toml
experimental_use_rmcp_client = true

[mcp_servers.workflowy]
url = "https://YOUR-VERCEL-URL.vercel.app/api/mcp"

[mcp_servers.workflowy.http_headers]
Authorization = "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
```

### Adding to Existing Config

If you already have a `~/.codex/config.toml` file with other servers:

```toml
experimental_use_rmcp_client = true

[mcp_servers.existing-server]
url = "https://existing-server.com/mcp"

[mcp_servers.workflowy]
url = "https://YOUR-VERCEL-URL.vercel.app/api/mcp"

[mcp_servers.workflowy.http_headers]
Authorization = "Bearer ACCESS_SECRET:WORKFLOWY_API_KEY"
```

**After saving:** Restart GPT Codex for changes to take effect.

---

## Quick Reference: Replace These Values

In all configurations above, replace:

- `YOUR-VERCEL-URL.vercel.app` → Your actual Vercel deployment URL
- `ACCESS_SECRET` → The secret you set in Vercel environment variables
- `WORKFLOWY_API_KEY` → Your Workflowy API key from https://beta.workflowy.com/api-reference/
- `/path/to/your/project` → Your actual project directory path (Claude Code only)
- `/Users/YOUR_USERNAME` → Your actual home directory path (Claude Code only)

## Testing the Connection

After configuring and restarting your client, try asking:

- "Show me my top Workflowy notes"
- "List my Workflowy bookmarks"
- "Create a note called 'Test' in my inbox"

If you see errors, double-check:
1. Your Vercel URL includes `/api/mcp` at the end
2. The authorization header format is correct: `Bearer ACCESS_SECRET:WORKFLOWY_API_KEY`
3. Both your ACCESS_SECRET and WORKFLOWY_API_KEY are correct
4. You've restarted the client after making changes
