# Quick Setup Summary

## Environment Variables Required

```
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=<64-char hex from: openssl rand -hex 32>
JWT_SECRET=<64-char hex from: openssl rand -hex 32>
OAUTH_ISSUER=https://your-vercel-url.vercel.app
OAUTH_REGISTRATION_SECRET=<64-char hex from: openssl rand -hex 32>
```

## Quick Start

1. **Deploy to Vercel** with the environment variables above
2. **In Claude:** Settings → Connectors → Add Connector
3. **Enter URL:** `https://your-vercel-url.vercel.app/api/mcp`
4. **Click Connect** → Enter your Workflowy API key → Authorize
5. **Done!**

## Important Notes

- MCP URL format: `https://your-vercel-url.vercel.app/api/mcp`
- Get your Workflowy API key from https://workflowy.com/api/
- OAuth tables are auto-created on first use
