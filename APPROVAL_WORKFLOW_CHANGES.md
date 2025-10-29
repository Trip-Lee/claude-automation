# Approval Workflow Changes

**Date**: 2025-10-29
**Version**: v0.13.0 (proposed)
**Type**: Major workflow improvement

## Summary

Simplified the approval process by **auto-creating PRs** at task completion, eliminating the need for manual approval commands and providing full context in GitHub.

---

## The Problem (Before)

**Old Workflow:**
1. Task completes → saves as `status: 'pending_approval'`
2. CLI prompts: "Approve / Reject / Hold for Later Review"
3. If "Hold": User runs `claude approve <taskId>` later
4. **Problem**: When running `claude approve <taskId>` later, there's **no context** about what changed

**User Experience Issues:**
- Lost context when approving later
- Extra manual step required
- Can't easily review changes
- Approval happens in CLI, not where code review should happen (GitHub)

---

## The Solution (After)

**New Workflow:**
1. Task completes successfully
2. **Auto-push branch to GitHub**
3. **Auto-create PR immediately**
4. Display PR URL to user
5. User reviews/approves **in GitHub PR interface** (full context, line-by-line comments, merge button)

**Benefits:**
- ✅ Full context always available (in GitHub PR)
- ✅ No manual approval step needed
- ✅ Natural review workflow (GitHub PR interface)
- ✅ Line-by-line commenting
- ✅ CI/CD integration works
- ✅ Merge history tracked properly

---

## What Changed

### 1. Orchestrator (`lib/orchestrator.js`)

**In `executeTask()` method (lines 195-248):**
- Changed task status from `'pending_approval'` to `'completed'`
- Added Step 8: Auto-create PR after task completion
- Pushes branch to GitHub
- Creates PR with full description
- Saves PR URL in task data
- **Keeps container in `activeContainers` during PR creation** (ensures cleanup if user Ctrl+C's)
- Removes from tracking only after PR creation completes
- Gracefully handles PR creation failures (user can retry with `claude approve <taskId>`)

**In `approve()` method (lines 739-800):**
- Renamed to "Manually create PR" (not "Approve task")
- Now checks for `status: 'completed'` instead of `'pending_approval'`
- Checks if PR already exists (prevents duplicates)
- Used only when auto-PR creation failed

### 2. CLI Workflow (`cli.js`)

**In workflow mode (lines 757-774):**
- Removed "Approve / Reject / Hold" prompt
- Now displays PR URL immediately after task completes
- Simplified to: "Review and merge the PR in GitHub when ready"

**Command descriptions updated:**
- `claude approve <taskId>`: Now says "Manually create PR (use if auto-PR creation failed)"
- `claude reject <taskId>`: Now says "Reject task and delete branch (use to discard unwanted changes)"

---

## What If User Exits? (Ctrl+C Handling)

### Scenario 1: User Ctrl+C's During Task Execution
**When**: Before task completes
**What Happens**:
- SIGINT handler triggers
- `activeContainers` cleanup runs
- Container is removed
- Branch may be partially created
- **No PR is created** (task didn't complete)

**User Action**: Run task again or manually clean up branch

### Scenario 2: User Ctrl+C's During PR Creation
**When**: After task completes, during "Creating Pull Request..."
**What Happens**:
- Container is still in `activeContainers` (by design)
- SIGINT handler triggers
- Container is cleaned up properly
- **PR may or may not be created** (depends on timing)
  - If before push: No PR, branch is local only
  - If after push: Branch on GitHub, PR may be incomplete
  - If after PR creation: PR exists!

**User Action**: Check GitHub for PR, if not found run `claude approve <taskId>`

### Scenario 3: User Ctrl+C's After PR Creation
**When**: After "✅ PR Created!" message
**What Happens**:
- **PR already exists on GitHub**
- Container cleanup happens during SIGINT
- Display is interrupted
- Cleanup still runs (cleanup handlers registered)

**User Action**: Nothing needed! PR is created, check GitHub

### Scenario 4: Network Failure During PR Creation
**When**: GitHub is unreachable
**What Happens**:
- Task completes successfully (code is done)
- Branch created locally
- PR creation fails with error message
- **Displays**: "⚠️ PR creation failed: <error>"
- **Displays**: "You can create it manually with: claude approve <taskId>"
- Container is cleaned up normally

**User Action**: Fix network/GitHub, run `claude approve <taskId>`

### No More "Lost State" Problem!

**Before (OLD workflow):**
```
Task completes → status: 'pending_approval'
User selects "Hold" → No PR
Later: claude approve <taskId> → NO CONTEXT about changes!
```

**After (NEW workflow):**
```
Task completes → PR AUTO-CREATED → status: 'completed'
PR has FULL context (diff, description, tests)
User reviews in GitHub (all context preserved)
```

---

## Usage Examples

### Example 1: Normal Happy Path

```bash
# Run a task
claude task my-project "Add login feature"

# Task executes...
# ✅ Task Completed!
#
# Pull Request Created:
#   https://github.com/user/my-project/pull/123
#
# Review and merge the PR in GitHub when ready.
#
# Workflow Complete!
```

**What happens:**
- PR is auto-created
- User clicks link to GitHub
- Reviews changes in GitHub PR interface
- Merges when ready (or requests changes, adds comments, etc.)

### Example 2: PR Creation Failed (Network Issue)

```bash
# Run a task
claude task my-project "Add login feature"

# Task executes...
# ⚠️  PR creation failed: Network timeout
#    You can create it manually with: claude approve task-123
#
# ✅ Task Completed!
```

**What happens:**
- Task completed successfully
- Branch created locally
- PR creation failed (network, permissions, etc.)
- User can retry: `claude approve task-123`

### Example 3: No GitHub Configured

```bash
# Run a task (no GITHUB_TOKEN in .env)
claude task my-project "Add login feature"

# Task executes...
# ⚠️  GitHub not configured - skipping PR creation
#    Set GITHUB_TOKEN in .env to enable PR creation
#
# Branch created but PR not created automatically.
#   Branch: claude/task-123
#   Create PR manually: claude approve task-123
```

**What happens:**
- Task completes
- Branch created locally
- No PR created (GitHub not configured)
- User can configure GitHub and run `claude approve task-123`

### Example 4: Manually Retry PR Creation

```bash
# Auto-PR creation failed earlier
claude approve task-123

# 📤 Creating PR for Task: task-123
#
# 📤 Pushing branch to GitHub...
#   ✅ Branch pushed
#
# 📝 Creating pull request...
#
# ✅ PR Created: https://github.com/user/my-project/pull/124
```

### Example 5: Reject Unwanted Changes

```bash
# You don't want the changes
claude reject task-123

# ❌ Rejecting Task: task-123
#
# 🗑️  Deleting branch...
#   ✅ Branch deleted
#
# 🗑️  Removing container...
#   ✅ Container removed
#
# ✅ Task rejected and cleaned up
```

---

## Migration Notes

### For Existing Users

**No breaking changes** for most workflows:
- Tasks now auto-create PRs (better experience)
- `claude approve <taskId>` still works (for manual retry)
- `claude reject <taskId>` still works (for discarding changes)

**If you have tasks in `'pending_approval'` status:**
- They won't have PRs yet
- Run `claude approve <taskId>` to create PR manually
- This will fail with "Task is not completed" error
- **Workaround**: Edit task JSON to change status to `'completed'`, then run `approve`

**Recommended action:**
- Complete any pending tasks
- Start fresh with new workflow

---

## Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| **PR Creation** | Manual (`claude approve`) | **Automatic** |
| **Context** | Lost when approving later | **Always available in GitHub** |
| **Review Location** | CLI prompt | **GitHub PR interface** |
| **Line comments** | Not possible | **Full GitHub features** |
| **CI/CD integration** | After approval | **Immediate** |
| **Approval step** | Required | **Optional (just merge in GitHub)** |

---

## Technical Details

### Task Status Flow

**Before:**
```
executing → pending_approval → approved (PR created)
                             → rejected (branch deleted)
```

**After:**
```
executing → completed (PR auto-created)
         → failed (on error)
```

### PR Creation Logic

```javascript
// After task completes successfully:
if (githubClient) {
  try {
    // Push branch
    await githubClient.pushBranch(projectPath, branchName);

    // Create PR
    const pr = await githubClient.createPullRequest({...});

    // Save PR info
    taskData.prUrl = pr.url;
    await saveTaskData(taskData);

    console.log("✅ PR Created:", pr.url);
  } catch (error) {
    console.log("⚠️ PR creation failed:", error.message);
    console.log("You can retry with: claude approve", taskId);
  }
}
```

### Backward Compatibility

**`claude approve <taskId>`:**
- Still exists for manual PR creation
- Now checks `status === 'completed'` instead of `'pending_approval'`
- Checks if PR already exists (prevents duplicates)

**`claude reject <taskId>`:**
- Still exists for discarding unwanted changes
- Deletes branch and cleans up

---

## Testing Checklist

- [ ] Run simple task with GitHub configured
  - [ ] Verify PR is auto-created
  - [ ] Verify PR URL is displayed
  - [ ] Verify PR description is correct
  - [ ] Verify PR is mergeable in GitHub

- [ ] Run task without GitHub configured
  - [ ] Verify warning message is shown
  - [ ] Verify branch is created locally
  - [ ] Verify `claude approve <taskId>` creates PR

- [ ] Simulate PR creation failure
  - [ ] Disconnect network during PR creation
  - [ ] Verify graceful failure message
  - [ ] Verify `claude approve <taskId>` works

- [ ] Test `claude reject <taskId>`
  - [ ] Verify branch is deleted
  - [ ] Verify cleanup happens

- [ ] Test duplicate PR prevention
  - [ ] Run `claude approve <taskId>` on task with PR
  - [ ] Verify "PR already exists" message

---

## Documentation Updates Needed

- [ ] README.md - Update workflow section
- [ ] WORKFLOW_MODE_GUIDE.md - Remove approve/reject prompt
- [ ] CLI command help text - Already updated
- [ ] CHANGELOG.md - Add v0.13.0 entry

---

## Version

**Proposed Version**: v0.13.0
**Type**: Minor (workflow improvement, backward compatible)
**Date**: 2025-10-29

---

## Rollback Plan

If issues arise, rollback is simple:

1. Revert `lib/orchestrator.js` lines 175-254 to use `status: 'pending_approval'`
2. Revert `cli.js` lines 757-774 to show approve/reject/hold prompt
3. Revert `approve()` method to check `'pending_approval'` status

All changes are in 2 files, easy to revert.

---

**Implemented by**: Claude (Automation Assistant)
**Date**: 2025-10-29
**Status**: ✅ Implementation Complete, Testing Pending
