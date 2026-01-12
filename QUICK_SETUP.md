# Quick Setup Summary

## Environment Variables

**Required:**
```
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=<64-char hex from: openssl rand -hex 32>
JWT_SECRET=<64-char hex from: openssl rand -hex 32>
OAUTH_ISSUER=https://your-vercel-url.vercel.app
```

**Optional:**
```
OAUTH_REGISTRATION_SECRET=<64-char hex>  # restricts OAuth client registration
```

## Quick Start

1. **Deploy to Vercel** with the environment variables above

2. **Connect Claude Desktop:**
   - Settings → Connectors → Add custom connector
   - Name: `Workflowy`
   - URL: `https://your-vercel-url.vercel.app/api/mcp`
   - Click Add → Enter Workflowy API key → Authorize

3. **Connect Claude Code:**
   ```bash
   claude mcp add workflowy --transport http https://your-vercel-url.vercel.app/api/mcp -s user
   ```
   Restart Claude Code, then use a Workflowy tool to trigger OAuth.

## Important Notes

- MCP URL format: `https://your-vercel-url.vercel.app/api/mcp`
- Get your Workflowy API key from https://workflowy.com/api/
- OAuth tables are auto-created on first use
