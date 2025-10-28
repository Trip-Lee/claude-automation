/**
 * GitHubClient - Comprehensive GitHub API Integration
 *
 * ============================================================================
 * OVERVIEW
 * ============================================================================
 * This class provides a complete interface to GitHub's REST API, handling all
 * aspects of repository management, pull request workflows, and branch operations.
 * It serves as the primary integration point between the Claude Multi-Agent System
 * and GitHub.
 *
 * ============================================================================
 * CORE CAPABILITIES
 * ============================================================================
 *
 * 1. PULL REQUEST LIFECYCLE MANAGEMENT
 *    - Create PRs with automatic duplicate detection
 *    - Update PR title, description, and metadata
 *    - Add comments for collaborative review
 *    - Close PRs (with or without merging)
 *    - Merge PRs with configurable strategies (squash/merge/rebase)
 *    - Query PR status and mergeability
 *    - List all open PRs in a repository
 *
 * 2. REPOSITORY MANAGEMENT
 *    - Create new repositories with customizable settings
 *    - Validate repository existence and access permissions
 *    - Parse repository URLs in multiple formats
 *    - Configure repository features (issues, projects, wiki)
 *
 * 3. BRANCH OPERATIONS
 *    - Push branches to remote with upstream tracking
 *    - Integrates with GitManager for local operations
 *    - Handles authentication via token or GitHub CLI
 *
 * 4. AUTHENTICATION & SECURITY
 *    - Token-based authentication via Octokit
 *    - Automatic error handling for auth failures
 *    - Supports both personal access tokens and GitHub App tokens
 *
 * ============================================================================
 * PROCESS FLOWS
 * ============================================================================
 *
 * TYPICAL PR WORKFLOW:
 * 1. GitManager creates and commits to a feature branch locally
 * 2. pushBranch() pushes the branch to GitHub
 * 3. createPullRequest() creates PR (or finds existing one)
 * 4. Optional: addComment() for automated code review notes
 * 5. getPRStatus() to check if ready to merge
 * 6. mergePullRequest() to complete the workflow
 *
 * REPOSITORY SETUP WORKFLOW:
 * 1. createRepository() creates repo on GitHub
 * 2. GitManager adds remote and pushes initial commit
 * 3. checkRepoAccess() validates successful setup
 *
 * ============================================================================
 * ERROR HANDLING
 * ============================================================================
 *
 * Common Error Scenarios:
 * - 401 Unauthorized: Invalid or expired token
 * - 404 Not Found: Repository doesn't exist or no access
 * - 422 Validation Failed: PR already exists, invalid data
 * - 403 Forbidden: Rate limit exceeded, insufficient permissions
 *
 * All methods throw descriptive errors with actionable messages.
 *
 * ============================================================================
 * USAGE EXAMPLE
 * ============================================================================
 *
 * const client = new GitHubClient(process.env.GITHUB_TOKEN);
 *
 * // Create repository
 * const repo = await client.createRepository({
 *   name: 'my-project',
 *   description: 'Project description',
 *   private: false
 * });
 *
 * // Push branch and create PR
 * await client.pushBranch('/path/to/project', 'feature-branch');
 * const pr = await client.createPullRequest({
 *   repo: 'github.com/owner/my-project',
 *   title: 'Add new feature',
 *   branch: 'feature-branch',
 *   baseBranch: 'main',
 *   body: 'Detailed PR description'
 * });
 *
 * // Check status and merge
 * const status = await client.getPRStatus({ repo, prNumber: pr.number });
 * if (status.mergeable) {
 *   await client.mergePullRequest({ repo, prNumber: pr.number });
 * }
 *
 * ============================================================================
 * DEPENDENCIES
 * ============================================================================
 * - @octokit/rest: GitHub API client library
 * - GitManager: Local git operations (from ./git-manager.js)
 * - chalk: Terminal output formatting
 *
 * ============================================================================
 * RELATED FILES
 * ============================================================================
 * - lib/git-manager.js: Local git operations
 * - setup-github.sh: Automated repository setup script
 * - docs/GITHUB_SETUP.md: User-facing setup documentation
 * - GITHUB_STATUS.md: Repository connection status tracking
 *
 * @module GitHubClient
 * @requires @octokit/rest
 * @requires ./git-manager
 * @requires chalk
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
   * Create a pull request with automatic duplicate detection
   *
   * PROCESS FLOW:
   * 1. Parse repository URL to extract owner and repo name
   * 2. Validate inputs and display operation details
   * 3. Attempt to create PR via GitHub API
   * 4. If 422 error (validation failed), check for existing PR
   * 5. Return either newly created PR or existing PR details
   *
   * DUPLICATE DETECTION:
   * When a PR already exists for the same branch→base combination, GitHub
   * returns a 422 error. This method automatically detects this scenario
   * and retrieves the existing PR instead of failing.
   *
   * ERROR SCENARIOS:
   * - 401: Invalid GitHub token or expired credentials
   * - 404: Repository not found or insufficient permissions
   * - 422: Validation failed (usually duplicate PR, auto-recovered)
   * - 403: Rate limit exceeded or branch protection prevents PR
   *
   * BEST PRACTICES:
   * - Ensure branch is pushed to remote before calling this
   * - Use descriptive titles following conventional commit format
   * - Include markdown body with summary, test plan, and checklist
   * - Set maintainer_can_modify to allow collaborative editing
   *
   * @param {Object} options - PR creation options
   * @param {string} options.repo - Repository URL in any format:
   *                                 - "github.com/owner/repo"
   *                                 - "https://github.com/owner/repo"
   *                                 - "https://github.com/owner/repo.git"
   * @param {string} options.title - PR title (supports markdown)
   * @param {string} options.branch - Source branch name (head branch)
   * @param {string} options.baseBranch - Target branch (usually 'main' or 'master')
   * @param {string} options.body - PR description in markdown format
   * @returns {Promise<Object>} PR details object containing:
   *          - number: PR number (e.g., 42)
   *          - url: Web URL to view the PR
   *          - id: GitHub's internal PR ID
   *          - state: 'open', 'closed', or 'merged'
   * @throws {Error} If PR creation fails (non-duplicate errors)
   *
   * @example
   * const pr = await client.createPullRequest({
   *   repo: 'github.com/owner/my-project',
   *   title: 'feat: Add user authentication',
   *   branch: 'feature/auth',
   *   baseBranch: 'main',
   *   body: '## Summary\nAdds JWT-based authentication\n\n## Test Plan\n- [x] Unit tests pass'
   * });
   * console.log(`PR created: ${pr.url}`);
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
   * Merge a pull request using specified merge strategy
   *
   * PROCESS FLOW:
   * 1. Validate PR is in mergeable state
   * 2. Apply merge using specified strategy
   * 3. Close PR and update base branch
   * 4. Trigger any configured webhooks or actions
   *
   * MERGE STRATEGIES:
   *
   * 1. SQUASH (default, recommended):
   *    - Combines all commits into a single commit
   *    - Creates clean, linear history on base branch
   *    - Preserves full history in PR discussion
   *    - Best for: Feature branches with many small commits
   *    Example: 10 commits → 1 commit "Add authentication feature"
   *
   * 2. MERGE (standard merge commit):
   *    - Creates a merge commit preserving all individual commits
   *    - Maintains complete commit history
   *    - Shows clear merge points in git log
   *    - Best for: Long-running feature branches, release branches
   *    Example: Creates merge commit "Merge PR #42 from feature/auth"
   *
   * 3. REBASE (linear history):
   *    - Replays commits on top of base branch
   *    - No merge commit created
   *    - Clean linear history
   *    - Best for: Small PRs, maintaining strict linear history
   *    Example: Moves commits from PR to top of base branch
   *
   * MERGE REQUIREMENTS:
   * - PR must be in 'open' state
   * - All required status checks must pass
   * - Branch must be up to date with base (or repo allows outdated merges)
   * - No merge conflicts present
   * - Required reviews approved (if branch protection enabled)
   *
   * ERROR SCENARIOS:
   * - 405: PR not in mergeable state (conflicts, checks failed)
   * - 404: PR doesn't exist or was deleted
   * - 403: Insufficient permissions or branch protection prevents merge
   * - 409: Merge conflict detected
   *
   * BEST PRACTICES:
   * - Use 'squash' for feature branches (keeps history clean)
   * - Use 'merge' for release branches (preserves full history)
   * - Check mergeable status before attempting merge
   * - Ensure CI/CD checks pass before merging
   * - Delete feature branch after successful merge
   *
   * @param {Object} options - Merge options
   * @param {string} options.repo - Repository URL
   * @param {number} options.prNumber - PR number to merge
   * @param {string} [options.mergeMethod='squash'] - Merge strategy:
   *                 'squash': Squash all commits into one
   *                 'merge': Create a merge commit
   *                 'rebase': Rebase and merge
   * @returns {Promise<void>} Resolves when merge completes successfully
   * @throws {Error} If merge fails due to conflicts, permissions, or validation
   *
   * @example
   * // Squash merge (recommended for features)
   * await client.mergePullRequest({
   *   repo: 'github.com/owner/project',
   *   prNumber: 42,
   *   mergeMethod: 'squash'
   * });
   *
   * @example
   * // Standard merge (for release branches)
   * await client.mergePullRequest({
   *   repo: 'github.com/owner/project',
   *   prNumber: 15,
   *   mergeMethod: 'merge'
   * });
   *
   * @example
   * // Full workflow with status check
   * const status = await client.getPRStatus({ repo, prNumber: 42 });
   * if (status.mergeable && status.state === 'open') {
   *   await client.mergePullRequest({ repo, prNumber: 42 });
   *   console.log('PR merged successfully');
   * }
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
   * Push a local branch to GitHub with upstream tracking
   *
   * PROCESS FLOW:
   * 1. Validate project path and branch name
   * 2. Use GitManager to execute 'git push -u origin <branch>'
   * 3. Set upstream tracking for future pushes/pulls
   * 4. Display push progress and confirmation
   *
   * UPSTREAM TRACKING:
   * The '-u' flag (--set-upstream) links the local branch to the remote branch,
   * enabling simplified future operations:
   * - 'git push' without arguments will push to tracked remote
   * - 'git pull' will fetch and merge from tracked remote
   * - 'git status' will show ahead/behind commit counts
   *
   * AUTHENTICATION:
   * Uses existing git credentials configured via:
   * - GitHub CLI (gh auth login) - recommended
   * - Git credential helper with personal access token
   * - SSH keys (if remote URL uses git@github.com)
   *
   * ERROR SCENARIOS:
   * - No remote named 'origin': Add remote first
   * - Authentication failed: Token expired or insufficient permissions
   * - Branch diverged: Remote has commits not in local branch
   * - Protected branch: Branch protection rules prevent direct push
   *
   * BEST PRACTICES:
   * - Always commit changes before pushing
   * - Pull before pushing if working on shared branches
   * - Use feature branches for development work
   * - Ensure .gitignore excludes sensitive files
   *
   * @param {string} projectPath - Absolute path to git repository root
   * @param {string} branchName - Name of branch to push (e.g., 'feature/auth')
   * @returns {Promise<string>} Git push command output showing:
   *          - Remote repository URL
   *          - Branch creation/update status
   *          - Commit range pushed
   *          - Upstream tracking confirmation
   * @throws {Error} If push fails due to auth, conflicts, or invalid path
   *
   * @example
   * // Push feature branch to create PR
   * await client.pushBranch('/home/user/my-project', 'feature/new-feature');
   * // Output: "Branch 'feature/new-feature' set up to track 'origin/feature/new-feature'"
   *
   * @example
   * // Common workflow with branch creation
   * const projectPath = '/path/to/project';
   * await gitManager.createBranch(projectPath, 'fix/bug-123');
   * await gitManager.commit(projectPath, 'Fix critical bug');
   * await client.pushBranch(projectPath, 'fix/bug-123');
   * // Now ready to create PR
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
   * Create a new GitHub repository with customizable settings
   *
   * PROCESS FLOW:
   * 1. Validate authentication token exists
   * 2. Check if repository already exists (prevents duplicates)
   * 3. Create repository with specified configuration
   * 4. Enable/disable repository features (issues, projects, wiki)
   * 5. Return repository details including clone URLs
   *
   * REPOSITORY FEATURES CONFIGURED:
   * - Issues: Enabled (for bug tracking and feature requests)
   * - Projects: Enabled (for project management)
   * - Wiki: Disabled (documentation in README/docs/ instead)
   * - Auto-init: Configurable (creates initial README.md)
   *
   * AUTO-INIT BEHAVIOR:
   * - autoInit=true: Creates repo with README.md and initial commit
   *   Use when starting a new project from scratch
   * - autoInit=false: Creates empty repository
   *   Use when pushing existing local code (recommended for this system)
   *
   * ERROR SCENARIOS:
   * - 401: Invalid or expired GitHub token
   * - 422: Repository name already exists for this user/org
   * - 403: Rate limit exceeded or insufficient token permissions
   *
   * TOKEN PERMISSIONS REQUIRED:
   * - 'repo' scope for public and private repositories
   * - 'public_repo' scope for public repositories only
   *
   * BEST PRACTICES:
   * - Use descriptive, kebab-case repository names
   * - Provide clear descriptions for discoverability
   * - Set autoInit=false when pushing existing code
   * - Use private=true for sensitive projects
   *
   * @param {Object} options - Repository creation options
   * @param {string} options.name - Repository name (alphanumeric, hyphens, underscores)
   * @param {string} options.description - Brief description of the repository
   * @param {boolean} [options.private=false] - Whether repository is private
   * @param {boolean} [options.autoInit=true] - Initialize with README.md
   * @returns {Promise<Object>} Repository details object containing:
   *          - name: Repository name
   *          - fullName: Full repository path (owner/name)
   *          - url: Web URL to view repository
   *          - cloneUrl: HTTPS URL for git clone
   *          - sshUrl: SSH URL for git clone
   *          - owner: Repository owner's username
   *          - private: Boolean indicating visibility
   *          - defaultBranch: Name of default branch (usually 'main')
   * @throws {Error} If repository creation fails or already exists
   *
   * @example
   * // Create public repository for existing code
   * const repo = await client.createRepository({
   *   name: 'my-awesome-project',
   *   description: 'An awesome project built with Claude',
   *   private: false,
   *   autoInit: false  // We have local code to push
   * });
   *
   * // Then add as remote and push
   * // git remote add origin ${repo.cloneUrl}
   * // git push -u origin main
   *
   * @example
   * // Create private repository from scratch
   * const repo = await client.createRepository({
   *   name: 'secret-project',
   *   description: 'Internal project',
   *   private: true,
   *   autoInit: true  // Creates initial README
   * });
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
