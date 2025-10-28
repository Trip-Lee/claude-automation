/**
 * GitHubClient - GitHub API integration for PR creation
 *
 * Handles:
 * - Pull request creation
 * - Branch pushing
 * - Repository URL parsing
 */

import { Octokit } from '@octokit/rest';
import { GitManager } from './git-manager.js';
import chalk from 'chalk';

export class GitHubClient {
  constructor(token) {
    if (!token) {
      throw new Error('GitHub token is required. Set GITHUB_TOKEN in .env file');
    }

    this.octokit = new Octokit({ auth: token });
    this.gitManager = new GitManager();
  }

  /**
   * Create a pull request
   * @param {Object} options - PR options
   * @param {string} options.repo - Repository (e.g., "github.com/owner/repo")
   * @param {string} options.title - PR title
   * @param {string} options.branch - Source branch (head)
   * @param {string} options.baseBranch - Target branch (base)
   * @param {string} options.body - PR description (markdown)
   * @returns {Promise<Object>} - PR details with number and URL
   */
  async createPullRequest({ repo, title, branch, baseBranch, body }) {
    const [owner, repoName] = this.parseRepo(repo);

    console.log(chalk.gray(`  Creating PR: ${title}`));
    console.log(chalk.gray(`    From: ${branch} → ${baseBranch}`));

    try {
      const response = await this.octokit.rest.pulls.create({
        owner,
        repo: repoName,
        title,
        head: branch,
        base: baseBranch,
        body: body || 'Automated PR from Claude Multi-Agent System',
        maintainer_can_modify: true // Allow maintainers to edit the PR
      });

      console.log(chalk.green(`  ✅ PR created: #${response.data.number}`));
      console.log(chalk.blue(`     ${response.data.html_url}`));

      return {
        number: response.data.number,
        url: response.data.html_url,
        id: response.data.id,
        state: response.data.state
      };
    } catch (error) {
      // Check for common errors
      if (error.status === 422) {
        // PR might already exist
        const existingPR = await this.findExistingPR({ repo, branch, baseBranch });
        if (existingPR) {
          console.log(chalk.yellow(`  ⚠️  PR already exists: #${existingPR.number}`));
          return existingPR;
        }
      }

      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  /**
   * Find existing PR for branch
   * @param {Object} options - Search options
   * @returns {Promise<Object|null>} - PR details or null
   */
  async findExistingPR({ repo, branch, baseBranch }) {
    const [owner, repoName] = this.parseRepo(repo);

    try {
      const response = await this.octokit.rest.pulls.list({
        owner,
        repo: repoName,
        head: `${owner}:${branch}`,
        base: baseBranch,
        state: 'open'
      });

      if (response.data.length > 0) {
        const pr = response.data[0];
        return {
          number: pr.number,
          url: pr.html_url,
          id: pr.id,
          state: pr.state
        };
      }

      return null;
    } catch (error) {
      console.log(chalk.yellow(`  Could not check for existing PR: ${error.message}`));
      return null;
    }
  }

  /**
   * Update PR description
   * @param {Object} options - Update options
   * @returns {Promise<void>}
   */
  async updatePullRequest({ repo, prNumber, title, body }) {
    const [owner, repoName] = this.parseRepo(repo);

    try {
      await this.octokit.rest.pulls.update({
        owner,
        repo: repoName,
        pull_number: prNumber,
        title,
        body
      });

      console.log(chalk.green(`  ✅ PR #${prNumber} updated`));
    } catch (error) {
      throw new Error(`Failed to update PR: ${error.message}`);
    }
  }

  /**
   * Add comment to PR
   * @param {Object} options - Comment options
   * @returns {Promise<void>}
   */
  async addComment({ repo, prNumber, body }) {
    const [owner, repoName] = this.parseRepo(repo);

    try {
      await this.octokit.rest.issues.createComment({
        owner,
        repo: repoName,
        issue_number: prNumber,
        body
      });

      console.log(chalk.green(`  ✅ Comment added to PR #${prNumber}`));
    } catch (error) {
      throw new Error(`Failed to add comment: ${error.message}`);
    }
  }

  /**
   * Close a pull request
   * @param {Object} options - Close options
   * @returns {Promise<void>}
   */
  async closePullRequest({ repo, prNumber }) {
    const [owner, repoName] = this.parseRepo(repo);

    try {
      await this.octokit.rest.pulls.update({
        owner,
        repo: repoName,
        pull_number: prNumber,
        state: 'closed'
      });

      console.log(chalk.green(`  ✅ PR #${prNumber} closed`));
    } catch (error) {
      throw new Error(`Failed to close PR: ${error.message}`);
    }
  }

  /**
   * Merge a pull request
   * @param {Object} options - Merge options
   * @returns {Promise<void>}
   */
  async mergePullRequest({ repo, prNumber, mergeMethod = 'squash' }) {
    const [owner, repoName] = this.parseRepo(repo);

    try {
      await this.octokit.rest.pulls.merge({
        owner,
        repo: repoName,
        pull_number: prNumber,
        merge_method: mergeMethod // 'merge', 'squash', or 'rebase'
      });

      console.log(chalk.green(`  ✅ PR #${prNumber} merged`));
    } catch (error) {
      throw new Error(`Failed to merge PR: ${error.message}`);
    }
  }

  /**
   * Push branch to GitHub
   * @param {string} projectPath - Path to git repository
   * @param {string} branchName - Branch to push
   * @returns {Promise<string>} - Output from git push
   */
  async pushBranch(projectPath, branchName) {
    console.log(chalk.gray(`  Pushing branch: ${branchName}`));

    try {
      const output = await this.gitManager.push(projectPath, branchName, true);
      console.log(chalk.green(`  ✅ Branch pushed to GitHub`));
      return output;
    } catch (error) {
      throw new Error(`Failed to push branch: ${error.message}`);
    }
  }

  /**
   * Parse repository URL to extract owner and repo
   * @param {string} repoUrl - Repository URL
   * @returns {Array<string>} - [owner, repo]
   */
  parseRepo(repoUrl) {
    // Handle different formats:
    // - github.com/owner/repo
    // - https://github.com/owner/repo
    // - https://github.com/owner/repo.git

    let cleanUrl = repoUrl;

    // Remove protocol if present
    cleanUrl = cleanUrl.replace(/^https?:\/\//, '');

    // Remove .git suffix if present
    cleanUrl = cleanUrl.replace(/\.git$/, '');

    // Remove github.com/ prefix
    cleanUrl = cleanUrl.replace(/^github\.com\//, '');

    // Split into owner and repo
    const parts = cleanUrl.split('/');

    if (parts.length < 2) {
      throw new Error(
        `Invalid repository URL: ${repoUrl}\n` +
        `Expected format: github.com/owner/repo or https://github.com/owner/repo`
      );
    }

    return [parts[0], parts[1]];
  }

  /**
   * Check if a repository exists and is accessible
   * @param {string} repo - Repository URL
   * @returns {Promise<boolean>} - True if accessible
   */
  async checkRepoAccess(repo) {
    const [owner, repoName] = this.parseRepo(repo);

    try {
      await this.octokit.rest.repos.get({
        owner,
        repo: repoName
      });
      return true;
    } catch (error) {
      if (error.status === 404) {
        return false;
      }
      throw new Error(`Failed to check repository access: ${error.message}`);
    }
  }

  /**
   * Get PR status
   * @param {Object} options - Status options
   * @returns {Promise<Object>} - PR status details
   */
  async getPRStatus({ repo, prNumber }) {
    const [owner, repoName] = this.parseRepo(repo);

    try {
      const pr = await this.octokit.rest.pulls.get({
        owner,
        repo: repoName,
        pull_number: prNumber
      });

      return {
        number: pr.data.number,
        state: pr.data.state,
        merged: pr.data.merged,
        mergeable: pr.data.mergeable,
        url: pr.data.html_url
      };
    } catch (error) {
      throw new Error(`Failed to get PR status: ${error.message}`);
    }
  }

  /**
   * List open PRs for repository
   * @param {string} repo - Repository URL
   * @returns {Promise<Array>} - Array of PR objects
   */
  async listPullRequests(repo) {
    const [owner, repoName] = this.parseRepo(repo);

    try {
      const response = await this.octokit.rest.pulls.list({
        owner,
        repo: repoName,
        state: 'open',
        per_page: 100
      });

      return response.data.map(pr => ({
        number: pr.number,
        title: pr.title,
        branch: pr.head.ref,
        baseBranch: pr.base.ref,
        url: pr.html_url,
        createdAt: pr.created_at
      }));
    } catch (error) {
      throw new Error(`Failed to list PRs: ${error.message}`);
    }
  }

  /**
   * Create a new GitHub repository
   * @param {Object} options - Repository options
   * @param {string} options.name - Repository name
   * @param {string} options.description - Repository description
   * @param {boolean} options.private - Whether repo is private (default: false)
   * @param {boolean} options.autoInit - Initialize with README (default: true)
   * @returns {Promise<Object>} - Created repository details
   */
  async createRepository({ name, description, private: isPrivate = false, autoInit = true }) {
    console.log(chalk.gray(`  Creating GitHub repository: ${name}...`));

    try {
      const response = await this.octokit.rest.repos.createForAuthenticatedUser({
        name,
        description: description || `Project managed by Claude Automation`,
        private: isPrivate,
        auto_init: autoInit,
        has_issues: true,
        has_projects: true,
        has_wiki: false
      });

      console.log(chalk.green(`  ✅ Repository created: ${response.data.html_url}`));

      return {
        name: response.data.name,
        fullName: response.data.full_name,
        url: response.data.html_url,
        cloneUrl: response.data.clone_url,
        sshUrl: response.data.ssh_url,
        owner: response.data.owner.login,
        private: response.data.private,
        defaultBranch: response.data.default_branch
      };
    } catch (error) {
      if (error.status === 422) {
        throw new Error(`Repository '${name}' already exists`);
      }
      throw new Error(`Failed to create repository: ${error.message}`);
    }
  }

  /**
   * Get authenticated user info
   * @returns {Promise<Object>} - User details
   */
  async getAuthenticatedUser() {
    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      return {
        login: response.data.login,
        name: response.data.name,
        email: response.data.email,
        type: response.data.type
      };
    } catch (error) {
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }
}
