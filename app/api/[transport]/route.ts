import { createMcpHandler } from "mcp-handler";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

// Initialize database and ensure table exists
async function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in process.env");
  }
  const sql = neon(databaseUrl);

  // Create table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS bookmarks (
      name TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  return sql;
}

const handler = createMcpHandler(
  (server) => {
    // Bookmark tools
    server.tool(
      "save_bookmark",
      "Save a Workflowy node ID with a friendly name for easy reference later. Use this to bookmark important nodes like special inboxes, project folders, etc.",
      {
        name: z
          .string()
          .describe("A friendly name for the bookmark (e.g., 'special_inbox', 'work_tasks')"),
        node_id: z.string().describe("The Workflowy node UUID to bookmark"),
      },
      async ({ name, node_id }: { name: string; node_id: string }) => {
        const sql = await getDb();
        await sql`
          INSERT INTO bookmarks (name, node_id)
          VALUES (${name}, ${node_id})
          ON CONFLICT (name) DO UPDATE SET node_id = ${node_id}
        `;
        return {
          content: [{ type: "text", text: `Bookmark "${name}" saved with node ID: ${node_id}` }],
        };
      },
    );

    server.tool(
      "get_bookmark",
      "Get a saved Workflowy node ID by its bookmark name. Use this to retrieve node IDs for bookmarked locations.",
      {
        name: z.string().describe("The bookmark name to look up"),
      },
      async ({ name }: { name: string }) => {
        const sql = await getDb();
        const result = await sql`SELECT node_id FROM bookmarks WHERE name = ${name}`;
        if (result.length === 0) {
          return {
            content: [{ type: "text", text: `Bookmark "${name}" not found` }],
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify({ name, node_id: result[0].node_id }) }],
        };
      },
    );

    server.tool(
      "list_bookmarks",
      "List all saved Workflowy bookmarks. Use this to see what nodes have been bookmarked.",
      {},
      async () => {
        const sql = await getDb();
        const result = await sql`SELECT name, node_id, created_at FROM bookmarks ORDER BY name`;
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    server.tool(
      "delete_bookmark",
      "Delete a saved bookmark by name.",
      {
        name: z.string().describe("The bookmark name to delete"),
      },
      async ({ name }: { name: string }) => {
        const sql = await getDb();
        const result = await sql`DELETE FROM bookmarks WHERE name = ${name} RETURNING name`;
        if (result.length === 0) {
          return {
            content: [{ type: "text", text: `Bookmark "${name}" not found` }],
          };
        }
        return {
          content: [{ type: "text", text: `Bookmark "${name}" deleted` }],
        };
      },
    );

    // Workflowy API tool
    server.tool(
      "workflowy_api",
      `Make requests to the Workflowy API. Available endpoints:
- POST /api/v1/nodes (create node: name, parent_id required in body)
- POST /api/v1/nodes/:id (update node)
- GET /api/v1/nodes/:id (get single node)
- GET /api/v1/nodes?parent_id=X (list children, parent_id can be UUID, "inbox", "home", or "None" for top-level)
- DELETE /api/v1/nodes/:id (delete node)
- POST /api/v1/nodes/:id/move (move node: parent_id required in body)
- POST /api/v1/nodes/:id/complete (mark complete)
- POST /api/v1/nodes/:id/uncomplete (mark incomplete)
- GET /api/v1/nodes-export (export all nodes, rate limit: 1/min)
- GET /api/v1/targets (get targets like inbox, home)

Tip: Use get_bookmark to retrieve saved node IDs for common locations.`,
      {
        path: z
          .string()
          .describe(
            "Workflowy API path starting with /api/v1/... (e.g., /api/v1/nodes?parent_id=None)",
          ),
        method: z
          .enum(["GET", "POST", "DELETE"])
          .default("GET")
          .describe("HTTP method for Workflowy"),
        query: z.record(z.any()).optional().describe("Query params for GET requests"),
        body: z.record(z.any()).optional().describe("JSON body for POST requests"),
      },
      async ({
        path,
        method,
        query,
        body,
      }: {
        path: string;
        method: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
      }) => {
        if (!path.startsWith("/api/")) {
          throw new Error("path must start with /api/");
        }

        const apiKey = process.env.WORKFLOWY_API_KEY;
        if (!apiKey) {
          throw new Error("WORKFLOWY_API_KEY is not set in process.env (Vercel env vars).");
        }

        const qs = new URLSearchParams(
          Object.entries(query || {}).reduce<Record<string, string>>((acc, [k, v]) => {
            if (v !== undefined && v !== null) acc[k] = String(v);
            return acc;
          }, {}),
        ).toString();

        const url = `https://workflowy.com${path}${qs ? "?" + qs : ""}`;

        const res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body:
            method === "GET" || method === "DELETE"
              ? undefined
              : body
                ? JSON.stringify(body)
                : undefined,
        });

        const text = await res.text();
        let data: unknown;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = { raw: text };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  path,
                  method,
                  http_status: res.status,
                  ok: res.ok,
                  data,
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    );
  },
  {},
  {
    basePath: "/api",
  },
);

export { handler as GET, handler as POST };
