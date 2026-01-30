import { App } from "@modelcontextprotocol/ext-apps";
import type { PullRequest } from "./types/github.js";

// Initialize MCP App
const app = new App({
  name: "GitHub PR Dashboard",
  version: "1.0.0",
});

// Global state
let currentData: {
  repository: string;
  owner: string;
  repo: string;
  pullRequests: PullRequest[];
  filters: any;
} | null = null;

// Connect to host
app.connect();

// Handle initial tool result
app.ontoolresult = (result) => {
  const content = result.content?.find((c) => c.type === "text");
  if (content && "text" in content) {
    try {
      currentData = JSON.parse(content.text);
      renderDashboard();
    } catch (error) {
      console.error("Failed to parse tool result:", error);
    }
  }
};

// Render the dashboard
function renderDashboard() {
  if (!currentData) return;

  const { repository, pullRequests } = currentData;

  // Update repo info
  const repoInfoEl = document.getElementById("repo-info");
  if (repoInfoEl) {
    repoInfoEl.innerHTML = `
      <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
      </svg>
      ${repository}
      <span>·</span>
      ${pullRequests.length} pull requests
    `;
  }

  // Render PR list
  const prListEl = document.getElementById("pr-list");
  if (!prListEl) return;

  if (pullRequests.length === 0) {
    prListEl.innerHTML = `
      <div class="empty-state">
        <h3>No pull requests found</h3>
        <p>Try adjusting your filters or check back later.</p>
      </div>
    `;
    return;
  }

  prListEl.innerHTML = pullRequests.map((pr) => createPRCard(pr)).join("");

  // Add event listeners
  attachEventListeners();
}

// Create PR card HTML
function createPRCard(pr: PullRequest): string {
  const timeSince = getTimeSince(new Date(pr.created_at));
  const reviewStatus = getReviewStatus(pr);
  const ciStatus = "success"; // We'll add real CI status later

  return `
    <div class="pr-card" data-pr-number="${pr.number}">
      <div class="pr-header">
        <div class="pr-title">
          <h3 onclick="window.open('${pr.html_url}', '_blank')">
            ${escapeHtml(pr.title)}
          </h3>
          <span class="pr-number">#${pr.number}</span>
          ${pr.draft ? '<span class="badge badge-draft">Draft</span>' : ""}
          ${reviewStatus === "approved" ? '<span class="badge badge-approved">✓ Approved</span>' : ""}
          ${reviewStatus === "changes_requested" ? '<span class="badge badge-changes">Changes Requested</span>' : ""}
          ${ciStatus === "success" ? '<span class="badge badge-success">✓ CI Passed</span>' : ""}
          ${ciStatus === "failure" ? '<span class="badge badge-failure">✗ CI Failed</span>' : ""}
        </div>
      </div>

      <div class="pr-meta">
        <div class="pr-author">
          <img src="${pr.user.avatar_url}" class="avatar" alt="${pr.user.login}">
          <span>${pr.user.login}</span>
        </div>
        <span>opened ${timeSince}</span>
      </div>

      <div class="pr-stats">
        <div class="stat">
          <span>📝</span>
          <span>${pr.changed_files} files</span>
        </div>
        <div class="stat">
          <span class="stat-add">+${pr.additions}</span>
        </div>
        <div class="stat">
          <span class="stat-del">-${pr.deletions}</span>
        </div>
        <div class="stat">
          <span>💾</span>
          <span>${pr.commits} commits</span>
        </div>
      </div>

      ${
        pr.labels.length > 0
          ? `
        <div class="labels">
          ${pr.labels
            .map(
              (label) => `
            <span class="label" style="background-color: #${label.color}">
              ${escapeHtml(label.name)}
            </span>
          `
            )
            .join("")}
        </div>
      `
          : ""
      }

      ${
        pr.requested_reviewers.length > 0
          ? `
        <div class="pr-reviewers">
          ${pr.requested_reviewers
            .map(
              (reviewer) => `
            <div class="reviewer">
              <img src="${reviewer.avatar_url}" class="avatar" alt="${reviewer.login}">
              <span>${reviewer.login}</span>
            </div>
          `
            )
            .join("")}
        </div>
      `
          : ""
      }

      <div class="pr-actions">
        <button class="btn btn-primary" data-action="approve" data-pr="${pr.number}">
          ✓ Approve
        </button>
        <button class="btn btn-danger" data-action="request-changes" data-pr="${pr.number}">
          ⚠ Request Changes
        </button>
        <button class="btn btn-secondary" data-action="comment" data-pr="${pr.number}">
          💬 Comment
        </button>
        <button class="btn btn-secondary" data-action="view" data-pr="${pr.number}">
          👁 View Details
        </button>
      </div>
    </div>
  `;
}

// Get review status
function getReviewStatus(pr: PullRequest): string {
  if (!pr.reviews || pr.reviews.length === 0) return "pending";

  const latestReviews = new Map<string, string>();
  pr.reviews.forEach((review) => {
    latestReviews.set(review.user.login, review.state);
  });

  if (Array.from(latestReviews.values()).includes("CHANGES_REQUESTED")) {
    return "changes_requested";
  }

  if (Array.from(latestReviews.values()).every((state) => state === "APPROVED")) {
    return "approved";
  }

  return "pending";
}

// Attach event listeners
function attachEventListeners() {
  // Filter listeners
  const filterState = document.getElementById("filter-state") as HTMLSelectElement;
  const filterSort = document.getElementById("filter-sort") as HTMLSelectElement;
  const filterAuthor = document.getElementById("filter-author") as HTMLInputElement;
  const filterReviewer = document.getElementById("filter-reviewer") as HTMLInputElement;

  if (filterState) {
    filterState.addEventListener("change", () => refreshData());
  }
  if (filterSort) {
    filterSort.addEventListener("change", () => refreshData());
  }
  if (filterAuthor) {
    filterAuthor.addEventListener("input", debounce(() => refreshData(), 500));
  }
  if (filterReviewer) {
    filterReviewer.addEventListener("input", debounce(() => refreshData(), 500));
  }

  // Action button listeners
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const target = e.target as HTMLButtonElement;
      const action = target.dataset.action;
      const prNumber = parseInt(target.dataset.pr || "0");

      if (!currentData) return;

      switch (action) {
        case "approve":
          await handleApprove(prNumber);
          break;
        case "request-changes":
          await handleRequestChanges(prNumber);
          break;
        case "comment":
          await handleComment(prNumber);
          break;
        case "view":
          const pr = currentData.pullRequests.find((p) => p.number === prNumber);
          if (pr) {
            window.open(pr.html_url, "_blank");
          }
          break;
      }
    });
  });
}

// Handle approve action
async function handleApprove(prNumber: number) {
  if (!currentData) return;

  try {
    await app.callServerTool({
      name: "approve-pr",
      arguments: {
        repository: currentData.repository,
        prNumber,
      },
    });
    
    await app.sendLog({
      level: "info",
      data: `Approved PR #${prNumber}`,
    });

    // Refresh data
    await refreshData();
  } catch (error) {
    await app.sendLog({
      level: "error",
      data: `Failed to approve PR: ${error}`,
    });
  }
}

// Handle request changes action
async function handleRequestChanges(prNumber: number) {
  if (!currentData) return;

  const comment = prompt("Please provide feedback on what needs to change:");
  if (!comment) return;

  try {
    await app.callServerTool({
      name: "request-changes",
      arguments: {
        repository: currentData.repository,
        prNumber,
        comment,
      },
    });

    await app.sendLog({
      level: "info",
      data: `Requested changes on PR #${prNumber}`,
    });

    await refreshData();
  } catch (error) {
    await app.sendLog({
      level: "error",
      data: `Failed to request changes: ${error}`,
    });
  }
}

// Handle comment action
async function handleComment(prNumber: number) {
  if (!currentData) return;

  const comment = prompt("Enter your comment:");
  if (!comment) return;

  try {
    await app.callServerTool({
      name: "comment-on-pr",
      arguments: {
        repository: currentData.repository,
        prNumber,
        comment,
      },
    });

    await app.sendLog({
      level: "info",
      data: `Added comment to PR #${prNumber}`,
    });
  } catch (error) {
    await app.sendLog({
      level: "error",
      data: `Failed to add comment: ${error}`,
    });
  }
}

// Refresh data with current filters
async function refreshData() {
  if (!currentData) return;

  const filterState = document.getElementById("filter-state") as HTMLSelectElement;
  const filterSort = document.getElementById("filter-sort") as HTMLSelectElement;
  const filterAuthor = document.getElementById("filter-author") as HTMLInputElement;
  const filterReviewer = document.getElementById("filter-reviewer") as HTMLInputElement;

  try {
    const result = await app.callServerTool({
      name: "list-pull-requests",
      arguments: {
        repository: currentData.repository,
        state: filterState?.value || "open",
        sortBy: filterSort?.value || "created",
        author: filterAuthor?.value || undefined,
        reviewer: filterReviewer?.value || undefined,
      },
    });

    const content = result.content?.find((c) => c.type === "text");
    if (content && "text" in content) {
      currentData = JSON.parse(content.text);
      renderDashboard();
    }
  } catch (error) {
    await app.sendLog({
      level: "error",
      data: `Failed to refresh data: ${error}`,
    });
  }
}

// Utility functions
function getTimeSince(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [name, value] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / value);
    if (interval >= 1) {
      return `${interval} ${name}${interval > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Log initialization
app.sendLog({
  level: "info",
  data: "PR Dashboard initialized",
});