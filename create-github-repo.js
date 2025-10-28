#!/usr/bin/env node

/**
 * ============================================================================
 * GitHub Repository Creation Script
 * ============================================================================
 *
 * PURPOSE:
 *   Automated script to create a new GitHub repository using the Octokit API.
 *   This is an alternative to using GitHub CLI or manual web-based creation.
 *
 * WHEN TO USE THIS:
 *   - GitHub CLI (gh) is not available or not desired
 *   - You prefer programmatic repository creation
 *   - You need to customize repository settings beyond CLI defaults
 *   - You're automating repository setup in a larger workflow
 *
 * WHAT THIS SCRIPT DOES:
 *   1. Loads GitHub personal access token from ~/.env file
 *   2. Validates token exists and has proper permissions
 *   3. Checks if repository already exists (prevents duplicates)
 *   4. Creates repository with pre-configured settings
 *   5. Displays clone URLs and next steps for pushing code
 *
 * REQUIREMENTS:
 *   - Node.js installed (for running the script)
 *   - @octokit/rest npm package (GitHub API client)
 *   - dotenv npm package (environment variable loading)
 *   - Valid GitHub personal access token in ~/.env
 *   - Token must have 'repo' or 'public_repo' scope
 *
 * REPOSITORY CONFIGURATION:
 *   - Name: claude-automation
 *   - Visibility: Public (can be changed to private)
 *   - Auto-init: false (we have local code to push)
 *   - Features enabled: Issues, Projects, Wiki
 *   - Default branch: main (set by GitHub)
 *
 * AUTHENTICATION:
 *   Token location: ~/.env
 *   Token format: GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
 *   Required scopes:
 *     - 'repo' (for private and public repos)
 *     - OR 'public_repo' (for public repos only)
 *
 * ERROR HANDLING:
 *   - Missing token: Exits with error message
 *   - Invalid token: API returns 401 Unauthorized
 *   - Repository exists: Skips creation, shows existing repo URL
 *   - Rate limit exceeded: API returns 403 Forbidden
 *
 * USAGE:
 *   node create-github-repo.js
 *
 * AFTER RUNNING:
 *   Follow the displayed commands to:
 *   1. Add GitHub as remote: git remote add origin <url>
 *   2. Push code to GitHub: git push -u origin master
 *
 * EXIT CODES:
 *   0 - Success: Repository created or already exists
 *   1 - Failure: Missing token, invalid token, or API error
 *
 * RELATED FILES:
 *   - setup-github.sh: Alternative script using GitHub CLI
 *   - lib/github-client.js: GitHubClient class with similar functionality
 *   - docs/GITHUB_SETUP.md: User-facing setup documentation
 *
 * ============================================================================
 */

import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';

/**
 * ============================================================================
 * STEP 1: Load Environment Variables
 * ============================================================================
 * Load GitHub token from ~/.env file
 * The dotenv package reads the file and makes variables available via process.env
 */
dotenv.config({ path: path.join(homedir(), '.env') });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

/**
 * ============================================================================
 * STEP 2: Validate GitHub Token
 * ============================================================================
 * Ensure token exists before proceeding
 * Without a valid token, API calls will fail with 401 Unauthorized
 */
if (!GITHUB_TOKEN) {
  console.error(chalk.red('Error: GITHUB_TOKEN not found in ~/.env file'));
  console.error(chalk.yellow('\nTo fix this:'));
  console.error(chalk.white('  1. Go to https://github.com/settings/tokens'));
  console.error(chalk.white('  2. Generate new token with "repo" scope'));
  console.error(chalk.white('  3. Add to ~/.env: GITHUB_TOKEN=ghp_your_token_here\n'));
  process.exit(1);
}

/**
 * ============================================================================
 * STEP 3: Initialize Octokit Client
 * ============================================================================
 * Octokit is the official GitHub REST API client for JavaScript
 * It handles authentication, request formatting, and response parsing
 */
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * ============================================================================
 * Main Repository Creation Function
 * ============================================================================
 * PROCESS FLOW:
 * 1. Get authenticated user information
 * 2. Check if repository already exists (prevents duplicates)
 * 3. If exists: Display repo URL and skip creation
 * 4. If not exists: Create repository with configured settings
 * 5. Display success message and next steps
 *
 * ERROR HANDLING:
 * - 401: Invalid/expired token
 * - 404: Repository doesn't exist (expected for new repos)
 * - 422: Repository name conflicts with existing repo
 * - 403: Rate limit exceeded or insufficient permissions
 */
async function createRepository() {
  const repoName = 'claude-automation';
  const description = 'Claude Multi-Agent Coding System - Mobile-accessible AI-powered development orchestration for Raspberry Pi';

  console.log(chalk.blue.bold('\n🚀 Creating GitHub Repository\n'));
  console.log(chalk.gray(`Repository: ${repoName}`));
  console.log(chalk.gray(`Description: ${description}\n`));

  try {
    /**
     * =========================================================================
     * STEP 4: Check for Existing Repository
     * =========================================================================
     * Before creating, verify repository doesn't already exist
     * This prevents 422 "repository name already exists" errors
     *
     * PROCESS:
     * 1. Get authenticated user's login name
     * 2. Attempt to fetch repository
     * 3. If found (200): Repository exists, skip creation
     * 4. If not found (404): Continue with creation
     */
    try {
      const { data: existingRepo } = await octokit.rest.repos.get({
        owner: (await octokit.rest.users.getAuthenticated()).data.login,
        repo: repoName
      });

      // Repository exists - show info and skip creation
      console.log(chalk.yellow(`⚠️  Repository already exists:`));
      console.log(chalk.blue(`   ${existingRepo.html_url}`));
      console.log(chalk.gray(`\nSkipping creation. Use this URL to add as remote:\n`));
      console.log(chalk.white(`   git remote add origin ${existingRepo.clone_url}`));
      console.log(chalk.white(`   git push -u origin master\n`));
      return existingRepo;
    } catch (error) {
      // If error is NOT 404, it's a real error - throw it
      if (error.status !== 404) {
        throw error;
      }
      // 404 means repository doesn't exist - this is expected, continue
    }

    /**
     * =========================================================================
     * STEP 5: Create New Repository
     * =========================================================================
     * Repository doesn't exist, so create it with these settings:
     *
     * CONFIGURATION:
     * - name: Repository identifier (must be unique for user/org)
     * - description: Shown on repo page and in search results
     * - private: false = public repository (visible to everyone)
     * - auto_init: false = don't create README (we have local code)
     * - has_issues: true = enable issue tracking
     * - has_projects: true = enable project boards
     * - has_wiki: true = enable wiki (can be disabled later)
     *
     * API ENDPOINT: POST /user/repos
     * RESPONSE: Repository object with URLs, settings, and metadata
     */
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      description: description,
      private: false, // Make it public (change to true for private)
      auto_init: false, // Don't auto-initialize (we have local code)
      has_issues: true,
      has_projects: true,
      has_wiki: true
    });

    /**
     * =========================================================================
     * STEP 6: Display Success and Next Steps
     * =========================================================================
     * Show repository URL and commands to connect local repo
     */
    console.log(chalk.green('✅ Repository created successfully!\n'));
    console.log(chalk.blue(`   ${repo.html_url}`));
    console.log(chalk.gray(`\nNext steps:\n`));
    console.log(chalk.white(`   git remote add origin ${repo.clone_url}`));
    console.log(chalk.white(`   git push -u origin master\n`));

    return repo;

  } catch (error) {
    /**
     * =========================================================================
     * ERROR HANDLING
     * =========================================================================
     * Provide specific guidance based on error type
     */
    console.error(chalk.red(`\n❌ Error creating repository: ${error.message}`));
    if (error.status === 401) {
      console.error(chalk.yellow('   Check that your GITHUB_TOKEN has the required permissions (repo scope)'));
    } else if (error.status === 403) {
      console.error(chalk.yellow('   Rate limit exceeded or insufficient permissions'));
    } else if (error.status === 422) {
      console.error(chalk.yellow('   Repository name conflicts or validation failed'));
    }
    process.exit(1);
  }
}

createRepository();
