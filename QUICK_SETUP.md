# Quick Setup Summary

## Environment Variables Required

For **OAuth** (Claude Desktop/Web/Mobile):
```
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=<64-char hex from: openssl rand -hex 32>
JWT_SECRET=<64-char hex from: openssl rand -hex 32>
OAUTH_ISSUER=https://your-vercel-url.vercel.app
```

For **Legacy Token** (Claude Code/Cursor/GPT Codex):
```
ACCESS_SECRET=<from: openssl rand -hex 32>
```

## 🚀 Quick Start

### For Claude Desktop / Web (OAuth)

1. **Deploy to Vercel** with the environment variables above
2. **In Claude:** Settings → Connectors → Add Connector
3. **Enter URL:** `https://your-vercel-url.vercel.app/api/mcp`
4. **Click Connect** → Enter your Workflowy API key → Authorize
5. **Done!**

### For Claude Code / Cursor (Legacy Token)

1. **Deploy to Vercel** with `ACCESS_SECRET` set
2. **Get your Workflowy API key** from https://workflowy.com/api/
3. **Configure your client** (see [MCP_CLIENT_SETUP.md](./MCP_CLIENT_SETUP.md))
4. **Test:** "Show me my top Workflowy notes"

## 📝 Important Notes

- MCP URL format: `https://your-vercel-url.vercel.app/api/mcp`
- Legacy token format: `Bearer ACCESS_SECRET:WORKFLOWY_API_KEY`
- OAuth tables are auto-created on first use
