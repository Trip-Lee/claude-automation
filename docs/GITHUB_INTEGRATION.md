# GitHub Integration Architecture

Complete documentation for GitHub integration in the Claude Multi-Agent System.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication Process](#authentication-process)
4. [Repository Management](#repository-management)
5. [Pull Request Workflow](#pull-request-workflow)
6. [Branch Operations](#branch-operations)
7. [Error Handling](#error-handling)
8. [API Rate Limits](#api-rate-limits)
9. [Security Best Practices](#security-best-practices)
10. [Process Diagrams](#process-diagrams)
11. [Common Workflows](#common-workflows)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The GitHub integration enables the Claude Multi-Agent System to:

- **Create and manage repositories** on GitHub
- **Push code changes** to remote repositories
- **Create pull requests** for code review
- **Manage PR lifecycle** (update, comment, merge, close)
- **Validate repository access** and permissions
- **Track repository status** and sync state

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **GitHubClient** | GitHub API integration | `lib/github-client.js` |
| **GitManager** | Local git operations | `lib/git-manager.js` |
| **setup-github.sh** | Automated repository setup | Root directory |
| **create-github-repo.js** | Programmatic repo creation | Root directory |

---

## Architecture

### Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                     Orchestrator Agent                       │
│              (Coordinates multi-agent tasks)                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Initiates GitHub operations
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      GitHubClient                            │
│  - Pull request management                                   │
│  - Repository creation                                       │
│  - Branch operations                                         │
│  - Authentication handling                                   │
└───────────┬─────────────────────────┬───────────────────────┘
            │                         │
            │ Uses                    │ Uses
            ▼                         ▼
┌───────────────────────┐   ┌─────────────────────────────────┐
│     GitManager        │   │      Octokit REST API           │
│  - Local git ops      │   │  - GitHub API calls             │
│  - Branch creation    │   │  - Authentication               │
│  - Commits            │   │  - Rate limiting                │
│  - Push/pull          │   │  - Error handling               │
└───────────────────────┘   └─────────────────────────────────┘
```

### Data Flow

```
User Request
    │
    ▼
Orchestrator Agent
    │
    ├──> Create feature branch (GitManager)
    │
    ├──> Make code changes (File operations)
    │
    ├──> Commit changes (GitManager)
    │
    ├──> Push branch (GitHubClient + GitManager)
    │
    ├──> Create PR (GitHubClient + Octokit)
    │
    └──> Return PR URL to user
```

---

## Authentication Process

### Method 1: GitHub CLI (Recommended)

**Process Flow:**

```
1. User runs: gh auth login
   │
   ├──> GitHub CLI prompts for authentication method
   │    - GitHub.com or Enterprise
   │    - HTTPS or SSH
   │    - Browser-based authentication
   │
   ├──> User completes browser authentication
   │
   ├──> GitHub CLI stores credentials securely
   │    Location: ~/.config/gh/hosts.yml
   │
   └──> Token automatically available to git operations
```

**Advantages:**
- Secure credential storage
- Automatic token rotation
- Works with 2FA
- No manual token management
- Integrated with git commands

**Command:**
```bash
gh auth login
```

**Validation:**
```bash
gh auth status
# Output: Logged in to github.com as <username>
```

---

### Method 2: Personal Access Token

**Process Flow:**

```
1. User visits GitHub Settings
   URL: https://github.com/settings/tokens
   │
   ├──> Click "Generate new token (classic)"
   │
   ├──> Configure token settings:
   │    - Note: "claude-automation"
   │    - Expiration: 90 days (or custom)
   │    - Scopes: Select required permissions
   │
   ├──> Generate token
   │    Format: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   │
   ├──> Copy token (only shown once!)
   │
   └──> Add to ~/.env file
        GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Required Scopes:**

| Scope | Purpose | Required For |
|-------|---------|--------------|
| `repo` | Full repository access | Private and public repos |
| `public_repo` | Public repository access | Public repos only |
| `workflow` | GitHub Actions | CI/CD automation |
| `read:org` | Organization info | Org repositories |

**Token Security:**
- Never commit tokens to git
- Store in `~/.env` (excluded by .gitignore)
- Rotate tokens every 90 days
- Use minimum required scopes
- Revoke unused tokens immediately

---

## Repository Management

### Creating a Repository

**Three Methods Available:**

#### 1. Automated Script (Recommended)

```bash
./setup-github.sh
```

**Process:**
```
1. Check GitHub CLI installation
   │
   ├──> If installed: Continue
   └──> If not: Display installation instructions

2. Verify authentication
   │
   ├──> If authenticated: Continue
   └──> If not: Prompt for gh auth login

3. Create repository
   │
   ├──> gh repo create claude-automation
   │    --public
   │    --description "..."
   │    --source=.
   │    --remote=origin
   │    --push
   │
   ├──> Repository created on GitHub
   │
   ├──> Local remote configured
   │
   └──> Code pushed to GitHub

4. Open repository in browser
   gh repo view --web
```

---

#### 2. Programmatic Creation

```bash
node create-github-repo.js
```

**Process:**
```
1. Load GITHUB_TOKEN from ~/.env
   │
   ├──> If missing: Exit with error
   └──> If present: Continue

2. Initialize Octokit client
   new Octokit({ auth: token })

3. Check if repository exists
   │
   ├──> GET /repos/:owner/:repo
   │
   ├──> If 200: Repository exists, skip creation
   └──> If 404: Repository doesn't exist, continue

4. Create repository
   │
   ├──> POST /user/repos
   │    {
   │      name: "claude-automation",
   │      description: "...",
   │      private: false,
   │      auto_init: false,
   │      has_issues: true,
   │      has_projects: true,
   │      has_wiki: true
   │    }
   │
   └──> Display clone URL and next steps

5. User adds remote manually
   git remote add origin <url>
   git push -u origin master
```

---

#### 3. Using GitHubClient Class

```javascript
import { GitHubClient } from './lib/github-client.js';

const client = new GitHubClient(process.env.GITHUB_TOKEN);

const repo = await client.createRepository({
  name: 'my-project',
  description: 'Project description',
  private: false,
  autoInit: false
});

console.log(`Repository created: ${repo.url}`);
```

**Process:**
```
1. Validate token exists
   │
   ├──> If missing: Throw error
   └──> If present: Continue

2. Call GitHub API
   octokit.rest.repos.createForAuthenticatedUser()

3. Handle response
   │
   ├──> Success (201): Return repository details
   │
   ├──> Already exists (422): Throw descriptive error
   │
   └──> Other errors: Throw with status code
```

---

### Repository Configuration

**Default Settings:**

```javascript
{
  visibility: 'public',      // or 'private'
  auto_init: false,          // Don't create README (we have code)
  has_issues: true,          // Enable issue tracking
  has_projects: true,        // Enable project boards
  has_wiki: false,           // Disable wiki (use docs/ instead)
  allow_squash_merge: true,  // Allow squash merging
  allow_merge_commit: true,  // Allow merge commits
  allow_rebase_merge: true,  // Allow rebase merging
  delete_branch_on_merge: true, // Auto-delete branches after merge
  default_branch: 'main'     // Default branch name
}
```

---

## Pull Request Workflow

### Complete PR Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│                    PR Lifecycle Stages                        │
└──────────────────────────────────────────────────────────────┘

1. CREATION
   ├──> Create feature branch
   ├──> Make code changes
   ├──> Commit changes
   ├──> Push branch to GitHub
   └──> Create PR via API

2. REVIEW
   ├──> Add comments
   ├──> Request changes
   ├──> Update PR description
   └──> Add reviewers

3. UPDATES
   ├──> Push additional commits
   ├──> Respond to comments
   └──> Update PR status

4. COMPLETION
   ├──> Merge PR (squash/merge/rebase)
   ├──> Delete feature branch
   └──> Close PR
```

---

### Creating a Pull Request

**Full Process:**

```javascript
// STEP 1: Create and switch to feature branch
await gitManager.createBranch(projectPath, 'feature/new-feature');

// STEP 2: Make code changes
// (File editing happens here)

// STEP 3: Commit changes
await gitManager.commit(projectPath, 'Add new feature');

// STEP 4: Push branch to GitHub
await githubClient.pushBranch(projectPath, 'feature/new-feature');

// STEP 5: Create pull request
const pr = await githubClient.createPullRequest({
  repo: 'github.com/owner/project',
  title: 'feat: Add new feature',
  branch: 'feature/new-feature',
  baseBranch: 'main',
  body: `
## Summary
Description of changes

## Test Plan
- [x] Unit tests pass
- [x] Integration tests pass
- [ ] Manual testing required

## Related Issues
Closes #123
  `
});

console.log(`PR created: ${pr.url}`);
```

**API Flow:**

```
1. pushBranch()
   │
   ├──> GitManager.push(projectPath, branchName, true)
   │    Executes: git push -u origin feature/new-feature
   │
   ├──> Sets upstream tracking
   │
   └──> Returns push output

2. createPullRequest()
   │
   ├──> Parse repository URL
   │    "github.com/owner/repo" → ["owner", "repo"]
   │
   ├──> Call GitHub API
   │    POST /repos/:owner/:repo/pulls
   │    {
   │      title: "feat: Add new feature",
   │      head: "feature/new-feature",
   │      base: "main",
   │      body: "## Summary\n...",
   │      maintainer_can_modify: true
   │    }
   │
   ├──> Handle response
   │    Success (201): Return PR details
   │    │
   │    ├──> PR number
   │    ├──> PR URL
   │    ├──> PR ID
   │    └──> State (open/closed/merged)
   │
   └──> Handle errors
        422: Check for existing PR
        │
        ├──> Call findExistingPR()
        ├──> Return existing PR if found
        └──> Throw error if not found
```

---

### PR Operations

#### Update PR Description

```javascript
await githubClient.updatePullRequest({
  repo: 'github.com/owner/project',
  prNumber: 42,
  title: 'Updated title',
  body: 'Updated description'
});
```

**Process:**
- Validates PR exists
- Updates title and/or body
- Preserves existing metadata
- Triggers GitHub notifications

---

#### Add Comment

```javascript
await githubClient.addComment({
  repo: 'github.com/owner/project',
  prNumber: 42,
  body: 'Automated code review notes:\n- All tests passing\n- Code coverage: 95%'
});
```

**Use Cases:**
- Automated code review results
- CI/CD status updates
- Bot notifications
- Review feedback

---

#### Check PR Status

```javascript
const status = await githubClient.getPRStatus({
  repo: 'github.com/owner/project',
  prNumber: 42
});

console.log(status);
// {
//   number: 42,
//   state: 'open',
//   merged: false,
//   mergeable: true,
//   url: 'https://github.com/owner/project/pull/42'
// }
```

**Status Fields:**
- `state`: 'open', 'closed', or 'merged'
- `merged`: Boolean indicating if PR was merged
- `mergeable`: Boolean indicating if PR can be merged
- `mergeable_state`: Detailed mergeability status

---

#### Merge Pull Request

```javascript
await githubClient.mergePullRequest({
  repo: 'github.com/owner/project',
  prNumber: 42,
  mergeMethod: 'squash'  // or 'merge', 'rebase'
});
```

**Merge Strategies:**

1. **Squash** (Default, Recommended)
   ```
   Before: A - B - C - D - E - F - G
                       ↑
                    feature branch (E, F, G)

   After:  A - B - C - D - H
                           ↑
                        squashed commit
   ```
   - Combines all commits into one
   - Clean, linear history
   - Preserves full history in PR
   - Best for: Feature branches

2. **Merge** (Standard Merge Commit)
   ```
   Before: A - B - C - D
                \       \
                 E - F - G

   After:  A - B - C - D - M
                \         /
                 E - F - G
                           ↑
                     merge commit
   ```
   - Creates merge commit
   - Preserves all individual commits
   - Shows merge points in history
   - Best for: Release branches

3. **Rebase** (Linear History)
   ```
   Before: A - B - C - D
                \
                 E - F - G

   After:  A - B - C - D - E' - F' - G'
                               ↑
                         rebased commits
   ```
   - Replays commits on base branch
   - No merge commit
   - Clean linear history
   - Best for: Small PRs

**Merge Requirements:**
- PR state must be 'open'
- All required checks must pass
- No merge conflicts
- Required approvals obtained
- Branch up to date with base

---

## Branch Operations

### Push with Upstream Tracking

```javascript
await githubClient.pushBranch(projectPath, branchName);
```

**What This Does:**

```bash
# Equivalent git command:
git push -u origin feature/new-feature
```

**Upstream Tracking Benefits:**

1. **Simplified Push/Pull:**
   ```bash
   # Without tracking:
   git push origin feature/new-feature
   git pull origin feature/new-feature

   # With tracking:
   git push
   git pull
   ```

2. **Status Information:**
   ```bash
   git status
   # Shows: Your branch is ahead of 'origin/feature' by 2 commits
   ```

3. **Automatic Remote:**
   ```bash
   git branch -vv
   # Shows: feature/new-feature abc1234 [origin/feature/new-feature] Commit message
   ```

---

### Branch Strategy

**Recommended Workflow:**

```
main (production)
 │
 ├── feature/user-auth      (new feature)
 ├── fix/bug-123            (bug fix)
 ├── refactor/database      (refactoring)
 └── release/v1.2.0         (release branch)
```

**Branch Naming Conventions:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions/updates
- `chore/description` - Maintenance tasks

---

## Error Handling

### Common Errors and Solutions

#### 1. Authentication Errors (401)

**Error:**
```
Error: Failed to create PR: Request failed with status code 401
```

**Cause:**
- Invalid or expired GitHub token
- Token lacks required permissions
- Token revoked

**Solution:**
```bash
# Check token validity
gh auth status

# Re-authenticate
gh auth login

# Or generate new token
# 1. Visit https://github.com/settings/tokens
# 2. Generate new token with 'repo' scope
# 3. Update ~/.env
```

---

#### 2. Repository Not Found (404)

**Error:**
```
Error: Failed to create PR: Not Found
```

**Cause:**
- Repository doesn't exist
- Incorrect repository URL
- Insufficient access permissions
- Repository is private and token lacks access

**Solution:**
```javascript
// Validate repository access
const hasAccess = await githubClient.checkRepoAccess(repo);
if (!hasAccess) {
  console.error('Repository not found or insufficient permissions');
}
```

---

#### 3. Validation Failed (422)

**Error:**
```
Error: Validation Failed
```

**Common Causes:**

| Scenario | Error | Solution |
|----------|-------|----------|
| PR already exists | Duplicate PR | Use findExistingPR() |
| Branch doesn't exist | Invalid head | Push branch first |
| Base branch invalid | Invalid base | Verify base branch name |
| No commits | Empty PR | Add commits to branch |

**Auto-Recovery:**
```javascript
// createPullRequest automatically handles duplicate PRs
try {
  const pr = await createPullRequest({ ... });
} catch (error) {
  if (error.status === 422) {
    // Automatically checks for existing PR
    // Returns existing PR if found
  }
}
```

---

#### 4. Rate Limit Exceeded (403)

**Error:**
```
Error: API rate limit exceeded
```

**Rate Limits:**
- **Authenticated:** 5,000 requests/hour
- **Unauthenticated:** 60 requests/hour
- **Search API:** 30 requests/minute

**Check Rate Limit:**
```javascript
const response = await octokit.rest.rateLimit.get();
console.log(response.data.rate);
// {
//   limit: 5000,
//   remaining: 4999,
//   reset: 1234567890
// }
```

**Solutions:**
- Wait until reset time
- Use conditional requests (ETags)
- Implement request caching
- Batch operations when possible

---

## API Rate Limits

### Monitoring Rate Limits

```javascript
// Check current rate limit status
async function checkRateLimit() {
  const { data } = await octokit.rest.rateLimit.get();

  console.log(`Limit: ${data.rate.limit}`);
  console.log(`Remaining: ${data.rate.remaining}`);
  console.log(`Resets: ${new Date(data.rate.reset * 1000)}`);

  if (data.rate.remaining < 100) {
    console.warn('⚠️  Approaching rate limit!');
  }
}
```

### Best Practices

1. **Cache Responses:**
   ```javascript
   // Use ETags for conditional requests
   const response = await octokit.request('GET /repos/:owner/:repo', {
     headers: {
       'If-None-Match': lastETag
     }
   });
   // Returns 304 if unchanged (doesn't count against limit)
   ```

2. **Batch Operations:**
   ```javascript
   // Instead of multiple single requests
   const prs = await octokit.rest.pulls.list({
     per_page: 100  // Get 100 PRs in one request
   });
   ```

3. **Use Webhooks:**
   - Receive events instead of polling
   - Doesn't count against rate limit
   - Real-time updates

---

## Security Best Practices

### Token Management

**DO:**
- ✅ Store tokens in `~/.env` (gitignored)
- ✅ Use minimum required scopes
- ✅ Rotate tokens every 90 days
- ✅ Revoke tokens when not needed
- ✅ Use GitHub CLI when possible

**DON'T:**
- ❌ Commit tokens to git
- ❌ Share tokens between users
- ❌ Use tokens with excessive permissions
- ❌ Store tokens in code
- ❌ Log tokens in output

---

### Repository Security

**Branch Protection:**
```
Settings → Branches → Add rule

✅ Require pull request reviews before merging
✅ Require status checks to pass
✅ Require branches to be up to date
✅ Include administrators
✅ Restrict who can push
```

**Secrets Management:**
```bash
# Add to .gitignore
.env
.env.*
*.key
*.pem
credentials.json
secrets/

# Verify not tracked
git ls-files | grep -E '\.(env|key|pem)$'
# Should return nothing
```

---

## Process Diagrams

### Complete GitHub Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                      │
└─────────────────────────────────────────────────────────────┘

1. SETUP PHASE
   │
   ├──> Authenticate with GitHub
   │    gh auth login OR set GITHUB_TOKEN
   │
   ├──> Create repository (if needed)
   │    ./setup-github.sh OR node create-github-repo.js
   │
   └──> Clone or initialize local repo
        git clone <url> OR git init

2. DEVELOPMENT PHASE
   │
   ├──> Create feature branch
   │    git checkout -b feature/new-feature
   │
   ├──> Make code changes
   │    Edit files, add features
   │
   ├──> Commit changes
   │    git add .
   │    git commit -m "Add new feature"
   │
   └──> Push branch
        git push -u origin feature/new-feature

3. REVIEW PHASE
   │
   ├──> Create pull request
   │    githubClient.createPullRequest()
   │
   ├──> Automated checks run
   │    CI/CD, tests, linting
   │
   ├──> Code review
   │    Team reviews changes
   │
   └──> Address feedback
        Make changes, push updates

4. MERGE PHASE
   │
   ├──> All checks pass
   │    Tests, reviews, approvals
   │
   ├──> Merge pull request
   │    githubClient.mergePullRequest()
   │
   ├──> Delete feature branch
   │    git branch -d feature/new-feature
   │
   └──> Pull latest changes
        git checkout main
        git pull
```

---

## Common Workflows

### Workflow 1: Create Repository and Push Code

```bash
# 1. Authenticate
gh auth login

# 2. Initialize local repository (if not done)
git init
git add .
git commit -m "Initial commit"

# 3. Create GitHub repository and push
./setup-github.sh

# Result: Repository created, code pushed, browser opened
```

---

### Workflow 2: Create Pull Request

```javascript
import { GitHubClient } from './lib/github-client.js';
import { GitManager } from './lib/git-manager.js';

const githubClient = new GitHubClient(process.env.GITHUB_TOKEN);
const gitManager = new GitManager();

const projectPath = '/path/to/project';
const branchName = 'feature/new-feature';

// 1. Create and switch to branch
await gitManager.createBranch(projectPath, branchName);

// 2. Make changes and commit
// (code changes happen here)
await gitManager.commit(projectPath, 'Add new feature');

// 3. Push branch
await githubClient.pushBranch(projectPath, branchName);

// 4. Create PR
const pr = await githubClient.createPullRequest({
  repo: 'github.com/owner/project',
  title: 'feat: Add new feature',
  branch: branchName,
  baseBranch: 'main',
  body: '## Summary\nAdds new feature\n\n## Test Plan\n- [x] Tests pass'
});

console.log(`PR created: ${pr.url}`);
```

---

### Workflow 3: Merge PR After Review

```javascript
// 1. Check PR status
const status = await githubClient.getPRStatus({
  repo: 'github.com/owner/project',
  prNumber: 42
});

// 2. Verify mergeable
if (status.state === 'open' && status.mergeable) {

  // 3. Merge with squash strategy
  await githubClient.mergePullRequest({
    repo: 'github.com/owner/project',
    prNumber: 42,
    mergeMethod: 'squash'
  });

  console.log('✅ PR merged successfully');

} else {
  console.log('⚠️  PR not ready to merge');
  console.log(`State: ${status.state}`);
  console.log(`Mergeable: ${status.mergeable}`);
}
```

---

## Troubleshooting

### Issue: "remote origin already exists"

**Error:**
```
fatal: remote origin already exists
```

**Solution:**
```bash
# Check existing remote
git remote -v

# Remove existing remote
git remote remove origin

# Add new remote
git remote add origin <url>

# Or update existing remote
git remote set-url origin <url>
```

---

### Issue: "Authentication failed"

**Error:**
```
remote: Invalid username or password
fatal: Authentication failed
```

**Solution:**
```bash
# Option 1: Re-authenticate with GitHub CLI
gh auth login

# Option 2: Update personal access token
# 1. Generate new token at https://github.com/settings/tokens
# 2. Update ~/.env
echo "GITHUB_TOKEN=ghp_your_new_token" >> ~/.env

# Option 3: Use SSH instead of HTTPS
git remote set-url origin git@github.com:owner/repo.git
```

---

### Issue: "Branch not found on remote"

**Error:**
```
Error: Reference does not exist
```

**Solution:**
```bash
# Push branch first
git push -u origin feature/branch-name

# Then create PR
```

---

### Issue: "Merge conflicts"

**Error:**
```
Error: Merge conflict detected
```

**Solution:**
```bash
# 1. Update branch with latest base
git checkout feature/branch-name
git fetch origin
git merge origin/main

# 2. Resolve conflicts
# Edit conflicting files

# 3. Mark as resolved
git add .
git commit -m "Resolve merge conflicts"

# 4. Push updated branch
git push

# 5. PR should now be mergeable
```

---

## Related Documentation

- **GitHub Setup Guide:** [`GITHUB_SETUP.md`](./GITHUB_SETUP.md)
- **Repository Status:** [`../GITHUB_STATUS.md`](../GITHUB_STATUS.md)
- **GitHubClient API:** [`../lib/github-client.js`](../lib/github-client.js)
- **Setup Script:** [`../setup-github.sh`](../setup-github.sh)

---

**Last Updated:** 2025-01-09
**Version:** 1.0.0
**Maintained By:** Claude Multi-Agent System
