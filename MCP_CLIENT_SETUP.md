# MCP Client Setup Guide

This guide covers setting up the Workflowy MCP server with Claude.

## Supported Clients

| Client | Status |
|--------|--------|
| Claude Desktop | Supported (OAuth) |
| Claude Web | Supported (OAuth) |
| Claude Mobile | Supported (via Desktop/Web) |

---

## Claude Desktop - OAuth Setup

1. **Open Claude Desktop**
2. **Go to Settings** → **Connectors**
3. **Click "Add Connector"**
4. **Enter the MCP Server URL:**
   ```
   https://YOUR-VERCEL-URL.vercel.app/api/mcp
   ```
5. **Click "Connect"**
6. **You'll be redirected to an authorization page:**
   - Enter your Workflowy API key (get it from https://workflowy.com/api/)
   - Click "Authorize"
7. **Done!** The connector will show as connected.

---

## Claude Web - OAuth Setup

Same steps as Claude Desktop - add connector in Settings → Connectors.

---

## Claude Mobile

Configure via Claude Desktop or Web first, then the connector will be available on mobile.

1. **On Claude Desktop or Web:** Add the connector using the OAuth method above
2. **On Mobile:** Open Claude Mobile → tap "+" → Connectors → enable "workflowy"

**Notes:**
- Custom connectors are available on Pro, Max, Team, and Enterprise plans
- Connectors configured on Desktop/Web automatically sync to Mobile

---

## Testing the Connection

After configuring your client, try asking:

- "Show me my top Workflowy notes"
- "List my Workflowy bookmarks"
- "Create a note called 'Test' in my inbox"

If you see errors, double-check:
1. Your Vercel URL includes `/api/mcp` at the end
2. You've completed the OAuth authorization flow
3. Your Workflowy API key is valid
