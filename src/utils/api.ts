import { Octokit } from "@octokit/rest";
import type { PullRequest, Review, CIStatus, PRFilters } from "../types/github.js";

export class GitHubAPI {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getPullRequests(
    owner: string,
    repo: string,
    filters: PRFilters = {}
  ): Promise<PullRequest[]> {
    const { data } = await this.octokit.pulls.list({
      owner,
      repo,
      state: filters.state || "open",
      sort: filters.sortBy || "created",
      direction: filters.direction || "desc",
      per_page: 100,
    });

    // Fetch additional data for each PR
    const prsWithDetails = await Promise.all(
      data.map(async (pr) => {
        const [reviews, commits] = await Promise.all([
          this.getReviews(owner, repo, pr.number),
          this.octokit.pulls.listCommits({
            owner,
            repo,
            pull_number: pr.number,
          }),
        ]);

        return {
          ...pr,
          reviews,
          commits: commits.data.length,
        } as PullRequest;
      })
    );

    // Apply additional filters
    let filtered = prsWithDetails;

    if (filters.author) {
      filtered = filtered.filter((pr) => pr.user.login === filters.author);
    }

    if (filters.reviewer) {
      filtered = filtered.filter((pr) =>
        pr.requested_reviewers.some((r) => r.login === filters.reviewer)
      );
    }

    if (filters.label) {
      filtered = filtered.filter((pr) =>
        pr.labels.some((l) => l.name === filters.label)
      );
    }

    return filtered;
  }

  async getReviews(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<Review[]> {
    const { data } = await this.octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });

    return data as Review[];
  }

  async getCIStatus(
    owner: string,
    repo: string,
    ref: string
  ): Promise<CIStatus> {
    const { data } = await this.octokit.repos.getCombinedStatusForRef({
      owner,
      repo,
      ref,
    });

    return data as CIStatus;
  }

  async approvePR(owner: string, repo: string, prNumber: number, body?: string) {
    return this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: "APPROVE",
      body: body || "Approved via MCP Dashboard",
    });
  }

  async requestChanges(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ) {
    return this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: "REQUEST_CHANGES",
      body,
    });
  }

  async addComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ) {
    return this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: "COMMENT",
      body,
    });
  }

  async mergePR(
    owner: string,
    repo: string,
    prNumber: number,
    method: "merge" | "squash" | "rebase" = "merge"
  ) {
    return this.octokit.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: method,
    });
  }

  async getRepository(owner: string, repo: string) {
    const { data } = await this.octokit.repos.get({ owner, repo });
    return data;
  }
}