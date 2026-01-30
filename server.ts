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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize GitHub API
const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  console.error("ERROR: GITHUB_TOKEN environment variable is required");
  process.exit(1);
}

const octokit = new Octokit({ auth: githubToken });

// Initialize MCP Server
const server = new McpServer({
  name: "GitHub PR Review Dashboard",
  version: "1.0.0",
});

// UI Resource URI
const resourceUri = "ui://github-pr-review-dashboard-mcp-app/pr-dashboard.html";

// Tool 1: List Pull Requests
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
    },
    _meta: {
      ui: { 
        resourceUri: resourceUri 
      },
    },
  },
  async (params) => {
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
        filtered = filtered.filter((pr) => pr.user.login === params.author);
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
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message,
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

// Tool 2: Approve Pull Request
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
    },
    _meta: {},
  },
  async (params) => {
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
      return {
        content: [
          {
            type: "text",
            text: `Failed to approve PR #${params.prNumber}: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 3: Request Changes
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
    },
    _meta: {},
  },
  async (params) => {
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
      return {
        content: [
          {
            type: "text",
            text: `Failed to request changes on PR #${params.prNumber}: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 4: Add Comment
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
    },
    _meta: {},
  },
  async (params) => {
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
      return {
        content: [
          {
            type: "text",
            text: `Failed to add comment to PR #${params.prNumber}: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 5: Merge Pull Request
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
    },
    _meta: {},
  },
  async (params) => {
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
      return {
        content: [
          {
            type: "text",
            text: `Failed to merge PR #${params.prNumber}: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register UI Resource
registerAppResource(
  server,
  resourceUri,
  resourceUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    try {
      const htmlPath = path.join(__dirname, "dist", "pr-dashboard.html");
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

// Setup Express Server
const app = express();
app.use(cors());
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✓ GitHub PR Dashboard MCP Server running on http://localhost:${PORT}/mcp`);
  console.log(`✓ GitHub Token configured: ${githubToken.substring(0, 7)}...`);
  console.log(`✓ Health check available at http://localhost:${PORT}/health`);
  console.log(`✓ Ready to accept connections`);
});
