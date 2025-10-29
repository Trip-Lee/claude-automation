# Error Handling Guide

**Version**: v0.13.0
**Date**: 2025-10-29
**Type**: Comprehensive Error Handling Implementation

---

## Overview

This guide documents the comprehensive error handling system implemented across the Claude Multi-Agent System. The system now provides early validation, clear error messages, and actionable guidance for users.

---

## Philosophy

**Fail Fast, Fail Clear**

1. **Validate early** - Check prerequisites before expensive operations
2. **Fail with context** - Explain what went wrong and why
3. **Provide solutions** - Tell users exactly how to fix the problem
4. **Prevent waste** - Don't execute expensive agent tasks if setup is wrong

---

## Error Handling Layers

### Layer 1: Configuration Validation (ConfigManager)

**When**: When loading project config
**Purpose**: Ensure config is valid before any operations

**Validations**:
- ✅ Required fields present (name, repo, base_branch, docker)
- ✅ Repo URL format correct (github.com/owner/repo or 'local')
- ✅ Docker image specified
- ✅ Base branch is non-empty string
- ✅ Memory/CPU formats valid (e.g., "4g", "512m")

**Error Examples**:

```
ERROR: Invalid repo URL: github.com/myrepo

Expected format:
  - github.com/owner/repo
  - https://github.com/owner/repo
  - 'local' (for local-only repositories without GitHub)

Update config at: ~/.claude-projects/myproject.yaml
```

### Layer 2: Pre-flight Checks (Orchestrator)

**When**: At start of `executeTask()` - BEFORE agents execute
**Purpose**: Validate GitHub setup to prevent wasted agent execution

**Validations**:
- ✅ Config loads successfully
- ✅ Docker is running
- ✅ GitHub repo format is valid (if not 'local')
- ✅ GitHub repository exists and is accessible

**Error Examples**:

```
ERROR: GitHub repository not found: github.com/user/myrepo

The repository either doesn't exist or you don't have access.

To fix this:
  1. Create the repository on GitHub
  2. Or run workflow mode: claude (includes repo creation)
  3. Or update config: ~/.claude-projects/myproject.yaml
```

**Impact**: **Prevents wasting 2-5 minutes and $0.05-$0.15** on agent execution when GitHub isn't set up correctly.

### Layer 3: Git Operations (GitManager)

**When**: When pushing branches to GitHub
**Purpose**: Ensure git remote is configured correctly

**Validations**:
- ✅ Git remote 'origin' exists before pushing
- ✅ Enhanced error messages for common push failures

**Error Examples**:

```
ERROR: Git remote 'origin' not configured for /home/user/projects/myproject

To fix this:
  1. Add remote: git remote add origin <repository-url>
  2. Or clone the repository instead of initializing locally

Repository URL should be from your GitHub repo.
```

```
ERROR: Failed to push feature-branch

This could be due to:
  - Network issues
  - Invalid credentials
  - Branch protection rules
  - Force push required (not recommended)

Original error: ...
```

### Layer 4: GitHub API Operations (GitHubClient)

**When**: During any GitHub API call
**Purpose**: Translate GitHub API errors into user-friendly messages

**Error Codes Handled**:

#### 401 Unauthorized
```
ERROR: GitHub authentication failed while trying to create pull request.

Your GITHUB_TOKEN is invalid or expired.

To fix this:
  1. Go to https://github.com/settings/tokens
  2. Generate a new token with 'repo' scope
  3. Update ~/.env with: GITHUB_TOKEN=your_new_token
```

#### 403 Forbidden
```
ERROR: GitHub access forbidden while trying to create pull request.

This could be due to:
  - Rate limit exceeded (wait 1 hour)
  - Insufficient token permissions (needs 'repo' scope)
  - Organization restrictions

Check your token at https://github.com/settings/tokens
```

#### 404 Not Found
```
ERROR: Resource not found while trying to create pull request.

The repository, branch, or resource doesn't exist or you don't have access.

Verify:
  - Repository exists on GitHub
  - You have access permissions
  - Repository URL is correct
```

#### 422 Validation Failed
```
ERROR: Validation failed while trying to create pull request.

GitHub rejected the request. This usually means:
  - PR already exists for this branch
  - Invalid data format
  - Branch protection rules violated

Original error: ...
```

#### 500/502/503 Server Errors
```
ERROR: GitHub server error while trying to create pull request.

GitHub is experiencing issues. Please:
  1. Wait a few minutes
  2. Check https://www.githubstatus.com/
  3. Retry your operation
```

---

## Error Flow Examples

### Example 1: Missing GitHub Repo (Caught Early)

**Without Pre-flight Checks** (OLD):
```
1. User runs: claude task myproject "Add feature"
2. Config loads ✓
3. Docker starts ✓
4. Agents execute for 3 minutes (~$0.10)
5. Code changes complete ✓
6. Try to create PR ✗ → "Repository not found"
7. User wasted 3 minutes and $0.10
```

**With Pre-flight Checks** (NEW):
```
1. User runs: claude task myproject "Add feature"
2. Config loads ✓
3. Docker check ✓
4. GitHub repo validation ✗ → FAIL IMMEDIATELY

ERROR: GitHub repository not found: github.com/user/myrepo

To fix this:
  1. Create the repository on GitHub
  2. Or run workflow mode: claude (includes repo creation)

5. Task stopped - NO TIME OR MONEY WASTED
```

**Savings**: 3 minutes, $0.10, user frustration

### Example 2: Invalid GitHub Token

**Error Message**:
```
ERROR: GitHub authentication failed while trying to check repository access.

Your GITHUB_TOKEN is invalid or expired.

To fix this:
  1. Go to https://github.com/settings/tokens
  2. Generate a new token with 'repo' scope
  3. Update ~/.env with: GITHUB_TOKEN=your_new_token
```

**User Action**: Follow steps 1-3, retry task

### Example 3: Git Remote Not Configured

**Error Message**:
```
ERROR: Git remote 'origin' not configured for /home/user/projects/myproject

To fix this:
  1. Add remote: git remote add origin https://github.com/user/myrepo.git
  2. Or clone the repository instead of initializing locally
```

**User Action**: Run `git remote add origin <url>`, retry

### Example 4: Rate Limited

**Error Message**:
```
ERROR: GitHub access forbidden while trying to create pull request.

This could be due to:
  - Rate limit exceeded (wait 1 hour)
  - Insufficient token permissions (needs 'repo' scope)
  - Organization restrictions

Check your token at https://github.com/settings/tokens
```

**User Action**: Wait 1 hour or check token permissions

---

## Error Prevention Checklist

Before running a task, the system automatically validates:

- [ ] Project config exists (`~/.claude-projects/<project>.yaml`)
- [ ] Config is valid YAML with required fields
- [ ] Repo URL format is correct
- [ ] Docker is running (`docker ps` succeeds)
- [ ] GitHub token is set (if using GitHub)
- [ ] GitHub repository exists (if not 'local')
- [ ] Git remote is configured (before push)

**If any check fails, task stops immediately with clear error message.**

---

## Common Error Scenarios & Solutions

### Scenario 1: "Project configuration not found"

**Error**:
```
ERROR: Project configuration not found: ~/.claude-projects/myproject.yaml
Create it with: claude add-project myproject
```

**Solution**:
```bash
# Option 1: Interactive workflow (recommended)
claude

# Option 2: Command line
claude add-project myproject
```

### Scenario 2: "GitHub repository not found"

**Error**:
```
ERROR: GitHub repository not found: github.com/user/myrepo

To fix this:
  1. Create the repository on GitHub
  2. Or run workflow mode: claude (includes repo creation)
```

**Solution**:
```bash
# Option 1: Workflow mode (creates repo for you)
claude

# Option 2: Create manually on github.com, then:
git remote add origin https://github.com/user/myrepo.git
git push -u origin main
```

### Scenario 3: "Git remote 'origin' not configured"

**Error**:
```
ERROR: Git remote 'origin' not configured for /path/to/project
```

**Solution**:
```bash
cd /path/to/project
git remote add origin https://github.com/user/myrepo.git
```

### Scenario 4: "GitHub authentication failed"

**Error**:
```
ERROR: Your GITHUB_TOKEN is invalid or expired.
```

**Solution**:
```bash
# 1. Generate new token at https://github.com/settings/tokens
# 2. Update ~/.env
echo "GITHUB_TOKEN=ghp_your_new_token_here" >> ~/.env

# 3. Retry task
claude task myproject "Add feature"
```

### Scenario 5: "Invalid repo URL"

**Error**:
```
ERROR: Invalid repo URL: myrepo

Expected format:
  - github.com/owner/repo
  - https://github.com/owner/repo
```

**Solution**:
```bash
# Edit config
nano ~/.claude-projects/myproject.yaml

# Fix repo URL to:
repo: github.com/username/myrepo
```

---

## Implementation Details

### Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `lib/orchestrator.js` | +30 lines | Pre-flight GitHub validation |
| `lib/git-manager.js` | +50 lines | Remote validation, enhanced push errors |
| `lib/github-client.js` | +90 lines | Centralized error enhancement |
| `lib/config-manager.js` | +15 lines | Better repo URL validation |

**Total**: ~185 lines of error handling code

### Key Methods Added

**GitManager**:
- `hasRemote(projectPath, remoteName)` - Check if git remote exists
- `getRemoteUrl(projectPath, remoteName)` - Get remote URL

**GitHubClient**:
- `_enhanceGitHubError(error, operation)` - Centralized error enhancement
  - Maps status codes to user-friendly messages
  - Provides actionable solutions

**ConfigManager**:
- Enhanced `isValidRepoUrl()` - Now handles 'local' and SSH URLs

### Error Enhancement Strategy

All GitHub API errors go through `_enhanceGitHubError()`:

```javascript
// Before
throw new Error(`Failed to create PR: ${error.message}`);

// After
throw this._enhanceGitHubError(error, 'create pull request');
```

**Result**: User sees actionable error with solutions instead of cryptic API error.

---

## Testing Error Scenarios

### Manual Testing Checklist

**Config Errors**:
- [ ] Test missing config file
- [ ] Test invalid repo URL format
- [ ] Test missing required fields

**GitHub Errors**:
- [ ] Test with invalid token (401)
- [ ] Test with repo that doesn't exist (404)
- [ ] Test without token set (should skip GitHub)

**Git Errors**:
- [ ] Test pushing without remote configured
- [ ] Test with network disconnected

**Pre-flight Errors**:
- [ ] Test with Docker not running
- [ ] Test with repo not accessible

### Test Commands

```bash
# Test 1: Missing config
claude task nonexistent "Add feature"
# Expected: "Project configuration not found"

# Test 2: Invalid token
echo "GITHUB_TOKEN=invalid" > ~/.env
claude task myproject "Add feature"
# Expected: "GitHub authentication failed"

# Test 3: No remote
mkdir test-no-remote && cd test-no-remote
git init
# Create config pointing to this
claude task test-no-remote "Add feature"
# Expected: "Git remote 'origin' not configured"

# Test 4: Repo doesn't exist
# Edit config to point to non-existent repo
claude task myproject "Add feature"
# Expected: "GitHub repository not found"
```

---

## Benefits Summary

### Before (Without Comprehensive Error Handling)

| Issue | Impact |
|-------|--------|
| No pre-flight checks | Wasted 2-5 min + $0.05-$0.15 per failed task |
| Cryptic error messages | Users frustrated, can't fix problems |
| No remote validation | Push fails late in workflow |
| Generic GitHub errors | "Failed to create PR" - no solution provided |

### After (With Comprehensive Error Handling)

| Improvement | Impact |
|-------------|--------|
| Pre-flight validation | **Saves 2-5 min + $0.05-$0.15 per failed task** |
| Clear error messages | Users understand problems immediately |
| Early remote check | Fails fast before expensive operations |
| Actionable solutions | Every error tells user exactly how to fix it |

**Estimated Savings**:
- **Time**: 10-20 minutes saved per day (5-10 failed tasks × 2-5 min each)
- **Cost**: $0.25-$1.50 saved per day (5-10 failed tasks × $0.05-$0.15 each)
- **Frustration**: Significantly reduced user frustration

---

## Future Enhancements

**Not yet implemented** (but planned):

1. **Network connectivity check** - Verify GitHub is reachable before operations
2. **Token permission validation** - Check token has 'repo' scope upfront
3. **Branch protection check** - Warn if branch has protection rules
4. **Disk space check** - Ensure enough space for Docker operations
5. **Memory check** - Warn if Docker memory is set too low

---

## Rollback Plan

If comprehensive error handling causes issues:

1. **Revert orchestrator.js lines 77-107** - Remove pre-flight GitHub validation
2. **Revert git-manager.js lines 198-270** - Remove remote validation
3. **Revert github-client.js _enhanceGitHubError()** - Use simple error messages
4. **Revert config-manager.js validation** - Use basic validation

All changes are localized and easy to revert.

---

## Version History

**v0.13.0 (2025-10-29)**: Comprehensive error handling implementation
- Pre-flight GitHub validation
- Git remote validation
- Enhanced GitHub API errors
- Better config validation

**Previous**: Basic error handling with generic messages

---

**Implemented by**: Claude (Automation Assistant)
**Date**: 2025-10-29
**Status**: ✅ Complete
