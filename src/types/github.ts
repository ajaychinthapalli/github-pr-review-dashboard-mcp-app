/**
 * GitHub Types
 * 
 * TypeScript interfaces for GitHub API data structures used in the PR dashboard.
 * These types ensure type safety when working with GitHub pull request data.
 * 
 * @module types/github
 */

/**
 * Pull Request Interface
 * 
 * Represents a GitHub pull request with all relevant metadata, reviews, and statistics.
 */
export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  draft: boolean;
  mergeable_state: string;
  html_url: string;
  body: string | null;
  
  // Review data
  requested_reviewers: Array<{ login: string; avatar_url: string }>;
  reviews?: Review[];
  
  // Stats
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  
  // Labels and milestones
  labels: Array<{ name: string; color: string }>;
  milestone: { title: string } | null;
  
  // CI status
  head: {
    sha: string;
    ref: string;
  };
}

/**
 * Review Interface
 * 
 * Represents a review on a pull request.
 * Reviews can be approvals, change requests, or general comments.
 */
export interface Review {
  id: number;
  user: {
    login: string;
    avatar_url: string;
  };
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING";
  submitted_at: string;
  body: string;
}

/**
 * CI Status Interface
 * 
 * Represents the continuous integration status for a pull request.
 * Includes overall state and individual status checks.
 */
export interface CIStatus {
  state: "success" | "pending" | "failure" | "error";
  statuses: Array<{
    context: string;
    state: string;
    description: string;
    target_url: string;
  }>;
}

/**
 * PR Filters Interface
 * 
 * Filter options for querying pull requests from the GitHub API.
 * All fields are optional to allow flexible filtering.
 */
export interface PRFilters {
  state?: "open" | "closed" | "all";
  author?: string;
  reviewer?: string;
  label?: string;
  sortBy?: "created" | "updated" | "popularity";
  direction?: "asc" | "desc";
}