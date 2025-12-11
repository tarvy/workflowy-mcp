import { protectedResourceHandler } from "mcp-handler";

// This endpoint tells MCP clients that this server uses Bearer token auth
// and doesn't require OAuth flow - just provide the token directly
const handler = protectedResourceHandler({
  // Empty array means no OAuth authorization server is needed
  // The Bearer token is validated directly by our verifyToken function
  authServerUrls: [],
});

export { handler as GET };
