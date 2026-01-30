// @ts-nocheck - MCP SDK has complex type inference issues that are safe to ignore
/**
 * GitHub PR Review Dashboard MCP Server
 * 
 * This server implements the Model Context Protocol (MCP) to provide
 * tools and resources for managing GitHub pull requests through an
 * interactive dashboard interface.
 * 
 * @module server
 * @requires @modelcontextprotocol/sdk
 * @requires @modelcontextprotocol/ext-apps
 * @requires express
 * @requires @octokit/rest
 */

// Polyfill for Hono compatibility: ensure global.Request is available
// @hono/node-server requires global.Request to be defined, but in some Node.js
// environments it may only be on globalThis. This ensures compatibility.
if (typeof global.Request === 'undefined' && typeof globalThis.Request !== 'undefined') {
  global.Request = globalThis.Request;
  global.Response = globalThis.Response;
  global.Headers = globalThis.Headers;
  global.fetch = globalThis.fetch;
}

// server.ts
console.log("Starting MCP App server...");
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Octokit } from "@octokit/rest";

// Load environment variables
dotenv.config();

/**
 * Get current file and directory paths for ES modules
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize GitHub API client with authentication
 * Requires GITHUB_TOKEN environment variable
 */
const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  console.error("ERROR: GITHUB_TOKEN environment variable is required");
  process.exit(1);
}

const octokit = new Octokit({ auth: githubToken });

/**
 * Initialize MCP Server instance
 * Provides tools and resources for GitHub PR management
 */
const server = new McpServer({
  name: "GitHub PR Review Dashboard",
  version: "1.0.0",
});

/**
 * UI Resource URI for the PR dashboard
 * This URI is used to serve the dashboard HTML interface
 */
const resourceUri = "ui://github-pr-review-dashboard-mcp-app/pr-dashboard.html";

/**
 * Tool 1: List Pull Requests
 * 
 * Fetches and displays pull requests from a GitHub repository with filtering options.
 * Returns data for rendering in the interactive dashboard UI.
 * 
 * @param {object} params - Tool parameters
 * @param {string} params.repository - Repository in format 'owner/repo'
 * @param {string} [params.state='open'] - Filter by PR state ('open', 'closed', 'all')
 * @param {string} [params.author] - Filter by PR author username
 * @param {string} [params.sortBy='created'] - Sort by field ('created', 'updated', 'popularity')
 * @returns {Promise<object>} PR data including reviews and metadata
 */
registerAppTool(
  server,
  "list-pull-requests",
  {
    title: "List Pull Requests",
    description: "Display an interactive dashboard of pull requests for a GitHub repository",
    inputSchema: {
      type: "object",
      properties: {
        repository: {
          type: "string",
          description: "Repository in format 'owner/repo'",
        },
        state: {
          type: "string",
          enum: ["open", "closed", "all"],
          default: "open",
          description: "Filter by PR state",
        },
        author: {
          type: "string",
          description: "Filter by PR author username",
        },
        sortBy: {
          type: "string",
          enum: ["created", "updated", "popularity"],
          default: "created",
          description: "Sort PRs by this field",
        },
      },
      required: ["repository"],
    } as any,
    _meta: {
      ui: { 
        resourceUri: resourceUri 
      },
    },
  },
  async (params: any) => {
    try {
      const [owner, repo] = params.repository.split("/");
      
      // Fetch pull requests
      const { data: pullRequests } = await octokit.pulls.list({
        owner,
        repo,
        state: params.state || "open",
        sort: params.sortBy || "created",
        direction: "desc",
        per_page: 50,
      });

      // Fetch reviews for each PR
      const prsWithReviews = await Promise.all(
        pullRequests.map(async (pr) => {
          try {
            const { data: reviews } = await octokit.pulls.listReviews({
              owner,
              repo,
              pull_number: pr.number,
            });
            return { ...pr, reviews };
          } catch (error) {
            console.error(`Error fetching reviews for PR #${pr.number}:`, error);
            return { ...pr, reviews: [] };
          }
        })
      );

      // Apply filters
      let filtered = prsWithReviews;
      
      if (params.author) {
        filtered = filtered.filter((pr) => pr.user?.login === params.author);
      }

      const responseData = {
        repository: params.repository,
        owner,
        repo,
        filters: {
          state: params.state || "open",
          author: params.author,
          sortBy: params.sortBy || "created",
        },
        pullRequests: filtered,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseData),
          },
        ],
      };
    } catch (error) {
      console.error("Error in list-pull-requests:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: errorMessage,
              repository: params.repository,
              pullRequests: [],
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 2: Approve Pull Request
 * 
 * Approves a pull request on GitHub with an optional comment.
 * 
 * @param {object} params - Tool parameters
 * @param {string} params.repository - Repository in format 'owner/repo'
 * @param {number} params.prNumber - Pull request number
 * @param {string} [params.comment] - Optional approval comment
 * @returns {Promise<object>} Success or error message
 */
registerAppTool(
  server,
  "approve-pr",
  {
    title: "Approve Pull Request",
    description: "Approve a pull request",
    inputSchema: {
      type: "object",
      properties: {
        repository: {
          type: "string",
          description: "Repository in format 'owner/repo'",
        },
        prNumber: {
          type: "number",
          description: "Pull request number",
        },
        comment: {
          type: "string",
          description: "Optional approval comment",
        },
      },
      required: ["repository", "prNumber"],
    } as any,
    _meta: {},
  },
  async (params: any) => {
    try {
      const [owner, repo] = params.repository.split("/");
      
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: params.prNumber,
        event: "APPROVE",
        body: params.comment || "Approved via MCP Dashboard",
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully approved PR #${params.prNumber}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error approving PR:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to approve PR #${params.prNumber}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 3: Request Changes
 * 
 * Requests changes on a pull request with a required comment explaining what needs to change.
 * 
 * @param {object} params - Tool parameters
 * @param {string} params.repository - Repository in format 'owner/repo'
 * @param {number} params.prNumber - Pull request number
 * @param {string} params.comment - Required comment explaining requested changes
 * @returns {Promise<object>} Success or error message
 */
registerAppTool(
  server,
  "request-changes",
  {
    title: "Request Changes on PR",
    description: "Request changes on a pull request",
    inputSchema: {
      type: "object",
      properties: {
        repository: {
          type: "string",
          description: "Repository in format 'owner/repo'",
        },
        prNumber: {
          type: "number",
          description: "Pull request number",
        },
        comment: {
          type: "string",
          description: "Required comment explaining requested changes",
        },
      },
      required: ["repository", "prNumber", "comment"],
    } as any,
    _meta: {},
  },
  async (params: any) => {
    try {
      const [owner, repo] = params.repository.split("/");
      
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: params.prNumber,
        event: "REQUEST_CHANGES",
        body: params.comment,
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully requested changes on PR #${params.prNumber}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error requesting changes:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to request changes on PR #${params.prNumber}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 4: Add Comment
 * 
 * Adds a review comment to a pull request without approving or requesting changes.
 * 
 * @param {object} params - Tool parameters
 * @param {string} params.repository - Repository in format 'owner/repo'
 * @param {number} params.prNumber - Pull request number
 * @param {string} params.comment - Comment text
 * @returns {Promise<object>} Success or error message
 */
registerAppTool(
  server,
  "comment-on-pr",
  {
    title: "Comment on PR",
    description: "Add a comment to a pull request",
    inputSchema: {
      type: "object",
      properties: {
        repository: {
          type: "string",
          description: "Repository in format 'owner/repo'",
        },
        prNumber: {
          type: "number",
          description: "Pull request number",
        },
        comment: {
          type: "string",
          description: "Comment text",
        },
      },
      required: ["repository", "prNumber", "comment"],
    } as any,
    _meta: {},
  },
  async (params: any) => {
    try {
      const [owner, repo] = params.repository.split("/");
      
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: params.prNumber,
        event: "COMMENT",
        body: params.comment,
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully added comment to PR #${params.prNumber}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error adding comment:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to add comment to PR #${params.prNumber}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 5: Merge Pull Request
 * 
 * Merges a pull request using the specified merge method.
 * 
 * @param {object} params - Tool parameters
 * @param {string} params.repository - Repository in format 'owner/repo'
 * @param {number} params.prNumber - Pull request number
 * @param {string} [params.method='merge'] - Merge method ('merge', 'squash', 'rebase')
 * @returns {Promise<object>} Success or error message
 */
registerAppTool(
  server,
  "merge-pr",
  {
    title: "Merge Pull Request",
    description: "Merge a pull request",
    inputSchema: {
      type: "object",
      properties: {
        repository: {
          type: "string",
          description: "Repository in format 'owner/repo'",
        },
        prNumber: {
          type: "number",
          description: "Pull request number",
        },
        method: {
          type: "string",
          enum: ["merge", "squash", "rebase"],
          default: "merge",
          description: "Merge method",
        },
      },
      required: ["repository", "prNumber"],
    } as any,
    _meta: {},
  },
  async (params: any) => {
    try {
      const [owner, repo] = params.repository.split("/");
      
      await octokit.pulls.merge({
        owner,
        repo,
        pull_number: params.prNumber,
        merge_method: params.method || "merge",
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully merged PR #${params.prNumber}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error merging PR:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to merge PR #${params.prNumber}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Register UI Resource
 * 
 * Registers the PR dashboard HTML as an MCP resource that can be served to clients.
 * The dashboard is built and bundled into a single HTML file in the dist/ directory.
 */
registerAppResource(
  server,
  resourceUri,
  resourceUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    try {
      // When running from compiled dist/server.js, __dirname is already 'dist'
      // When running from source server.ts, __dirname is the root
      const htmlPath = __dirname.endsWith('dist') 
        ? path.join(__dirname, "pr-dashboard.html")
        : path.join(__dirname, "dist", "pr-dashboard.html");
      const html = await fs.readFile(htmlPath, "utf-8");
      
      return {
        contents: [
          { 
            uri: resourceUri, 
            mimeType: RESOURCE_MIME_TYPE, 
            text: html 
          },
        ],
      };
    } catch (error) {
      console.error("Error reading UI resource:", error);
      throw error;
    }
  }
);

/**
 * Setup Express HTTP Server
 * 
 * Creates an Express server to handle HTTP requests for the MCP server.
 * Enables CORS for cross-origin requests and JSON parsing.
 */
const app = express();
app.use(cors());
app.use(express.json());

/**
 * MCP Endpoint
 * 
 * POST /mcp - Main endpoint for MCP protocol communication
 * Handles streaming HTTP transport for MCP messages
 */
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

/**
 * Health Check Endpoint
 * 
 * GET /health - Returns server health status and timestamp
 * Useful for monitoring and uptime checks
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Start the server
 * 
 * Listens on the configured PORT (default: 3001)
 * Logs startup information including the GitHub token prefix
 */
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✓ GitHub PR Dashboard MCP Server running on http://localhost:${PORT}/mcp`);
  console.log(`✓ GitHub Token configured: ${githubToken.substring(0, 7)}...`);
  console.log(`✓ Health check available at http://localhost:${PORT}/health`);
  console.log(`✓ Ready to accept connections`);
});
