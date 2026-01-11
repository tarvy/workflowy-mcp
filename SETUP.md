# Step-by-Step Setup Guide

## Prerequisites
- Vercel account linked to GitHub
- Neon database account (free tier works)

## Step 1: Create Neon Database

1. **Sign up/Login to Neon**
   - Go to https://neon.tech
   - Sign up for a free account (or login if you already have one)

2. **Create a New Project**
   - Click "Create Project" or "New Project"
   - Choose a project name (e.g., "workflowy-mcp")
   - Select a region close to you
   - Choose PostgreSQL version (default is fine)
   - Click "Create Project"

3. **Get Your Connection String**
   - Once the project is created, you'll see a dashboard
   - Look for "Connection String" or "Connection Details"
   - You should see something like:
     ```
     postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
   - **Copy this entire connection string** - you'll need it in the next step

## Step 2: Configure Vercel Environment Variables

1. **Go to Your Vercel Project**
   - Open https://vercel.com/dashboard
   - Find your `workflowy-mcp` project (or import it if not already deployed)
   - Click on the project name

2. **Navigate to Settings**
   - Click on "Settings" in the top navigation
   - Click on "Environment Variables" in the left sidebar

3. **Add Required Environment Variables**

   Add each of the following:

   | Key | Value | Description |
   |-----|-------|-------------|
   | `DATABASE_URL` | Your Neon connection string | From Step 1 |
   | `ENCRYPTION_KEY` | `openssl rand -hex 32` | 64-char hex string |
   | `JWT_SECRET` | `openssl rand -hex 32` | 64-char hex string |
   | `OAUTH_ISSUER` | `https://your-project.vercel.app` | Your Vercel URL |
   | `OAUTH_REGISTRATION_SECRET` | `openssl rand -hex 32` | 64-char hex string |

   For each variable:
   - Click "Add New"
   - Enter the Key and Value
   - Select "Production", "Preview", and "Development"
   - Click "Save"

4. **Redeploy Your Project**
   - Go to the "Deployments" tab
   - Find your latest deployment
   - Click the three dots menu → "Redeploy"

## Step 3: Get Your Workflowy API Key

1. **Go to Workflowy API Reference**
   - Visit https://workflowy.com/api/
   - Log in to your Workflowy account if needed

2. **Generate/Copy Your API Key**
   - Look for your API key on the page
   - If you don't have one, generate it
   - **Copy your API key** - it looks like `wf_xxxxxxxxxxxxx`

## Step 4: Connect Claude to Your MCP Server

1. **Open Claude Desktop**
2. **Go to Settings → Connectors**
3. **Click "Add Connector"**
4. **Enter your MCP Server URL:**
   ```
   https://your-project-name.vercel.app/api/mcp
   ```
5. **Click "Connect"**
6. **Enter your Workflowy API key** when prompted
7. **Click "Authorize"**

## Step 5: Verify Setup

Try asking Claude:
- "Show me my top Workflowy notes"
- "List my Workflowy bookmarks"
- "Create a note called 'Test' in my inbox"

## Troubleshooting

- **Database connection errors**: Double-check your `DATABASE_URL` in Vercel
- **OAuth errors**: Verify all environment variables are set correctly
- **404 errors**: Make sure your Vercel URL includes `/api/mcp` at the end
- **Authorization failures**: Re-do the OAuth flow in Claude's Connectors settings

## Next Steps

Once set up, you can:
- Create notes in Workflowy
- List and browse your Workflowy nodes
- Save bookmarks for quick access
- Complete/uncomplete tasks
- Move nodes around
