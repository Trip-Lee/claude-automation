# Comprehensive Test Plan - v0.13.0

**Date**: 2025-10-29
**Features to Test**:
1. Auto-PR creation workflow
2. Comprehensive error handling
3. Edge cases and error scenarios

---

## Test Categories

### Category 1: Pre-flight Validation
### Category 2: Git Remote Validation
### Category 3: Config Validation
### Category 4: GitHub API Errors
### Category 5: Approval Workflow
### Category 6: Edge Cases

---

## Category 1: Pre-flight Validation Tests

### Test 1.1: Missing GitHub Repo (Should fail fast)
**Setup**: Create config pointing to non-existent repo
**Expected**: Fail immediately with "Repository not found"
**Cost**: $0 (no agent execution)
**Time**: <5 seconds

### Test 1.2: Invalid GitHub Token
**Setup**: Set GITHUB_TOKEN to invalid value
**Expected**: Fail with "Authentication failed" + fix instructions
**Cost**: $0
**Time**: <5 seconds

### Test 1.3: Local-only Project (Should skip GitHub validation)
**Setup**: Config with `repo: 'local'`
**Expected**: Skip GitHub validation, execute normally
**Cost**: Normal task cost
**Time**: Normal task time

### Test 1.4: GitHub Rate Limited
**Setup**: Make many API calls to trigger rate limit
**Expected**: Clear message about rate limit + wait time
**Cost**: $0
**Time**: <5 seconds

---

## Category 2: Git Remote Validation Tests

### Test 2.1: No Git Remote (Should fail at push)
**Setup**: Git repo without remote configured
**Expected**: Fail with "Git remote 'origin' not configured" + fix instructions
**Cost**: Normal task cost (fails after agents complete)
**Time**: Normal task time + instant fail at push

### Test 2.2: Git Remote Exists (Should succeed)
**Setup**: Git repo with proper remote
**Expected**: Push succeeds, PR created
**Cost**: Normal task cost
**Time**: Normal task time

### Test 2.3: Wrong Remote URL
**Setup**: Remote points to wrong repo
**Expected**: Push fails with helpful error
**Cost**: Normal task cost
**Time**: Normal task time + fail at push

---

## Category 3: Config Validation Tests

### Test 3.1: Invalid Repo Format - No Owner
**Setup**: Config with `repo: "myrepo"` (no owner)
**Expected**: Fail at config load with format error
**Cost**: $0
**Time**: Instant

### Test 3.2: Invalid Repo Format - Wrong Domain
**Setup**: Config with `repo: "gitlab.com/user/repo"`
**Expected**: Fail at config load with format error
**Cost**: $0
**Time**: Instant

### Test 3.3: SSH Format Repo URL
**Setup**: Config with `repo: "git@github.com:user/repo.git"`
**Expected**: Accept and work correctly
**Cost**: Normal
**Time**: Normal

### Test 3.4: HTTPS Format with .git
**Setup**: Config with `repo: "https://github.com/user/repo.git"`
**Expected**: Accept and work correctly
**Cost**: Normal
**Time**: Normal

### Test 3.5: Local-only Repo
**Setup**: Config with `repo: "local"`
**Expected**: Skip GitHub operations, no PR creation
**Cost**: Normal task cost
**Time**: Normal task time

### Test 3.6: Missing Required Fields
**Setup**: Config missing `docker.image`
**Expected**: Fail at config load with clear error
**Cost**: $0
**Time**: Instant

---

## Category 4: GitHub API Error Tests

### Test 4.1: 404 - Repo Not Found
**Setup**: Valid config but repo deleted on GitHub
**Expected**: Fail with "Repository not found" + verification steps
**Cost**: $0 (pre-flight check)
**Time**: <5 seconds

### Test 4.2: 422 - PR Already Exists
**Setup**: Create PR manually, then run task with same branch
**Expected**: Find existing PR, return it (no error)
**Cost**: Normal task cost
**Time**: Normal task time

### Test 4.3: 403 - Insufficient Permissions
**Setup**: Token without 'repo' scope
**Expected**: Fail with "Insufficient permissions" + fix instructions
**Cost**: $0 (pre-flight check)
**Time**: <5 seconds

---

## Category 5: Approval Workflow Tests

### Test 5.1: Happy Path - PR Auto-Created
**Setup**: Valid config, repo exists, task completes successfully
**Expected**:
- Task completes
- Branch pushed
- PR created automatically
- PR URL displayed
**Cost**: Normal task cost
**Time**: Normal task time + 5-10s for PR creation

### Test 5.2: PR Creation Fails (Network Issue)
**Setup**: Disconnect network during PR creation
**Expected**:
- Task completes
- PR creation fails gracefully
- Displays: "PR creation failed: <error>"
- Displays: "You can retry with: claude approve <taskId>"
**Cost**: Normal task cost
**Time**: Normal task time + timeout

### Test 5.3: Manual PR Creation (Retry)
**Setup**: Task completed but PR creation failed
**Expected**:
- `claude approve <taskId>` creates PR
- Returns PR URL
**Cost**: $0 (no agent execution)
**Time**: <10 seconds

### Test 5.4: PR Already Exists (Duplicate Prevention)
**Setup**: Run `claude approve <taskId>` twice
**Expected**:
- First call creates PR
- Second call says "PR already exists: <url>"
**Cost**: $0
**Time**: <5 seconds

### Test 5.5: Workflow Mode - Auto PR
**Setup**: Run `claude` (workflow mode)
**Expected**:
- Task executes
- PR auto-created
- No approval prompt
- Displays PR URL
**Cost**: Normal task cost
**Time**: Normal task time

---

## Category 6: Edge Cases

### Test 6.1: Empty Repository (No Commits)
**Setup**: Brand new repo with no commits
**Expected**: May fail to create branch or PR (need to verify behavior)
**Risk**: High

### Test 6.2: Protected Branch
**Setup**: Base branch has protection rules
**Expected**: PR creation succeeds but merge may be restricted
**Risk**: Medium

### Test 6.3: Very Long Task Description
**Setup**: Description with 1000+ characters
**Expected**: PR created with full description (GitHub allows up to 65k)
**Risk**: Low

### Test 6.4: Special Characters in Branch Name
**Setup**: Task description with special chars (creates branch like `claude/<task-id>`)
**Expected**: Branch created successfully (task ID is sanitized)
**Risk**: Low

### Test 6.5: Docker Not Running
**Setup**: Stop Docker daemon
**Expected**: Fail with "Docker not running" error
**Cost**: $0
**Time**: <5 seconds

### Test 6.6: Out of Disk Space
**Setup**: Fill disk to near capacity
**Expected**: Docker or git operations fail (need graceful handling)
**Risk**: High

### Test 6.7: Project Directory Doesn't Exist
**Setup**: Config points to non-existent directory
**Expected**: Fail with "Project directory not found" error
**Cost**: $0
**Time**: <5 seconds

### Test 6.8: Concurrent Tasks (Same Project)
**Setup**: Run two tasks simultaneously on same project
**Expected**: Potential branch conflicts (need to verify behavior)
**Risk**: High

### Test 6.9: GitHub Down (500 errors)
**Setup**: GitHub experiencing outage
**Expected**: Fail with "GitHub server error" + status page link
**Cost**: $0 (pre-flight should catch it)
**Time**: <5 seconds or timeout

### Test 6.10: Task Interrupted (Ctrl+C During PR Creation)
**Setup**: Hit Ctrl+C while PR is being created
**Expected**:
- Container cleanup happens
- PR may or may not exist (check GitHub)
- Can retry with `claude approve <taskId>`
**Risk**: Medium

### Test 6.11: Malformed YAML Config
**Setup**: Config with invalid YAML syntax
**Expected**: Fail at config load with YAML parsing error
**Cost**: $0
**Time**: Instant

### Test 6.12: Config with Unicode Characters
**Setup**: Project name or description with emoji/unicode
**Expected**: Handle correctly or fail gracefully
**Risk**: Low

### Test 6.13: Very Large Repository (>1GB)
**Setup**: Project with large files
**Expected**: May hit Docker mount or resource limits
**Risk**: Medium

### Test 6.14: Binary Files Modified
**Setup**: Task modifies binary files (images, etc.)
**Expected**: Git handles correctly, PR shows binary changes
**Risk**: Low

### Test 6.15: No Network Connection
**Setup**: Disconnect network before task
**Expected**: Fail at GitHub validation or Docker pull
**Risk**: Medium

---

## Testing Approach

### Phase 1: Quick Validation Tests (30 mins)
Run tests that don't require agent execution:
- Config validation tests (3.1-3.6)
- Pre-flight validation tests (1.1-1.4)
- Edge cases: Docker not running (6.5), Missing directory (6.7)

### Phase 2: Git & GitHub Tests (20 mins)
Test git and GitHub operations:
- Git remote tests (2.1-2.3)
- GitHub API error tests (4.1-4.3)

### Phase 3: Full Workflow Tests (1 hour)
Run complete workflows with agent execution:
- Approval workflow tests (5.1-5.5)
- Edge cases: Empty repo (6.1), Protected branch (6.2)

### Phase 4: Stress & Edge Cases (30 mins)
Test unusual scenarios:
- Concurrent tasks (6.8)
- Interrupted tasks (6.10)
- Large repos (6.13)

---

## Success Criteria

### Must Pass (Critical)
- ✅ Pre-flight validation catches missing repos
- ✅ Invalid configs fail immediately
- ✅ Valid tasks auto-create PRs
- ✅ Error messages are clear and actionable
- ✅ No wasted agent execution on setup errors

### Should Pass (Important)
- ✅ Git remote validation catches missing remotes
- ✅ GitHub API errors are user-friendly
- ✅ Manual PR retry works
- ✅ Duplicate PR prevention works
- ✅ Container cleanup on interruption

### Nice to Have (Edge Cases)
- ⚠️ Concurrent tasks don't conflict
- ⚠️ Large repos work correctly
- ⚠️ Binary files handled properly
- ⚠️ Unicode characters work

---

## Test Execution Log

**Start Time**: TBD
**End Time**: TBD
**Total Tests**: 35+
**Passed**: TBD
**Failed**: TBD
**Blocked**: TBD

---

## Bug Tracking

### Bugs Found

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| - | - | - | - |

---

## Next Steps After Testing

1. Fix any critical bugs found
2. Document known issues/limitations
3. Update CHANGELOG.md for v0.13.0
4. Commit changes
5. Move to performance optimization

---

**Created by**: Claude (Testing Plan)
**Date**: 2025-10-29
**Status**: Ready for execution
